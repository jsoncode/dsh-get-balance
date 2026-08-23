import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ¥≈xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与预估费用。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 */
import { useCallback, useEffect, useState } from 'react';
import { fmtAmount, fmtTokens, t } from "../i18n.js";
/** 四桶 token 总数。 */
function totalTokensOf(b) {
    return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
}
export function HeaderButton({ sessionId, run, useTick, usePriceTick }) {
    const tick = useTick();
    const priceTick = usePriceTick?.() ?? 0;
    const [tokens, setTokens] = useState(null);
    const [amount, setAmount] = useState(null);
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
    // 挂载 / 会话切换 / 自动刷新 tick / 价格保存 tick 变化时刷新；点击按钮手动刷新一次。
    useEffect(() => {
        void refresh();
    }, [refresh, tick, priceTick]);
    const tokensText = tokens === null ? '--' : fmtTokens(tokens);
    const amountText = amount === null ? '--' : '≈' + fmtAmount(amount);
    const title = t('headerBtnPrefix') + ' ' + tokensText + ' | ¥' + amountText;
    return (_jsxs("button", { type: "button", className: "dshb-header-btn", title: title, "aria-label": title, onClick: () => void refresh(), children: [_jsx("span", { children: t('headerBtnPrefix') }), _jsx("span", { className: "dshb-header-tokens", children: tokensText }), _jsx("span", { className: "dshb-header-sep", children: "|" }), _jsxs("span", { className: "dshb-header-amount", children: ["\u00A5", amountText] })] }));
}
