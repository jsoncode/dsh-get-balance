/**
 * dsh-get-balance —— 宿主半边：会话日志解析（纯内存缓存）。
 *
 * 历史数据的「图表聚合」持久化在 series-store.ts（按本地日聚合，不存完整会话
 * 记录）；本模块只负责把日志文件「解压 + 解析」为样本列表，并在内存里缓存最近
 * 解析过的文件（LRU）—— 主要用于当天数据的实时读取（当天文件每次查询都解析，
 * 靠内存缓存避免重复解压），历史回填是一次性的，无需持久化原始样本。
 */
import { readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { zstdDecompressSync } from 'node:zlib';
/* ── zstd 解码（原 cost.ts）──────────────────────────────────── */
/** zstd 帧魔数（小端 0xFD2FB528）。 */
const ZSTD_MAGIC = [0x28, 0xB5, 0x2F, 0xFD];
/**
 * 解压一个日志文件：zstd 一律按帧魔数切分逐帧解压（zstdDecompressSync
 * 对多帧文件会静默丢弃首帧之后的帧，不能整包直解）；明文直接返回。
 */
export function decodeLog(path, isZstd) {
    let raw;
    try {
        raw = readFileSync(path);
    }
    catch {
        return undefined;
    }
    if (isZstd === false)
        return raw.toString('utf8');
    // 扫描帧魔数边界，逐帧解压拼接（与官方 PublicZstdFrameDecoder 同语义；
    // 单帧文件扫描结果为 1 帧，与一次性 API 等价）。
    const starts = [];
    for (let i = 0; i + 4 <= raw.length; i++) {
        if (raw[i] === ZSTD_MAGIC[0] && raw[i + 1] === ZSTD_MAGIC[1] && raw[i + 2] === ZSTD_MAGIC[2] && raw[i + 3] === ZSTD_MAGIC[3]) {
            starts.push(i);
        }
    }
    if (starts.length < 1)
        return undefined;
    const parts = [];
    for (let i = 0; i < starts.length; i++) {
        const start = starts[i];
        const end = i + 1 < starts.length ? starts[i + 1] : raw.length;
        try {
            parts.push(zstdDecompressSync(raw.subarray(start, end)));
        }
        catch {
            return undefined;
        }
    }
    return Buffer.concat(parts).toString('utf8');
}
/** node:zlib zstdDecompressSync 逐帧解压，每 256 帧让出一次事件循环。 */
async function decodeFramesAsync(raw, starts) {
    const parts = [];
    for (let i = 0; i < starts.length; i++) {
        const start = starts[i];
        const end = i + 1 < starts.length ? starts[i + 1] : raw.length;
        try {
            parts.push(zstdDecompressSync(raw.subarray(start, end)));
        }
        catch {
            return undefined;
        }
        // 会话日志按追加批次成帧，一个文件可达上万小帧；逐帧 promise 异步反而更慢。
        // 同步解压 + 定期让出：单块仅 ~几十毫秒，无长阻塞也几乎无额外开销。
        if ((i & 255) === 255)
            await new Promise((resolve) => setImmediate(resolve));
    }
    return Buffer.concat(parts).toString('utf8');
}
/**
 * 异步解压一个日志文件（语义与 decodeLog 一致，逐帧解压；读文件异步，解压
 * 分块让出事件循环 —— 大日志的整包同步解压会卡住并发 op 的响应，如余额查询）。
 */
export async function decodeLogAsync(path, isZstd) {
    let raw;
    try {
        raw = await readFile(path);
    }
    catch {
        return undefined;
    }
    if (isZstd === false)
        return raw.toString('utf8');
    // 扫描帧魔数边界（同步但廉价：一次线性扫描）。
    const starts = [];
    for (let i = 0; i + 4 <= raw.length; i++) {
        if (raw[i] === ZSTD_MAGIC[0] && raw[i + 1] === ZSTD_MAGIC[1] && raw[i + 2] === ZSTD_MAGIC[2] && raw[i + 3] === ZSTD_MAGIC[3]) {
            starts.push(i);
        }
    }
    if (starts.length < 1)
        return undefined;
    return decodeFramesAsync(raw, starts);
}
const numberOr = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
/** 四桶合计。 */
function totalTokens(b) {
    return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
}
/**
 * 解析一个日志文件为样本列表（header cwd + step/end 计数 + assistant/message 用量）。
 * 用途分类：该步 assistant 消息的 content 部件含 tool-call → 工具调用；否则含 text
 * → 文本回复；否则 → 纯推理（整步四桶合计归入该类 —— token 粒度只到步骤）。
 *
 * 逐行扫描（indexOf('\n') 切片），不把整文 split 成行数组 —— 大日志避免一份
 * 与正文等大的行引用数组副本，降低单文件解析的瞬时内存峰值。
 */
export function parseLogFile(path, isZstd) {
    const text = decodeLog(path, isZstd);
    if (text === undefined)
        return undefined;
    return scanTextSync(text);
}
/** 异步版本：解压与逐行解析都定期让出事件循环（大日志不阻塞并发 op 响应）。 */
export async function parseLogFileAsync(path, isZstd) {
    const text = await decodeLogAsync(path, isZstd);
    if (text === undefined)
        return undefined;
    return scanTextAsync(text);
}
/** 处理一行（不抛异常）。 */
function scanLine(ctx, trimmed) {
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch {
        return;
    }
    if (ctx.first) {
        ctx.first = false;
        if (parsed.type === 'session' && typeof parsed.cwd === 'string')
            ctx.sample.cwd = parsed.cwd;
        return;
    }
    if (parsed.type === 'request/context') {
        const data = parsed.data;
        if (typeof data?.model === 'string' && data.model.length > 0)
            ctx.currentModel = data.model;
        if (typeof data?.provider === 'string' && data.provider.length > 0)
            ctx.currentProvider = data.provider;
        return;
    }
    if (parsed.type === 'step/end') {
        if (typeof parsed.time === 'number' && Number.isFinite(parsed.time)) {
            ctx.sample.steps.push({ time: parsed.time, provider: ctx.currentProvider ?? 'unknown', model: ctx.currentModel ?? '*' });
        }
        return;
    }
    if (parsed.type !== 'assistant/message')
        return;
    if (typeof parsed.time !== 'number' || !Number.isFinite(parsed.time))
        return;
    const data = parsed.data;
    const usage = data?.usage;
    if (usage === undefined)
        return;
    const buckets = {
        uncachedInput: numberOr(usage.inputTokens),
        cacheRead: numberOr(usage.cacheReadTokens),
        cacheWrite: numberOr(usage.cacheWriteTokens),
        output: numberOr(usage.outputTokens),
    };
    const parts = data?.message?.content ?? [];
    const total = totalTokens(buckets);
    const purpose = parts.some((p) => p.type === 'tool-call')
        ? { tool: total, text: 0, reasoning: 0 }
        : parts.some((p) => p.type === 'text')
            ? { tool: 0, text: total, reasoning: 0 }
            : { tool: 0, text: 0, reasoning: total };
    ctx.sample.usages.push({ time: parsed.time, provider: ctx.currentProvider ?? 'unknown', model: ctx.currentModel ?? '*', buckets, purpose });
}
/** 同步逐行扫描（不让出事件循环；大文件解析会阻塞 —— 仅用于同步解析路径）。 */
function scanTextSync(text) {
    const ctx = { sample: { steps: [], usages: [] }, first: true };
    let cursor = 0;
    while (cursor < text.length) {
        let nl = text.indexOf('\n', cursor);
        if (nl === -1)
            nl = text.length;
        const line = text.slice(cursor, nl);
        cursor = nl + 1;
        const trimmed = line.trim();
        if (trimmed.length === 0)
            continue;
        scanLine(ctx, trimmed);
    }
    return ctx.sample;
}
/** 异步逐行扫描：每 1024 行让出事件循环，避免单文件解析长时间阻塞并发请求。 */
async function scanTextAsync(text) {
    const ctx = { sample: { steps: [], usages: [] }, first: true };
    let cursor = 0;
    let lineCount = 0;
    while (cursor < text.length) {
        let nl = text.indexOf('\n', cursor);
        if (nl === -1)
            nl = text.length;
        const line = text.slice(cursor, nl);
        cursor = nl + 1;
        const trimmed = line.trim();
        if (trimmed.length === 0)
            continue;
        scanLine(ctx, trimmed);
        if ((++lineCount & 1023) === 0)
            await new Promise((resolve) => setImmediate(resolve));
    }
    return ctx.sample;
}
/* ── 内存缓存（LRU，仅当天 / 最近解析的文件）──────────────────── */
/** 内存 LRU 上限（文件数）：超出后逐出最久未访问，避免历史全量驻留内存。 */
const CACHE_MEM_MAX = 300;
/** 内存 LRU：最近访问的文件样本（插入序 = 访问序）。 */
const memSamples = new Map();
/** 解析中的文件（path:mtime:size → Promise）：并发请求同一文件只解析一次。 */
const inflightParses = new Map();
/** 写入内存 LRU（超出上限逐出最久未访问）。 */
function setMem(path, entry) {
    memSamples.delete(path);
    memSamples.set(path, entry);
    while (memSamples.size > CACHE_MEM_MAX) {
        const oldest = memSamples.keys().next().value;
        if (oldest === undefined)
            break;
        memSamples.delete(oldest);
    }
}
/**
 * 取一个日志文件的解析样本（stat 校验 → 内存 LRU 命中 → 真解析并缓存）。
 * 文件内容变化（mtime/size）自动失效重解析。异步：大日志解压/解析分块让出
 * 事件循环，不阻塞并发 op（如余额查询）的响应。
 */
export async function getParsedFile(ref) {
    let stat;
    try {
        stat = statSync(ref.path);
    }
    catch {
        return undefined;
    }
    const mem = memSamples.get(ref.path);
    if (mem !== undefined && mem.m === stat.mtimeMs && mem.s === stat.size) {
        memSamples.delete(ref.path);
        memSamples.set(ref.path, mem);
        return mem.sample;
    }
    // 同一文件的并发解析合并为一次（cost op 与 costSeries 常同时扫今天文件）。
    const key = ref.path + '\u0000' + stat.mtimeMs + '\u0000' + stat.size;
    const inflight = inflightParses.get(key);
    if (inflight !== undefined)
        return inflight;
    const promise = parseLogFileAsync(ref.path, ref.isZstd).then((sample) => {
        inflightParses.delete(key);
        if (sample !== undefined)
            setMem(ref.path, { m: stat.mtimeMs, s: stat.size, sample });
        return sample;
    });
    inflightParses.set(key, promise);
    return promise;
}
