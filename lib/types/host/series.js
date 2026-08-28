/**
 * dsh-get-balance —— 宿主半边：costSeries（费用 tab 图表数据链路）。
 *
 * 数据架构（历史聚合存储 + 当天实时，见 series-store.ts）：
 * - 历史日（< 今天）的图表数据按「本地日」持久化聚合（provider×model×workspace
 *   一组：peak/offPeak 分开的 token 四桶 + steps + 用途），不保存完整会话记录；
 * - 当天数据始终实时：每次请求解析今天的日志（内存缓存），覆盖写存储当天条目；
 * - 首次「全部」查询做一次全量回填（解析全部历史 → 按日聚合落盘，full=true），
 *   之后所有范围只做增量：每天首次查询回填 [coveredTo+1, 昨天]（含昨天尾部的
 *   修正），week7/month1 只回填各自窗口 —— 不再每次重复拉取宿主历史日志；
 * - 金额口径：仅官方 key（baseURL 域名 == api.deepseek.com）且模型精确/前缀命中
 *   价格档才计费（matchTier 的 '*' 通配兜底与 prices[0] 兜底不触发计费）；金额在
 *   查询时用当前价格档 × 存储的 peak/offPeak 桶现算（改价不影响历史桶）；
 * - 并发：同 (range, 配置) 请求 single-flight 合并为一次扫描；大范围首次回填
 *   每 ~150ms 让出事件循环，避免长时间冻结宿主。
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { costOf, isOfficialProvider, isPeakTime, periodPricesOf } from "./cost.js";
import { getParsedFile } from "./log-cache.js";
import { loadSeriesStore, touchSeriesStore } from "./series-store.js";
/** 支持的 range 值（ops.ts 据此校验）。 */
export const SERIES_RANGES = ['hour1', 'today', 'week7', 'month1', 'all'];
/**
 * 「今天」实时桶的复用窗口（毫秒）：日范围查询在窗口内直接复用存储里的今天桶，
 * 不重扫当天日志。冷缓存下当天文件解析是每次日范围查询的主要耗时（数秒），
 * 而图表对今天的实时性要求不高（≤30s 可接受；实时范围 hour1/today 不受影响）。
 */
