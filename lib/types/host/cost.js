/**
 * dsh-get-balance —— 宿主半边：费用计算。
 *
 * 三条数据链：
 * 1. 内存会话（ctx.sessions.get）：经 snapshotEvents() 取全量事件日志，复刻官方
 *    tokenUsage 投影的折叠语义 —— 'assistant/chunk'(chunk.type==='usage') 提供早期样本，
 *    'assistant/message' 提供同一 (turn,step) 的最终样本，后值覆盖前值，
 *    不重复计费；'request/context' 追踪当前模型与服务商用于匹配价格档。
 * 2. 磁盘会话兜底 + 子代理并入：已从内存注销的会话（如已结束的子代理，
 *    dispose 后 ctx.sessions 不再保留）按 id 从 dshHomePath('sessions')/
 *    <project>/<sessionId>/session.jsonl(.zstd) 读回；「本会话」再按
 *    header.parentSession 血缘（同项目目录）把子孙子代理会话的用量一并折叠
 *    进当前会话 —— 任务开子代理产生的流量归到主任务同一会话头上。
 * 3. 今日磁盘聚合：扫描 dshHomePath('sessions')/<project>/<sessionId>/
 *    session.jsonl(.zstd)，mtime >= 今日零点粗筛 → 解析复用 log-cache 的
 *    内存样本缓存（同文件 mtime/size 未变不重复解压）→ 只取 time >= 今日
 *    零点、已由 parseLogFile 固化了 model/provider 的样本 → 按服务商分组、
 *    组内按事件自身时段拆高峰/空闲，官方 key 另按模型进 billable 计费。
 *    当天数据始终实时；历史日由 series-store 的按日聚合存储提供，不重复拉取。
 *
 * 按 API key（服务商条目）分组统计：每个 provider（会话事件中的服务商路由，
 * 对应一个 API key）各自累计 token 四桶 —— 不区分官方与否，一律只统计数量；
 * 费用只对官方 key（baseURL 域名 == api.deepseek.com）按 模型 × 高峰/空闲时段
 * 计费，非官方 key 金额恒为 0（展示为「不计费」）。token 消耗量统计全部流量，
 * 费用预估只针对 DeepSeek 自身的官方流量。
 *
 * 计费口径（每百万 tokens 单价）：时段判定：事件时间 → 配置时区偏移后的本地
 * HH:MM → 是否落在任一高峰窗口（开启「周六日半价」时周六/周日整天为空闲）；
 * 其余时间为空闲时段。同一模型两套单价分别用于
 * 对应时段。(uncachedInput*input + cacheRead*cacheRead + cacheWrite*cacheWrite
 * + output*output) / 1e6
 */
