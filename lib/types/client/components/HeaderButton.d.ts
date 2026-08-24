/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ≈¥xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与
 * 预估费用（≈ 在前、货币符号 ¥ 在后，与金额同绿）。文案空格固定为
 * 「前缀 1.87M | ≈¥0.2935」（前缀与 token 之间一个空格、| 两侧空格）。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 * 会话可能中途切换 provider：按钮展示的是**合并统计结果**，**悬停**按钮
 * 弹出气泡弹框，逐 provider 列出当前会话统计（`ds-self 268K | ≈¥0.41`），
 * 鼠标移出按钮/气泡区域后自动收起。
 * 额外监听宿主会话快照（会话级插槽标准套件 useSession 注入）：每次 AI 请求
 * 完成（assistant/message 事件落盘，快照中新增一个更高 seq 的 assistant 节点）
 * 即重算 token 与预估费用 —— 不是流式逐 token 更新，而是每次请求完成更新一次
 * （一轮含多次请求时逐次更新）。余额刷新按请求走的接口区分：该请求走 DeepSeek
 * 官方接口（api.deepseek.com，cost op 的 lastRequestOfficial=true）才广播
 * bumpBalanceTick 让 footer 强制刷新余额；非官方接口只更新 token 与预估费用。
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
     * 'session' → useSession）。缺省时不做「请求完成」监听。
     */
    useSession?(selector: (s: {
        nodes?: readonly {
            kind?: string;
            seq?: number;
        }[];
    }) => unknown): unknown;
    /** 余额刷新广播：刚完成的请求走 DeepSeek 官方接口时调用，footer 随之强制刷新余额。 */
    bumpBalanceTick?(): void;
}
export declare function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, bumpBalanceTick }: HeaderButtonProps): import("react").JSX.Element;
//# sourceMappingURL=HeaderButton.d.ts.map