const TODAY_UPSERT_TTL_MS = 30_000;
const MIN10 = 10 * 60_000;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const zeroBuckets = () => ({ uncachedInput: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
/** 金额保留 6 位小数（与 token 单价的每百万口径精度匹配）。 */
const round6 = (v) => Math.round(v * 1e6) / 1e6;
/** 四桶合计。 */
function totalTokens(b) {
    return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
}
function addBuckets(target, next) {
    target.uncachedInput += next.uncachedInput;
    target.cacheRead += next.cacheRead;
    target.cacheWrite += next.cacheWrite;
    target.output += next.output;
}
/** sessions 根目录；解析失败（home 不可用）返回 undefined。 */
function sessionsRoot() {
    try {
        return dshHomePath('sessions');
    }
    catch {
        return undefined;
    }
}
/** 平台名 = provider 的 baseURL 域名（api.deepseek.com / openrouter.ai …）；未配置 → 路由名。 */
function platformOf(provider, providerBaseUrls) {
    const baseUrl = providerBaseUrls[provider];
    if (typeof baseUrl === 'string' && baseUrl.length > 0) {
        try {
            return new URL(baseUrl).hostname;
        }
        catch {
            return provider;
        }
    }
    return provider;
}
/**
 * 价格档匹配（series 专用口径）：精确模型 id > 模型 id 前缀；
 * `match === '*'` 的兜底档与 prices[0] 兜底都**不算**（未配置定价 → 不计费）。
 */
function pricedTierOf(model, tiers) {
    const m = model ?? '';
    if (m.length > 0) {
        const exact = tiers.find((t) => t.match === m);
        if (exact !== undefined)
            return exact;
        const prefix = tiers.find((t) => t.match !== '*' && t.match.length > 0 && m.startsWith(t.match));
        if (prefix !== undefined)
            return prefix;
    }
    return undefined;
}
/* ── 本地日工具（与 cost.ts 的时区口径一致：事件时间 + 配置偏移）── */
/** 移位帧下的本地日零点（Date.UTC 由本地日历分量构造）。 */
function shiftedDayStart(shiftedMs) {
    const d = new Date(shiftedMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
/** 移位帧下的本地月首。 */
function shiftedMonthStart(shiftedMs) {
    const d = new Date(shiftedMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
/** 移位帧下的「年月序号」（用于月桶差值）。 */
function monthOf(shiftedMs) {
    const d = new Date(shiftedMs);
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
}
/** 移位帧时间 → 本地日键 'YYYY-MM-DD'。 */
function dayKeyOf(shiftedMs) {
    const d = new Date(shiftedMs);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
/** 本地日键 → 该日零点（真实 epoch）。 */
function dayStartOfKey(key, offsetMs) {
    const parts = key.split('-').map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]) - offsetMs;
}
/** 本地日键 ± n 天。 */
function dayAdd(key, n) {
    const parts = key.split('-').map(Number);
    return dayKeyOf(Date.UTC(parts[0], parts[1] - 1, parts[2]) + n * DAY);
}
/* ── 桶轴 ────────────────────────────────────────────────── */
/** 构造桶轴；「全部」依赖最早样本时间（minTime），其余由 now 直接确定。 */
function buildAxis(range, now, offsetMs, minTime) {
    const shiftedNow = now + offsetMs;
    switch (range) {
        case 'hour1': {
            const start = Math.floor((shiftedNow - 60 * MIN10) / MIN10) * MIN10;
            return { bucket: 'min10', count: 6, startMs: start, bucketMs: MIN10, rangeStartMs: now - 60 * MIN10, offsetMs };
        }
        case 'today': {
            const start = shiftedDayStart(shiftedNow);
            return { bucket: 'hour', count: 24, startMs: start, bucketMs: HOUR, rangeStartMs: start - offsetMs, offsetMs };
        }
        case 'week7': {
            const start = shiftedDayStart(shiftedNow) - 6 * DAY;
            return { bucket: 'day', count: 7, startMs: start, bucketMs: DAY, rangeStartMs: start - offsetMs, offsetMs };
        }
        case 'month1': {
            const start = shiftedDayStart(shiftedNow) - 29 * DAY;
            return { bucket: 'day', count: 30, startMs: start, bucketMs: DAY, rangeStartMs: start - offsetMs, offsetMs };
        }
        case 'all': {
            if (!Number.isFinite(minTime)) {
                return { bucket: 'day', count: 0, startMs: 0, bucketMs: DAY, rangeStartMs: 0, offsetMs };
            }
            const firstDay = shiftedDayStart(minTime + offsetMs);
            const lastDay = shiftedDayStart(shiftedNow);
            const days = Math.floor((lastDay - firstDay) / DAY) + 1;
            if (days > 90) {
                const firstMonth = shiftedMonthStart(minTime + offsetMs);
                const lastMonth = shiftedMonthStart(shiftedNow);
                return { bucket: 'month', count: monthOf(lastMonth) - monthOf(firstMonth) + 1, startMs: firstMonth, bucketMs: 0, rangeStartMs: 0, offsetMs };
            }
            return { bucket: 'day', count: days, startMs: firstDay, bucketMs: DAY, rangeStartMs: 0, offsetMs };
        }
        default:
            return { bucket: 'day', count: 0, startMs: 0, bucketMs: DAY, rangeStartMs: 0, offsetMs };
    }
}
/** 桶 i 的起始（移位帧）；month 桶逐月推进。 */
function bucketStart(axis, i) {
    if (axis.bucket === 'month') {
        const base = new Date(axis.startMs);
        return Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, 1);
    }
    return axis.startMs + i * axis.bucketMs;
}
/** 样本时间 → 桶下标；范围外返回 -1（超尾钳制到最后一桶）。 */
function axisIndex(axis, timeMs) {
    const shifted = timeMs + axis.offsetMs;
    const idx = axis.bucket === 'month'
        ? monthOf(shifted) - monthOf(axis.startMs)
        : Math.floor((shifted - axis.startMs) / axis.bucketMs);
    if (idx < 0)
        return -1;
    if (idx >= axis.count)
        return axis.count - 1;
    return idx;
}
/** 桶展示标签（08:00 / 02-12 / 2026-02）。 */
function pointLabel(bucket, shiftedMs) {
    const d = new Date(shiftedMs);
    const pad = (n) => String(n).padStart(2, '0');
    if (bucket === 'min10' || bucket === 'hour')
        return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
    if (bucket === 'month')
        return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1);
    return pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
/* ── 实时聚合（hour1 / today 的小时桶）────────────────────── */
function groupOf(map, provider, model, workspace, providerBaseUrls, tiers) {
    const key = provider + '\u0000' + model + '\u0000' + workspace;
    let g = map.get(key);
    if (g === undefined) {
        const official = isOfficialProvider(provider, providerBaseUrls);
        const tier = official ? pricedTierOf(model === '*' ? undefined : model, tiers) : undefined;
        g = {
            provider,
            platform: platformOf(provider, providerBaseUrls),
            model,
            workspace,
            buckets: zeroBuckets(),
            amount: 0,
            official,
            ...tier === undefined ? {} : { tier },
            steps: 0,
            purpose: { tool: 0, text: 0, reasoning: 0 },
            tokens: 0,
        };
        map.set(key, g);
    }
    return g;
}
/** 遍历项目/会话目录收集日志文件（zstd 优先，明文兜底）。 */
function collectFiles(root) {
    if (root === undefined)
        return [];
    const out = [];
    let projects;
    try {
        projects = readdirSync(root);
    }
    catch {
        return out;
    }
    for (const project of projects) {
        const projectDir = join(root, project);
        let names;
        try {
            names = readdirSync(projectDir);
        }
        catch {
            continue;
        }
        for (const name of names) {
            const dir = join(projectDir, name);
            const candidates = [
                { path: join(dir, 'session.jsonl.zstd'), isZstd: true },
                { path: join(dir, 'session.jsonl'), isZstd: false },
            ];
            for (const candidate of candidates) {
                let stat;
                try {
                    stat = statSync(candidate.path);
                }
                catch {
                    continue;
                }
                out.push({ path: candidate.path, isZstd: candidate.isZstd, mtimeMs: stat.mtimeMs, size: stat.size });
                break;
            }
        }
    }
    return out;
}
/**
 * 实时计算 hour1 / today（小时桶，纯当天日志，不读历史存储）。
 * 日志解压/解析是同步操作：逐文件处理并定期让出事件循环，避免长时间阻塞
 * 并发 op（如余额查询）的响应。
 * @returns 结果 + 本次解析的样本（today 调用方用于覆盖写存储当天条目）。
 */
async function computeLive(range, now, offsetMs, root, config, providerBaseUrls) {
    const coarseStart = range === 'hour1'
        ? now - 60 * MIN10
        : shiftedDayStart(now + offsetMs) - offsetMs;
    const refs = collectFiles(root).filter((ref) => ref.mtimeMs >= coarseStart);
    const samples = [];
    for (let i = 0; i < refs.length; i++) {
        const sample = await getParsedFile(refs[i]);
        if (sample !== undefined)
            samples.push(sample);
        if ((i & 7) === 7)
            await new Promise((resolve) => setImmediate(resolve));
    }
    const axis = buildAxis(range, now, offsetMs, 0);
    const points = [];
    for (let i = 0; i < axis.count; i++) {
        const start = bucketStart(axis, i);
        points.push({ ts: start - offsetMs, label: pointLabel(axis.bucket, start) });
    }
    const bucketsArr = [];
    for (let i = 0; i < axis.count; i++)
        bucketsArr.push(new Map());
    let currency = 'CNY';
    let currencySet = false;
    for (const sample of samples) {
        const workspace = sample.cwd ?? '';
        for (const st of sample.steps) {
            if (st.time < axis.rangeStartMs)
                continue;
            const idx = axisIndex(axis, st.time);
            if (idx < 0)
                continue;
            const g = groupOf(bucketsArr[idx], st.provider, st.model, workspace, providerBaseUrls, config.tiers);
            g.steps += 1;
        }
        for (const u of sample.usages) {
            if (u.time < axis.rangeStartMs)
                continue;
            const idx = axisIndex(axis, u.time);
            if (idx < 0)
                continue;
            const g = groupOf(bucketsArr[idx], u.provider, u.model, workspace, providerBaseUrls, config.tiers);
            addBuckets(g.buckets, u.buckets);
            g.purpose.tool += u.purpose.tool;
            g.purpose.text += u.purpose.text;
            g.purpose.reasoning += u.purpose.reasoning;
            g.tokens += totalTokens(u.buckets);
            if (g.official && g.tier !== undefined) {
                if (!currencySet && g.tier.currency !== '') {
                    currency = g.tier.currency;
                    currencySet = true;
                }
                g.amount += costOf(u.buckets, periodPricesOf(g.tier, u.time, config));
            }
        }
    }
    const records = bucketsArr.map((m) => [...m.values()]
        .filter((g) => g.tokens > 0 || g.steps > 0)
        .sort((a, b) => b.tokens - a.tokens)
        .map((g) => ({
        provider: g.provider,
        platform: g.platform,
        model: g.model,
        workspace: g.workspace,
        buckets: { ...g.buckets },
        amount: round6(g.amount),
        priced: g.official && g.tier !== undefined,
        steps: g.steps,
        purpose: { ...g.purpose },
    })));
    return {
        result: { range: range, bucket: axis.bucket, points, records, currency },
        samples,
    };
}
/* ── 按日聚合（历史存储的构建单元）────────────────────────── */
/** 取（或新建）某天聚合表内的一组。 */
function dayGroupOf(groups, provider, model, workspace) {
    const key = provider + '\u0000' + model + '\u0000' + workspace;
    let g = groups.get(key);
    if (g === undefined) {
        g = {
            provider,
            model,
            workspace,
            peak: zeroBuckets(),
            offPeak: zeroBuckets(),
            steps: 0,
            purpose: { tool: 0, text: 0, reasoning: 0 },
            tokens: 0,
        };
        groups.set(key, g);
    }
    return g;
}
/**
 * 把一批样本按「本地日」聚合（每个样本按自身时间归入所在日；peak/offPeak 按时段
 * 拆开 —— 金额用当前价格档现算，改价不改历史桶）。返回 日键 → 聚合组。
 */
async function collectDayGroups(root, parseFromMs, parseFromKey, needToKey, offsetMs, config) {
    const refs = collectFiles(root).filter((ref) => ref.mtimeMs >= parseFromMs);
    const dayMaps = new Map();
    let lastYieldAt = Date.now();
    for (const ref of refs) {
        const sample = await getParsedFile(ref);
        if (sample === undefined)
            continue;
        const workspace = sample.cwd ?? '';
        for (const st of sample.steps) {
            if (st.time < parseFromMs)
                continue;
            const key = dayKeyOf(st.time + offsetMs);
            if (parseFromKey !== undefined && key < parseFromKey)
                continue;
            if (key > needToKey)
                continue;
            dayGroupOf(dayGroupsOf(dayMaps, key), st.provider, st.model, workspace).steps += 1;
        }
        for (const u of sample.usages) {
            if (u.time < parseFromMs)
                continue;
            const key = dayKeyOf(u.time + offsetMs);
            if (parseFromKey !== undefined && key < parseFromKey)
                continue;
            if (key > needToKey)
                continue;
            const g = dayGroupOf(dayGroupsOf(dayMaps, key), u.provider, u.model, workspace);
            const peak = isPeakTime(u.time, config);
            addBuckets(peak ? g.peak : g.offPeak, u.buckets);
            g.purpose.tool += u.purpose.tool;
            g.purpose.text += u.purpose.text;
            g.purpose.reasoning += u.purpose.reasoning;
            g.tokens += totalTokens(u.buckets);
        }
        // 首次大范围回填是唯一的重活：每 ~150ms 让出事件循环，避免冻结宿主服务。
        if (Date.now() - lastYieldAt > 150) {
            lastYieldAt = Date.now();
            await new Promise((resolve) => setImmediate(resolve));
        }
    }
    return dayMaps;
}
/** 取（或新建）某天的聚合表。 */
function dayGroupsOf(dayMaps, dayKey) {
    let groups = dayMaps.get(dayKey);
    if (groups === undefined) {
        groups = new Map();
        dayMaps.set(dayKey, groups);
    }
    return groups;
}
/** DayGroup → 存储紧凑格式。 */
function storedOf(groups) {
    return [...groups].map((g) => ({
        p: g.provider,
        m: g.model,
        w: g.workspace,
        pk: [g.peak.uncachedInput, g.peak.cacheRead, g.peak.cacheWrite, g.peak.output],
        op: [g.offPeak.uncachedInput, g.offPeak.cacheRead, g.offPeak.cacheWrite, g.offPeak.output],
        st: g.steps,
        pt: [g.purpose.tool, g.purpose.text, g.purpose.reasoning],
        tk: g.tokens,
    }));
}
/** 存储紧凑格式 → DayGroup。 */
function decodeStoredDay(day) {
    if (day === undefined)
        return [];
    return day.g.map((sg) => ({
        provider: sg.p,
        model: sg.m,
        workspace: sg.w,
        peak: { uncachedInput: sg.pk[0], cacheRead: sg.pk[1], cacheWrite: sg.pk[2], output: sg.pk[3] },
        offPeak: { uncachedInput: sg.op[0], cacheRead: sg.op[1], cacheWrite: sg.op[2], output: sg.op[3] },
        steps: sg.st,
        purpose: { tool: sg.pt[0], text: sg.pt[1], reasoning: sg.pt[2] },
        tokens: sg.tk,
    }));
}
/** 存储里的某天 → 聚合 Map（键与 aggregateDayGroups 一致，供图表记录直接消费）。 */
function dayGroupsFromStored(day) {
    const out = new Map();
    for (const g of decodeStoredDay(day)) {
        out.set(g.provider + '\u0000' + g.model + '\u0000' + g.workspace, g);
    }
    return out;
}
/** 一天的聚合组 → 图表记录（金额用当前价格档 × peak/offPeak 现算）。 */
function dayGroupsToRecords(groups, providerBaseUrls, tiers) {
    const records = [];
    let currency = '';
    for (const g of groups) {
        if (g.tokens <= 0 && g.steps <= 0)
            continue;
        const official = isOfficialProvider(g.provider, providerBaseUrls);
        const tier = official ? pricedTierOf(g.model === '*' ? undefined : g.model, tiers) : undefined;
        const amount = official && tier !== undefined
            ? costOf(g.peak, tier.peak) + costOf(g.offPeak, tier.offPeak)
            : 0;
        if (official && tier !== undefined && currency === '' && tier.currency !== '') {
            currency = tier.currency;
        }
        records.push({
            provider: g.provider,
            platform: platformOf(g.provider, providerBaseUrls),
            model: g.model,
            workspace: g.workspace,
            buckets: {
                uncachedInput: g.peak.uncachedInput + g.offPeak.uncachedInput,
                cacheRead: g.peak.cacheRead + g.offPeak.cacheRead,
                cacheWrite: g.peak.cacheWrite + g.offPeak.cacheWrite,
                output: g.peak.output + g.offPeak.output,
            },
            amount: round6(amount),
            priced: official && tier !== undefined,
            steps: g.steps,
            purpose: { ...g.purpose },
        });
    }
    records.sort((a, b) => (b.buckets.uncachedInput + b.buckets.cacheRead + b.buckets.cacheWrite + b.buckets.output)
        - (a.buckets.uncachedInput + a.buckets.cacheRead + a.buckets.cacheWrite + a.buckets.output));
    return { records, currency };
}
/**
 * 计算 [needFromKey, needToKey]（needTo 恒为昨天）相对当前存储的覆盖缺口：
 * - 返回 null：已覆盖，无需任何动作；
 * - parseFromKey undefined：只需把 coveredFrom 延伸到 needFromKey（全量回填后
 *   的底部缺口 —— 覆盖起点之前的日无数据，全量回填已捕获全部，重扫是浪费）；
 * - 其余：解析 [parseFromKey, needToKey] 窗口（含上次「今天」的尾部修正）。
 */
function backfillWindow(store, needFromKey, needToKey, offsetMs) {
    const haveFrom = store.coveredFrom;
    const haveTo = store.coveredTo;
    if (haveFrom !== undefined && haveTo !== undefined && haveFrom <= needFromKey && haveTo >= needToKey) {
        return null; // 已覆盖
    }
    if (store.full === true && haveFrom !== undefined && haveTo !== undefined && haveFrom > needFromKey) {
        // 全量回填后的底部缺口：只需延伸标记；顶部缺口照常解析。
        if (haveTo >= needToKey)
            return {};
        const parseFromKey = dayAdd(haveTo, 1);
        if (parseFromKey > needToKey)
            return {};
        return { parseFromKey, parseFromMs: dayStartOfKey(parseFromKey, offsetMs) };
    }
    let parseFromKey;
    if (haveFrom !== undefined && haveFrom <= needFromKey && haveTo !== undefined && haveTo >= needFromKey) {
        parseFromKey = dayAdd(haveTo, 1); // 底部已覆盖到 needFrom，只补顶部（含昨天尾部修正）
    }
    else {
        parseFromKey = needFromKey; // 底部缺口或完全没有覆盖
    }
    if (parseFromKey > needToKey)
        return {};
    return { parseFromKey, parseFromMs: dayStartOfKey(parseFromKey, offsetMs) };
}
/**
 * 确保存储已覆盖 [needFromKey, needToKey]（needTo 恒为昨天）。未覆盖的窗口
 * 解析 mtime 在该窗口起点之后的日志，按日聚合后覆盖写存储。窗口内含上次
 * 「今天」的部分数据（尾部修正），已完整覆盖的日不被重扫。
 */
async function ensureCoverage(store, needFromKey, needToKey, root, offsetMs, config) {
    const win = backfillWindow(store, needFromKey, needToKey, offsetMs);
    if (win === null)
        return; // 已覆盖
    if (win.parseFromKey === undefined) {
        // 仅延伸覆盖标记（全量回填后的底部缺口）：不解析日志。
        if (store.coveredFrom === undefined || store.coveredFrom > needFromKey)
            store.coveredFrom = needFromKey;
        store.coveredTo = needToKey;
        touchSeriesStore();
        return;
    }
    const dayMaps = await collectDayGroups(root, win.parseFromMs, win.parseFromKey, needToKey, offsetMs, config);
    for (const [key, groups] of dayMaps) {
        store.days[key] = { g: storedOf(groups.values()) };
    }
    if (store.coveredFrom === undefined || store.coveredFrom > needFromKey)
        store.coveredFrom = needFromKey;
    store.coveredTo = needToKey;
    touchSeriesStore();
}
/** 首次「全部」查询的全量回填：解析全部历史，按日聚合落盘。 */
async function backfillAll(store, root, offsetMs, todayKey, toKey, config) {
    const dayMaps = await collectDayGroups(root, 0, undefined, toKey, offsetMs, config);
    let earliest;
    for (const [key, groups] of dayMaps) {
        store.days[key] = { g: storedOf(groups.values()) };
        if (earliest === undefined || key < earliest)
            earliest = key;
    }
    store.full = true;
    store.coveredFrom = earliest ?? todayKey;
    store.coveredTo = toKey;
    touchSeriesStore();
}
/** 把某月的所有日聚合组合并为一组（all 跨度 > 90 天的月桶）。 */
function mergeMonthGroups(store, todayKey, todayGroups, monthIdx, axis, offsetMs) {
    const merged = new Map();
    const add = (groups) => {
        for (const g of groups) {
            const t = dayGroupOf(merged, g.provider, g.model, g.workspace);
            addBuckets(t.peak, g.peak);
            addBuckets(t.offPeak, g.offPeak);
            t.steps += g.steps;
            t.purpose.tool += g.purpose.tool;
            t.purpose.text += g.purpose.text;
            t.purpose.reasoning += g.purpose.reasoning;
            t.tokens += g.tokens;
        }
    };
    const base = monthOf(axis.startMs);
    for (const [key, day] of Object.entries(store.days)) {
        if (monthOf(dayStartOfKey(key, offsetMs) + offsetMs) - base !== monthIdx)
            continue;
        add(decodeStoredDay(day));
    }
    if (monthOf(dayStartOfKey(todayKey, offsetMs) + offsetMs) - base === monthIdx) {
        add(todayGroups.values());
    }
    return merged;
}
/** single-flight：并发同 (range, 配置) 请求合并为一次扫描。 */
const seriesInFlight = new Map();
/** 配置指纹（价格档 + 时区 + 高峰窗口 + provider baseURL），用于 single-flight 键。 */
function seriesConfigKey(config, providerBaseUrls) {
    return JSON.stringify({
        tiers: config.tiers,
        offset: config.timezoneOffsetMinutes,
        windows: config.peakWindows,
        weekend: config.weekendOffPeak === true,
        providers: providerBaseUrls,
    });
}
/**
 * 计算费用 tab 图表数据（costSeries）。
 * @param range - 'hour1' | 'today' | 'week7' | 'month1' | 'all'（非法值由 ops.ts 拦截）。
 * @param config - 完整价格配置。
 * @param providerBaseUrls - provider 路由 → baseURL（平台名与官方判定）。
 * @param rootOverride - 测试注入的 sessions 根目录；缺省 dshHomePath('sessions')。
 * @param opts - 存储选项（持久化存储路径；测试注入 root 时缺省为仅内存）。
 */
export async function computeSeries(range, config, providerBaseUrls, rootOverride, opts) {
    // 测试注入 root 时默认不落盘（避免测试写真实 $DSH_HOME）。
    const storePath = rootOverride !== undefined && opts?.storePath === undefined ? null : opts?.storePath;
    const flightKey = range + '\u0000' + seriesConfigKey(config, providerBaseUrls);
    const inFlight = seriesInFlight.get(flightKey);
    if (inFlight !== undefined)
        return inFlight;
    const promise = doComputeSeries(range, config, providerBaseUrls, rootOverride, storePath);
    seriesInFlight.set(flightKey, promise);
    try {
        return await promise;
    }
    finally {
        if (seriesInFlight.get(flightKey) === promise)
            seriesInFlight.delete(flightKey);
    }
}
/** computeSeries 的实际执行体（single-flight 合并后只有一个实例在跑）。 */
async function doComputeSeries(range, config, providerBaseUrls, rootOverride, storePath) {
    const store = await loadSeriesStore(storePath);
    const now = Date.now();
    const offsetMs = config.timezoneOffsetMinutes * 60_000;
    const root = rootOverride ?? sessionsRoot();
    const todayKey = dayKeyOf(now + offsetMs);
    const yesterdayKey = dayAdd(todayKey, -1);
    const todayStart = shiftedDayStart(now + offsetMs) - offsetMs;
    // 实时范围：hour1 / today（当天日志，内存缓存解析；today 顺带覆盖写存储当天条目）。
    if (range === 'hour1') {
        const { result } = await computeLive('hour1', now, offsetMs, root, config, providerBaseUrls);
        return result;
    }
    if (range === 'today') {
        const { result, samples } = await computeLive('today', now, offsetMs, root, config, providerBaseUrls);
        const todayGroups = aggregateDayGroups(samples, todayStart, Infinity, config);
        store.days[todayKey] = { g: storedOf(todayGroups.values()) };
        store.todayUpdatedAt = now;
        touchSeriesStore();
        return result;
    }
    // 历史范围：先保证存储覆盖（首次「全部」全量回填；其余窗口增量回填）。
    if (range === 'all') {
        if (store.full !== true) {
            await backfillAll(store, root, offsetMs, todayKey, yesterdayKey, config);
        }
        else {
            await ensureCoverage(store, store.coveredFrom ?? todayKey, yesterdayKey, root, offsetMs, config);
        }
    }
    else {
        const needFromKey = dayAdd(todayKey, range === 'week7' ? -6 : -29);
        await ensureCoverage(store, needFromKey, yesterdayKey, root, offsetMs, config);
    }
    // 当天实时聚合（历史范围的今天桶 + 覆盖写存储当天条目）。
    // 近期（含跨进程持久化的 todayUpdatedAt）已写过今天桶 → 直接复用存储，不再
    // 重扫当天日志：冷缓存下今天文件解析是每次日范围查询的主要耗时（数秒）。
    const todayUpdatedAt = store.todayUpdatedAt ?? 0;
    let todayGroups;
    let hasTodayData;
    if (now - todayUpdatedAt < TODAY_UPSERT_TTL_MS && store.days[todayKey] !== undefined) {
        todayGroups = dayGroupsFromStored(store.days[todayKey]);
        hasTodayData = true;
    }
    else {
        const todayRefs = collectFiles(root).filter((ref) => ref.mtimeMs >= todayStart);
        const todaySamples = [];
        for (let i = 0; i < todayRefs.length; i++) {
            const sample = await getParsedFile(todayRefs[i]);
            if (sample !== undefined)
                todaySamples.push(sample);
            if ((i & 7) === 7)
                await new Promise((resolve) => setImmediate(resolve));
        }
        todayGroups = aggregateDayGroups(todaySamples, todayStart, Infinity, config);
        hasTodayData = todaySamples.length > 0;
        store.days[todayKey] = { g: storedOf(todayGroups.values()) };
        store.todayUpdatedAt = now;
        touchSeriesStore();
    }
    // 轴：week7/month1 由 now 定；all 依赖最早一天。
    let minTime;
    if (range === 'all') {
        const dayKeys = Object.keys(store.days);
        const earliestKey = dayKeys.length > 0 ? dayKeys.reduce((a, b) => (a < b ? a : b)) : todayKey;
        minTime = dayKeys.length > 0 || hasTodayData ? dayStartOfKey(earliestKey, offsetMs) : Infinity;
    }
    else {
        minTime = 0;
    }
    const axis = buildAxis(range, now, offsetMs, minTime);
    const points = [];
    for (let i = 0; i < axis.count; i++) {
        const start = bucketStart(axis, i);
        points.push({ ts: start - offsetMs, label: pointLabel(axis.bucket, start) });
    }
    // 记录：日桶从存储（历史）+ 当天实时；月桶（all 跨度 > 90 天）合并日聚合。
    const records = [];
    let currency = '';
    for (let i = 0; i < axis.count; i++) {
        const start = bucketStart(axis, i);
        if (axis.bucket === 'month') {
            const groups = mergeMonthGroups(store, todayKey, todayGroups, monthOf(start) - monthOf(axis.startMs), axis, offsetMs);
            const out = dayGroupsToRecords(groups.values(), providerBaseUrls, config.tiers);
            records.push(out.records);
            if (currency === '' && out.currency !== '')
                currency = out.currency;
        }
        else {
            const key = dayKeyOf(start);
            const groups = key === todayKey ? todayGroups.values() : decodeStoredDay(store.days[key]);
            const out = dayGroupsToRecords(groups, providerBaseUrls, config.tiers);
            records.push(out.records);
            if (currency === '' && out.currency !== '')
                currency = out.currency;
        }
    }
    return { range: range, bucket: axis.bucket, points, records, currency: currency || 'CNY' };
}
/** 把当天样本聚合为一天一组（dayStart 起至未来）。 */
function aggregateDayGroups(samples, dayStartMs, dayEndMs, config) {
    const groups = new Map();
    for (const sample of samples) {
        const workspace = sample.cwd ?? '';
        for (const st of sample.steps) {
            if (st.time < dayStartMs || st.time >= dayEndMs)
                continue;
            dayGroupOf(groups, st.provider, st.model, workspace).steps += 1;
        }
        for (const u of sample.usages) {
            if (u.time < dayStartMs || u.time >= dayEndMs)
                continue;
            const g = dayGroupOf(groups, u.provider, u.model, workspace);
            const peak = isPeakTime(u.time, config);
            addBuckets(peak ? g.peak : g.offPeak, u.buckets);
            g.purpose.tool += u.purpose.tool;
            g.purpose.text += u.purpose.text;
            g.purpose.reasoning += u.purpose.reasoning;
            g.tokens += totalTokens(u.buckets);
        }
    }
    return groups;
}
/* ── 首次回填探测（客户端确认弹框前的只读预检）───────────────── */
/** 需要确认的一次性回填的最小日志量（字节）：小于该量说明回填很快，不打扰用户。 */
const BACKFILL_CONFIRM_MIN_BYTES = 10 * 1024 * 1024;
/**
 * 只读预检：判断请求该 range 是否会触发一次性长回填（不执行回填、不写存储）。
 * 常规每日增量（覆盖只差昨天一天）不算 —— 那是一次性快操作，直接加载即可；
 * 全量回填后的底部缺口只需延伸覆盖标记、不解析日志，同样不算。
 * 与 ensureCoverage / backfillAll 用同一套覆盖判定口径，避免预检与真实回填不一致。
 */
export async function seriesBackfillInfo(range, config, rootOverride, opts) {
    // 测试注入 root 时同样走内存存储（与 computeSeries 一致）。
    const storePath = rootOverride !== undefined && opts?.storePath === undefined ? null : opts?.storePath;
    // 实时范围从不回填历史。
    if (range === 'hour1' || range === 'today')
        return { pending: false, windowBytes: 0, full: false };
    const store = await loadSeriesStore(storePath);
    const now = Date.now();
    const offsetMs = config.timezoneOffsetMinutes * 60_000;
    const root = rootOverride ?? sessionsRoot();
    const todayKey = dayKeyOf(now + offsetMs);
    const needToKey = dayAdd(todayKey, -1);
    // 「全部」首次：全量回填（窗口 = 全部日志）。
    if (range === 'all' && store.full !== true) {
        const refs = collectFiles(root);
        const bytes = refs.reduce((s, r) => s + r.size, 0);
        return { pending: bytes > BACKFILL_CONFIRM_MIN_BYTES, windowBytes: bytes, full: true };
    }
    const needFromKey = range === 'all' ? store.coveredFrom ?? todayKey : dayAdd(todayKey, range === 'week7' ? -6 : -29);
    const win = backfillWindow(store, needFromKey, needToKey, offsetMs);
    if (win === null || win.parseFromKey === undefined) {
        // 已覆盖，或只需延伸覆盖标记（不解析日志）→ 无需确认。
        return { pending: false, windowBytes: 0, full: false };
    }
    // 常规每日增量：回填窗口恰好只有昨天一天（无论底部是否已覆盖）→ 不打扰。
    const routineTail = win.parseFromKey === needToKey;
    if (routineTail)
        return { pending: false, windowBytes: 0, full: false };
    const parseFromMs = win.parseFromMs;
    const refs = collectFiles(root).filter((r) => r.mtimeMs >= parseFromMs);
    const bytes = refs.reduce((s, r) => s + r.size, 0);
    return { pending: bytes > BACKFILL_CONFIRM_MIN_BYTES, windowBytes: bytes, full: false };
}
