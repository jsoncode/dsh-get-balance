/**
 * dsh-get-balance —— 统一「余额」弹框（余额 / 费用 / 价格设置 三 tab）。
 *
 * 所有余额相关的显示与设置都收敛在此弹框：
 * 1. 余额：DeepSeek 服务商列表（来源标签、脱敏 key、总/赠送余额），
 *    每行独立状态；底部「附加 API Key」管理不在 providers 配置中的 key；
 * 2. 费用：筛选器（API Key / 平台 / 模型 / 时间）+ 五张 ECharts 堆叠柱状图
 *    （费用 / Token 总量 / 工作区 / 缓存比例 / 工具占比），见 CostTab.tsx；
 * 3. 价格设置：二级平台 tab（当前仅 DeepSeek）—— 时段配置 + 价格档行内编辑 + 增删，
 *    后续新增其他平台定价时在 PRICE_PLATFORMS 加一项即可。
 */
import type { RunFn } from '../rpc.ts';
export interface BalanceModalProps {
    run: RunFn;
    useOpen(): boolean;
    close(): void;
    /** 当前会话 id（footer 入口上报），费用查询随请求上传。 */
    getSession(): string;
    /** 自动刷新 tick（到点触发余额/费用刷新）。 */
    useTick(): number;
    /** 当前定时刷新间隔（秒，0 = 关闭）。 */
    useAutoSeconds(): number;
    /** 更新定时刷新间隔（秒）。 */
    setAutoSeconds(seconds: number): void;
    /** 价格配置保存成功后调用：通知 footer / 头部按钮立即刷新时段与费用显示。 */
    bumpPriceTick(): void;
    /** 「显示余额」开关当前值（false = footer 与余额列表金额掩码为 **）。 */
    useShowBalance(): boolean;
    /** 切换「显示余额」开关：即时生效并持久化（footer 入口同步跟随）。 */
    setShowBalance(enabled: boolean): void;
}
export declare function BalanceModal({ run, useOpen, close, getSession, useTick, useAutoSeconds, setAutoSeconds, bumpPriceTick, useShowBalance, setShowBalance }: BalanceModalProps): import("react").JSX.Element | null;
//# sourceMappingURL=BalanceModal.d.ts.map