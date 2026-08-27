import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Schema from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { dirname, join } from "node:path";
import { dshHomePath } from "@deepseek-ai/dsh-home-paths";
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { zstdDecompressSync } from "node:zlib";
import { spawn, spawnSync } from "node:child_process";
/** 默认高峰时段窗口（官方口径：北京时间 9:00–12:00、14:00–18:00；其余为空闲）。 */
const DEFAULT_PEAK_WINDOWS = [{
	start: "09:00",
	end: "12:00"
}, {
	start: "14:00",
	end: "18:00"
}];
/** 内置默认完整价格配置。 */
const DEFAULT_PRICE_CONFIG = {
	tiers: [
		{
			id: "deepseek-v4-flash",
			name: "deepseek-v4-flash",
			currency: "CNY",
			match: "deepseek-v4-flash",
			peak: {
				input: 3,
				cacheRead: .1,
				cacheWrite: 0,
				output: 9
			},
			offPeak: {
				input: 1.5,
				cacheRead: .05,
				cacheWrite: 0,
				output: 4.5
			}
		},
		{
			id: "deepseek-v4-pro",
			name: "deepseek-v4-pro",
			currency: "CNY",
			match: "deepseek-v4-pro",
			peak: {
				input: 9,
				cacheRead: .3,
				cacheWrite: 0,
				output: 27
			},
			offPeak: {
				input: 4.5,
				cacheRead: .15,
				cacheWrite: 0,
				output: 13.5
			}
		},
		{
			id: "deepseek-v4-flash-vision-exp",
			name: "deepseek-v4-flash-vision-exp",
			currency: "CNY",
			match: "deepseek-v4-flash-vision-exp",
			peak: {
				input: 3,
				cacheRead: .1,
				cacheWrite: 0,
				output: 9
			},
			offPeak: {
				input: 1.5,
				cacheRead: .05,
				cacheWrite: 0,
				output: 4.5
			}
		}
	].map((tier) => ({
		...tier,
		peak: { ...tier.peak },
		offPeak: { ...tier.offPeak }
	})),
	timezoneOffsetMinutes: 480,
	peakWindows: DEFAULT_PEAK_WINDOWS.map((w) => ({ ...w })),
	weekendOffPeak: false
};
const zeroBuckets = () => ({
	uncachedInput: 0,
	cacheRead: 0,
	cacheWrite: 0,
	output: 0
});
const numberOr = (v, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
/** 金额保留 6 位小数（与 token 单价的每百万口径精度匹配）。 */
const round6 = (v) => Math.round(v * 1e6) / 1e6;
/** usage -> 四桶（与官方 bucketsFrom 一致：cacheRead/cacheWrite 缺省 0）。 */
function bucketsFrom(usage) {
	return {
		uncachedInput: numberOr(usage.inputTokens),
		cacheRead: numberOr(usage.cacheReadTokens),
		cacheWrite: numberOr(usage.cacheWriteTokens),
		output: numberOr(usage.outputTokens)
	};
}
function addBuckets(target, next) {
	target.uncachedInput += next.uncachedInput;
	target.cacheRead += next.cacheRead;
	target.cacheWrite += next.cacheWrite;
	target.output += next.output;
}
const numberOrZero = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
function normalizePeriod(raw) {
	const obj = raw !== null && typeof raw === "object" ? raw : {};
	return {
		input: numberOrZero(obj["input"]),
		cacheRead: numberOrZero(obj["cacheRead"]),
		cacheWrite: numberOrZero(obj["cacheWrite"]),
		output: numberOrZero(obj["output"])
	};
}
/** 规范化一个档位：新版（peak/offPeak）原样；旧版扁平单价迁移为 高峰=原价、空闲=原价（行为不变）。 */
function normalizeTier(raw, index) {
	const obj = raw !== null && typeof raw === "object" ? raw : {};
	const hasPeriods = obj["peak"] !== void 0 && obj["offPeak"] !== void 0;
	const peak = normalizePeriod(hasPeriods ? obj["peak"] : raw);
	const offPeak = normalizePeriod(hasPeriods ? obj["offPeak"] : raw);
	const id = typeof obj["id"] === "string" && obj["id"].length > 0 ? obj["id"] : "tier-" + index;
	return {
		id,
		name: typeof obj["name"] === "string" ? obj["name"] : id,
		currency: typeof obj["currency"] === "string" && obj["currency"].length > 0 ? obj["currency"] : "CNY",
		match: typeof obj["match"] === "string" && obj["match"].length > 0 ? obj["match"] : "*",
		peak,
		offPeak
	};
}
/** 解析 'HH:MM' 为当日分钟数；非法返回 undefined。 */
function parseClock(value) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
	if (m === null) return void 0;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (h < 0 || h > 23 || min < 0 || min > 59) return void 0;
	return h * 60 + min;
}
/** DeepSeek 官方接口域名（判断是否官方服务商的唯一标准）。 */
const OFFICIAL_API_HOST = "api.deepseek.com";
/**
* 判定一个 provider（会话事件中的服务商 key，如 deepseek-official / openrouter）
* 是否走 DeepSeek 官方接口：provider 的 baseURL 域名必须为 api.deepseek.com。
* provider 缺失或未在配置中登记 → 非官方，过滤。
*/
function isOfficialProvider(provider, providerBaseUrls) {
	if (typeof provider !== "string" || provider.length === 0) return false;
	const baseUrl = providerBaseUrls[provider];
	if (typeof baseUrl !== "string" || baseUrl.length === 0) return false;
	try {
		return new URL(baseUrl).hostname.toLowerCase() === OFFICIAL_API_HOST;
	} catch {
		return false;
	}
}
/** 旧版本内置默认档的三档 id（deepseek-chat / deepseek-reasoner / 兜底）。 */
const LEGACY_DEFAULT_TIER_IDS = /* @__PURE__ */ new Set([
	"deepseek-chat",
	"deepseek-reasoner",
	"fallback"
]);
/** 是否恰好是旧版本内置默认档（未自定义过的旧配置）。 */
function isLegacyDefaultTiers(tiers) {
	return tiers.length === 3 && tiers.every((t) => LEGACY_DEFAULT_TIER_IDS.has(t.id));
}
/**
* 把任意存储值规范化为 PriceConfig：
* - 新版对象 { tiers, timezoneOffsetMinutes?, peakWindows?, weekendOffPeak? }；
* - 旧版扁平数组（迁移：单一时段单价 → 高峰/空闲同价，窗口用默认值）；
* - 旧版内置默认档（deepseek-chat / deepseek-reasoner / 兜底）→ 直接升级为当前官方三档；
* - 其它（缺失/非法）→ 默认配置。
*/
function normalizePriceConfig(raw) {
	const fallback = () => JSON.parse(JSON.stringify(DEFAULT_PRICE_CONFIG));
	if (Array.isArray(raw)) {
		const tiers = raw.map((item, index) => normalizeTier(item, index));
		if (tiers.length === 0) return fallback();
		if (isLegacyDefaultTiers(tiers)) return fallback();
		return {
			...fallback(),
			tiers
		};
	}
	if (raw !== null && typeof raw === "object") {
		const obj = raw;
		const tiersRaw = obj["tiers"];
		if (!Array.isArray(tiersRaw) || tiersRaw.length === 0) return fallback();
		const tiers = tiersRaw.map((item, index) => normalizeTier(item, index));
		if (isLegacyDefaultTiers(tiers)) return fallback();
		const offset = numberOr(obj["timezoneOffsetMinutes"], 480);
		const windowsRaw = obj["peakWindows"];
		const windows = Array.isArray(windowsRaw) && windowsRaw.length > 0 ? windowsRaw.map((w) => {
			const o = w !== null && typeof w === "object" ? w : {};
			const start = typeof o["start"] === "string" ? o["start"] : "";
			const end = typeof o["end"] === "string" ? o["end"] : "";
			return parseClock(start) !== void 0 && parseClock(end) !== void 0 ? {
				start,
				end
			} : void 0;
		}).filter((w) => w !== void 0) : [];
		return {
			tiers,
			timezoneOffsetMinutes: Math.round(offset),
			peakWindows: windows.length > 0 ? windows : DEFAULT_PEAK_WINDOWS.map((w) => ({ ...w })),
			weekendOffPeak: obj["weekendOffPeak"] === true
		};
	}
	return fallback();
}
/**
* 判定一个时刻是否处于高峰时段。
* @param timeMs - 事件时间（ms）。
* @param config - 价格配置（含时区偏移与高峰窗口；开启周六日半价时周末整天为空闲）。
*/
function isPeakTime(timeMs, config) {
	const local = new Date(timeMs + config.timezoneOffsetMinutes * 6e4);
	if (config.weekendOffPeak === true) {
		const day = local.getUTCDay();
		if (day === 0 || day === 6) return false;
	}
	const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
	for (const window of config.peakWindows) {
		const start = parseClock(window.start);
		const end = parseClock(window.end);
		if (start === void 0 || end === void 0) continue;
		if (start <= end) {
			if (minutes >= start && minutes < end) return true;
		} else if (minutes >= start || minutes < end) return true;
	}
	return false;
}
/** 取某档在指定时刻生效的单价集合。 */
function periodPricesOf(tier, timeMs, config) {
	return isPeakTime(timeMs, config) ? tier.peak : tier.offPeak;
}
/**
* 价格档匹配：精确模型 id > 模型 id 前缀 > '*' 通配兜底。
* @param model - 当前模型 id（可为空）。
* @param prices - 价格档列表（空列表返回 undefined）。
*/
function matchTier(model, prices) {
	if (prices.length === 0) return void 0;
	const m = model ?? "";
	if (m.length > 0) {
		const exact = prices.find((t) => t.match === m);
		if (exact !== void 0) return exact;
		const prefix = prices.find((t) => t.match !== "*" && t.match.length > 0 && m.startsWith(t.match));
		if (prefix !== void 0) return prefix;
	}
	return prices.find((t) => t.match === "*") ?? prices[0];
}
/** 按一组单价计费（每百万 tokens 单价）。 */
function costOf(buckets, period) {
	if (period === void 0) return 0;
	return (buckets.uncachedInput * period.input + buckets.cacheRead * period.cacheRead + buckets.cacheWrite * period.cacheWrite + buckets.output * period.output) / 1e6;
}
/** 一个桶的总 token 数（四桶之和）。 */
function totalTokens(buckets) {
	return buckets.uncachedInput + buckets.cacheRead + buckets.cacheWrite + buckets.output;
}
/**
* 把 per-key 分组折算成 CostEntry：
* token 合计（所有 key，不区分官方与否）+ 计费金额合计（仅官方 key）。
* 全零分组剔除；byKey 按 token 总数降序。
*/
function assembleEntry(groups) {
	const buckets = zeroBuckets();
	let amount = 0;
	let currency = "CNY";
	const byKey = [];
	for (const group of groups) {
		if (totalTokens(group.buckets) <= 0) continue;
		addBuckets(buckets, group.buckets);
		byKey.push({
			provider: group.provider,
			buckets: { ...group.buckets },
			official: group.official,
			amount: group.amount,
			currency: group.currency
		});
		if (group.official) {
			amount += group.amount;
			if (group.currency !== "") currency = group.currency;
		}
	}
	byKey.sort((a, b) => totalTokens(b.buckets) - totalTokens(a.buckets));
	return {
		amount: round6(amount),
		currency,
		buckets,
		byKey
	};
}
/**
* 折叠内存会话事件为 per-(turn,step) 样本表（官方投影语义：后值覆盖前值）。
* 同时追踪每个样本所属模型与服务商（取样本之前最近一次 request/context）与时间。
*/
function foldSessionEvents(events) {
	const samples = /* @__PURE__ */ new Map();
	let currentModel;
	let currentProvider;
	let maxTurn = -1;
	for (const event of events) {
		const data = event.data;
		if (data === void 0) continue;
		if (event.type === "request/context") {
			if (typeof data.model === "string" && data.model.length > 0) currentModel = data.model;
			if (typeof data.provider === "string" && data.provider.length > 0) currentProvider = data.provider;
			continue;
		}
		let usage;
		if (event.type === "assistant/chunk" && data.chunk?.type === "usage") usage = data.chunk.usage;
		else if (event.type === "assistant/message") usage = data.usage;
		if (usage === void 0) continue;
		const turn = numberOr(data.turn);
		const step = numberOr(data.step);
		samples.set(turn + ":" + step, {
			turn,
			step,
			buckets: bucketsFrom(usage),
			...currentModel === void 0 ? {} : { model: currentModel },
			...currentProvider === void 0 ? {} : { provider: currentProvider },
			...typeof event.time === "number" && Number.isFinite(event.time) ? { time: event.time } : {},
			...event.type === "assistant/message" ? { final: true } : {}
		});
		if (turn > maxTurn) maxTurn = turn;
	}
	return {
		samples,
		maxTurn
	};
}
/**
* 取最近一次「已完成的请求」样本：turn 最大、step 最大，且必须由
* assistant/message 落盘（final）—— 流式中的 usage chunk 早期样本不算完成。
*/
function lastCompletedSample(samples) {
	let best;
	for (const sample of samples.values()) {
		if (sample.final !== true) continue;
		if (best === void 0 || sample.turn > best.turn || sample.turn === best.turn && sample.step > best.step) best = sample;
	}
	return best;
}
/**
* 对一组样本按 API key（provider）分组统计：全部 token 分别累计（不区分官方与否）；
* 官方 key（api.deepseek.com）额外按模型 × 时段计费，非官方金额恒为 0。
* 每个样本都用「它自己所属的模型」（request/context 追踪）匹配价格档，
* 多 provider / 多模型切换的会话不会串档。
*/
function priceSamples(samples, prices, config, providerBaseUrls) {
	const groups = /* @__PURE__ */ new Map();
	for (const sample of samples) {
		const key = typeof sample.provider === "string" && sample.provider.length > 0 ? sample.provider : "unknown";
		let group = groups.get(key);
		if (group === void 0) {
			group = {
				buckets: zeroBuckets(),
				official: isOfficialProvider(sample.provider, providerBaseUrls),
				amount: 0,
				currency: ""
			};
			groups.set(key, group);
		}
		addBuckets(group.buckets, sample.buckets);
		if (group.official) {
			const tier = matchTier(sample.model, prices);
			if (tier !== void 0) group.currency = tier.currency;
			group.amount += costOf(sample.buckets, tier === void 0 ? void 0 : periodPricesOf(tier, sample.time ?? Date.now(), config));
		}
	}
	return { byKey: [...groups.entries()].map(([provider, g]) => ({
		provider,
		buckets: { ...g.buckets },
		official: g.official,
		amount: round6(g.amount),
		currency: g.currency
	})) };
}
/** 会话日志根目录；解析失败（home 不可用）返回 undefined。 */
function sessionsRoot() {
	try {
		return dshHomePath("sessions");
	} catch {
		return;
	}
}
/**
* 复刻 dsh-session-persistence-jsonl/format.projectKey：把 cwd 编码为
* 磁盘上的项目目录名（分隔符 → '-'，非安全字符 → '~XXXX'，前缀 '--' 后缀 '--'）。
* 宿主后端按此命名存放会话日志，这里必须逐字节一致才能定位子代理日志。
*/
function projectKeyOf(cwd) {
	if (cwd.length === 0) throw new Error("cannot encode an empty project path");
	let readable = "";
	let separatorRun = false;
	for (let i = 0; i < cwd.length; i++) {
		const code = cwd.charCodeAt(i);
		const ch = String.fromCharCode(code);
		if (ch === "/" || ch === "\\" || ch === ":") {
			if (!separatorRun) readable += "-";
			separatorRun = true;
		} else if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) {
			readable += ch;
			separatorRun = false;
		} else {
			readable += "~" + code.toString(16).toUpperCase().padStart(4, "0");
			separatorRun = false;
		}
	}
	return `--${(readable.replace(/^-+/, "") || "root").slice(0, 251)}--`;
}
/** zstd 魔数在 buffer 中的首个出现位置；未找到返回 -1。 */
function indexOfMagic(raw) {
	for (let i = 0; i + 4 <= raw.length; i++) if (raw[i] === ZSTD_MAGIC[0] && raw[i + 1] === ZSTD_MAGIC[1] && raw[i + 2] === ZSTD_MAGIC[2] && raw[i + 3] === ZSTD_MAGIC[3]) return i;
	return -1;
}
/**
* 只读日志文件的首行（header 行）：zstd 首帧即 header 帧（写端独立成帧），
* 读前 64KB 解出即可；帧不完整或异常时整读兜底。用于血缘发现，避免
* 为取 header 而整包解压大日志。
*/
function readHeaderLine(path, isZstd) {
	let fd;
	try {
		fd = openSync(path, "r");
	} catch {
		return;
	}
	try {
		const buf = Buffer.alloc(65536);
		const bytesRead = readSync(fd, buf, 0, buf.length, 0);
		const head = buf.subarray(0, bytesRead);
		if (isZstd === false) {
			const nl = head.indexOf(10);
			if (nl !== -1) return head.subarray(0, nl).toString("utf8");
			return readFileSync(path).toString("utf8").split("\n", 1)[0];
		}
		const start = indexOfMagic(head);
		if (start === -1) return void 0;
		try {
			return zstdDecompressSync(head.subarray(start)).toString("utf8").split("\n", 1)[0];
		} catch {
			const raw = readFileSync(path);
			const s = indexOfMagic(raw);
			if (s === -1) return void 0;
			try {
				return zstdDecompressSync(raw.subarray(s)).toString("utf8").split("\n", 1)[0];
			} catch {
				return;
			}
		}
	} catch {
		return;
	} finally {
		try {
			closeSync(fd);
		} catch {}
	}
}
/** 解析日志 header 行：返回 id / cwd / parentSession；非会话首行返回 undefined。 */
function parseLogHeader(line) {
	let parsed;
	try {
		parsed = JSON.parse(line);
	} catch {
		return;
	}
	if (parsed.type !== "session" || typeof parsed.id !== "string" || parsed.id.length === 0) return void 0;
	return {
		id: parsed.id,
		...typeof parsed.cwd === "string" && parsed.cwd.length > 0 ? { cwd: parsed.cwd } : {},
		...typeof parsed.parentSession === "string" && parsed.parentSession.length > 0 ? { parentSession: parsed.parentSession } : {}
	};
}
/** 解析日志事件行（跳过首行 header）为 SessionEventLike[]（与内存会话同一视图）。 */
function parseLogEvents(text) {
	const events = [];
	let first = true;
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		let parsed;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			continue;
		}
		if (first) {
			first = false;
			continue;
		}
		if (typeof parsed.type !== "string") continue;
		events.push({
			type: parsed.type,
			...typeof parsed.time === "number" ? { time: parsed.time } : {},
			...parsed.data !== void 0 && parsed.data !== null ? { data: parsed.data } : {}
		});
	}
	return events;
}
/**
* 按 id 从磁盘定位一个会话日志并读回（内存已注销的会话 —— 如已结束的
* 子代理 —— 走这里）。全项目目录扫描 header 匹配 id，命中后整包解码。
*/
function readSessionLog(sessionId) {
	const root = sessionsRoot();
	if (root === void 0) return void 0;
	let projects;
	try {
		projects = readdirSync(root);
	} catch {
		return;
	}
	for (const project of projects) {
		const projectDirPath = join(root, project);
		let names;
		try {
			names = readdirSync(projectDirPath);
		} catch {
			continue;
		}
		for (const name of names) {
			const dir = join(projectDirPath, name);
			const candidates = [{
				path: join(dir, "session.jsonl.zstd"),
				zstd: true
			}, {
				path: join(dir, "session.jsonl"),
				zstd: false
			}];
			for (const candidate of candidates) {
				const headerLine = readHeaderLine(candidate.path, candidate.zstd);
				if (headerLine === void 0) continue;
				const header = parseLogHeader(headerLine);
				if (header === void 0 || header.id !== sessionId) break;
				const text = decodeLog(candidate.path, candidate.zstd);
				if (text === void 0) return void 0;
				return {
					...header.cwd !== void 0 ? { header: { cwd: header.cwd } } : {},
					events: parseLogEvents(text)
				};
			}
		}
	}
}
/**
* 收集当前会话的子孙会话（子代理）样本：同项目目录下按 header.parentSession
* 血缘 BFS，逐层整包解码子会话日志并折叠。返回的样本表用子会话 id 做键前缀
* 命名空间，避免与主会话的 (turn,step) 键冲突。子代理是独立会话（header 标记
* origin='subagent' / delegationDepth>0 / parentSession），与父任务同 cwd。
* @param sessionId - 当前会话 id（血缘根）。
* @param cwd - 当前会话的项目目录（决定扫描哪个项目目录；缺省 _no-cwd）。
*/
function foldDescendantSamples(sessionId, cwd) {
	const out = /* @__PURE__ */ new Map();
	if (sessionId.length === 0) return out;
	const root = sessionsRoot();
	if (root === void 0) return out;
	const projectDirPath = cwd !== void 0 ? join(root, projectKeyOf(cwd)) : join(root, "_no-cwd");
	const byId = /* @__PURE__ */ new Map();
	let names;
	try {
		names = readdirSync(projectDirPath);
	} catch {
		return out;
	}
	for (const name of names) {
		const dir = join(projectDirPath, name);
		const candidates = [{
			path: join(dir, "session.jsonl.zstd"),
			zstd: true
		}, {
			path: join(dir, "session.jsonl"),
			zstd: false
		}];
		for (const candidate of candidates) {
			const headerLine = readHeaderLine(candidate.path, candidate.zstd);
			if (headerLine === void 0) continue;
			const header = parseLogHeader(headerLine);
			if (header === void 0) break;
			byId.set(header.id, {
				...header.parentSession !== void 0 ? { parentSession: header.parentSession } : {},
				path: candidate.path,
				zstd: candidate.zstd
			});
			break;
		}
	}
	const visited = /* @__PURE__ */ new Set([sessionId]);
	const queue = [sessionId];
	while (queue.length > 0) {
		const parent = queue.shift();
		for (const [childId, rec] of byId) {
			if (rec.parentSession !== parent || visited.has(childId)) continue;
			visited.add(childId);
			queue.push(childId);
			const text = decodeLog(rec.path, rec.zstd);
			if (text === void 0) continue;
			const { samples } = foldSessionEvents(parseLogEvents(text));
			for (const [key, sample] of samples) out.set(childId + ":" + key, sample);
		}
	}
	return out;
}
/**
* 计算一个会话的四项费用（最近一次提问 / 本会话 / 今日·本项目 / 今日·全部）。
* 会话解析链：内存存活会话（sessions.get）优先，磁盘日志兜底（已结束的
* 子代理等已从内存注销的会话）；「本会话」再并入该会话的子孙（子代理）会话
* —— 与任务开子代理产生的流量归到主任务同一会话头上。子代理会话日志与父
* 任务同 cwd、同项目目录，模型/服务商记录在各自日志的 request/context 中，
* 统计与计费与主会话同等处理。
* @param sessionId - 当前会话 id（空串：实时两项归零）。
* @param sessions - 宿主内存 sessions 服务（可能缺失）。
* @param config - 完整价格配置。
* @param fallbackCwd - 会话 header 无 cwd 时「本项目」判定的 cwd（缺省 process.cwd()）。
*/
async function computeCosts(sessionId, sessions, config, fallbackCwd, providerBaseUrls = {}) {
	const own = (sessionId.length > 0 ? sessions?.get(sessionId) : void 0) ?? (sessionId.length > 0 ? readSessionLog(sessionId) : void 0);
	const cwd = own?.header?.cwd !== void 0 && own.header.cwd.length > 0 ? own.header.cwd : fallbackCwd;
	const { samples, maxTurn } = own?.events !== void 0 ? foldSessionEvents(own.events) : {
		samples: /* @__PURE__ */ new Map(),
		maxTurn: -1
	};
	let sessionModel;
	for (const sample of samples.values()) if (sample.model !== void 0) sessionModel = sample.model;
	const descendantSamples = foldDescendantSamples(sessionId, own?.header?.cwd);
	const merged = new Map(samples);
	for (const [key, sample] of descendantSamples) merged.set("sub:" + key, sample);
	const sessionPriced = priceSamples(merged.values(), config.tiers, config, providerBaseUrls);
	const lastTurnPriced = maxTurn >= 0 ? priceSamples([...samples.values()].filter((s) => s.turn === maxTurn), config.tiers, config, providerBaseUrls) : { byKey: [] };
	const today = await scanToday(cwd, config, providerBaseUrls);
	const tier = matchTier(sessionModel, config.tiers);
	return {
		lastTurn: assembleEntry(lastTurnPriced.byKey),
		session: assembleEntry(sessionPriced.byKey),
		todayProject: today.project,
		todayAll: today.all,
		...sessionModel === void 0 ? {} : { sessionTier: sessionModel + " → " + (tier?.name ?? "?") },
		lastRequestOfficial: isOfficialProvider(lastCompletedSample(samples)?.provider, providerBaseUrls)
	};
}
/** zstd 帧魔数（小端 0xFD2FB528）。 */
const ZSTD_MAGIC = [
	40,
	181,
	47,
	253
];
/** 记忆化缓存：文件内容未变（mtime+size）、同一天、且时段/服务商配置未变时不重复扫描。 */
const todayFileCache = /* @__PURE__ */ new Map();
/**
* 解压一个日志文件：zstd 一律按帧魔数切分逐帧解压（zstdDecompressSync
* 对多帧文件会静默丢弃首帧之后的帧，不能整包直解）；明文直接返回。
*/
function decodeLog(path, isZstd) {
	let raw;
	try {
		raw = readFileSync(path);
	} catch {
		return;
	}
	if (isZstd === false) return raw.toString("utf8");
	const starts = [];
	for (let i = 0; i + 4 <= raw.length; i++) if (raw[i] === ZSTD_MAGIC[0] && raw[i + 1] === ZSTD_MAGIC[1] && raw[i + 2] === ZSTD_MAGIC[2] && raw[i + 3] === ZSTD_MAGIC[3]) starts.push(i);
	if (starts.length < 1) return void 0;
	const parts = [];
	for (let i = 0; i < starts.length; i++) {
		const start = starts[i];
		const end = i + 1 < starts.length ? starts[i + 1] : raw.length;
		try {
			parts.push(zstdDecompressSync(raw.subarray(start, end)));
		} catch {
			return;
		}
	}
	return Buffer.concat(parts).toString("utf8");
}
/**
* 解析一个日志文件中今日的用量（header cwd + assistant/message 桶，
* 按 API key 分组、组内按时段拆分）。所有 key 的 token 都统计数量；
* 官方 key（api.deepseek.com）的用量额外进入 billable 按模型计费。
*/
function parseTodayFile(path, isZstd, todayStart, config, providerBaseUrls) {
	const text = decodeLog(path, isZstd);
	if (text === void 0) return void 0;
	const sample = { byProvider: /* @__PURE__ */ new Map() };
	let currentModel;
	let currentProvider;
	let first = true;
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		let parsed;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			continue;
		}
		if (first) {
			first = false;
			if (parsed.type === "session" && typeof parsed.cwd === "string") sample.cwd = parsed.cwd;
			continue;
		}
		if (parsed.type === "request/context") {
			const data = parsed.data;
			if (typeof data?.model === "string") currentModel = data.model;
			if (typeof data?.provider === "string") currentProvider = data.provider;
			continue;
		}
		if (parsed.type !== "assistant/message") continue;
		if (typeof parsed.time !== "number" || parsed.time < todayStart) continue;
		const usage = parsed.data?.usage;
		if (usage === void 0) continue;
		const model = currentModel ?? "*";
		const providerKey = typeof currentProvider === "string" && currentProvider.length > 0 ? currentProvider : "unknown";
		let provider = sample.byProvider.get(providerKey);
		if (provider === void 0) {
			provider = {
				peak: zeroBuckets(),
				offPeak: zeroBuckets(),
				billable: /* @__PURE__ */ new Map()
			};
			sample.byProvider.set(providerKey, provider);
		}
		const peak = isPeakTime(parsed.time, config);
		const usageBuckets = bucketsFrom(usage);
		addBuckets(peak ? provider.peak : provider.offPeak, usageBuckets);
		if (isOfficialProvider(currentProvider, providerBaseUrls)) {
			const pair = provider.billable.get(model) ?? {
				peak: zeroBuckets(),
				offPeak: zeroBuckets()
			};
			addBuckets(peak ? pair.peak : pair.offPeak, usageBuckets);
			provider.billable.set(model, pair);
		}
	}
	return sample;
}
/** 判断两个路径是否指向同一目录（大小写不敏感的 Windows 友好比较）。 */
function samePath(a, b) {
	const norm = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
	return norm(a) === norm(b);
}
/** 今日零点（本地时区）。 */
function todayStartMs() {
	const now = /* @__PURE__ */ new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
/** 把一个文件的 per-provider 聚合并入目标映射（跨文件合并）。 */
function mergeProviderToday(target, source) {
	for (const [provider, pt] of source) {
		const t = target.get(provider) ?? {
			peak: zeroBuckets(),
			offPeak: zeroBuckets(),
			billable: /* @__PURE__ */ new Map()
		};
		addBuckets(t.peak, pt.peak);
		addBuckets(t.offPeak, pt.offPeak);
		for (const [model, pair] of pt.billable) {
			const b = t.billable.get(model) ?? {
				peak: zeroBuckets(),
				offPeak: zeroBuckets()
			};
			addBuckets(b.peak, pair.peak);
			addBuckets(b.offPeak, pair.offPeak);
			t.billable.set(model, b);
		}
		target.set(provider, t);
	}
}
/**
* 扫描今日全部会话日志，聚合「本项目」与「全部」两项费用。
* @param currentCwd - 当前项目 cwd（与 header.cwd 比对区分本项目）。
* @param config - 完整价格配置。
*/
async function scanToday(currentCwd, config, providerBaseUrls) {
	const empty = {
		project: assembleEntry([]),
		all: assembleEntry([])
	};
	const todayStart = todayStartMs();
	let root;
	try {
		root = dshHomePath("sessions");
	} catch {
		return empty;
	}
	let projects;
	try {
		projects = readdirSync(root);
	} catch {
		return empty;
	}
	const allByProvider = /* @__PURE__ */ new Map();
	const projectByProvider = /* @__PURE__ */ new Map();
	for (const project of projects) {
		const projectDirPath = join(root, project);
		let sessionIds;
		try {
			sessionIds = readdirSync(projectDirPath);
		} catch {
			continue;
		}
		for (const sessionId of sessionIds) {
			const dir = join(projectDirPath, sessionId);
			const candidates = [{
				path: join(dir, "session.jsonl.zstd"),
				zstd: true
			}, {
				path: join(dir, "session.jsonl"),
				zstd: false
			}];
			for (const candidate of candidates) {
				let stat;
				try {
					stat = statSync(candidate.path);
				} catch {
					continue;
				}
				if (stat.mtimeMs < todayStart) continue;
				const cacheKey = candidate.path;
				const configKey = JSON.stringify({
					offset: config.timezoneOffsetMinutes,
					windows: config.peakWindows,
					weekend: config.weekendOffPeak === true,
					providers: providerBaseUrls
				});
				const cached = todayFileCache.get(cacheKey);
				let sample;
				if (cached !== void 0 && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size && cached.todayStart === todayStart && cached.configKey === configKey) sample = cached.sample;
				else {
					sample = parseTodayFile(candidate.path, candidate.zstd, todayStart, config, providerBaseUrls);
					if (sample !== void 0) todayFileCache.set(cacheKey, {
						mtimeMs: stat.mtimeMs,
						size: stat.size,
						todayStart,
						configKey,
						sample
					});
				}
				if (sample === void 0) continue;
				const isProject = sample.cwd !== void 0 && samePath(sample.cwd, currentCwd);
				mergeProviderToday(allByProvider, sample.byProvider);
				if (isProject) mergeProviderToday(projectByProvider, sample.byProvider);
				break;
			}
		}
	}
	const assemble = (byProvider) => {
		const groups = [];
		for (const [provider, pt] of byProvider) {
			const buckets = zeroBuckets();
			addBuckets(buckets, pt.peak);
			addBuckets(buckets, pt.offPeak);
			const official = isOfficialProvider(provider, providerBaseUrls);
			let amount = 0;
			let currency = "";
			if (official) for (const [model, pair] of pt.billable) {
				const tier = matchTier(model === "*" ? void 0 : model, config.tiers);
				if (tier !== void 0) currency = tier.currency;
				amount += costOf(pair.peak, tier === void 0 ? void 0 : tier.peak);
				amount += costOf(pair.offPeak, tier === void 0 ? void 0 : tier.offPeak);
			}
			groups.push({
				provider,
				buckets,
				official,
				amount: round6(amount),
				currency
			});
		}
		return assembleEntry(groups);
	};
	return {
		project: assemble(projectByProvider),
		all: assemble(allByProvider)
	};
}
//#endregion
//#region src/host/config-file.ts
/**
* dsh-get-balance —— 宿主半边：插件自有配置文件读写。
*
* 插件的持久数据（附加 API key、价格档、自动刷新间隔）不再写入宿主默认设置
* （$DSH_HOME/settings.yaml 的 dsh-balance 命名空间），改存独立文件
* `$DSH_HOME/dsh-get-balance.json`（与 settings.yaml 同目录，路径由
* @deepseek-ai/dsh-home-paths 解析）。
*
* 设计（方案 A：读穿透 + 原子写）：
* - 每次读取现读文件（文件极小，读一次微秒级；外部手改立即生效）；
* - 写操作经 promise 链串行化，先写 `<file>.tmp` 再 rename 原子替换，防半写损坏；
* - 首次读取前执行一次性迁移：JSON 文件不存在且宿主 settings 里存在旧
*   dsh-balance 命名空间数据时，临时注册旧命名空间读出并写入 JSON 文件；
*   迁移完成后不再注册该命名空间（彻底移除对宿主设置的读写）。
*/
/** 配置文件文件名（$DSH_HOME 下）。 */
const CONFIG_FILE_NAME = "dsh-get-balance.json";
/** 配置文件格式版本（未来演进用）。 */
const CONFIG_FILE_VERSION = 1;
/** 旧版 settings 命名空间的 schema（仅迁移读取用）。 */
const LegacyBalanceSchema = Schema.object({
	extraKeysJson: Schema.string().default("[]"),
	pricesJson: Schema.string().default(""),
	autoRefreshJson: Schema.string().default("0")
});
/** 配置文件绝对路径（$DSH_HOME/dsh-get-balance.json）。 */
const configPath = dshHomePath(CONFIG_FILE_NAME);
/** 一次性迁移 promise；null 表示尚未初始化（apply 未调用 initConfigFile）。 */
let initPromise = null;
/** 迁移只跑一次（进程内）。 */
let migrated = false;
/** 损坏文件只告警一次。 */
let corruptWarned = false;
/** 写操作串行化队列尾：每个保存都在上一个完成后执行（读-合并-写整体入队，防丢更新）。 */
let writeTail = Promise.resolve();
/** 默认配置：空 key 列表 + 内置默认价格 + 自动刷新关闭 + 显示余额开启。 */
function defaultConfig() {
	return {
		version: CONFIG_FILE_VERSION,
		extraKeys: [],
		prices: normalizePriceConfig(void 0),
		autoRefreshSeconds: 0,
		showBalance: true
	};
}
/** 把任意值规范化为 ExtraKey 列表（逐项容错，id 缺省补 `k<index>`）。 */
function sanitizeKeys(parsed) {
	if (!Array.isArray(parsed)) return [];
	return parsed.filter((item) => item !== null && typeof item === "object").map((item, index) => ({
		id: typeof item.id === "string" && item.id.length > 0 ? item.id : `k${index}`,
		label: typeof item.label === "string" ? item.label : "",
		apiKey: typeof item.apiKey === "string" ? item.apiKey : ""
	}));
}
/** 把任意值规范化为自动刷新秒数（非法/负值 → 0）。 */
function sanitizeSeconds(raw) {
	const n = typeof raw === "number" ? raw : Number(String(raw ?? "0").trim());
	return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}
/** 把任意值规范化为布尔开关（仅接受字面 true/false，其余回退默认）。 */
function sanitizeBool(raw, fallback) {
	return typeof raw === "boolean" ? raw : fallback;
}
/** 解析旧版 settings 的 JSON 字符串字段；空串/非法 → undefined。 */
function parseLegacyJson(raw) {
	if (typeof raw !== "string" || raw.length === 0) return void 0;
	try {
		return JSON.parse(raw);
	} catch {
		return;
	}
}
/**
* 初始化模块（apply 时调用一次）。只启动懒迁移 promise，不阻塞 apply；
* 所有读/写入口都会 await initPromise，因此首个 op 必然等迁移完成。
*/
function initConfigFile(deps) {
	if (initPromise === null) initPromise = ensureMigrated(deps);
}
/**
* 一次性迁移：JSON 文件不存在且宿主 settings 存在旧 dsh-balance 命名空间
* 数据时，把三份字段搬进 JSON 文件；之后不再注册该命名空间。
*/
async function ensureMigrated(deps) {
	if (migrated) return;
	migrated = true;
	try {
		await access(configPath);
		return;
	} catch {}
	const legacy = await readLegacySettings(deps);
	if (legacy === null) return;
	try {
		await writeConfigFile(legacy);
		console.log(`[dsh-get-balance] migrated plugin data from host settings to ${configPath}`);
	} catch (e) {
		console.warn(`[dsh-get-balance] failed to write migrated config to ${configPath}: ${e instanceof Error ? e.message : String(e)}`);
	}
}
/**
* 从宿主 settings 读取旧 dsh-balance 命名空间。
*
* `settings.get()` 只认已注册的命名空间，因此这里在一次性子插件上下文里
* 临时注册旧 schema（settings 服务随子 fiber 继承自父上下文），读完立即
* dispose 注销 —— 迁移后宿主不再持有该命名空间的注册。
*
* @returns 规范化后的完整配置；无旧数据 / settings 服务缺失 / 读取失败 → null。
*/
async function readLegacySettings(deps) {
	if (deps.settings === void 0) return null;
	let legacy = null;
	let fiber = null;
	try {
		fiber = deps.ctx.plugin({
			name: "dsh-get-balance-legacy-migrate",
			apply(child) {
				const settings = child.get("settings");
				if (settings === void 0) return;
				try {
					const scope = settings.register(settingsNamespace("dsh-balance"), LegacyBalanceSchema, { base: {
						extraKeysJson: "[]",
						pricesJson: ""
					} });
					if (scope === null) return;
					const value = scope.get();
					const extraKeys = sanitizeKeys(parseLegacyJson(value["extraKeysJson"]));
					const prices = normalizePriceConfig(parseLegacyJson(value["pricesJson"]));
					const autoRefreshSeconds = sanitizeSeconds(value["autoRefreshJson"]);
					if (extraKeys.length === 0 && autoRefreshSeconds === 0 && JSON.stringify(prices) === JSON.stringify(normalizePriceConfig(void 0))) return;
					legacy = {
						extraKeys,
						prices,
						autoRefreshSeconds
					};
				} catch {}
			}
		});
		await fiber;
	} catch {
		return null;
	} finally {
		if (fiber !== null) await fiber.dispose().catch(() => void 0);
	}
	return legacy;
}
/**
* 读取完整插件配置（迁移完成后每次现读文件）。
* 文件缺失 → 默认值；JSON 损坏 → 备份为 `<file>.bak-<时间戳>` + 告警一次 + 默认值。
*/
async function readPluginConfig() {
	await initPromise;
	let text;
	try {
		text = await readFile(configPath, "utf8");
	} catch (e) {
		if (e.code === "ENOENT") return defaultConfig();
		throw e;
	}
	try {
		const parsed = JSON.parse(text);
		return {
			version: typeof parsed["version"] === "number" ? parsed["version"] : CONFIG_FILE_VERSION,
			extraKeys: sanitizeKeys(parsed["extraKeys"]),
			prices: normalizePriceConfig(parsed["prices"]),
			autoRefreshSeconds: sanitizeSeconds(parsed["autoRefreshSeconds"]),
			showBalance: sanitizeBool(parsed["showBalance"], true)
		};
	} catch {
		await backupCorruptFile().catch(() => void 0);
		if (!corruptWarned) {
			corruptWarned = true;
			console.warn(`[dsh-get-balance] config file corrupted, backed up and using defaults: ${configPath}`);
		}
		return defaultConfig();
	}
}
/** 把损坏的配置文件改名备份（保留现场供排查），不改动业务数据。 */
async function backupCorruptFile() {
	const backup = `${configPath}.bak-${Date.now()}`;
	await rename(configPath, backup);
}
/**
* 保存插件配置：合并 patch 后整体写入（读-合并-写整体入队串行化，防并发丢更新）。
* 先写 `<file>.tmp` 再 rename 原子替换；写前确保目录存在；失败抛错由 op 层映射。
*/
async function savePluginConfig(patch) {
	await initPromise;
	const run = writeTail.then(async () => {
		await writeConfigFile({
			...await readFileConfig(),
			...patch
		});
	});
	writeTail = run.catch(() => void 0);
	await run;
}
/** 现读文件并规范化为完整配置（不触发迁移，仅供保存前取当前值）。 */
async function readFileConfig() {
	let text;
	try {
		text = await readFile(configPath, "utf8");
	} catch (e) {
		if (e.code === "ENOENT") return defaultConfig();
		throw e;
	}
	try {
		const parsed = JSON.parse(text);
		return {
			version: typeof parsed["version"] === "number" ? parsed["version"] : CONFIG_FILE_VERSION,
			extraKeys: sanitizeKeys(parsed["extraKeys"]),
			prices: normalizePriceConfig(parsed["prices"]),
			autoRefreshSeconds: sanitizeSeconds(parsed["autoRefreshSeconds"]),
			showBalance: sanitizeBool(parsed["showBalance"], true)
		};
	} catch {
		await backupCorruptFile().catch(() => void 0);
		return defaultConfig();
	}
}
/** 原子写盘：mkdir -p → 写 tmp → rename 替换。 */
async function writeConfigFile(next) {
	const serialized = JSON.stringify(next, null, 2) + "\n";
	await mkdir(dirname(configPath), { recursive: true });
	const tmp = `${configPath}.tmp`;
	await writeFile(tmp, serialized, "utf8");
	await rename(tmp, configPath);
}
//#endregion
//#region src/host/fence.ts
/** 规范化后的 URL hostname 是否指向本地回环（localhost / 127.0.0.0/8 / [::1]）。 */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** 规范化一个 Host 头 authority 为 URL，解析失败返回 undefined。 */
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
/** 规范化 authority 形式：hostname，或带端口的 hostname:port。 */
function canonicalAuthority(entry, entryUrl) {
	const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
	return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
/** 请求 authority 是否匹配 trustedHosts 中的一项（精确或省略端口）。 */
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
	});
}
/**
* 判定一次 /dsh-balance/api 请求是否可放行。
* @param headers - node HTTP 请求头。
* @param trustedHosts - 部署的非回环受信任主机（webRuntime.trustedHosts，可为空）。
* @returns true 表示 Host 是自有（回环或受信任）且浏览器标记为同源。
*/
function isTrustedApiRequest(headers, trustedHosts) {
	const raw = headers.host;
	if (typeof raw !== "string" || raw === "") return false;
	const hostUrl = parseAuthority(raw);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	if (headers["sec-fetch-site"] === "cross-site") return false;
	const origin = headers.origin;
	if (typeof origin !== "string" || origin === "") return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/host/providers.ts
/** 官方 DeepSeek API 地址（baseURL 缺省值与过滤参照）。 */
const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
/** 脱敏一个 API key：保留头 5 与尾 4，过短全掩。 */
function maskApiKey(key) {
	const k = String(key || "").trim();
	if (k.length === 0) return "";
	if (k.length <= 10) return k.slice(0, 2) + "****";
	return k.slice(0, 5) + "…" + k.slice(-4);
}
/** baseURL / 路由 key 是否指向 DeepSeek。 */
function isDeepseekRoute(routeKey, baseUrl) {
	if (routeKey.toLowerCase().includes("deepseek")) return true;
	if (baseUrl === void 0) return false;
	return baseUrl.toLowerCase().includes("deepseek");
}
/** 解析一个凭据引用：返回真实 key 及其来源层；未配置 / 服务缺失 / 异常返回 undefined。 */
async function resolveApiKey(credentials, apiKeyEnv) {
	if (credentials === void 0 || apiKeyEnv === void 0 || apiKeyEnv === "") return void 0;
	try {
		const resolved = await credentials.resolve(apiKeyEnv);
		const value = resolved?.value;
		return typeof value === "string" && value.length > 0 ? {
			value,
			...typeof resolved?.source === "string" ? { source: resolved.source } : {}
		} : void 0;
	} catch {
		return;
	}
}
/**
* 枚举全部 providers 路由 → baseURL 映射（含非 deepseek 路由与官方 llm-deepseek
* 段），供费用统计按「接口域名为官方地址」判定并过滤非官方请求的 token。
* @param settings - 宿主 settings 服务（可能缺失）。
* @param nsOf - namespace 品牌化函数（settingsNamespace）。
* @returns provider key -> baseURL。
*/
function listProviderBaseUrls(settings, nsOf) {
	const map = {};
	const providers = (settings?.get(nsOf("llm-pi-ai")))?.providers;
	if (providers !== void 0 && providers !== null && typeof providers === "object") for (const [route, section] of Object.entries(providers)) {
		if (section === void 0 || section === null || typeof section !== "object") continue;
		if (typeof section.baseURL === "string" && section.baseURL.length > 0) map[route] = section.baseURL;
	}
	const deepseek = settings?.get(nsOf("llm-deepseek"));
	if (deepseek !== void 0 && deepseek !== null && typeof deepseek === "object") map["deepseek-official"] = deepseek.baseURL ?? "https://api.deepseek.com";
	return map;
}
/**
* 枚举全部 DeepSeek 服务商条目（含 key 解析）。
*
* 解析到同一 API key（同一账号）的多个路由折叠为一行：保留首个条目并把其余
* 路由记入其 `sharedWith`（余额对每个唯一 key 只查询一次，同一账号不重复展示）。
*
* @param settings - 宿主 settings 服务（可能缺失）。
* @param nsOf - namespace 品牌化函数（settingsNamespace）。
* @param credentials - 宿主 credentials 服务（可能缺失）。
* @param extraKeys - 插件配置文件（$DSH_HOME/dsh-get-balance.json）的附加 key 列表。
* @returns 按「解析 key 去重 + 路由去重」后的服务商列表。
*/
async function listDeepseekProviders(settings, nsOf, credentials, extraKeys) {
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	const providers = (settings?.get(nsOf("llm-pi-ai")))?.providers;
	if (providers !== void 0 && providers !== null && typeof providers === "object") for (const [route, section] of Object.entries(providers)) {
		if (section === void 0 || section === null || typeof section !== "object") continue;
		if (!isDeepseekRoute(route, section.baseURL)) continue;
		const apiKeyEnv = typeof section.apiKeyEnv === "string" && section.apiKeyEnv.length > 0 ? section.apiKeyEnv : void 0;
		const resolved = await resolveApiKey(credentials, apiKeyEnv);
		const apiKey = resolved?.value;
		entries.push({
			id: `pi-ai:${route}`,
			label: section.displayName ?? route,
			baseUrl: section.baseURL ?? "https://api.deepseek.com",
			source: "llm-pi-ai",
			...apiKeyEnv === void 0 ? {} : { apiKeyEnv },
			...apiKey === void 0 ? {} : { apiKey },
			apiKeyMasked: apiKey === void 0 ? "" : maskApiKey(apiKey),
			hasKey: apiKey !== void 0,
			...apiKey !== void 0 && resolved?.source !== void 0 ? { keySource: resolved.source } : {}
		});
		seen.add(route);
	}
	const deepseek = settings?.get(nsOf("llm-deepseek"));
	if (deepseek !== void 0 && deepseek !== null && typeof deepseek === "object" && !seen.has("deepseek-official")) {
		const apiKeyEnv = typeof deepseek.apiKeyEnv === "string" && deepseek.apiKeyEnv.length > 0 ? deepseek.apiKeyEnv : "DEEPSEEK_API_KEY";
		const resolved = await resolveApiKey(credentials, apiKeyEnv);
		const apiKey = resolved?.value;
		entries.push({
			id: "llm-deepseek:deepseek-official",
			label: "deepseek-official",
			baseUrl: deepseek.baseURL ?? "https://api.deepseek.com",
			source: "llm-deepseek",
			apiKeyEnv,
			...apiKey === void 0 ? {} : { apiKey },
			apiKeyMasked: apiKey === void 0 ? "" : maskApiKey(apiKey),
			hasKey: apiKey !== void 0,
			...apiKey !== void 0 && resolved?.source !== void 0 ? { keySource: resolved.source } : {}
		});
	}
	for (const extra of extraKeys) {
		const key = String(extra.apiKey || "").trim();
		entries.push({
			id: `extra:${extra.id}`,
			label: extra.label || extra.id,
			baseUrl: DEEPSEEK_DEFAULT_BASE_URL,
			source: "extra",
			...key.length > 0 ? { apiKey: key } : {},
			apiKeyMasked: maskApiKey(key),
			hasKey: key.length > 0
		});
	}
	const groups = /* @__PURE__ */ new Map();
	for (const entry of entries) if (entry.apiKey !== void 0 && entry.apiKey.length > 0) {
		const group = groups.get(entry.apiKey);
		if (group === void 0) groups.set(entry.apiKey, [entry]);
		else group.push(entry);
	}
	const folded = /* @__PURE__ */ new Set();
	for (const group of groups.values()) {
		if (group.length <= 1) continue;
		const kept = group[0];
		kept.sharedWith = group.slice(1).map((entry) => ({
			id: entry.id,
			label: entry.label,
			source: entry.source
		}));
		for (const entry of group.slice(1)) folded.add(entry);
	}
	return folded.size === 0 ? entries : entries.filter((entry) => !folded.has(entry));
}
//#endregion
//#region src/host/balance.ts
/** 单次余额请求超时（毫秒）。 */
const BALANCE_TIMEOUT_MS = 1e4;
/** 缓存存活时间（毫秒）。 */
const CACHE_TTL_MS = 6e4;
const cache = /* @__PURE__ */ new Map();
/** 规范化响应：余额字段一律转字符串（官方为字符串数字）。 */
function normalizeBalance(providerId, body) {
	const infos = Array.isArray(body.balance_infos) ? body.balance_infos : [];
	return {
		providerId,
		ok: true,
		is_available: body.is_available === true,
		balance_infos: infos.map((info) => ({
			currency: typeof info.currency === "string" ? info.currency : "CNY",
			total_balance: String(info.total_balance ?? "0"),
			granted_balance: String(info.granted_balance ?? "0"),
			topped_out: info.topped_out === true
		}))
	};
}
/** 查询一个服务商的余额（带超时）。 */
async function fetchOne(entry) {
	if (entry.apiKey === void 0 || entry.apiKey.length === 0) return {
		providerId: entry.id,
		ok: false,
		code: "no-credential",
		error: "no credential configured"
	};
	const url = "https://api.deepseek.com/user/balance";
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), BALANCE_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				authorization: `Bearer ${entry.apiKey}`,
				accept: "application/json"
			},
			signal: controller.signal
		});
		if (response.status === 401 || response.status === 403) return {
			providerId: entry.id,
			ok: false,
			code: "auth-failed",
			error: `HTTP ${response.status}`
		};
		if (!response.ok) return {
			providerId: entry.id,
			ok: false,
			code: "http-error",
			error: `HTTP ${response.status}`
		};
		const body = await response.json();
		return normalizeBalance(entry.id, body);
	} catch (e) {
		const aborted = e instanceof Error && e.name === "AbortError";
		return {
			providerId: entry.id,
			ok: false,
			code: aborted ? "timeout" : "network-failed",
			error: e instanceof Error ? e.message : String(e)
		};
	} finally {
		clearTimeout(timer);
	}
}
/**
* 批量查询余额（并行）。
* @param entries - 服务商列表。
* @param refresh - true 绕过 60s 缓存。
* @returns 与 entries 等长的结果数组。
*/
async function queryBalances(entries, refresh) {
	const now = Date.now();
	return Promise.all(entries.map(async (entry) => {
		if (!refresh) {
			const cached = cache.get(entry.id);
			if (cached !== void 0 && now - cached.at < CACHE_TTL_MS) return cached.result;
		}
		const result = await fetchOne(entry);
		if (result.ok || result.code === "auth-failed" || result.code === "no-credential") cache.set(entry.id, {
			at: now,
			result
		});
		return result;
	}));
}
//#endregion
//#region src/host/update.ts
/**
* dsh-get-balance —— 宿主半边：插件新版本检查。
*
* 以 npm registry 搜索接口（keywords:dsh-get-balance）取线上最新版本，
* 与**被安装根目录的 package.json** 的 version 比对（即本插件安装位置的
* 包清单，经 import.meta.url 相对定位，不依赖任何绝对路径）：
* 返回 { current, latest, hasUpdate }。name 不匹配视为未命中（不提示更新）。
*
* 全程实时读取：每次 updateCheck 都重新读安装位置的包清单、并实时请求
* registry —— 客户端每次页面刷新恰好触发一次检查（并发调用合并为同一在途
* 请求，不引入时间缓存）。因此插件更新落盘后刷新页面即可见新版本号，
* 无需重启宿主。
* 网络失败静默降级为 hasUpdate=false（latest 置空），不打扰用户；
* 失败不做负面缓存，下次刷新自动重试。
*/
/** npm registry 搜索接口：按关键字查本插件，size=1 取第一条。 */
const REGISTRY_URL = "https://registry.npmjs.org/-/v1/search?text=keywords:dsh-get-balance&size=1&from=0";
/** 插件名判断条件：搜索结果 package.name 必须严格等于该值。 */
const PLUGIN_NAME$1 = "dsh-get-balance";
/** 单次 registry 请求超时（毫秒）。 */
const FETCH_TIMEOUT_MS = 8e3;
/** 解析 semver 版本串；非法返回 null（忽略前导 v，容忍空白）。 */
function parseVersion(input) {
	const raw = String(input ?? "").trim().replace(/^v/i, "");
	const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(raw);
	if (m === null) return null;
	const pre = m[4] !== void 0 ? m[4].split(".").filter((p) => p.length > 0) : [];
	return {
		nums: [
			Number(m[1]),
			Number(m[2]),
			Number(m[3])
		],
		pre
	};
}
/** 比较单个预发布标识：纯数字按数值比较，数字 < 字母串，其余按 ASCII。 */
function comparePreIdentifiers(a, b) {
	const na = /^\d+$/.test(a) ? Number(a) : null;
	const nb = /^\d+$/.test(b) ? Number(b) : null;
	if (na !== null && nb !== null) return na === nb ? 0 : na < nb ? -1 : 1;
	if (na !== null) return -1;
	if (nb !== null) return 1;
	return a === b ? 0 : a < b ? -1 : 1;
}
/**
* 判断 candidate 是否严格比 base 更新（semver 规则子集）：
* 主版本三元组数值比较；预发布版劣于正式版，预发布标识逐段比较。
* 任一侧无法解析时返回 false（宁可漏报也不误报）。
*/
function isNewerVersion(candidate, base) {
	const c = parseVersion(candidate);
	const b = parseVersion(base);
	if (c === null || b === null) return false;
	for (let i = 0; i < 3; i++) if (c.nums[i] !== b.nums[i]) return c.nums[i] > b.nums[i];
	if (c.pre.length === 0 && b.pre.length === 0) return false;
	if (c.pre.length === 0) return true;
	if (b.pre.length === 0) return false;
	const len = Math.max(c.pre.length, b.pre.length);
	for (let i = 0; i < len; i++) {
		const ci = c.pre[i];
		const bi = b.pre[i];
		if (ci === void 0) return false;
		if (bi === void 0) return true;
		const cmp = comparePreIdentifiers(ci, bi);
		if (cmp !== 0) return cmp > 0;
	}
	return false;
}
/**
* 读取被安装根目录 package.json 的 version（并校验 name）。
* 编译产物 lib/index.js 相对 `../package.json`；源码直跑（tsx src/…）相对
* `../../package.json`。两候选都失败或 name 不符时回退 process.cwd()。
*
* 每次调用都直接读盘（本地小文件，开销可忽略、远小于一次网络往返）：
* 插件更新命令在磁盘上替换包清单后，下一次 updateCheck 立即读到新版本号，
* 不再依赖旧实现里的进程内永久缓存（那正是「更新后要重启才生效」的根因；
* 外部终端里手动 dsh plugin update 的场景下更没有任何失效时机）。
*/
function readInstalledVersion() {
	const candidates = [new URL("../package.json", import.meta.url), new URL("../../package.json", import.meta.url)];
	let fallback = "";
	for (const url of candidates) try {
		const text = readFileSync(url, "utf8");
		const pkg = JSON.parse(text);
		if (pkg.name === PLUGIN_NAME$1 && typeof pkg.version === "string") return pkg.version;
		if (fallback === "" && typeof pkg.version === "string") fallback = pkg.version;
	} catch {}
	if (fallback === "") try {
		const pkg = JSON.parse(readFileSync("package.json", "utf8"));
		if (pkg.name === PLUGIN_NAME$1 && typeof pkg.version === "string") fallback = pkg.version;
	} catch {}
	return fallback;
}
/** 同一瞬间的并发 updateCheck 合并共享的在途请求（settle 后立即清空，不留时间缓存）。 */
let inflight = null;
/**
* 检查插件更新：registry 最新版 vs 被安装根目录 package.json 版本。
* 每次调用实时读盘 + 实时请求 registry（客户端每次页面刷新触发一次）；
* 瞬间并发合并为同一请求，settle 即清空 —— 不引入任何时间维度的缓存，
* 因此刚发布 / 刚更新的版本号下一次刷新就能查到。
* 网络失败降级为 { current, latest:'', hasUpdate:false }（不做负面缓存，
* 下次刷新自动重试）。
*/
function checkPluginUpdate() {
	if (inflight !== null) return inflight;
	inflight = (async () => {
		const current = readInstalledVersion();
		const latest = await fetchLatest();
		return {
			current,
			latest,
			hasUpdate: isNewerVersion(latest, current)
		};
	})().finally(() => {
		inflight = null;
	});
	return inflight;
}
/** 从 registry 响应里取 name 严格匹配条目的版本（objects 可能有多个）。 */
function pickLatest(objects) {
	if (!Array.isArray(objects)) return "";
	for (const item of objects) {
		const pkg = item?.package;
		if (pkg === void 0 || pkg === null || pkg.name !== PLUGIN_NAME$1) continue;
		return typeof pkg.version === "string" ? pkg.version.trim() : "";
	}
	return "";
}
async function fetchLatest() {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(REGISTRY_URL, {
			signal: controller.signal,
			headers: { accept: "application/json" }
		});
		if (!res.ok) return "";
		return pickLatest((await res.json().catch(() => null))?.objects);
	} catch {
		return "";
	} finally {
		clearTimeout(timer);
	}
}
//#endregion
//#region src/host/plugin-update.ts
/**
* dsh-get-balance —— 宿主半边：执行插件更新命令（后台进程 + 输出缓冲）。
*
* 浏览器半边点击「更新」胶囊 → 确认弹框 → 大日志弹框：本模块以子进程后台
* 执行 `dsh plugin --profile web update dsh-get-balance`，stdout/stderr 实时
* 追加进环形缓冲；客户端轮询 pluginUpdateStatus op 拉取增量日志与运行状态
* （done / exitCode）。同一时刻只允许一个更新进程；进程内缓冲有上限防膨胀。
*
* 【排除「启动更新命令失败」】dsh CLI 常经 pnpm 全局安装，而宿主进程的 PATH
* 未必包含其 bin 目录（如由服务 / 桌面快捷方式拉起、PATH 不完整），裸 spawn
* 'dsh' 会失败。这里按优先级解析可执行文件：
*   1. 显式覆盖 process.env.DSH_BIN（存在才用）；
*   2. 常见全局 bin 目录：PNPM_HOME / %APPDATA%\npm / %LOCALAPPDATA%\pnpm /
*      ~/.local/bin（Windows 依次试 dsh.cmd / dsh.exe / dsh）；
*   3. where / which 沿 PATH 探测；
*   4. 兜底裸命令名（Windows 经 shell 解析 .cmd，命中与否都写入日志，不静默）。
*/
/** 被更新的插件包名（dsh plugin --profile web update <包名>）。 */
const PLUGIN_NAME = "dsh-get-balance";
const WINDOWS = process.platform === "win32";
let run = null;
function appendOutput(rec, text) {
	rec.output = (rec.output + text).slice(-524288);
}
/** 常见全局 bin 目录 × 平台扩展名，生成候选绝对路径。 */
function candidatePaths() {
	const names = WINDOWS ? [
		"dsh.cmd",
		"dsh.exe",
		"dsh"
	] : ["dsh"];
	const dirs = [
		process.env.PNPM_HOME,
		process.env.APPDATA !== void 0 ? join(process.env.APPDATA, "npm") : void 0,
		process.env.LOCALAPPDATA !== void 0 ? join(process.env.LOCALAPPDATA, "pnpm") : void 0,
		process.env.USERPROFILE !== void 0 ? join(process.env.USERPROFILE, ".local", "bin") : void 0,
		process.env.HOME !== void 0 ? join(process.env.HOME, ".local", "bin") : void 0
	];
	const out = [];
	for (const dir of dirs) {
		if (dir === void 0 || dir.length === 0) continue;
		for (const name of names) out.push(join(dir, name));
	}
	return out;
}
/**
* 解析 dsh 可执行文件：显式覆盖 > 常见全局 bin 目录 > where/which 探测 > 裸名。
* 返回值是绝对路径或裸命令名（后者交给 PATH / shell 解析）。
* （导出仅用于冒烟测试；不进入对外 API，index.ts 不 re-export。）
*/
function resolveDshCommand() {
	const explicit = process.env.DSH_BIN;
	if (explicit !== void 0 && explicit.trim().length > 0 && existsSync(explicit.trim())) return explicit.trim();
	for (const candidate of candidatePaths()) if (existsSync(candidate)) return candidate;
	try {
		const probe = spawnSync(WINDOWS ? "where" : "which", ["dsh"], {
			encoding: "utf8",
			windowsHide: true
		});
		if (probe.status === 0 && typeof probe.stdout === "string") {
			const hit = probe.stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0);
			if (hit !== void 0) return hit;
		}
	} catch {}
	return "dsh";
}
/**
* 启动更新进程。已在运行则返回 alreadyRunning=true（不重复启动）；
* 上次已结束则丢弃旧记录重新开始。
*/
function startPluginUpdate() {
	if (run !== null && run.running) return {
		ok: true,
		alreadyRunning: true
	};
	run = null;
	const command = resolveDshCommand();
	let child;
	try {
		child = spawn(command, [
			"plugin",
			"--profile",
			"web",
			"update",
			PLUGIN_NAME
		], {
			shell: WINDOWS,
			windowsHide: true
		});
	} catch (e) {
		return {
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		};
	}
	const rec = {
		child,
		output: "",
		running: true,
		exitCode: null,
		error: "",
		startedAt: Date.now(),
		finishedAt: null
	};
	run = rec;
	child.stdout.on("data", (d) => appendOutput(rec, d.toString()));
	child.stderr.on("data", (d) => appendOutput(rec, d.toString()));
	child.on("error", (err) => {
		appendOutput(rec, `\n[spawn error] ${err.message}\n`);
		rec.error = err.message;
		rec.exitCode = -1;
		rec.running = false;
		rec.finishedAt = Date.now();
	});
	child.on("close", (code) => {
		appendOutput(rec, `\n[exit code ${code ?? "null"}]\n`);
		rec.exitCode = code;
		rec.running = false;
		rec.finishedAt = Date.now();
	});
	return { ok: true };
}
/** 轮询用：当前更新进程（或最近一次已结束进程）的状态与累计输出。 */
function getPluginUpdateStatus() {
	if (run === null) return {
		running: false,
		done: false,
		output: "",
		exitCode: null,
		error: "",
		startedAt: null,
		finishedAt: null
	};
	return {
		running: run.running,
		done: !run.running,
		output: run.output,
		exitCode: run.exitCode,
		error: run.error,
		startedAt: run.startedAt,
		finishedAt: run.finishedAt
	};
}
//#endregion
//#region src/host/ops.ts
/** 读取用户附加 key 列表。 */
async function readExtraKeys() {
	return (await readPluginConfig()).extraKeys;
}
/** 读取完整价格配置（用户已保存 > 内置默认；旧版扁平档位数组自动迁移）。 */
async function readPriceConfig() {
	return (await readPluginConfig()).prices;
}
/** 读取定时自动刷新间隔（秒，0 = 关闭）。 */
async function readAutoSeconds() {
	return (await readPluginConfig()).autoRefreshSeconds;
}
/** 读取「显示余额」开关（false = footer 与余额列表的金额掩码为 **）。 */
async function readShowBalance() {
	return (await readPluginConfig()).showBalance;
}
/**
* 执行一个 op。
* @param deps - apply 注入的宿主依赖。
* @param request - OpRequest（HTTP 与命令通道共用形状）。
* @returns OpResult 形状载荷（不抛异常；内部错误映射为 ok:false）。
*/
async function runOp(deps, request) {
	try {
		switch (request.op) {
			case "providers": {
				const credentials = deps.getCredentials?.();
				return {
					ok: true,
					providers: (await listDeepseekProviders(deps.settings, deps.nsOf, credentials, await readExtraKeys())).map(({ apiKey: _apiKey, ...rest }) => rest),
					credentialsPresent: credentials !== void 0
				};
			}
			case "balance": {
				const credentials = deps.getCredentials?.();
				return {
					ok: true,
					balances: await queryBalances(await listDeepseekProviders(deps.settings, deps.nsOf, credentials, await readExtraKeys()), request.refresh === true)
				};
			}
			case "cost": {
				const sessionId = typeof request.sessionId === "string" ? request.sessionId : "";
				const providerBaseUrls = listProviderBaseUrls(deps.settings, deps.nsOf);
				return {
					ok: true,
					cost: await computeCosts(sessionId, deps.sessions, await readPriceConfig(), process.cwd(), providerBaseUrls)
				};
			}
			case "pricesGet": return {
				ok: true,
				config: await readPriceConfig()
			};
			case "pricesSave": {
				const raw = request.config;
				if (raw === void 0 || raw === null || typeof raw !== "object" || !Array.isArray(raw.tiers)) return {
					ok: false,
					code: "params-invalid",
					error: "config.tiers must be an array"
				};
				const config = normalizePriceConfig(raw);
				if (config.tiers.length === 0) return {
					ok: false,
					code: "params-invalid",
					error: "keep at least one price tier"
				};
				await savePluginConfig({ prices: config });
				return {
					ok: true,
					config
				};
			}
			case "keysGet": return {
				ok: true,
				keys: (await readExtraKeys()).map((key) => ({
					id: key.id,
					label: key.label,
					apiKeyMasked: maskKeyForClient(key.apiKey)
				}))
			};
			case "keysSave": {
				if (!Array.isArray(request.keys)) return {
					ok: false,
					code: "params-invalid",
					error: "keys must be an array"
				};
				const previous = await readExtraKeys();
				const next = request.keys.map((item, index) => {
					const id = typeof item.id === "string" && item.id.length > 0 ? item.id : `k${Date.now().toString(36)}-${index}`;
					const incoming = typeof item.apiKey === "string" ? item.apiKey.trim() : "";
					const kept = previous.find((p) => p.id === id);
					return {
						id,
						label: typeof item.label === "string" ? item.label : "",
						apiKey: incoming.length > 0 ? incoming : kept?.apiKey ?? ""
					};
				}).filter((key) => key.apiKey.length > 0);
				await savePluginConfig({ extraKeys: next });
				return {
					ok: true,
					keys: next.map((key) => ({
						id: key.id,
						label: key.label,
						apiKeyMasked: maskKeyForClient(key.apiKey)
					}))
				};
			}
			case "autoRefreshGet": return {
				ok: true,
				seconds: await readAutoSeconds()
			};
			case "autoRefreshSave": {
				const seconds = typeof request.seconds === "number" && Number.isFinite(request.seconds) ? Math.round(request.seconds) : Number(String(request.seconds ?? "").trim());
				if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) return {
					ok: false,
					code: "params-invalid",
					error: "seconds must be 0..86400"
				};
				await savePluginConfig({ autoRefreshSeconds: seconds });
				return {
					ok: true,
					seconds
				};
			}
			case "showBalanceGet": return {
				ok: true,
				enabled: await readShowBalance()
			};
			case "showBalanceSave":
				if (typeof request.enabled !== "boolean") return {
					ok: false,
					code: "params-invalid",
					error: "enabled must be a boolean"
				};
				await savePluginConfig({ showBalance: request.enabled });
				return {
					ok: true,
					enabled: request.enabled
				};
			case "updateCheck": return {
				ok: true,
				update: await checkPluginUpdate()
			};
			case "pluginUpdateStart": {
				const start = startPluginUpdate();
				return start.ok ? {
					ok: true,
					alreadyRunning: start.alreadyRunning === true
				} : {
					ok: false,
					code: "spawn-failed",
					error: start.error ?? "failed to spawn dsh"
				};
			}
			case "pluginUpdateStatus": return {
				ok: true,
				status: getPluginUpdateStatus()
			};
			default: return {
				ok: false,
				code: "op-unknown",
				error: `unknown op: ${String(request.op)}`
			};
		}
	} catch (e) {
		return {
			ok: false,
			code: "internal-error",
			error: e instanceof Error ? e.message : String(e)
		};
	}
}
/** 与 providers.maskApiKey 同规则的客户端脱敏（避免循环依赖，本地小副本）。 */
function maskKeyForClient(key) {
	const k = String(key || "").trim();
	if (k.length === 0) return "";
	if (k.length <= 10) return k.slice(0, 2) + "****";
	return k.slice(0, 5) + "…" + k.slice(-4);
}
//#endregion
//#region src/host/index.ts
const name = "dsh-get-balance";
const inject = [
	"shell",
	"settings",
	"commands"
];
const Config = Schema.object({});
const API_BODY_LIMIT = 1 << 20;
function writeApiJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
function apply(ctx, _config) {
	if (ctx.get("shell") === void 0) return;
	const settings = ctx.get("settings");
	const commands = ctx.get("commands");
	const sessions = ctx.get("sessions");
	initConfigFile({
		ctx,
		settings
	});
	const deps = {
		...settings === void 0 ? {} : { settings },
		nsOf: settingsNamespace,
		getCredentials: () => ctx.get("credentials"),
		...sessions === void 0 ? {} : { sessions }
	};
	const webServer = ctx.get("webServer");
	const webRuntime = ctx.get("webRuntime");
	if (webServer !== void 0) {
		const fence = (headers) => isTrustedApiRequest(headers, webRuntime?.trustedHosts ?? []);
		try {
			webServer.register({
				kind: "exact",
				path: "/dsh-balance/api",
				handler: async (req, res) => {
					if (!fence(req.headers)) {
						writeApiJson(res, 403, {
							ok: false,
							error: {
								code: "forbidden",
								message: "forbidden"
							}
						});
						return;
					}
					if (req.method !== "POST") {
						writeApiJson(res, 405, {
							ok: false,
							error: {
								code: "method-error",
								message: "method not allowed"
							}
						});
						return;
					}
					const chunks = [];
					let total = 0;
					for await (const chunk of req) {
						const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
						total += buffer.length;
						if (total > API_BODY_LIMIT) {
							writeApiJson(res, 413, {
								ok: false,
								error: {
									code: "body-too-large",
									message: "request body too large"
								}
							});
							return;
						}
						chunks.push(buffer);
					}
					const text = Buffer.concat(chunks).toString("utf8");
					let request = { op: "" };
					if (text.trim().length > 0) try {
						request = JSON.parse(text);
					} catch {
						writeApiJson(res, 400, {
							ok: false,
							error: {
								code: "params-invalid",
								message: "Parameters must be JSON"
							}
						});
						return;
					}
					try {
						writeApiJson(res, 200, {
							ok: true,
							value: await runOp(deps, request)
						});
					} catch (e) {
						writeApiJson(res, 200, {
							ok: true,
							value: {
								ok: false,
								code: "internal-error",
								error: e instanceof Error ? e.message : String(e)
							}
						});
					}
				}
			});
		} catch {}
		const iconRoute = "/plugins/dsh-get-balance/assets/wallet-money-duotone-128x128.png";
		const iconPath = fileURLToPath(new URL("../assets/wallet-money-duotone-128x128.png", import.meta.url));
		let iconCache = null;
		let iconWarned = false;
		try {
			webServer.register({
				kind: "exact",
				path: iconRoute,
				handler: async (req, res) => {
					if (req.method !== "GET" && req.method !== "HEAD") {
						res.writeHead(405);
						res.end();
						return;
					}
					if (iconCache === null) try {
						iconCache = await readFile(iconPath);
					} catch (e) {
						if (!iconWarned) {
							iconWarned = true;
							console.warn(`[dsh-get-balance] footer icon missing: ${iconPath}`, e instanceof Error ? e.message : String(e));
						}
						res.writeHead(404);
						res.end();
						return;
					}
					res.writeHead(200, {
						"content-type": "image/png",
						"cache-control": "no-cache"
					});
					res.end(req.method === "HEAD" ? void 0 : iconCache);
				}
			});
		} catch {}
	}
	if (commands !== void 0) commands.register({
		name: "dsh-balance",
		description: "DeepSeek 余额与费用查询：列出服务商、查询官方余额、计算费用（最近一次提问/本会话/今日·本项目/今日·全部）、管理价格档与附加 API key。Query DeepSeek balances and token costs. 参数为 JSON：{ \"op\": \"providers|balance|cost|pricesGet|pricesSave|keysGet|keysSave|autoRefreshGet|autoRefreshSave|updateCheck|pluginUpdateStart|pluginUpdateStatus\", \"sessionId\": \"...\", \"refresh\": true, ... }。",
		input: { hint: "{\"op\":\"balance\"}" },
		recordInput: true,
		handler: async (invocation) => {
			const raw = (invocation.rawInput ?? "").trim();
			let req = { op: "" };
			if (raw.length > 0) try {
				req = JSON.parse(raw);
			} catch {
				return {
					kind: "error",
					text: JSON.stringify({
						ok: false,
						code: "params-invalid",
						error: "Parameters must be JSON"
					})
				};
			}
			try {
				const payload = await runOp(deps, req);
				return {
					kind: "success",
					text: JSON.stringify(payload)
				};
			} catch (e) {
				return {
					kind: "error",
					text: JSON.stringify({
						ok: false,
						code: "internal-error",
						error: e instanceof Error ? e.message : String(e)
					})
				};
			}
		}
	});
}
//#endregion
export { Config, apply, inject, name };
