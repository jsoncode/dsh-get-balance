/**
 * dsh-get-balance —— 浏览器半边插件主体（slots 注册）。
 *
 * 本文件不包含 __ModuleLoader__ 包装：构建为单文件 CJS 后由 tsdown 的
 * banner/footer 包装成宿主工厂格式。外部依赖（react 等）在打包时 external，
 * 运行时经 factory 的 require 解析到宿主模块表（seed）。
 *
 * 入口结构（统一弹框）：
 * - sidebar.footer.action：常驻「余额」按钮（固定 order: 30，排在插槽
 *   靠前位置），点击打开统一弹框；检测到新版本时最右侧显示「更新」胶囊，
 *   点击胶囊 → 确认弹框 → 日志大弹框（dsh plugin --profile web update 执行日志）；
 * - shell.overlay（dsh-balance-modal）：统一弹框，三个 tab —— 余额 / 费用 /
 *   价格设置，所有余额相关的显示与设置都收敛在此；
 * - shell.overlay（dsh-balance-update）：更新确认弹框 / 更新日志大弹框。
 */
/** 浏览器侧插件上下文（宿主注入）。 */
export interface ClientCtx {
    get<T = unknown>(name: string): T | undefined;
    /** cordis 事件订阅（可选：宿主 locale 服务缺失时的 'locale/change' 兜底通道）。 */
    on?(event: string, listener: (payload: unknown) => void): unknown;
    remote: {
        commands: {
            execute(sessionId: string, command: string): Promise<unknown>;
        };
    };
}
export interface ClientPluginModule {
    name: string;
    inject: string[];
    apply(ctx: ClientCtx): void;
}
export declare function createPlugin(): ClientPluginModule;
//# sourceMappingURL=plugin.d.ts.map