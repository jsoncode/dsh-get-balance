/**
 * dsh-get-balance —— 侧边栏底部入口（sidebar.footer.action）：
 * 常驻的「余额」按钮（footer.action 区），点击打开统一弹框
 * （余额 / 费用 / 价格设置 三个 tab）。
 *
 * 右侧文案横排显示：「余额 ￥110.00 | ￥99.50 · 时段小圆点」——余额靠右对齐
 * （货币符号前缀、数字绿色），**每个服务商（账号）一段**，以 | 分隔；
 * 取不到余额的账号（未配置 key / 查询失败）以**红色 --** 占位（悬停显示原因）。
 * 时段文案收敛为小圆点（高峰红 / 空闲绿），悬停使用宿主的
 * Tooltip（@deepseek-ai/dsh-client-ui-primitives，运行时从宿主 seed 表解析）
 * 气泡提示完整信息「当前为高峰时段 全价计费」/「当前为空闲时段 半价计费」，
 * 其中价词着色（高峰「全价」红 / 空闲「半价」绿，与圆点同色）。
 * 时段判定与宿主一致（时区偏移 + 高峰窗口 + 周六日半价，按当前时间），
 * 每 60 秒刷新；弹框内保存价格成功或关闭弹框后立即刷新。
 */
import type { RunFn } from '../rpc.ts';
export interface FooterButtonProps {
    /** 打开统一「余额」弹框。 */
    onOpen(): void;
    /** 上报当前会话 id（供费用查询经宿主读取内存会话）。 */
    reportSession?: (sessionId: string) => void;
    wide?: boolean;
    useSessions?: (selector: (s: {
        current?: string;
    }) => unknown) => unknown;
    /** 宿主 op 通道（pricesGet 取时段配置）。 */
    run: RunFn;
    /** 弹框开合状态（关闭后刷新按钮时段文案）。 */
    useOpen(): boolean;
    /** 价格配置保存 tick（弹框保存成功后变化，立即刷新时段文案）。 */
    usePriceTick?(): number;
    /** 余额刷新 tick（插件共享 store）：头部按钮确认刚完成的请求走 DeepSeek 官方接口后递增，此处强制刷新余额。 */
    useBalanceTick?(): number;
}
export declare function FooterButton({ onOpen, reportSession, wide, useSessions, run, useOpen, usePriceTick, useBalanceTick }: FooterButtonProps): import("react").JSX.Element;
//# sourceMappingURL=FooterButton.d.ts.map