import { closeSync, openSync, readSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { decodeLog, getParsedFile } from "./log-cache.js";
/** 默认时区偏移：北京时间 UTC+8（分钟）。 */
export const DEFAULT_TIMEZONE_OFFSET_MINUTES = 480;
/** 默认高峰时段窗口（官方口径：北京时间 9:00–12:00、14:00–18:00；其余为空闲）。 */
export const DEFAULT_PEAK_WINDOWS = [
    { start: '09:00', end: '12:00' },
    { start: '14:00', end: '18:00' },
];
/**
 * 内置默认价格档（DeepSeek 官方指导价，CNY / 每百万 tokens；2026 现行 V4 系列）。
 * 与官方价目表一致：仅三档模型，名称用官方模型版本号；无「兜底」档。
 * 高峰：北京时间 9:00–12:00、14:00–18:00；空闲 = 高峰 × 0.5。
 */
export const DEFAULT_PRICES = [
    {
        id: 'deepseek-v4-flash', name: 'deepseek-v4-flash', currency: 'CNY', match: 'deepseek-v4-flash',
        peak: { input: 3.0, cacheRead: 0.10, cacheWrite: 0, output: 9.0 },
        offPeak: { input: 1.5, cacheRead: 0.05, cacheWrite: 0, output: 4.5 },
    },
    {
        id: 'deepseek-v4-pro', name: 'deepseek-v4-pro', currency: 'CNY', match: 'deepseek-v4-pro',
        peak: { input: 9.0, cacheRead: 0.30, cacheWrite: 0, output: 27.0 },
        offPeak: { input: 4.5, cacheRead: 0.15, cacheWrite: 0, output: 13.5 },
    },
    {
        id: 'deepseek-v4-flash-vision-exp', name: 'deepseek-v4-flash-vision-exp', currency: 'CNY', match: 'deepseek-v4-flash-vision-exp',
        peak: { input: 3.0, cacheRead: 0.10, cacheWrite: 0, output: 9.0 },
        offPeak: { input: 1.5, cacheRead: 0.05, cacheWrite: 0, output: 4.5 },
    },
];
/** 内置默认完整价格配置。 */
export const DEFAULT_PRICE_CONFIG = {
    tiers: DEFAULT_PRICES.map((tier) => ({
        ...tier,
        peak: { ...tier.peak },
        offPeak: { ...tier.offPeak },
    })),
    timezoneOffsetMinutes: DEFAULT_TIMEZONE_OFFSET_MINUTES,
    peakWindows: DEFAULT_PEAK_WINDOWS.map((w) => ({ ...w })),
    weekendOffPeak: false,
};
/** 取一个会话视图的全部事件：宿主 Session 走 snapshotEvents()，磁盘视图走 events 数组。 */
function eventsOf(session) {
    if (typeof session.snapshotEvents === 'function')
        return session.snapshotEvents();
    return session.events ?? [];
}
const zeroBuckets = () => ({ uncachedInput: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
const numberOr = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
/** 金额保留 6 位小数（与 token 单价的每百万口径精度匹配）。 */
const round6 = (v) => Math.round(v * 1e6) / 1e6;
/** usage -> 四桶（与官方 bucketsFrom 一致：cacheRead/cacheWrite 缺省 0）。 */
function bucketsFrom(usage) {
    return {
        uncachedInput: numberOr(usage.inputTokens),
        cacheRead: numberOr(usage.cacheReadTokens),
        cacheWrite: numberOr(usage.cacheWriteTokens),
        output: numberOr(usage.outputTokens),
    };
}
function addBuckets(target, next) {
    target.uncachedInput += next.uncachedInput;
    target.cacheRead += next.cacheRead;
    target.cacheWrite += next.cacheWrite;
    target.output += next.output;
}
/* ── 价格配置规范化 / 旧数据迁移 ────────────────────────────── */
const numberOrZero = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
function normalizePeriod(raw) {
    const obj = (raw !== null && typeof raw === 'object' ? raw : {});
    return {
        input: numberOrZero(obj['input']),
        cacheRead: numberOrZero(obj['cacheRead']),
        cacheWrite: numberOrZero(obj['cacheWrite']),
        output: numberOrZero(obj['output']),
    };
}
/** 规范化一个档位：新版（peak/offPeak）原样；旧版扁平单价迁移为 高峰=原价、空闲=原价（行为不变）。 */
function normalizeTier(raw, index) {
    const obj = (raw !== null && typeof raw === 'object' ? raw : {});
    const hasPeriods = obj['peak'] !== undefined && obj['offPeak'] !== undefined;
    const peak = normalizePeriod(hasPeriods ? obj['peak'] : raw);
    const offPeak = normalizePeriod(hasPeriods ? obj['offPeak'] : raw);
    const id = typeof obj['id'] === 'string' && obj['id'].length > 0 ? obj['id'] : 'tier-' + index;
    return {
        id,
        name: typeof obj['name'] === 'string' ? obj['name'] : id,
        currency: typeof obj['currency'] === 'string' && obj['currency'].length > 0 ? obj['currency'] : 'CNY',
        match: typeof obj['match'] === 'string' && obj['match'].length > 0 ? obj['match'] : '*',
        peak,
        offPeak,
    };
}
/** 解析 'HH:MM' 为当日分钟数；非法返回 undefined。 */
function parseClock(value) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
    if (m === null)
        return undefined;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59)
        return undefined;
    return h * 60 + min;
}
/** DeepSeek 官方接口域名（判断是否官方服务商的唯一标准）。 */
export const OFFICIAL_API_HOST = 'api.deepseek.com';
/**
 * 判定一个 provider（会话事件中的服务商 key，如 deepseek-official / openrouter）
 * 是否走 DeepSeek 官方接口：provider 的 baseURL 域名必须为 api.deepseek.com。
 * provider 缺失或未在配置中登记 → 非官方，过滤。
 */
export function isOfficialProvider(provider, providerBaseUrls) {
    if (typeof provider !== 'string' || provider.length === 0)
        return false;
    const baseUrl = providerBaseUrls[provider];
    if (typeof baseUrl !== 'string' || baseUrl.length === 0)
        return false;
    try {
        return new URL(baseUrl).hostname.toLowerCase() === OFFICIAL_API_HOST;
    }
    catch {
        return false;
    }
}
/** 旧版本内置默认档的三档 id（deepseek-chat / deepseek-reasoner / 兜底）。 */
const LEGACY_DEFAULT_TIER_IDS = new Set(['deepseek-chat', 'deepseek-reasoner', 'fallback']);
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
export function normalizePriceConfig(raw) {
    const fallback = () => JSON.parse(JSON.stringify(DEFAULT_PRICE_CONFIG));
    if (Array.isArray(raw)) {
        const tiers = raw.map((item, index) => normalizeTier(item, index));
        if (tiers.length === 0)
            return fallback();
        if (isLegacyDefaultTiers(tiers))
            return fallback();
        return { ...fallback(), tiers };
    }
    if (raw !== null && typeof raw === 'object') {
        const obj = raw;
        const tiersRaw = obj['tiers'];
        if (!Array.isArray(tiersRaw) || tiersRaw.length === 0)
            return fallback();
        const tiers = tiersRaw.map((item, index) => normalizeTier(item, index));
        if (isLegacyDefaultTiers(tiers))
            return fallback();
        const offset = numberOr(obj['timezoneOffsetMinutes'], DEFAULT_TIMEZONE_OFFSET_MINUTES);
        const windowsRaw = obj['peakWindows'];
        const windows = Array.isArray(windowsRaw) && windowsRaw.length > 0
            ? windowsRaw
                .map((w) => {
                const o = (w !== null && typeof w === 'object' ? w : {});
                const start = typeof o['start'] === 'string' ? o['start'] : '';
                const end = typeof o['end'] === 'string' ? o['end'] : '';
                return (parseClock(start) !== undefined && parseClock(end) !== undefined) ? { start, end } : undefined;
            })
                .filter((w) => w !== undefined)
            : [];
        return {
            tiers,
            timezoneOffsetMinutes: Math.round(offset),
            peakWindows: windows.length > 0 ? windows : DEFAULT_PEAK_WINDOWS.map((w) => ({ ...w })),
            weekendOffPeak: obj['weekendOffPeak'] === true,
        };
    }
    return fallback();
}
/* ── 时段判定与计费 ─────────────────────────────────────────── */
/**
 * 判定一个时刻是否处于高峰时段。
 * @param timeMs - 事件时间（ms）。
 * @param config - 价格配置（含时区偏移与高峰窗口；开启周六日半价时周末整天为空闲）。
 */
export function isPeakTime(timeMs, config) {
    const local = new Date(timeMs + config.timezoneOffsetMinutes * 60_000);
    // 周六日半价：周六/周日整天从高峰窗口中排除，按空闲时段计费。
    if (config.weekendOffPeak === true) {
        const day = local.getUTCDay();
        if (day === 0 || day === 6)
            return false;
    }
    const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
    for (const window of config.peakWindows) {
        const start = parseClock(window.start);
        const end = parseClock(window.end);
        if (start === undefined || end === undefined)
            continue;
        // 支持跨午夜的窗口：start <= end 时取 [start, end)；start > end 时取 [start, 1440) ∪ [0, end)。
        if (start <= end) {
            if (minutes >= start && minutes < end)
                return true;
        }
        else if (minutes >= start || minutes < end) {
            return true;
        }
    }
    return false;
}
/** 取某档在指定时刻生效的单价集合。 */
export function periodPricesOf(tier, timeMs, config) {
    return isPeakTime(timeMs, config) ? tier.peak : tier.offPeak;
}
/**
 * 价格档匹配：精确模型 id > 模型 id 前缀 > '*' 通配兜底。
 * @param model - 当前模型 id（可为空）。
 * @param prices - 价格档列表（空列表返回 undefined）。
 */
export function matchTier(model, prices) {
    if (prices.length === 0)
        return undefined;
    const m = model ?? '';
    if (m.length > 0) {
        const exact = prices.find((t) => t.match === m);
        if (exact !== undefined)
            return exact;
        const prefix = prices.find((t) => t.match !== '*' && t.match.length > 0 && m.startsWith(t.match));
        if (prefix !== undefined)
            return prefix;
    }
    return prices.find((t) => t.match === '*') ?? prices[0];
}
/** 按一组单价计费（每百万 tokens 单价）。 */
export function costOf(buckets, period) {
    if (period === undefined)
        return 0;
    return (buckets.uncachedInput * period.input
        + buckets.cacheRead * period.cacheRead
        + buckets.cacheWrite * period.cacheWrite
        + buckets.output * period.output) / 1_000_000;
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
    let currency = 'CNY';
    const byKey = [];
    for (const group of groups) {
        if (totalTokens(group.buckets) <= 0)
            continue;
        addBuckets(buckets, group.buckets);
        byKey.push({ provider: group.provider, buckets: { ...group.buckets }, official: group.official, amount: group.amount, currency: group.currency });
        if (group.official) {
            amount += group.amount;
            if (group.currency !== '')
                currency = group.currency;
        }
    }
    byKey.sort((a, b) => totalTokens(b.buckets) - totalTokens(a.buckets));
    return { amount: round6(amount), currency, buckets, byKey };
}
/**
 * 折叠内存会话事件为 per-(turn,step) 样本表（官方投影语义：后值覆盖前值）。
 * 同时追踪每个样本所属模型与服务商（取样本之前最近一次 request/context）与时间。
 */
function foldSessionEvents(events) {
    const samples = new Map();
    let currentModel;
    let currentProvider;
    let maxTurn = -1;
    for (const event of events) {
        const data = event.data;
        if (data === undefined)
            continue;
        if (event.type === 'request/context') {
            if (typeof data.model === 'string' && data.model.length > 0)
                currentModel = data.model;
            if (typeof data.provider === 'string' && data.provider.length > 0)
                currentProvider = data.provider;
            continue;
        }
        let usage;
        if (event.type === 'assistant/chunk' && data.chunk?.type === 'usage') {
            usage = data.chunk.usage;
        }
        else if (event.type === 'assistant/message') {
            usage = data.usage;
        }
        if (usage === undefined)
            continue;
        const turn = numberOr(data.turn);
        const step = numberOr(data.step);
        samples.set(turn + ':' + step, {
            turn,
            step,
            buckets: bucketsFrom(usage),
            ...currentModel === undefined ? {} : { model: currentModel },
            ...currentProvider === undefined ? {} : { provider: currentProvider },
            ...typeof event.time === 'number' && Number.isFinite(event.time) ? { time: event.time } : {},
            ...event.type === 'assistant/message' ? { final: true } : {},
        });
        if (turn > maxTurn)
            maxTurn = turn;
    }
    return { samples, maxTurn };
}
/**
 * 取最近一次「已完成的请求」样本：turn 最大、step 最大，且必须由
 * assistant/message 落盘（final）—— 流式中的 usage chunk 早期样本不算完成。
 */
function lastCompletedSample(samples) {
    let best;
    for (const sample of samples.values()) {
        if (sample.final !== true)
            continue;
        if (best === undefined || sample.turn > best.turn || (sample.turn === best.turn && sample.step > best.step))
            best = sample;
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
    const groups = new Map();
    for (const sample of samples) {
        const key = typeof sample.provider === 'string' && sample.provider.length > 0 ? sample.provider : 'unknown';
        let group = groups.get(key);
        if (group === undefined) {
            // 同一 provider 的 baseURL 固定，官方属性对首个样本判定一次即可。
            group = { buckets: zeroBuckets(), official: isOfficialProvider(sample.provider, providerBaseUrls), amount: 0, currency: '' };
            groups.set(key, group);
        }
        addBuckets(group.buckets, sample.buckets);
        if (group.official) {
            const tier = matchTier(sample.model, prices);
            if (tier !== undefined)
                group.currency = tier.currency;
            group.amount += costOf(sample.buckets, tier === undefined ? undefined : periodPricesOf(tier, sample.time ?? Date.now(), config));
        }
    }
    const byKey = [...groups.entries()].map(([provider, g]) => ({
        provider,
        buckets: { ...g.buckets },
        official: g.official,
        amount: round6(g.amount),
        currency: g.currency,
    }));
    return { byKey };
}
/* ── 会话解析（内存 → 磁盘兜底）与子代理血缘并入 ───────────── */
/** 会话日志根目录；解析失败（home 不可用）返回 undefined。 */
function sessionsRoot() {
    try {
        return dshHomePath('sessions');
    }
    catch {
        return undefined;
    }
}
/**
 * 复刻 dsh-session-persistence-jsonl/format.projectKey：把 cwd 编码为
 * 磁盘上的项目目录名（分隔符 → '-'，非安全字符 → '~XXXX'，前缀 '--' 后缀 '--'）。
 * 宿主后端按此命名存放会话日志，这里必须逐字节一致才能定位子代理日志。
 */
function projectKeyOf(cwd) {
    if (cwd.length === 0)
        throw new Error('cannot encode an empty project path');
    let readable = '';
    let separatorRun = false;
    for (let i = 0; i < cwd.length; i++) {
        const code = cwd.charCodeAt(i);
        const ch = String.fromCharCode(code);
        if (ch === '/' || ch === '\\' || ch === ':') {
            if (!separatorRun)
                readable += '-';
            separatorRun = true;
        }
        else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
            readable += ch;
            separatorRun = false;
        }
        else {
            readable += '~' + code.toString(16).toUpperCase().padStart(4, '0');
            separatorRun = false;
        }
    }
    const slug = readable.replace(/^-+/, '') || 'root';
    return `--${slug.slice(0, 251)}--`;
}
/** zstd 魔数在 buffer 中的首个出现位置；未找到返回 -1。 */
function indexOfMagic(raw) {
    for (let i = 0; i + 4 <= raw.length; i++) {
        if (raw[i] === ZSTD_MAGIC[0] && raw[i + 1] === ZSTD_MAGIC[1] && raw[i + 2] === ZSTD_MAGIC[2] && raw[i + 3] === ZSTD_MAGIC[3])
            return i;
    }
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
        fd = openSync(path, 'r');
    }
    catch {
        return undefined;
    }
    try {
        const buf = Buffer.alloc(64 * 1024);
        const bytesRead = readSync(fd, buf, 0, buf.length, 0);
        const head = buf.subarray(0, bytesRead);
        if (isZstd === false) {
            const nl = head.indexOf(0x0a);
            if (nl !== -1)
                return head.subarray(0, nl).toString('utf8');
            return readFileSync(path).toString('utf8').split('\n', 1)[0];
        }
        const start = indexOfMagic(head);
        if (start === -1)
            return undefined;
        try {
            // zstdDecompressSync 对多帧输入只解首帧（丢弃其后帧），首行即 header。
            return zstdDecompressSync(head.subarray(start)).toString('utf8').split('\n', 1)[0];
        }
        catch {
            // 首帧在 64KB 内不完整：整读后解首帧兜底。
            const raw = readFileSync(path);
            const s = indexOfMagic(raw);
            if (s === -1)
                return undefined;
            try {
                return zstdDecompressSync(raw.subarray(s)).toString('utf8').split('\n', 1)[0];
            }
            catch {
                return undefined;
            }
        }
    }
    catch {
        return undefined;
    }
    finally {
        try {
            closeSync(fd);
        }
        catch { /* 关闭失败忽略 */ }
    }
}
/** 解析日志 header 行：返回 id / cwd / parentSession；非会话首行返回 undefined。 */
function parseLogHeader(line) {
    let parsed;
    try {
        parsed = JSON.parse(line);
    }
    catch {
        return undefined;
    }
    if (parsed.type !== 'session' || typeof parsed.id !== 'string' || parsed.id.length === 0)
        return undefined;
    return {
        id: parsed.id,
        ...typeof parsed.cwd === 'string' && parsed.cwd.length > 0 ? { cwd: parsed.cwd } : {},
        ...typeof parsed.parentSession === 'string' && parsed.parentSession.length > 0 ? { parentSession: parsed.parentSession } : {},
    };
}
/**
 * 解析日志事件行（跳过首行 header）为 SessionEventLike[]（与内存会话同一视图）。
 */
