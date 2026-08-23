/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ≈¥xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与
 * 预估费用（≈ 在前、货币符号 ¥ 在后，与金额同绿）。文案空格固定为
 * 「前缀 1.87M | ≈¥0.2935」（前缀与 token 之间一个空格、| 两侧空格）。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 * 额外监听宿主会话快照的 running 标志（会话级插槽标准套件 useSession 注入）：
 * 任务执行中 running=true，完成后回落 false —— 在该回落瞬间广播 bumpTaskTick
 * （footer 入口随之刷新余额），自身经 useTaskTick 立即重算 token 与预估费用，
 * 保证一轮任务结束后的数字即为最终值。
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
    /**
     * 宿主注入的会话快照选择 hook（会话级插槽标准套件；运行时提供
     * 'session' → useSession）。缺省时不做「任务完成」监听。
     */
    useSession?(selector: (s: {
        running?: boolean;
    }) => unknown): unknown;
    /** 任务完成 tick（插件共享 store）：会话任务结束时递增，自身订阅后刷新。 */
    useTaskTick?(): number;
    /** 任务完成广播：检测到 running true→false 时调用，footer 入口随之刷新余额。 */
    bumpTaskTick?(): void;
}
export declare function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, useTaskTick, bumpTaskTick }: HeaderButtonProps): import("react").JSX.Element;
//# sourceMappingURL=HeaderButton.d.ts.map