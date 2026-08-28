import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { Fragment, useCallback, useEffect, useState } from 'react';
import { fmtAmount, t, tErr, zhNumeral } from "../i18n.js";
import { CostTab } from "./CostTab.js";
const sourceChipKey = {
    'llm-pi-ai': 'sourcePiAi',
    'llm-deepseek': 'sourceDeepseek',
    'extra': 'sourceExtra',
};
/**
 * 会话事件中的 provider 路由是否命中某个（可能折叠的）服务商条目：
 * 命中本行 id / label，或命中本行 sharedWith 中任一条目的 id / label。
 * 折叠后（同一账号一行）费用统计仍能按任意共享路由匹配到该行。
 */
function providerMatches(p, route) {
    if (p.id === 'pi-ai:' + route || p.id === 'llm-deepseek:' + route || p.id === route || p.label === route)
        return true;
    return (p.sharedWith ?? []).some((s) => s.id === 'pi-ai:' + route || s.id === 'llm-deepseek:' + route || s.id === route || s.label === route);
}
/** 严格对齐官方价格表：仅三组指标（输入-缓存命中 / 输入-缓存未命中 / 输出）。 */
const METRIC_GROUPS = [
    { labelKey: 'priceInputHit', field: 'cacheRead' },
    { labelKey: 'priceInputMiss', field: 'input' },
    { labelKey: 'priceOutput', field: 'output' },
];
/** 价格设置内的平台 tab 清单（顺序即展示顺序；新增平台 = 加一项 + 一个 render 函数）。 */
const PRICE_PLATFORMS = [
    { key: 'deepseek', labelKey: 'tabPlatformDeepseek' },
];
/** 把 UTC 偏移小时数格式化为时区名（zh：零时区 / 东八区 / 西五区；en：UTC±0 / UTC+8 / UTC-5）。 */
function formatTimezone(offsetHours) {
    const h = Math.round(offsetHours);
    return t(h === 0 ? 'tzZero' : h > 0 ? 'tzEast' : 'tzWest', { n: zhNumeral(Math.abs(h)) });
}
export function BalanceModal({ run, useOpen, close, getSession, useTick, useAutoSeconds, setAutoSeconds, bumpPriceTick, useShowBalance, setShowBalance }) {
    const open = useOpen();
    const tick = useTick();
    const autoSeconds = useAutoSeconds();
    const showBalance = useShowBalance();
    const [tab, setTab] = useState('balance');
    // 价格设置内的二级平台 tab（当前仅 DeepSeek，后续扩展其他平台）
    const [pricePlatform, setPricePlatform] = useState('deepseek');
    // 定时更新配置弹框
    const [timingOpen, setTimingOpen] = useState(false);
    const [timingInput, setTimingInput] = useState('');
    const [timingErr, setTimingErr] = useState('');
    // 余额 tab
    const [providers, setProviders] = useState(null);
    const [balances, setBalances] = useState({});
    const [balLoading, setBalLoading] = useState(false);
    const [balError, setBalError] = useState('');
    // 附加 key
    const [keys, setKeys] = useState([]);
    const [keyFormOpen, setKeyFormOpen] = useState(false);
    const [keyLabel, setKeyLabel] = useState('');
    const [keyValue, setKeyValue] = useState('');
    const [keyErr, setKeyErr] = useState('');
    // 费用 tab
    const [cost, setCost] = useState(null);
    const [costLoading, setCostLoading] = useState(false);
    /** 手动刷新请求计数：头部「刷新」按钮自增，CostTab 监听后重新请求 costSeries。 */
    const [costReload, setCostReload] = useState(0);
    // 价格 tab
    const [prices, setPrices] = useState(null);
    const [windowCfg, setWindowCfg] = useState({ timezoneOffsetMinutes: 480, peakWindows: [], weekendOffPeak: false });
    const [priceMsg, setPriceMsg] = useState('');
    /** 余额查询：providers 与 balances 一并回填。 */
    const loadBalances = useCallback(async (refresh) => {
        setBalLoading(true);
        setBalError('');
        try {
            const provRes = await run(getSession(), { op: 'providers' });
            if (provRes.ok && Array.isArray(provRes.providers)) {
                setProviders(provRes.providers);
            }
            const res = await run(getSession(), { op: 'balance', refresh });
            if (res.ok && Array.isArray(res.balances)) {
                const map = {};
                for (const b of res.balances)
                    map[b.providerId] = b;
                setBalances(map);
            }
            else {
                setBalError(tErr(res, t('saveFailed')));
            }
        }
        finally {
            setBalLoading(false);
        }
    }, [run, getSession]);
    const loadKeys = useCallback(async () => {
        const res = await run(getSession(), { op: 'keysGet' });
        if (res.ok && Array.isArray(res.keys))
            setKeys(res.keys);
    }, [run, getSession]);
    const loadCost = useCallback(async () => {
        setCostLoading(true);
        try {
            const res = await run(getSession(), { op: 'cost', sessionId: getSession() });
            if (res.ok && res.cost !== undefined)
                setCost(res.cost);
        }
        finally {
            setCostLoading(false);
        }
    }, [run, getSession]);
    const loadPrices = useCallback(async () => {
        const res = await run(getSession(), { op: 'pricesGet' });
        if (res.ok) {
            const config = res.config;
            if (Array.isArray(config?.tiers))
                setPrices(config.tiers);
            if (config !== undefined) {
                setWindowCfg({
                    timezoneOffsetMinutes: typeof config.timezoneOffsetMinutes === 'number' ? config.timezoneOffsetMinutes : 480,
                    peakWindows: Array.isArray(config.peakWindows) ? config.peakWindows : [],
                    weekendOffPeak: config.weekendOffPeak === true,
                });
            }
        }
    }, [run, getSession]);
    // 弹框打开时全量拉取；切换 tab 也保证数据新鲜（轻量：宿主有缓存）。
    useEffect(() => {
        if (!open)
            return;
        void loadBalances(false);
        void loadKeys();
        void loadCost();
        void loadPrices();
    }, [open, tab, loadBalances, loadKeys, loadCost, loadPrices]);
    // 定时自动刷新：宿主定时器到点 bump tick，这里刷新余额与费用（tick 初始 0 跳过）。
    useEffect(() => {
        if (!open || tick <= 0)
            return;
        void loadBalances(false);
        void loadCost();
    }, [tick, open, loadBalances, loadCost]);
    /* ── 定时更新配置 ── */
    const saveAutoSeconds = async (seconds) => {
        try {
            const res = await run('', { op: 'autoRefreshSave', seconds });
            if (res.ok && typeof res.seconds === 'number') {
                setAutoSeconds(res.seconds);
                setTimingErr('');
                return true;
            }
            setTimingErr(tErr(res, t('saveFailed')));
            return false;
        }
        catch {
            setTimingErr(tErr(null, t('saveFailed')));
            return false;
        }
    };
    const openTimingDialog = () => {
        setTimingInput(autoSeconds > 0 ? String(autoSeconds) : '60');
        setTimingErr('');
        setTimingOpen(true);
    };
    if (!open)
        return null;
    /* ── 附加 key 操作 ── */
    const saveKeys = async (next) => {
        const res = await run(getSession(), { op: 'keysSave', keys: next });
        if (res.ok) {
            await loadKeys();
            void loadBalances(true);
        }
        else {
            setKeyErr(tErr(res, t('saveFailed')));
        }
    };
    const submitKey = () => {
        const value = keyValue.trim();
        if (value.length === 0) {
            setKeyErr(t('keyRequired'));
            return;
        }
        setKeyErr('');
        setKeyFormOpen(false);
        setKeyValue('');
        setKeyLabel('');
        void saveKeys([...keys.map((k) => ({ id: k.id, label: k.label, apiKey: '' })), { label: keyLabel.trim(), apiKey: value }]);
    };
    const removeKey = (id) => {
        void saveKeys(keys.filter((k) => k.id !== id).map((k) => ({ id: k.id, label: k.label, apiKey: '' })));
    };
    /* ── 价格档操作 ── */
    const updatePrice = (index, patch) => {
        setPrices((prev) => {
            if (prev === null)
                return prev;
            const next = prev.slice();
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };
    /** 更新某档某个时段的单项单价。 */
    const updateRate = (index, period, field, value) => {
        setPrices((prev) => {
            if (prev === null)
                return prev;
            const next = prev.slice();
            const tier = next[index];
            next[index] = { ...tier, [period]: { ...tier[period], [field]: value } };
            return next;
        });
    };
    const savePrices = async (list, windowCfgNext) => {
        if (list.length === 0) {
            setPriceMsg(t('pricesEmpty'));
            return;
        }
        const cfg = windowCfgNext ?? windowCfg;
        const res = await run(getSession(), {
            op: 'pricesSave',
            config: { tiers: list, timezoneOffsetMinutes: cfg.timezoneOffsetMinutes, peakWindows: cfg.peakWindows, weekendOffPeak: cfg.weekendOffPeak },
        });
        if (res.ok) {
            const config = res.config;
            if (Array.isArray(config?.tiers))
                setPrices(config.tiers);
            if (config !== undefined) {
                setWindowCfg({
                    timezoneOffsetMinutes: typeof config.timezoneOffsetMinutes === 'number' ? config.timezoneOffsetMinutes : 480,
                    peakWindows: Array.isArray(config.peakWindows) ? config.peakWindows : [],
                    weekendOffPeak: config.weekendOffPeak === true,
                });
            }
            setPriceMsg(t('pricesSaved'));
            // 广播「价格已保存」：footer 时段徽标 / 头部费用按钮立即刷新（无需关闭弹框）。
            bumpPriceTick();
            // 价格变化影响图表金额：强制 costSeries 重新拉取（绕过 CostTab 的 range 本地缓存）。
            setCostReload((n) => n + 1);
            void loadCost();
        }
        else {
            setPriceMsg(tErr(res, t('saveFailed')));
        }
    };
    /* ── 渲染 ── */
    const balanceOf = (id) => balances[id];
    /** 余额金额展示：「显示余额」关闭时统一掩码为 **（footer 入口同步生效）。 */
    const balanceText = (v) => (showBalance ? v : '**');
    /**
     * 单个服务商条目（API key）的今日消耗：从 cost.todayAll.byKey 按
     * 服务商路由匹配（pi-ai:<route> / llm-deepseek:<route> / label / 共享路由）。
     * 无用量时返回 undefined，展示为 ≈0.00 CNY。
     */
    const todayCostOf = (p) => {
        const list = cost?.todayAll?.byKey ?? [];
        return list.find((k) => providerMatches(p, k.provider));
    };
    const renderBalanceTab = () => (_jsxs("div", { children: [_jsxs("div", { className: "dshb-showbalance-row", children: [_jsxs("div", { className: "dshb-showbalance-text", children: [_jsx("div", { className: "dshb-showbalance-title", children: t('showBalanceToggle') }), _jsx("p", { className: "dshb-showbalance-hint", children: t('showBalanceHint') })] }), _jsx("button", { type: "button", role: "switch", "aria-checked": showBalance, "aria-label": t('showBalanceToggle'), title: t('showBalanceToggle'), className: 'dshb-switch' + (showBalance ? ' dshb-switch-on' : ''), onClick: () => setShowBalance(!showBalance), children: _jsx("span", { className: "dshb-switch-thumb" }) })] }), providers === null
                ? _jsx("div", { className: "dshb-spinner" })
                : providers.length === 0
                    ? _jsx("div", { className: "dshb-empty", children: t('noProviders') })
                    : (_jsx("div", { className: "dshb-prov-list", children: providers.map((p) => {
                            const b = balanceOf(p.id);
                            const infos = b?.ok ? (b.balance_infos ?? []) : [];
                            return (_jsxs("div", { className: "dshb-prov", children: [_jsxs("div", { className: "dshb-prov-main", children: [_jsxs("div", { className: "dshb-prov-name-row", children: [_jsx("span", { className: "dshb-prov-name", children: p.label }), _jsx("span", { className: 'dshb-chip' + (p.source === 'extra' ? ' dshb-chip-brand' : ''), children: t(sourceChipKey[p.source]) }), (p.sharedWith ?? []).map((s) => (_jsx("span", { className: "dshb-chip", title: t('sharedAccountTitle', { n: s.label !== '' ? s.label : s.id }), children: t(sourceChipKey[s.source]) }, s.id))), !p.hasKey
                                                        ? (_jsxs("span", { className: "dshb-chip", title: p.keySource !== undefined ? 'source: ' + p.keySource : undefined, children: [t('noCredential'), p.apiKeyEnv !== undefined ? ' · ' + p.apiKeyEnv : ''] }))
                                                        : null] }), _jsxs("div", { className: "dshb-prov-meta", children: [p.baseUrl, p.apiKeyMasked ? ` · ${p.apiKeyMasked}` : ''] })] }), _jsx("div", { className: "dshb-prov-side", children: b === undefined
                                            ? (balLoading ? _jsx("div", { className: "dshb-spinner", style: { margin: '4px 0 4px auto' } }) : _jsx("span", { className: "dshb-prov-sub", children: "\u2014" }))
                                            : b.ok
                                                ? infos.length === 0
                                                    ? _jsx("span", { className: "dshb-prov-sub", children: "\u2014" })
                                                    : infos.map((info, i) => {
                                                        const kc = todayCostOf(p);
                                                        const kcCurrency = kc !== undefined && kc.currency !== '' ? kc.currency : 'CNY';
                                                        return (_jsxs("div", { children: [_jsxs("div", { className: "dshb-prov-costline", children: [_jsx("span", { children: t('summaryTodayCost') }), kc !== undefined
                                                                            ? _jsxs("span", { className: "dshb-balance-num", children: ["\u2248", fmtAmount(kc.amount), " ", kcCurrency] })
                                                                            : (costLoading
                                                                                ? _jsx("span", { className: "dshb-balance-num dshb-balance-loading", "aria-label": t('summaryTodayCost'), children: "\u2026" })
                                                                                : _jsx("span", { className: "dshb-prov-sub", children: "\u2014" })), _jsx("span", { className: "dshb-balance-sep", children: "|" }), _jsx("span", { children: t('summaryBalance') }), _jsxs("span", { className: "dshb-balance-num", children: [balanceText(info.total_balance), " ", info.currency] })] }), _jsxs("div", { className: 'dshb-prov-sub' + (info.topped_out ? ' dshb-topped' : ''), children: [t('balanceGranted'), " ", balanceText(info.granted_balance), info.topped_out ? ` · ${t('toppedOut')}` : ''] })] }, i));
                                                    })
                                                : _jsx("div", { className: "dshb-prov-err", children: tErr(b) }) })] }, p.id));
                        }) })), balError !== '' ? _jsx("p", { className: "dshb-err", children: balError }) : null, _jsxs("div", { className: "dshb-keys", children: [_jsx("div", { className: "dshb-keys-title", children: t('extraKeysTitle') }), _jsx("p", { className: "dshb-hint", children: t('extraKeysHint') }), keys.map((k) => (_jsxs("div", { className: "dshb-key-row", children: [_jsx("span", { className: "dshb-chip", children: k.label !== '' ? k.label : t('sourceExtra') }), _jsx("span", { className: "dshb-key-mask", children: k.apiKeyMasked }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small dshb-btn-danger", onClick: () => removeKey(k.id), children: t('delete') })] }, k.id))), keyFormOpen
                        ? (_jsxs("div", { className: "dshb-key-form", children: [_jsx("input", { className: "dshb-input", value: keyLabel, placeholder: t('keyLabelPlaceholder'), "aria-label": t('keyLabel'), onChange: (e) => setKeyLabel(e.target.value) }), _jsx("input", { className: "dshb-input", value: keyValue, placeholder: t('keyInputPlaceholder'), "aria-label": t('keyInput'), onChange: (e) => setKeyValue(e.target.value) }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small dshb-btn-primary", onClick: submitKey, children: t('add') }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: () => { setKeyFormOpen(false); setKeyErr(''); }, children: t('cancel') })] }))
                        : _jsxs("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: () => setKeyFormOpen(true), children: ["+ ", t('addKeyBtn')] }), keyErr !== '' ? _jsx("p", { className: "dshb-err", children: keyErr }) : null] })] }));
    /** 服务商路由 key → 展示信息（label + 脱敏 key + 来源）；用余额 tab 已加载的 providers 列表匹配（含折叠的共享路由）。 */
    const providerMeta = (provider) => {
        const hit = (providers ?? []).find((p) => providerMatches(p, provider));
        if (hit !== undefined) {
            return {
                label: hit.label !== '' ? hit.label : provider,
                ...hit.apiKeyMasked !== undefined && hit.apiKeyMasked !== '' ? { masked: hit.apiKeyMasked } : {},
                source: hit.source,
            };
        }
        return { label: provider };
    };
    /** 费用 tab（图表版）：筛选器 + 五张 ECharts 图（CostTab 自管数据加载与刷新）。 */
    const renderCostTab = () => (_jsx(CostTab, { run: run, getSession: getSession, tick: tick, reloadTick: costReload, metaOf: providerMeta, active: tab === 'cost' }));
    /** DeepSeek 平台定价：时段配置 + 官方价格表式价格档编辑。 */
    const renderDeepseekPrices = () => (_jsxs("div", { children: [_jsx("p", { className: "dshb-hint", children: t('pricesHint') }), prices === null
                ? _jsx("div", { className: "dshb-spinner" })
                : (_jsxs("div", { children: [_jsxs("div", { className: "dshb-window-box", children: [_jsxs("div", { className: "dshb-window-head", children: [_jsx("span", { className: "dshb-window-title", children: t('windowTitle') }), _jsxs("label", { className: "dshb-weekend", title: t('weekendHint'), children: [_jsx("input", { type: "checkbox", checked: windowCfg.weekendOffPeak, "aria-label": t('weekendHalfPrice'), onChange: (e) => setWindowCfg({ ...windowCfg, weekendOffPeak: e.target.checked }) }), _jsx("span", { children: t('weekendHalfPrice') })] })] }), _jsx("p", { className: "dshb-hint", children: t('windowHint') }), _jsx("div", { className: "dshb-window-list", children: windowCfg.peakWindows.map((w, wi) => (_jsxs("div", { className: "dshb-window-row", children: [_jsx("input", { className: "dshb-input dshb-cur", value: w.start, "aria-label": t('windowStart'), placeholder: "09:00", onChange: (e) => {
                                                    const next = windowCfg.peakWindows.map((x, j) => j === wi ? { ...x, start: e.target.value } : x);
                                                    setWindowCfg({ ...windowCfg, peakWindows: next });
                                                } }), _jsx("span", { children: "\u2013" }), _jsx("input", { className: "dshb-input dshb-cur", value: w.end, "aria-label": t('windowEnd'), placeholder: "12:00", onChange: (e) => {
                                                    const next = windowCfg.peakWindows.map((x, j) => j === wi ? { ...x, end: e.target.value } : x);
                                                    setWindowCfg({ ...windowCfg, peakWindows: next });
                                                } }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small dshb-btn-danger dshb-window-del", onClick: () => setWindowCfg({ ...windowCfg, peakWindows: windowCfg.peakWindows.filter((_, j) => j !== wi) }), children: t('delete') })] }, wi))) }), _jsxs("div", { className: "dshb-window-actions", children: [_jsxs("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: () => setWindowCfg({ ...windowCfg, peakWindows: [...windowCfg.peakWindows, { start: '09:00', end: '12:00' }] }), children: ["+ ", t('addWindow')] }), _jsxs("label", { className: "dshb-window-tz", children: [_jsx("span", { children: t('tzOffset') }), _jsx("input", { className: "dshb-range", type: "range", min: -12, max: 12, step: 1, value: Math.round(windowCfg.timezoneOffsetMinutes / 60), "aria-label": t('tzOffset'), onChange: (e) => setWindowCfg({ ...windowCfg, timezoneOffsetMinutes: Number(e.target.value) * 60 }) }), _jsx("b", { className: "dshb-window-tz-label", children: formatTimezone(windowCfg.timezoneOffsetMinutes / 60) })] })] })] }), _jsx("div", { className: "dshb-price-scroll", children: _jsxs("table", { className: "dshb-table dshb-price-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "dshb-price-corner", colSpan: 2, children: t('priceModel') }), prices.map((tier, i) => (_jsx("th", { className: "dshb-price-head-cell", children: _jsx("span", { className: "dshb-price-model-name", title: tier.match === '*' ? t('fallbackHint') : undefined, children: tier.name || tier.match }) }, tier.id)))] }) }), _jsx("tbody", { children: METRIC_GROUPS.map((group) => (_jsxs(Fragment, { children: [_jsxs("tr", { children: [_jsx("th", { rowSpan: 2, className: "dshb-price-metric", children: t(group.labelKey) }), _jsx("td", { className: "dshb-price-period dshb-period-off", children: t('pricePeriodOffPeak') }), prices.map((tier, i) => (_jsx("td", { className: "dshb-price-cell", children: _jsx("input", { className: "dshb-input dshb-num", type: "number", step: "any", min: 0, value: tier.offPeak[group.field], "aria-label": t(group.labelKey) + ' · ' + t('pricePeriodOffPeak'), onChange: (e) => updateRate(i, 'offPeak', group.field, Number(e.target.value) || 0) }) }, tier.id)))] }), _jsxs("tr", { children: [_jsx("td", { className: "dshb-price-period dshb-period-peak", children: t('pricePeriodPeak') }), prices.map((tier, i) => (_jsx("td", { className: "dshb-price-cell", children: _jsx("input", { className: "dshb-input dshb-num", type: "number", step: "any", min: 0, value: tier.peak[group.field], "aria-label": t(group.labelKey) + ' · ' + t('pricePeriodPeak'), onChange: (e) => updateRate(i, 'peak', group.field, Number(e.target.value) || 0) }) }, tier.id)))] })] }, group.field))) })] }) })] }))] }));
    /**
     * 价格设置容器：二级平台 tab 行 + 各平台面板。
     * 面板与弹框主体一样采用 grid 叠放常驻：隐藏面板仍参与布局，
     * 平台增多后切换二级 tab 也不会引起弹框高度跳动。
     */
    const renderPricesTab = () => {
        const platformViews = { deepseek: renderDeepseekPrices };
        return (_jsxs("div", { children: [_jsx("div", { className: "dshb-subtabs", role: "tablist", "aria-label": t('tabPrices'), children: PRICE_PLATFORMS.map((p) => (_jsx("button", { type: "button", role: "tab", "aria-selected": pricePlatform === p.key, className: 'dshb-subtab' + (pricePlatform === p.key ? ' dshb-subtab-active' : ''), onClick: () => setPricePlatform(p.key), children: t(p.labelKey) }, p.key))) }), _jsx("div", { className: "dshb-subpanes", children: PRICE_PLATFORMS.map((p) => (_jsx("div", { className: 'dshb-pane' + (pricePlatform === p.key ? '' : ' dshb-pane-off'), children: platformViews[p.key]() }, p.key))) })] }));
    };
    return (_jsxs("div", { className: "dshb-backdrop", onClick: (e) => { if (e.target === e.currentTarget)
            close(); }, children: [_jsxs("div", { className: "dshb-modal", role: "dialog", "aria-modal": "true", children: [_jsxs("div", { className: "dshb-modal-header", children: [_jsx("div", { className: "dshb-modal-title", children: t('modalTitle') }), _jsxs("div", { className: "dshb-tabs", children: [_jsx("button", { type: "button", className: 'dshb-tab' + (tab === 'balance' ? ' dshb-tab-active' : ''), onClick: () => setTab('balance'), children: t('tabBalance') }), _jsx("button", { type: "button", className: 'dshb-tab' + (tab === 'cost' ? ' dshb-tab-active' : ''), onClick: () => setTab('cost'), children: t('tabCost') }), _jsx("button", { type: "button", className: 'dshb-tab' + (tab === 'prices' ? ' dshb-tab-active' : ''), onClick: () => setTab('prices'), children: t('tabPrices') })] }), _jsxs("div", { className: "dshb-head-ops", children: [_jsxs("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: openTimingDialog, children: [t('timingBtn'), autoSeconds > 0 ? '·' + autoSeconds + 's' : ''] }), tab === 'balance'
                                        ? _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", disabled: balLoading, onClick: () => void loadBalances(true), children: t('refresh') })
                                        : null, tab === 'cost'
                                        ? _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: () => setCostReload((n) => n + 1), children: t('refresh') })
                                        : null, _jsx("button", { type: "button", className: "dshb-close", "aria-label": t('close'), onClick: close, children: "\u2715" })] })] }), _jsxs("div", { className: "dshb-modal-body", children: [_jsx("div", { className: 'dshb-pane' + (tab === 'balance' ? '' : ' dshb-pane-off'), children: renderBalanceTab() }), _jsx("div", { className: 'dshb-pane' + (tab === 'cost' ? '' : ' dshb-pane-off'), children: renderCostTab() }), _jsx("div", { className: 'dshb-pane' + (tab === 'prices' ? '' : ' dshb-pane-off'), children: renderPricesTab() })] }), tab === 'prices'
                        ? (_jsxs("div", { className: "dshb-modal-footer", children: [priceMsg !== ''
                                    ? _jsx("p", { className: 'dshb-msg ' + (priceMsg === t('pricesSaved') ? 'dshb-ok' : 'dshb-err'), children: priceMsg })
                                    : null, _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small dshb-btn-primary", disabled: prices === null, onClick: () => { if (prices !== null)
                                        void savePrices(prices); }, children: t('save') })] }))
                        : null] }), timingOpen
                ? (_jsx("div", { className: "dshb-timing-backdrop", onClick: (e) => { if (e.target === e.currentTarget)
                        setTimingOpen(false); }, children: _jsxs("div", { className: "dshb-timing-dialog", role: "dialog", "aria-modal": "true", children: [_jsx("div", { className: "dshb-timing-title", children: t('timingTitle') }), _jsx("p", { className: "dshb-hint", children: t('timingHint') }), _jsxs("label", { className: "dshb-timing-field", children: [t('timingSeconds'), _jsx("input", { className: "dshb-input", type: "number", min: 1, max: 86400, value: timingInput, placeholder: "60", disabled: autoSeconds > 0, onChange: (e) => setTimingInput(e.target.value) })] }), autoSeconds > 0
                                ? _jsx("div", { className: "dshb-timing-active", children: t('timingActive', { n: String(autoSeconds) }) })
                                : null, timingErr !== '' ? _jsx("p", { className: "dshb-err", children: timingErr }) : null, _jsxs("div", { className: "dshb-timing-actions", children: [_jsx("button", { type: "button", className: "dshb-btn dshb-btn-small dshb-btn-primary", disabled: autoSeconds > 0, onClick: () => {
                                            const n = Number(String(timingInput).trim());
                                            if (!Number.isFinite(n) || n <= 0 || n > 86400) {
                                                setTimingErr(t('timingInvalid'));
                                                return;
                                            }
                                            void saveAutoSeconds(Math.round(n)).then((ok) => {
                                                if (!ok)
                                                    return;
                                                // 启动成功立即刷新一次，让效果可见；弹框保持打开。
                                                void loadBalances(false);
                                                void loadCost();
                                            });
                                        }, children: t('timingStart') }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", disabled: autoSeconds <= 0, onClick: () => {
                                            void saveAutoSeconds(0);
                                        }, children: t('timingStop') }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: () => setTimingOpen(false), children: t('close') })] })] }) }))
                : null] }));
}
