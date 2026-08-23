import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * dsh-get-balance —— 侧边栏底部入口（sidebar.footer.action）：
 * 常驻的「余额」按钮（footer.action 区），点击打开统一弹框
 * （余额 / 费用 / 价格设置 三个 tab）。
 *
 * 右侧文案横排显示：「余额 ¥110.00 · 时段小圆点」——余额靠右对齐（货币符号前缀、
 * 数字绿色）；时段文案收敛为小圆点（高峰红 / 空闲绿），悬停使用宿主的
 * Tooltip（@deepseek-ai/dsh-client-ui-primitives，运行时从宿主 seed 表解析）
 * 气泡提示完整信息「当前为高峰时段 全价计费」/「当前为空闲时段 半价计费」，
 * 其中价词着色（高峰「全价」红 / 空闲「半价」绿，与圆点同色）。
 * 时段判定与宿主一致（时区偏移 + 高峰窗口 + 周六日半价，按当前时间），
 * 每 60 秒刷新；弹框内保存价格成功或关闭弹框后立即刷新。
 */
import { useCallback, useEffect, useState } from 'react';
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { t } from "../i18n.js";
import { NumberRoller } from "./NumberRoller.js";
import { BALANCE_LOGO_PNG } from "../logo.js";
/** 解析 'HH:MM' 为当日分钟数；非法返回 undefined（与宿主 cost.ts 同规则）。 */
function parseClock(value) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
    if (m === null)
        return undefined;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59)
        return undefined;
    return h * 60 + min;
}
/** 判定一个时刻是否处于高峰时段（与宿主 isPeakTime 同逻辑，含周六日半价）。 */
function isPeakNow(config, nowMs) {
    const offset = typeof config.timezoneOffsetMinutes === 'number' ? config.timezoneOffsetMinutes : 480;
    const local = new Date(nowMs + offset * 60_000);
    // 周六日半价：周六/周日整天视为空闲时段。
    if (config.weekendOffPeak === true) {
        const day = local.getUTCDay();
        if (day === 0 || day === 6)
            return false;
    }
    const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
    for (const window of config.peakWindows ?? []) {
        const start = parseClock(window.start);
        const end = parseClock(window.end);
        if (start === undefined || end === undefined)
            continue;
        // 支持跨午夜的窗口：start <= end 时取 [start, end)；start > end 时取 [start, 1440) ∪ [0, end)。
        if (start <= end) {
            if (minutes >= start && minutes < end)
                return true;
        }
        else if (minutes >= start || minutes < end) {
            return true;
        }
    }
    return false;
}
/** 常见货币代码 → 符号（余额前缀展示）；未收录的代码回退为代码本身（无代码时为空）。 */
const CURRENCY_SYMBOLS = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    HKD: 'HK$',
    KRW: '₩',
    INR: '₹',
    RUB: '₽',
    AUD: 'A$',
    CAD: 'C$',
    SGD: 'S$',
    CHF: 'Fr.',
    TWD: 'NT$',
};
function currencySymbol(code) {
    const c = (code || '').trim().toUpperCase();
    return c !== '' ? (CURRENCY_SYMBOLS[c] ?? c) : '';
}
/** 时段气泡纯文本（aria-label / 窄栏按钮 title 用）：{price} 占位替换为价词文本。 */
function tipPlain(peak) {
    const word = peak ? t('tipFullPrice') : t('tipHalfPrice');
    return t(peak ? 'tipPeak' : 'tipOffPeak').split('{price}').join(word);
}
/**
 * 时段气泡富文本（宿主 Tooltip 渲染）：{price} 处插入彩色价词
 * （高峰「全价」红 / 空闲「半价」绿，与圆点同色）。宿主 Tooltip 的 label
 * 类型仅声明为 string，但其运行时直接渲染 ReactNode，这里以函数形式 +
 * 类型收窄注入彩色片段（宿主运行时行为不变，无需改宿主）。
 */
