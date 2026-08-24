import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { currencySymbol, fmtAmount, fmtTokens, t } from "../i18n.js";
import { NumberRoller } from "./NumberRoller.js";
/** 四桶 token 总数。 */
function totalTokensOf(b) {
    return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
}
/** 快照中 assistant 消息节点的最大事件 seq；没有任何 assistant 消息时为 0。
 *  assistant/message 事件在会话日志中按序追加，seq 单调递增；窗口截断只会
 *  丢弃最早的节点，最大 seq 不受影响，因此是「请求完成」的稳定信号。 */
function maxAssistantSeqOf(nodes) {
    if (!Array.isArray(nodes))
        return 0;
    let max = 0;
    for (const node of nodes) {
        if (node && node.kind === 'assistant' && typeof node.seq === 'number' && node.seq > max)
            max = node.seq;
    }
    return max;
}
export function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, bumpBalanceTick }) {
    const tick = useTick();
    const priceTick = usePriceTick?.() ?? 0;
    const [tokens, setTokens] = useState(null);
    const [amount, setAmount] = useState(null);
    // 逐 provider 明细（气泡弹框）：cost.session.byKey（token 降序，宿主已排）。
    const [byKey, setByKey] = useState(null);
    // 气泡弹框开关与锚点位置（fixed 定位，避免被头部容器 overflow 裁剪）。
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [popoverPos, setPopoverPos] = useState(null);
    const btnRef = useRef(null);
    // providers 展示名缓存（路由 key → label），气泡弹框展示用。
    const [providerLabels, setProviderLabels] = useState(null);
    // 已落盘的 assistant 消息最大事件 seq：每次 AI 请求完成（assistant/message）
    // 都会让它增大，作为「请求完成」的稳定信号（流式 chunk 不改变它）。
    const assistantSeq = useSession ? useSession((s) => maxAssistantSeqOf(s.nodes)) : 0;
    // 会话切换时重置观察状态（组件实例可能被复用）。
    const prevSessionId = useRef(null);
    // 历史最大 assistant seq：超过它即视为一次新的 AI 请求完成。
    const maxAssistantSeq = useRef(null);
    /**
     * 刷新 token 与预估费用（cost op）。gateBalance=true 时（请求完成路径）：
     * 仅当最近一次完成的请求走 DeepSeek 官方接口（lastRequestOfficial=true）才
     * 广播 bumpBalanceTick —— 非官方接口的请求不触发余额查询。
     */
    const refresh = useCallback(async (gateBalance = false) => {
        try {
            const costRes = await run(sessionId, { op: 'cost', sessionId });
            const cost = costRes.cost;
            const session = cost?.session;
            if (session === undefined)
                return;
            if (session.amount !== undefined)
                setAmount(session.amount);
            if (session.buckets !== undefined)
                setTokens(totalTokensOf(session.buckets));
            if (Array.isArray(session.byKey))
                setByKey(session.byKey);
            if (gateBalance && cost?.lastRequestOfficial === true)
                bumpBalanceTick?.();
        }
        catch {
            // 保持上一次值。
        }
    }, [run, sessionId, bumpBalanceTick]);
    // 气泡弹框展示名：路由 key → providers 列表 label（一次拉取缓存）。
    const labelOf = (route) => providerLabels?.[route] ?? route;
    const loadProviderLabels = useCallback(async () => {
        if (providerLabels !== null)
            return;
        try {
            const res = await run('', { op: 'providers' });
            const providers = res.providers;
            if (!Array.isArray(providers))
                return;
            const map = {};
            for (const p of providers) {
                // 会话事件里的 provider 是路由 key（如 ds-self / deepseek-official），
                // 与 providers 条目的 id（pi-ai:ds-self / llm-deepseek:deepseek-official）对应。
                const route = p.id.replace(/^(pi-ai|llm-deepseek|extra):/, '');
                if (route.length > 0 && p.label.length > 0)
                    map[route] = p.label;
                if (p.label.length > 0)
                    map[p.label] = p.label;
            }
            setProviderLabels(map);
        }
        catch { /* 宿主不可达：保留原始路由名 */ }
    }, [run, providerLabels]);
    // 挂载即取 providers 展示名（气泡弹框用）。
    useEffect(() => {
        void loadProviderLabels();
    }, [loadProviderLabels]);
    // 挂载 / 会话切换 / 自动刷新 tick / 价格保存 tick 变化时刷新；点击按钮手动刷新一次。
    // 请求完成不在此列：由下方完成 effect 直接调用 refresh(true)，避免重复 cost 查询。
    useEffect(() => {
        void refresh();
    }, [refresh, tick, priceTick]);
    // 会话切换：清空观察状态，避免把上一会话的 seq 当作增量误触发。
    useEffect(() => {
        if (prevSessionId.current !== sessionId) {
            prevSessionId.current = sessionId;
            maxAssistantSeq.current = null;
        }
    }, [sessionId]);
    // 每次 AI 请求完成（assistant/message 落盘 → 快照出现更高 seq 的 assistant 节点）：
    // 立即重算 token 与预估费用；若该请求走 DeepSeek 官方接口，附带广播 bumpBalanceTick
    // （footer 余额随之强制刷新）。首次观察只记录历史存量（会话已有历史消息），不触发。
    useEffect(() => {
        if (useSession === undefined)
            return;
        if (maxAssistantSeq.current === null) {
            maxAssistantSeq.current = assistantSeq;
            return;
        }
        if (assistantSeq > maxAssistantSeq.current) {
            maxAssistantSeq.current = assistantSeq;
            void refresh(true);
        }
    }, [useSession, assistantSeq, refresh]);
    // 数字「上下轮播」动画：token 紧凑缩写（K/M/B/T/P 后缀列静态）、金额
    // （≈¥ 前缀之外的数字部分逐位滚动）。
    const tokensText = tokens === null ? '--' : fmtTokens(tokens);
    const amountText = amount === null ? '--' : fmtAmount(amount);
    const title = t('headerBtnPrefix') + ' ' + tokensText + ' | ≈¥' + amountText;
    // 悬停交互：鼠标进入按钮/气泡区域即展开逐 provider 明细（fixed 锚定按钮下缘），
    // 离开后延迟 150ms 收起 —— 短暂延迟桥接按钮与气泡之间的空隙，
    // 指针跨空隙或移入气泡时 openPopover 会取消待执行的关闭，气泡不闪断。
    const hoverRef = useRef(false);
    const closeTimerRef = useRef(null);
    const clearCloseTimer = () => {
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };
    const openPopover = () => {
        hoverRef.current = true;
        clearCloseTimer();
        void refresh();
        const el = btnRef.current;
        if (el) {
            const r = el.getBoundingClientRect();
            setPopoverPos({ top: r.bottom + 6, left: Math.max(8, r.right - 260) });
        }
        setPopoverOpen(true);
    };
    const scheduleClose = () => {
        hoverRef.current = false;
        if (closeTimerRef.current !== null)
            window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null;
            if (!hoverRef.current)
                setPopoverOpen(false);
        }, 150);
    };
    // 卸载时清理悬停关闭定时器。
    useEffect(() => () => {
        if (closeTimerRef.current !== null)
            window.clearTimeout(closeTimerRef.current);
    }, []);
    return (_jsxs("span", { className: "dshb-header-wrap", onMouseEnter: openPopover, onMouseLeave: scheduleClose, children: [_jsxs("button", { ref: btnRef, type: "button", className: "dshb-header-btn", title: title, "aria-label": title, "aria-expanded": popoverOpen, onClick: () => void refresh(), children: [_jsx("span", { children: t('headerBtnPrefix') }), ' ', _jsx(NumberRoller, { value: tokens, format: fmtTokens, fallback: "--", className: "dshb-header-tokens" }), _jsx("span", { className: "dshb-header-sep", children: "|" }), _jsxs("span", { className: "dshb-header-amount", children: ["\u2248\u00A5", _jsx(NumberRoller, { value: amount, format: fmtAmount, fallback: "--", className: "dshb-header-amount-num" })] })] }), popoverOpen ? (_jsxs("div", { className: "dshb-header-bd", role: "dialog", "aria-label": t('headerBreakdownTitle'), style: popoverPos !== null ? { top: popoverPos.top, left: popoverPos.left } : undefined, children: [_jsx("div", { className: "dshb-header-bd-title", children: t('headerBreakdownTitle') }), byKey === null || byKey.length === 0
                        ? _jsx("div", { className: "dshb-header-bd-empty", children: "\u2014" })
                        : byKey.map((k) => (_jsxs("div", { className: "dshb-header-bd-row", children: [_jsx("span", { className: "dshb-header-bd-name", title: k.provider, children: labelOf(k.provider) }), _jsx("span", { className: "dshb-header-bd-tokens", children: fmtTokens(totalTokensOf(k.buckets)) }), _jsx("span", { className: "dshb-header-bd-sep", children: "|" }), k.official
                                    ? _jsxs("span", { className: "dshb-header-bd-amount", children: ["\u2248", currencySymbol(k.currency), fmtAmount(k.amount)] })
                                    : _jsx("span", { className: "dshb-header-bd-amount dshb-header-bd-nobill", children: t('notBilled') })] }, k.provider)))] })) : null] }));
}
