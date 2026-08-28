/**
 * dsh-get-balance —— 宿主半边：历史图表数据持久化（按「本地日」聚合，不存会话详情）。
 *
 * 与用户诉求一致：历史数据只需要支撑图表展示，不需要完整会话记录。因此这里
 * 只持久化「某一天内按 (provider, model, workspace) 聚合」的图表数据组：
 * - peak / offPeak 分开的 token 四桶（金额与价格配置相关，查询时用当前价格档
 *   现算 —— 改价/换价档不影响历史桶，只有改高峰窗口/时区才影响历史分类）；
 * - steps（请求次数）与用途拆分（tool / text / reasoning）；
 * - 不保存任何原始事件 / 会话日志内容。
 *
 * 文件：$DSH_HOME/dsh-get-balance-series-store.json
 * - 条目键 = 配置时区下的本地日 'YYYY-MM-DD'；当天数据是「实时」的（每次查询现算
 *   并覆盖写当天条目），历史日（< 今天）在写入后视为完成；
 * - coveredFrom / coveredTo：已完整覆盖的连续日区间（不含当天）。每天首次查询时
 *   增量回填 [coveredTo+1, 昨天]（只解析该窗口内的日志），首次「全部」查询做一次
 *   全量回填（full=true），之后所有范围都只做增量；
 * - 写盘防抖 + 原子替换（tmp → rename），损坏文件备份后忽略（内存副本继续可用）。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
/** 存储格式版本。 */
export const SERIES_STORE_VERSION = 2;
/** 存储文件名（$DSH_HOME 下）。 */
const STORE_FILE_NAME = 'dsh-get-balance-series-store.json';
/** 写盘防抖（毫秒）。 */
const PERSIST_DEBOUNCE_MS = 1500;
/* ── 模块状态 ─────────────────────────────────────────────────── */
/** 生效的存储文件路径；null = 仅内存（不落盘，测试注入用）。 */
let storePath = null;
/** 懒加载 promise（首个消费方触发，全进程只加载一次）。 */
let loadPromise = null;
/** 当前存储（内存副本）。 */
let store = null;
let dirty = false;
let persistTimer = null;
let persistTail = Promise.resolve();
let corruptWarned = false;
let persistWarned = false;
/** 空存储。 */
export function emptyStore() {
    return { version: SERIES_STORE_VERSION, full: false, days: {} };
}
/** 默认存储文件路径；$DSH_HOME 不可用时返回 null（降级为仅内存）。 */
function defaultStorePath() {
    try {
        return dshHomePath(STORE_FILE_NAME);
    }
    catch {
        return null;
    }
}
/** 备份损坏的存储文件（保留现场供排查），不阻塞业务。 */
async function backupCorruptStore() {
    if (storePath === null)
        return;
    const backup = `${storePath}.bak-${Date.now()}`;
    await rename(storePath, backup).catch(() => undefined);
}
/** 加载持久化存储（懒 + 一次性）。 */
export async function loadSeriesStore(cachePath) {
    if (loadPromise === null) {
        loadPromise = (async () => {
            storePath = cachePath === undefined ? defaultStorePath() : cachePath;
            store = emptyStore();
            if (storePath === null)
                return;
            let text;
            try {
                text = await readFile(storePath, 'utf8');
            }
            catch {
                return; // 缺失 / 不可读：从空存储开始
            }
            try {
                const parsed = JSON.parse(text);
                if (parsed === null || typeof parsed !== 'object')
                    return;
                if (parsed.version !== SERIES_STORE_VERSION)
                    return;
                if (typeof parsed.full !== 'boolean')
                    return;
                if (typeof parsed.days !== 'object' || parsed.days === null || Array.isArray(parsed.days))
                    return;
                if (parsed.coveredFrom !== undefined && typeof parsed.coveredFrom !== 'string')
                    return;
                if (parsed.coveredTo !== undefined && typeof parsed.coveredTo !== 'string')
                    return;
                if (parsed.todayUpdatedAt !== undefined && typeof parsed.todayUpdatedAt !== 'number')
                    return;
                store = parsed;
            }
            catch {
                await backupCorruptStore();
                if (!corruptWarned) {
                    corruptWarned = true;
                    console.warn(`[dsh-get-balance] series store corrupted, backed up and starting fresh: ${storePath}`);
                }
            }
        })();
    }
    await loadPromise;
    return store ?? emptyStore();
}
/** 标记存储变更：防抖调度写盘（仅内存模式下为 no-op）。 */
export function touchSeriesStore() {
    if (storePath === null || store === null)
        return;
    dirty = true;
    if (persistTimer !== null)
        return;
    persistTimer = setTimeout(() => {
        persistTimer = null;
        void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
}
/** 串行化原子写盘（tmp → rename）。失败只告警一次，内存副本不受影响。 */
async function flushPersist() {
    if (storePath === null || store === null)
        return;
    const path = storePath;
    const run = persistTail.then(async () => {
        try {
            if (!dirty)
                return;
            dirty = false;
            const serialized = JSON.stringify(store);
            await mkdir(dirname(path), { recursive: true });
            const tmp = `${path}.tmp`;
            await writeFile(tmp, serialized, 'utf8');
            await rename(tmp, path);
        }
        catch (e) {
            if (!persistWarned) {
                persistWarned = true;
                console.warn(`[dsh-get-balance] failed to persist series store: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    });
    persistTail = run.catch(() => undefined);
    await run;
}
