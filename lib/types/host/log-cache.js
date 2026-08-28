/**
 * dsh-get-balance —— 宿主半边：会话日志解析（纯内存缓存）。
 *
 * 历史数据的「图表聚合」持久化在 series-store.ts（按本地日聚合，不存完整会话
 * 记录）；本模块只负责把日志文件「解压 + 解析」为样本列表，并在内存里缓存最近
 * 解析过的文件（LRU）—— 主要用于当天数据的实时读取（当天文件每次查询都解析，
 * 靠内存缓存避免重复解压），历史回填是一次性的，无需持久化原始样本。
 */
import { readFileSync, statSync } from 'node:fs';
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
    const sample = { steps: [], usages: [] };
    let currentModel;
    let currentProvider;
    let first = true;
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
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        if (first) {
            first = false;
            if (parsed.type === 'session' && typeof parsed.cwd === 'string')
                sample.cwd = parsed.cwd;
            continue;
        }
        if (parsed.type === 'request/context') {
            const data = parsed.data;
            if (typeof data?.model === 'string' && data.model.length > 0)
                currentModel = data.model;
            if (typeof data?.provider === 'string' && data.provider.length > 0)
                currentProvider = data.provider;
            continue;
        }
        if (parsed.type === 'step/end') {
            if (typeof parsed.time === 'number' && Number.isFinite(parsed.time)) {
                sample.steps.push({ time: parsed.time, provider: currentProvider ?? 'unknown', model: currentModel ?? '*' });
            }
            continue;
        }
        if (parsed.type !== 'assistant/message')
            continue;
        if (typeof parsed.time !== 'number' || !Number.isFinite(parsed.time))
            continue;
        const data = parsed.data;
        const usage = data?.usage;
        if (usage === undefined)
            continue;
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
        sample.usages.push({ time: parsed.time, provider: currentProvider ?? 'unknown', model: currentModel ?? '*', buckets, purpose });
    }
    return sample;
}
/* ── 内存缓存（LRU，仅当天 / 最近解析的文件）──────────────────── */
/** 内存 LRU 上限（文件数）：超出后逐出最久未访问，避免历史全量驻留内存。 */
const CACHE_MEM_MAX = 300;
/** 内存 LRU：最近访问的文件样本（插入序 = 访问序）。 */
const memSamples = new Map();
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
 * 文件内容变化（mtime/size）自动失效重解析。
 */
export function getParsedFile(ref) {
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
    const sample = parseLogFile(ref.path, ref.isZstd);
    if (sample === undefined)
        return undefined;
    setMem(ref.path, { m: stat.mtimeMs, s: stat.size, sample });
    return sample;
}
