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
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import Schema from '@deepseek-ai/schemastery';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { normalizePriceConfig } from "./cost.js";
/** 配置文件文件名（$DSH_HOME 下）。 */
export const CONFIG_FILE_NAME = 'dsh-get-balance.json';
/** 配置文件格式版本（未来演进用）。 */
const CONFIG_FILE_VERSION = 1;
/** 旧版 settings 命名空间的 schema（仅迁移读取用）。 */
const LegacyBalanceSchema = Schema.object({
    extraKeysJson: Schema.string().default('[]'),
    pricesJson: Schema.string().default(''),
    autoRefreshJson: Schema.string().default('0'),
});
/* ── 模块状态 ─────────────────────────────────────────────────── */
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
/* ── 内部工具 ─────────────────────────────────────────────────── */
/** 默认配置：空 key 列表 + 内置默认价格 + 自动刷新关闭 + 显示余额开启。 */
function defaultConfig() {
    return {
        version: CONFIG_FILE_VERSION,
        extraKeys: [],
        prices: normalizePriceConfig(undefined),
        autoRefreshSeconds: 0,
        showBalance: true,
    };
}
/** 把任意值规范化为 ExtraKey 列表（逐项容错，id 缺省补 `k<index>`）。 */
function sanitizeKeys(parsed) {
    if (!Array.isArray(parsed))
        return [];
    return parsed
        .filter((item) => item !== null && typeof item === 'object')
        .map((item, index) => ({
        id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `k${index}`,
        label: typeof item.label === 'string' ? item.label : '',
        apiKey: typeof item.apiKey === 'string' ? item.apiKey : '',
    }));
}
/** 把任意值规范化为自动刷新秒数（非法/负值 → 0）。 */
function sanitizeSeconds(raw) {
    const n = typeof raw === 'number' ? raw : Number(String(raw ?? '0').trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}
/** 把任意值规范化为布尔开关（仅接受字面 true/false，其余回退默认）。 */
function sanitizeBool(raw, fallback) {
    return typeof raw === 'boolean' ? raw : fallback;
}
/** 解析旧版 settings 的 JSON 字符串字段；空串/非法 → undefined。 */
function parseLegacyJson(raw) {
    if (typeof raw !== 'string' || raw.length === 0)
        return undefined;
    try {
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
/* ── 初始化与一次性迁移 ───────────────────────────────────────── */
/**
 * 初始化模块（apply 时调用一次）。只启动懒迁移 promise，不阻塞 apply；
 * 所有读/写入口都会 await initPromise，因此首个 op 必然等迁移完成。
 */
export function initConfigFile(deps) {
    if (initPromise === null)
        initPromise = ensureMigrated(deps);
}
/**
 * 一次性迁移：JSON 文件不存在且宿主 settings 存在旧 dsh-balance 命名空间
 * 数据时，把三份字段搬进 JSON 文件；之后不再注册该命名空间。
 */
async function ensureMigrated(deps) {
    if (migrated)
        return;
    migrated = true;
    try {
        await access(configPath);
        return; // 配置文件已存在：无需迁移
    }
    catch {
        /* 不存在 → 尝试迁移 */
    }
    const legacy = await readLegacySettings(deps);
    if (legacy === null)
        return;
    try {
        await writeConfigFile(legacy);
        console.log(`[dsh-get-balance] migrated plugin data from host settings to ${configPath}`);
    }
    catch (e) {
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
    if (deps.settings === undefined)
        return null;
    let legacy = null;
    let fiber = null;
    try {
        fiber = deps.ctx.plugin({
            name: 'dsh-get-balance-legacy-migrate',
            apply(child) {
                const settings = child.get('settings');
                if (settings === undefined)
                    return;
                try {
                    const scope = settings.register(settingsNamespace('dsh-balance'), LegacyBalanceSchema, {
                        base: { extraKeysJson: '[]', pricesJson: '' },
                    });
                    if (scope === null)
                        return;
                    const value = scope.get();
                    const extraKeys = sanitizeKeys(parseLegacyJson(value['extraKeysJson']));
                    const prices = normalizePriceConfig(parseLegacyJson(value['pricesJson']));
                    const autoRefreshSeconds = sanitizeSeconds(value['autoRefreshJson']);
                    // 全部为默认值视为无旧数据，不落盘（全新安装不产生多余文件）。
                    const isDefault = extraKeys.length === 0 && autoRefreshSeconds === 0
                        && JSON.stringify(prices) === JSON.stringify(normalizePriceConfig(undefined));
                    if (isDefault)
                        return;
                    legacy = { extraKeys, prices, autoRefreshSeconds };
                }
                catch {
                    /* 旧段注册/读取失败：视为无旧数据，不迁移 */
                }
            },
        });
        await fiber; // 等待子插件加载完成（apply 同步执行完毕）
    }
    catch {
        return null;
    }
    finally {
        if (fiber !== null) {
            await fiber.dispose().catch(() => undefined);
        }
    }
    return legacy;
}
/* ── 读 ───────────────────────────────────────────────────────── */
/**
 * 读取完整插件配置（迁移完成后每次现读文件）。
 * 文件缺失 → 默认值；JSON 损坏 → 备份为 `<file>.bak-<时间戳>` + 告警一次 + 默认值。
 */
export async function readPluginConfig() {
    await initPromise;
    let text;
    try {
        text = await readFile(configPath, 'utf8');
    }
    catch (e) {
        const code = e.code;
        if (code === 'ENOENT')
            return defaultConfig();
        throw e; // 其它读错误（权限等）向上抛，由 op 层映射为错误
    }
    try {
        const parsed = JSON.parse(text);
        return {
            version: typeof parsed['version'] === 'number' ? parsed['version'] : CONFIG_FILE_VERSION,
            extraKeys: sanitizeKeys(parsed['extraKeys']),
            prices: normalizePriceConfig(parsed['prices']),
            autoRefreshSeconds: sanitizeSeconds(parsed['autoRefreshSeconds']),
            showBalance: sanitizeBool(parsed['showBalance'], true),
        };
    }
    catch {
        await backupCorruptFile().catch(() => undefined);
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
/* ── 写 ───────────────────────────────────────────────────────── */
/**
 * 保存插件配置：合并 patch 后整体写入（读-合并-写整体入队串行化，防并发丢更新）。
 * 先写 `<file>.tmp` 再 rename 原子替换；写前确保目录存在；失败抛错由 op 层映射。
 */
export async function savePluginConfig(patch) {
    await initPromise;
    const run = writeTail.then(async () => {
        const current = await readFileConfig();
        await writeConfigFile({ ...current, ...patch });
    });
    writeTail = run.catch(() => undefined);
    await run;
}
/** 现读文件并规范化为完整配置（不触发迁移，仅供保存前取当前值）。 */
async function readFileConfig() {
    let text;
    try {
        text = await readFile(configPath, 'utf8');
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return defaultConfig();
        throw e;
    }
    try {
        const parsed = JSON.parse(text);
        return {
            version: typeof parsed['version'] === 'number' ? parsed['version'] : CONFIG_FILE_VERSION,
            extraKeys: sanitizeKeys(parsed['extraKeys']),
            prices: normalizePriceConfig(parsed['prices']),
            autoRefreshSeconds: sanitizeSeconds(parsed['autoRefreshSeconds']),
            showBalance: sanitizeBool(parsed['showBalance'], true),
        };
    }
    catch {
        await backupCorruptFile().catch(() => undefined);
        return defaultConfig();
    }
}
/** 原子写盘：mkdir -p → 写 tmp → rename 替换。 */
async function writeConfigFile(next) {
    const serialized = JSON.stringify(next, null, 2) + '\n';
    await mkdir(dirname(configPath), { recursive: true });
    const tmp = `${configPath}.tmp`;
    await writeFile(tmp, serialized, 'utf8');
    await rename(tmp, configPath);
}
