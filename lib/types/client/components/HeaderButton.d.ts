/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ¥≈xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与预估费用。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 */
import type { RunFn } from '../rpc.ts';
export interface HeaderButtonProps {
    /** 当前会话 id（插槽标准 props）。 */
    sessionId: string;
    /** 宿主 op 通道。 */
    run: RunFn;
    /** 自动刷新 tick（到点变化时触发刷新）。 */
    useTick(): number;
    /** 价格配置保存 tick（弹框保存成功后变化，立即刷新费用金额）。 */
    usePriceTick?(): number;
}
export declare function HeaderButton({ sessionId, run, useTick, usePriceTick }: HeaderButtonProps): import("react").JSX.Element;
//# sourceMappingURL=HeaderButton.d.ts.map