export function parseLogEvents(text) {
    const events = [];
    let first = true;
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        if (first) {
            first = false;
            continue;
        }
        if (typeof parsed.type !== 'string')
            continue;
        events.push({
            type: parsed.type,
            ...typeof parsed.time === 'number' ? { time: parsed.time } : {},
            ...parsed.data !== undefined && parsed.data !== null ? { data: parsed.data } : {},
        });
    }
    return events;
}
/**
 * 项目目录的会话索引缓存：key = 目录名集合（排序拼接）。新会话 = 新目录 →
 * 目录名集合变化即重建；TTL 仅作兜底（header 为会话创建时写入，内容不变）。
 * readSessionLog（已结束会话定位）与 foldDescendantSamples（子代理血缘）共用，
 * 避免每次 cost op 都重读项目下所有日志的 header。
 */
const projectIndexCache = new Map();
const PROJECT_INDEX_TTL_MS = 60_000;
/** 取一个项目目录的会话索引（id → 日志位置 + header 血缘信息）。 */
function projectSessionIndex(projectDirPath) {
    let names;
    try {
        names = readdirSync(projectDirPath);
    }
    catch {
        return new Map();
    }
    const dirKey = [...names].sort().join('\u0000');
    const now = Date.now();
    const cached = projectIndexCache.get(projectDirPath);
    if (cached !== undefined && cached.dirKey === dirKey && now - cached.at < PROJECT_INDEX_TTL_MS) {
        return cached.byId;
    }
    const byId = new Map();
    for (const name of names) {
        const dir = join(projectDirPath, name);
        const candidates = [
            { path: join(dir, 'session.jsonl.zstd'), zstd: true },
            { path: join(dir, 'session.jsonl'), zstd: false },
        ];
        for (const candidate of candidates) {
            const headerLine = readHeaderLine(candidate.path, candidate.zstd);
            if (headerLine === undefined)
                continue;
            const header = parseLogHeader(headerLine);
            if (header === undefined)
                break;
            byId.set(header.id, {
                path: candidate.path,
                zstd: candidate.zstd,
                ...header.cwd !== undefined ? { cwd: header.cwd } : {},
                ...header.parentSession !== undefined ? { parentSession: header.parentSession } : {},
            });
            break;
        }
    }
    projectIndexCache.set(projectDirPath, { dirKey, at: now, byId });
    return byId;
}
/**
 * 按 id 从磁盘定位一个会话日志并读回（内存已注销的会话 —— 如已结束的
 * 子代理 —— 走这里）。经项目会话索引定位（索引按目录集变化失效），
 * 命中后整包解码。
 */
