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
import type { Context } from '@deepseek-ai/cordis';
import type { SettingsService } from './providers.ts';
import type { ExtraKey, PriceConfig } from './types.ts';
/** 配置文件文件名（$DSH_HOME 下）。 */
export declare const CONFIG_FILE_NAME = "dsh-get-balance.json";
/** 插件持久数据的完整形状（与 JSON 文件一一对应）。 */
export interface PluginConfigFile {
    version: number;
    extraKeys: ExtraKey[];
    prices: PriceConfig;
    autoRefreshSeconds: number;
    /** 「显示余额」开关：false 时 footer 入口与余额列表的金额一律掩码为 **（默认 true）。 */
    showBalance: boolean;
}
/** config-file 模块初始化依赖（由 index.ts 的 apply 注入）。 */
export interface ConfigDeps {
    ctx: Context;
    /** 宿主 settings 服务（可能缺失；仅迁移旧数据时需要）。 */
    settings?: SettingsService;
}
/**
 * 初始化模块（apply 时调用一次）。只启动懒迁移 promise，不阻塞 apply；
 * 所有读/写入口都会 await initPromise，因此首个 op 必然等迁移完成。
 */
export declare function initConfigFile(deps: ConfigDeps): void;
/**
 * 读取完整插件配置（迁移完成后每次现读文件）。
 * 文件缺失 → 默认值；JSON 损坏 → 备份为 `<file>.bak-<时间戳>` + 告警一次 + 默认值。
 */
export declare function readPluginConfig(): Promise<PluginConfigFile>;
/**
 * 保存插件配置：合并 patch 后整体写入（读-合并-写整体入队串行化，防并发丢更新）。
 * 先写 `<file>.tmp` 再 rename 原子替换；写前确保目录存在；失败抛错由 op 层映射。
 */
export declare function savePluginConfig(patch: Partial<PluginConfigFile>): Promise<void>;
//# sourceMappingURL=config-file.d.ts.map