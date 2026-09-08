/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ≈¥xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与
 * 预估费用（≈ 在前、货币符号 ¥ 在后，与金额同绿）。文案空格固定为
 * 「前缀 1.87M | ≈¥0.2935」（前缀与 token 之间一个空格、| 两侧空格）。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 * 会话可能中途切换 provider：按钮展示的是**合并统计结果**，**悬停**按钮
 * 弹出气泡弹框，逐 provider 列出当前会话统计（`ds-self 268K | ≈¥0.41`），
 * 鼠标移出按钮/气泡区域后自动收起。
 * 额外监听会话事件（三条冗余触发路径，任一命中即重算，350ms 窗口合并）：
 * 1. useChat（插槽标准套件，主信号）：会话 chat 快照的已落盘节点里出现更高的
 *    assistant 消息 seq —— assistant/message 事件落盘即产生该节点，正是「一次
 *    响应结束」；
 * 2. sessions 服务的 eventSource（直连兜底）：窗口追加 assistant/message 事件
 *    时立即回调，不依赖插槽标准套件；
 * 3. useSession（插槽标准套件）：快照 running 从 true 变为 false —— 整轮结束
 *    （含子代理并入的用量）时补一次。
 * 余额刷新按请求走的接口区分：该请求走 DeepSeek 官方接口（api.deepseek.com，
 * cost op 的 lastRequestOfficial=true）才广播 bumpBalanceTick 让 footer 强制
 * 刷新余额；非官方接口只更新 token 与预估费用。
 */
import type { RunFn } from '../rpc.ts';
/** 会话 chat 快照中已落盘的节点（仅取判定所需字段）。 */
interface ChatNodeView {
    kind?: string;
    seq?: number;
}
/** 会话 chat 快照（useChat 选择器入参；宿主未注册 chat 目标时可能为空）。 */
interface ChatSnapshotView {
    legacy?: {
        nodes?: readonly ChatNodeView[];
    };
}
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
     * 'session' → useSession）。用作「整轮结束」兜底信号，缺省时不做该监听。
     */
    useSession?(selector: (s: {
        running?: boolean;
    }) => unknown): unknown;
    /**
     * 宿主注入的会话 chat 选择 hook（会话级插槽标准套件；运行时提供
     * 'chat' → useChat）。主信号：assistant 消息节点落盘即一次响应结束。
     * 缺省时退化为仅靠 useSession / 定时 / 悬停触发。
     */
    useChat?(selector: (s: ChatSnapshotView) => unknown): unknown;
    /**
     * 会话事件直连订阅（宿主 sessions 服务的 per-session eventSource，软依赖）：
     * assistant/message 落盘即回调。返回退订函数，服务不可达时返回 null。
     * 与上面两个 hook 互为冗余，任一可用即可感知「一次响应结束」。
     */
    subscribeSessionEvents?(sessionId: string, onAssistantMessage: () => void): (() => void) | null;
    /** 余额刷新广播：刚完成的请求走 DeepSeek 官方接口时调用，footer 随之强制刷新余额。 */
    bumpBalanceTick?(): void;
}
export declare function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, useChat, subscribeSessionEvents, bumpBalanceTick }: HeaderButtonProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=HeaderButton.d.ts.map