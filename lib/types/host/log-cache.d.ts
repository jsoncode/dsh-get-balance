/**
 * dsh-get-balance —— 宿主半边：会话日志解析（纯内存缓存）。
 *
 * 历史数据的「图表聚合」持久化在 series-store.ts（按本地日聚合，不存完整会话
 * 记录）；本模块只负责把日志文件「解压 + 解析」为样本列表，并在内存里缓存最近
 * 解析过的文件（LRU）—— 主要用于当天数据的实时读取（当天文件每次查询都解析，
 * 靠内存缓存避免重复解压），历史回填是一次性的，无需持久化原始样本。
 */
import type { PurposeTokens, UsageBuckets } from './types.ts';
/** 一个日志文件的引用（扫描阶段 stat 的结果）。 */
export interface FileRef {
    path: string;
    isZstd: boolean;
    mtimeMs: number;
    size: number;
}
/** 一个 step/end 样本（仅计数）。 */
export interface StepSample {
    time: number;
    provider: string;
    model: string;
}
/** 一个 assistant/message 样本（token 四桶 + 用途分类）。 */
export interface UsageSample {
    time: number;
    provider: string;
    model: string;
    buckets: UsageBuckets;
    purpose: PurposeTokens;
}
/** 单个日志文件解析后的样本列表（不含金额 —— 金额与价格配置相关，聚合时现算）。 */
export interface FileSample {
    cwd?: string;
    steps: StepSample[];
    usages: UsageSample[];
}
/**
 * 解压一个日志文件：zstd 一律按帧魔数切分逐帧解压（zstdDecompressSync
 * 对多帧文件会静默丢弃首帧之后的帧，不能整包直解）；明文直接返回。
 */
export declare function decodeLog(path: string, isZstd: boolean): string | undefined;
/**
 * 解析一个日志文件为样本列表（header cwd + step/end 计数 + assistant/message 用量）。
 * 用途分类：该步 assistant 消息的 content 部件含 tool-call → 工具调用；否则含 text
 * → 文本回复；否则 → 纯推理（整步四桶合计归入该类 —— token 粒度只到步骤）。
 *
 * 逐行扫描（indexOf('\n') 切片），不把整文 split 成行数组 —— 大日志避免一份
 * 与正文等大的行引用数组副本，降低单文件解析的瞬时内存峰值。
 */
export declare function parseLogFile(path: string, isZstd: boolean): FileSample | undefined;
/**
 * 取一个日志文件的解析样本（stat 校验 → 内存 LRU 命中 → 真解析并缓存）。
 * 文件内容变化（mtime/size）自动失效重解析。
 */
export declare function getParsedFile(ref: FileRef): FileSample | undefined;
//# sourceMappingURL=log-cache.d.ts.map