function tipRich(peak) {
    const [before, after] = t(peak ? 'tipPeak' : 'tipOffPeak').split('{price}');
    return (_jsxs("span", { className: "dshb-tip", children: [before, _jsx("b", { className: peak ? 'dshb-tip-full' : 'dshb-tip-half', children: peak ? t('tipFullPrice') : t('tipHalfPrice') }), after] }));
}
export function FooterButton({ onOpen, reportSession, wide = false, useSessions, run, useOpen, usePriceTick, useBalanceTick }) {
    const currentSessionId = useSessions
        ? useSessions((s) => s && s.current)
        : null;
    if (reportSession && currentSessionId)
        reportSession(currentSessionId);
    const open = useOpen();
    const priceTick = usePriceTick?.() ?? 0;
    const balanceTick = useBalanceTick?.() ?? 0;
    const [peak, setPeak] = useState(null);
    const [bal, setBal] = useState(null);
    const refresh = useCallback(async (forceBalance = false) => {
        try {
            const res = await run('', { op: 'pricesGet' });
            const config = res.config;
            if (config !== undefined)
                setPeak(isPeakNow(config, Date.now()));
        }
        catch {
            // 网络/路由异常时保持上一次状态，不闪断。
        }
        try {
            // refresh:false 命中宿主 60s 余额缓存，不触发真实请求；
            // 官方请求完成触发的刷新 forceBalance=true 绕过缓存拿到最新余额。
            const res = await run('', { op: 'balance', refresh: forceBalance });
            const balances = res.balances;
            const first = Array.isArray(balances)
                ? balances.find((b) => b.ok === true && Array.isArray(b.balance_infos) && b.balance_infos.length > 0)
                : undefined;
            const info = first?.balance_infos?.[0];
            if (info !== undefined)
                setBal({ total: info.total_balance, currency: info.currency });
        }
        catch {
            // 余额查询失败时保持上一次状态。
        }
    }, [run]);
    // 挂载即查 + 每 60 秒随当前时间刷新；弹框关闭（可能刚保存过价格）立即刷新。
    useEffect(() => {
        void refresh();
        const id = setInterval(() => { void refresh(); }, 60_000);
        return () => clearInterval(id);
    }, [refresh]);
    useEffect(() => {
        if (!open)
            void refresh();
    }, [open, refresh]);
    // 弹框内保存价格成功（含周六日半价开关）：跳过 60s 轮询立即刷新时段文案。
    useEffect(() => {
        if (priceTick > 0)
            void refresh();
    }, [priceTick, refresh]);
    // 官方请求完成（头部按钮广播，仅 DeepSeek 官方接口的请求）：立即强制刷新余额
    // （绕过 60s 缓存）+ 时段文案。非官方请求不触发 —— 只更新 token 与预估费用。
    useEffect(() => {
        if (balanceTick > 0)
            void refresh(true);
    }, [balanceTick, refresh]);
    // 「余额」+ 时段小圆点作为一个整体锚点挂宿主 Tooltip：悬停二字或圆点都显示
    // 气泡（高峰红 / 空闲绿，价词着色：高峰「全价」红 / 空闲「半价」绿）。
    const periodTip = peak === null ? '' : tipPlain(peak);
    const periodGroup = peak === null
        ? _jsx("span", { className: "dshb-footer-word", children: t('balanceBtn') })
        : (_jsx(Tooltip, { label: (() => tipRich(peak)), side: "top", delayMs: 300, children: _jsxs("span", { className: "dshb-footer-word-group", children: [_jsx("span", { className: "dshb-footer-word", children: t('balanceBtn') }), _jsx("span", { className: 'dshb-period-dot ' + (peak ? 'dshb-period-dot-peak' : 'dshb-period-dot-off'), "aria-label": periodTip })] }) }));
    const curSym = bal === null ? '' : currencySymbol(bal.currency);
    const balText = bal === null ? '' : curSym + bal.total;
    const fullLabel = t('balanceBtn') + (balText !== '' ? ' ' + balText : '') + (periodTip !== '' ? ' ' + periodTip : '');
    // 余额数字「上下轮播」动画：值变化时逐位滚动到新值（2 位小数）。
    const balValue = bal === null
        ? null
        : (() => {
            const n = parseFloat(bal.total);
            return Number.isFinite(n) ? n : null;
        })();
    return (_jsx("div", { className: 'dshb-footer-group' + (wide ? '' : ' dshb-footer-rail-group'), children: _jsxs("button", { type: "button", className: 'dshb-footer-btn' + (wide ? '' : ' dshb-footer-btn-rail'), 
            // 宽模式信息全部可见（余额文案 + 圆点气泡），再挂原生 title 会在悬停
            // 圆点时与 Tooltip 气泡双重弹出；窄栏（仅图标）保留原生 title 兜底。
            title: wide ? undefined : fullLabel, "aria-label": fullLabel, onClick: onOpen, children: [_jsx("img", { src: BALANCE_LOGO_PNG, alt: "", className: "dshb-footer-logo" }), wide
                    ? (_jsxs("span", { className: "dshb-footer-label", children: [periodGroup, bal !== null ? (_jsxs("span", { className: "dshb-footer-balance", children: [curSym !== '' ? _jsx("span", { className: "dshb-footer-cur", children: curSym }) : null, _jsx(NumberRoller, { value: balValue, format: (v) => v.toFixed(2), fallback: "--", className: "dshb-footer-balance-num" })] })) : null] }))
                    : null] }) }));
}