function readSessionLog(sessionId) {
    const root = sessionsRoot();
    if (root === undefined)
        return undefined;
    let projects;
    try {
        projects = readdirSync(root);
    }
    catch {
        return undefined;
    }
    for (const project of projects) {
        const byId = projectSessionIndex(join(root, project));
        const rec = byId.get(sessionId);
        if (rec === undefined)
            continue;
        const text = decodeLog(rec.path, rec.zstd);
        if (text === undefined)
            return undefined;
        return {
            ...rec.cwd !== undefined ? { header: { cwd: rec.cwd } } : {},
            events: parseLogEvents(text),
        };
    }
    return undefined;
}
/**
 * 收集当前会话的子孙会话（子代理）样本：同项目目录下按 header.parentSession
 * 血缘 BFS，逐层整包解码子会话日志并折叠。返回的样本表用子会话 id 做键前缀
 * 命名空间，避免与主会话的 (turn,step) 键冲突。子代理是独立会话（header 标记
 * origin='subagent' / delegationDepth>0 / parentSession），与父任务同 cwd。
 * 解码是同步的：逐文件让出事件循环，避免阻塞并发 op（如余额查询）。
 * @param sessionId - 当前会话 id（血缘根）。
 * @param cwd - 当前会话的项目目录（决定扫描哪个项目目录；缺省 _no-cwd）。
 */
