/**
 * dsh-get-balance —— 宿主半边：执行插件更新命令（后台进程 + 输出缓冲）。
 *
 * 浏览器半边点击「更新」胶囊 → 确认弹框 → 大日志弹框：本模块以子进程后台
 * 执行 `dsh plugin --profile web update dsh-get-balance`，stdout/stderr 实时
 * 追加进环形缓冲；客户端轮询 pluginUpdateStatus op 拉取增量日志与运行状态
 * （done / exitCode）。同一时刻只允许一个更新进程；进程内缓冲有上限防膨胀。
 *
 * 【排除「启动更新命令失败」】dsh CLI 常经 pnpm 全局安装，而宿主进程的 PATH
 * 未必包含其 bin 目录（如由服务 / 桌面快捷方式拉起、PATH 不完整），裸 spawn
 * 'dsh' 会失败。这里按优先级解析可执行文件：
 *   1. 显式覆盖 process.env.DSH_BIN（存在才用）；
 *   2. 常见全局 bin 目录：PNPM_HOME / %APPDATA%\npm / %LOCALAPPDATA%\pnpm /
 *      ~/.local/bin（Windows 依次试 dsh.cmd / dsh.exe / dsh）；
 *   3. where / which 沿 PATH 探测；
 *   4. 兜底裸命令名（Windows 经 shell 解析 .cmd，命中与否都写入日志，不静默）。
 */
export interface PluginUpdateStatus {
    running: boolean;
    done: boolean;
    output: string;
    exitCode: number | null;
    error: string;
    startedAt: number | null;
    finishedAt: number | null;
}
/**
 * 解析 dsh 可执行文件：显式覆盖 > 常见全局 bin 目录 > where/which 探测 > 裸名。
 * 返回值是绝对路径或裸命令名（后者交给 PATH / shell 解析）。
 * （导出仅用于冒烟测试；不进入对外 API，index.ts 不 re-export。）
 */
export declare function resolveDshCommand(): string;
/**
 * 启动更新进程。已在运行则返回 alreadyRunning=true（不重复启动）；
 * 上次已结束则丢弃旧记录重新开始。
 */
export declare function startPluginUpdate(): {
    ok: boolean;
    alreadyRunning?: boolean;
    error?: string;
};
/** 轮询用：当前更新进程（或最近一次已结束进程）的状态与累计输出。 */
export declare function getPluginUpdateStatus(): PluginUpdateStatus;
//# sourceMappingURL=plugin-update.d.ts.map