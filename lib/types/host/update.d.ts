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
export interface PluginUpdateInfo {
    /** 被安装根目录 package.json 里的当前版本；读取失败为空串。 */
    current: string;
    /** registry 上的最新版本；网络失败 / 未命中时为空串。 */
    latest: string;
    /** latest 是否比 current 更新。 */
    hasUpdate: boolean;
}
/**
 * 判断 candidate 是否严格比 base 更新（semver 规则子集）：
 * 主版本三元组数值比较；预发布版劣于正式版，预发布标识逐段比较。
 * 任一侧无法解析时返回 false（宁可漏报也不误报）。
 */
export declare function isNewerVersion(candidate: string, base: string): boolean;
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
export declare function readInstalledVersion(): string;
/**
 * 检查插件更新：registry 最新版 vs 被安装根目录 package.json 版本。
 * 每次调用实时读盘 + 实时请求 registry（客户端每次页面刷新触发一次）；
 * 瞬间并发合并为同一请求，settle 即清空 —— 不引入任何时间维度的缓存，
 * 因此刚发布 / 刚更新的版本号下一次刷新就能查到。
 * 网络失败降级为 { current, latest:'', hasUpdate:false }（不做负面缓存，
 * 下次刷新自动重试）。
 */
export declare function checkPluginUpdate(): Promise<PluginUpdateInfo>;
//# sourceMappingURL=update.d.ts.map