async function foldDescendantSamples(sessionId, cwd) {
    const out = new Map();
    if (sessionId.length === 0)
        return out;
    const root = sessionsRoot();
    if (root === undefined)
        return out;
    const projectDirPath = cwd !== undefined ? join(root, projectKeyOf(cwd)) : join(root, '_no-cwd');
    // 项目会话索引（目录集变化即重建）→ id → parentSession 血缘表。
    const byId = projectSessionIndex(projectDirPath);
    // BFS：从当前会话出发沿 parentSession 向下找直接/间接子会话。
    const visited = new Set([sessionId]);
    const queue = [sessionId];
    let parsedCount = 0;
    while (queue.length > 0) {
        const parent = queue.shift();
        for (const [childId, rec] of byId) {
            if (rec.parentSession !== parent || visited.has(childId))
                continue;
            visited.add(childId);
            queue.push(childId);
            const text = decodeLog(rec.path, rec.zstd);
            if (text === undefined)
                continue;
            const { samples } = foldSessionEvents(parseLogEvents(text));
            for (const [key, sample] of samples)
                out.set(childId + ':' + key, sample);
            if ((++parsedCount & 3) === 0)
                await new Promise((resolve) => setImmediate(resolve));
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
 * @param providerBaseUrls - provider 路由 → baseURL（平台名与官方判定）。
 */
export async function computeCosts(sessionId, sessions, config, fallbackCwd, providerBaseUrls = {}) {
    // 当前会话自身事件：内存优先，磁盘日志兜底。
    const live = sessionId.length > 0 ? sessions?.get(sessionId) : undefined;
    let own = live;
    if (own === undefined && sessionId.length > 0) {
        // 磁盘兜底是整包解压（可能很慢）：先让出事件循环，让并发请求（如余额
        // 查询）先得到处理，避免余额显示被本 op 的解析卡住。
        await new Promise((resolve) => setImmediate(resolve));
        own = readSessionLog(sessionId);
    }
    const cwd = own?.header?.cwd !== undefined && own.header.cwd.length > 0 ? own.header.cwd : fallbackCwd;
    const { samples, maxTurn } = foldSessionEvents(own !== undefined ? eventsOf(own) : []);
    let sessionModel;
    for (const sample of samples.values()) {
        if (sample.model !== undefined)
            sessionModel = sample.model;
    }
    // 子代理并入「本会话」：血缘 BFS 折叠子孙会话（独立日志，全量事件，无今日过滤）。
    const descendantSamples = await foldDescendantSamples(sessionId, own?.header?.cwd);
    const merged = new Map(samples);
    for (const [key, sample] of descendantSamples)
        merged.set('sub:' + key, sample);
    const sessionPriced = priceSamples(merged.values(), config.tiers, config, providerBaseUrls);
    // 最近一次提问仍取当前会话自身的最后一轮（不含子代理的轮次）。
    const lastTurnPriced = maxTurn >= 0
        ? priceSamples([...samples.values()].filter((s) => s.turn === maxTurn), config.tiers, config, providerBaseUrls)
        : { byKey: [] };
    // 今日两项：磁盘日志扫描（官方 key 的金额按各文件记录的模型 + 时段分别匹配价格档后求和）。
    const today = await scanToday(cwd, config, providerBaseUrls);
    const tier = matchTier(sessionModel, config.tiers);
    return {
        lastTurn: assembleEntry(lastTurnPriced.byKey),
        session: assembleEntry(sessionPriced.byKey),
        todayProject: today.project,
        todayAll: today.all,
        ...sessionModel === undefined ? {} : { sessionTier: sessionModel + ' → ' + (tier?.name ?? '?') },
        // 最近一次已完成的请求是否走 DeepSeek 官方接口（浏览器侧据此决定是否刷新余额）。
        lastRequestOfficial: isOfficialProvider(lastCompletedSample(samples)?.provider, providerBaseUrls),
    };
}
/* ── 今日磁盘扫描 ─────────────────────────────────────────── */
/** zstd 帧魔数（小端 0xFD2FB528）。 */
const ZSTD_MAGIC = [0x28, 0xB5, 0x2F, 0xFD];
/**
 * 从共享解析样本（log-cache 持久缓存的 FileSample）聚合「今日」用量：
 * 只取 time >= 今日零点的 assistant/message 样本，按 API key 分组、组内按时段
 * （事件自身时间判高峰/空闲）拆分；官方 key（api.deepseek.com）的用量额外进入
 * billable 按模型计费。语义与旧 parseTodayFile 完全一致 —— request/context 的
 * model/provider 就近追踪已由 parseLogFile 固化到每个样本上，无需重新解析日志。
 */
function aggregateTodayFile(sample, todayStart, config, providerBaseUrls) {
    const out = { byProvider: new Map() };
    if (sample.cwd !== undefined)
        out.cwd = sample.cwd;
    for (const u of sample.usages) {
        if (u.time < todayStart)
            continue;
        const providerKey = u.provider;
        let provider = out.byProvider.get(providerKey);
        if (provider === undefined) {
            provider = { peak: zeroBuckets(), offPeak: zeroBuckets(), billable: new Map() };
            out.byProvider.set(providerKey, provider);
        }
        const peak = isPeakTime(u.time, config);
        addBuckets(peak ? provider.peak : provider.offPeak, u.buckets);
        if (isOfficialProvider(providerKey, providerBaseUrls)) {
            // 仅官方 key 进入计费桶（按模型拆分以匹配价格档）。
            const pair = provider.billable.get(u.model) ?? { peak: zeroBuckets(), offPeak: zeroBuckets() };
            addBuckets(peak ? pair.peak : pair.offPeak, u.buckets);
            provider.billable.set(u.model, pair);
        }
    }
    return out;
}
/** 判断两个路径是否指向同一目录（大小写不敏感的 Windows 友好比较）。 */
function samePath(a, b) {
    const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    return norm(a) === norm(b);
}
/** 今日零点（本地时区）。 */
function todayStartMs() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
/** 把一个文件的 per-provider 聚合并入目标映射（跨文件合并）。 */
function mergeProviderToday(target, source) {
    for (const [provider, pt] of source) {
        const t = target.get(provider) ?? { peak: zeroBuckets(), offPeak: zeroBuckets(), billable: new Map() };
        addBuckets(t.peak, pt.peak);
        addBuckets(t.offPeak, pt.offPeak);
        for (const [model, pair] of pt.billable) {
            const b = t.billable.get(model) ?? { peak: zeroBuckets(), offPeak: zeroBuckets() };
            addBuckets(b.peak, pair.peak);
            addBuckets(b.offPeak, pair.offPeak);
            t.billable.set(model, b);
        }
        target.set(provider, t);
    }
}
/**
 * 扫描今日全部会话日志，聚合「本项目」与「全部」两项费用。
 * 解压 + 解析复用 log-cache 的内存样本缓存（同文件 mtime/size 未变不重复
 * 解压；历史日数据由 series-store 提供，这里只处理当天的实时部分）；今日
 * 口径的时段/计费聚合在内存样本上现算。
 * @param currentCwd - 当前项目 cwd（与 header.cwd 比对区分本项目）。
 * @param config - 完整价格配置。
 * @param providerBaseUrls - provider 路由 → baseURL（官方判定与平台名）。
 */
async function scanToday(currentCwd, config, providerBaseUrls) {
    const empty = { project: assembleEntry([]), all: assembleEntry([]) };
    const todayStart = todayStartMs();
    let root;
    try {
        root = dshHomePath('sessions');
    }
    catch {
        return empty;
    }
    let projects;
    try {
        projects = readdirSync(root);
    }
    catch {
        return empty;
    }
    const allByProvider = new Map();
    const projectByProvider = new Map();
    let parsedCount = 0;
    for (const project of projects) {
        const projectDirPath = join(root, project);
        let sessionIds;
        try {
            sessionIds = readdirSync(projectDirPath);
        }
        catch {
            continue;
        }
        for (const sessionId of sessionIds) {
            const dir = join(projectDirPath, sessionId);
            const candidates = [
                { path: join(dir, 'session.jsonl.zstd'), zstd: true },
                { path: join(dir, 'session.jsonl'), zstd: false },
            ];
            for (const candidate of candidates) {
                let stat;
                try {
                    stat = statSync(candidate.path);
                }
                catch {
                    continue;
                }
                if (stat.mtimeMs < todayStart)
                    continue;
                // 共享持久缓存：每个日志文件的解压 + 解析只做一次（文件变化由 mtime/size 失效）。
                const sample = await getParsedFile({ path: candidate.path, isZstd: candidate.zstd, mtimeMs: stat.mtimeMs, size: stat.size });
                if (sample === undefined)
                    continue;
                const isProject = sample.cwd !== undefined && samePath(sample.cwd, currentCwd);
                const todaySample = aggregateTodayFile(sample, todayStart, config, providerBaseUrls);
                mergeProviderToday(allByProvider, todaySample.byProvider);
                if (isProject)
                    mergeProviderToday(projectByProvider, todaySample.byProvider);
                // 解压/解析是同步的：每 8 个文件让出事件循环，避免阻塞并发请求（如余额查询）。
                if ((++parsedCount & 7) === 0)
                    await new Promise((resolve) => setImmediate(resolve));
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
            let currency = '';
            if (official) {
                // 高峰/空闲桶已按「事件自身时间」拆分（parseTodayFile 的 isPeakTime，
                // 含配置的时区偏移、高峰窗口、周六日半价），计价直接套用对应时段单价：
                // 高峰桶用高峰价、空闲桶用空闲价 —— 与当前查询时刻无关。
                for (const [model, pair] of pt.billable) {
                    const tier = matchTier(model === '*' ? undefined : model, config.tiers);
                    if (tier !== undefined)
                        currency = tier.currency;
                    amount += costOf(pair.peak, tier === undefined ? undefined : tier.peak);
                    amount += costOf(pair.offPeak, tier === undefined ? undefined : tier.offPeak);
                }
            }
            groups.push({ provider, buckets, official, amount: round6(amount), currency });
        }
        return assembleEntry(groups);
    };
    return {
        project: assemble(projectByProvider),
        all: assemble(allByProvider),
    };
}
