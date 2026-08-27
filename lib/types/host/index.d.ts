/**
 * dsh-get-balance —— 宿主半边（可发布组合包，无硬编码路径）
 *
 * - 插件持久数据（附加 key / 价格档 / 自动刷新间隔）存独立配置文件
 *   $DSH_HOME/dsh-get-balance.json（config-file.ts），不再写入宿主默认设置
 *   settings.yaml；首次运行时若检测到旧 dsh-balance settings 段数据会自动迁移；
 * - `/dsh-balance/api` HTTP 路由（webServer 注册 + 信任围栏）：浏览器半边
 *   经 fetch 调用，参数为 JSON（{ op: 'providers|balance|cost|pricesGet|pricesSave|keysGet|keysSave' }），
 *   结果以 JSON 信封回传。请求不进入对话命令通道，页面不会出现 command 节点；
 * - `dsh-balance` 命令：保留兼容（用户/模型在对话中显式执行时可用），
 *   浏览器半边默认不走命令通道。
 *
 * 运行时依赖（@deepseek-ai/*）由 package.json 的 peerDependencies 声明，
 * 安装时由宿主解析，本文件不含任何绝对路径。
 */
import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
import type { OpRequest } from './types.ts';
export declare const name = "dsh-get-balance";
export declare const inject: string[];
export declare const Config: Schema<Schemastery.ObjectS<{}>, Schemastery.ObjectT<{}>>;
export declare function apply(ctx: Context, _config: Record<string, never>): void;
export type { OpRequest };
//# sourceMappingURL=index.d.ts.map