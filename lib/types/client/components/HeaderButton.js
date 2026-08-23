import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtAmount, fmtTokens, t } from "../i18n.js";
import { NumberRoller } from "./NumberRoller.js";
/** 四桶 token 总数。 */
function totalTokensOf(b) {
    return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
}
export function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, useTaskTick, bumpTaskTick }) {
    const tick = useTick();
    const priceTick = usePriceTick?.() ?? 0;
    const taskTick = useTaskTick?.() ?? 0;
    const [tokens, setTokens] = useState(null);
    const [amount, setAmount] = useState(null);
    const running = useSession ? useSession((s) => s.running) : undefined;
    // 记录上一次 running：仅在 true→false（任务完成）瞬间广播。
    const prevRunning = useRef(null);
    const refresh = useCallback(async () => {
        try {
            const costRes = await run(sessionId, { op: 'cost', sessionId });
            const session = costRes.cost?.session;
            if (session === undefined)
                return;
            if (session.amount !== undefined)
                setAmount(session.amount);
            if (session.buckets !== undefined)
                setTokens(totalTokensOf(session.buckets));
        }
        catch {
            // 保持上一次值。
        }
    }, [run, sessionId]);
    // 挂载 / 会话切换 / 自动刷新 tick / 任务完成 tick / 价格保存 tick 变化时刷新；
    // 点击按钮手动刷新一次。
    useEffect(() => {
        void refresh();
    }, [refresh, tick, taskTick, priceTick]);
    // 任务完成：会话快照 running 由 true 回落 false —— 广播 bumpTaskTick（footer
    // 余额随之刷新），自身经上方 useTaskTick 变化立即重算 token 与预估费用。
    useEffect(() => {
        if (running === undefined)
            return;
        if (prevRunning.current === true && running === false)
            bumpTaskTick?.();
        prevRunning.current = running;
    }, [running, bumpTaskTick]);
    // 数字「上下轮播」动画：token 紧凑缩写（K/M/B/T/P 后缀列静态）、金额
    // （≈¥ 前缀之外的数字部分逐位滚动）。
    const tokensText = tokens === null ? '--' : fmtTokens(tokens);
    const amountText = amount === null ? '--' : fmtAmount(amount);
    const title = t('headerBtnPrefix') + ' ' + tokensText + ' | ≈¥' + amountText;
    return (_jsxs("button", { type: "button", className: "dshb-header-btn", title: title, "aria-label": title, onClick: () => void refresh(), children: [_jsx("span", { children: t('headerBtnPrefix') }), ' ', _jsx(NumberRoller, { value: tokens, format: fmtTokens, fallback: "--", className: "dshb-header-tokens" }), _jsx("span", { className: "dshb-header-sep", children: "|" }), _jsxs("span", { className: "dshb-header-amount", children: ["\u2248\u00A5", _jsx(NumberRoller, { value: amount, format: fmtAmount, fallback: "--", className: "dshb-header-amount-num" })] })] }));
}
