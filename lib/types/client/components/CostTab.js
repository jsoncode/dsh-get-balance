import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * dsh-get-balance —— 费用 tab（图表版）：筛选行 + 数据加载 + 五张图布局。
 *
 * 数据链路：宿主 `costSeries` op 返回固定桶轴（points）+ 每桶记录
 * （provider×model×workspace 聚合）。API Key / 平台 / 模型筛选为纯前端过滤
 * （本地聚合，不回宿主）；时间切换（range）重新请求。
 *
 * 五张图（全部堆叠柱状图，x = 时间桶）：
 * 1. 费用：每个已配置定价的 (平台·模型) 一条金额（y 轴单位为元）；未配置定价的不计费、不显示。
 * 2. Token 总量：每个 (平台·模型) 一条（四桶合计）。
 * 3. 工作区：每个工作区（cwd）一条。
 * 4. 缓存比例：缓存命中 / 未命中 两条（tooltip 附命中缓存率）。
 * 5. 工具占比：工具调用 / 文本回复 / 纯推理 三条。
 *
 * 加载体验：未加载完成前用骨架占位固定图表区高度；切换时间范围时旧数据半透明
 * 示「刷新中」，并发请求只采纳最后一次（避免慢请求后到覆盖新范围的数据）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { currencySymbol, t, tErr } from "../i18n.js";
import { ChartCard, cacheTooltip, costTooltip, stackedBarOption } from "./CostCharts.js";
import { ModalPortal } from "./ModalPortal.js";
/** 时间范围（顺序即展示顺序）。 */
const RANGES = [
    { key: 'all', labelKey: 'rangeAll' },
    { key: 'hour1', labelKey: 'rangeHour1' },
    { key: 'today', labelKey: 'rangeToday' },
    { key: 'week7', labelKey: 'rangeWeek7' },
    { key: 'month1', labelKey: 'rangeMonth1' },
];
/** 首次加载骨架占位卡片（与五张图一一对应，固定图表区高度）。 */
const SKELETON_CARDS = [0, 1, 2, 3, 4];
/** 四桶 token 总数。 */
function tokensOf(b) {
    return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
}
/** 字节数 → 可读大小（MB / GB），用于回填确认文案。 */
function fmtBytes(n) {
    if (!Number.isFinite(n) || n <= 0)
        return '—';
    const gb = 1024 ** 3;
    const mb = 1024 ** 2;
    return n >= gb ? (n / gb).toFixed(2) + ' GB' : (n / mb).toFixed(1) + ' MB';
}
/** 工作区展示名：取路径末段（basename）；同名冲突时取末两段区分；空 → 未知工作区。 */
function workspaceLabels(workspaces) {
    const list = [...workspaces];
    const base = (w) => {
        if (w === '')
            return t('workspaceUnknown');
        const segs = w.replace(/\\/g, '/').split('/').filter(Boolean);
        return segs.length > 0 ? segs[segs.length - 1] : w;
    };
    const counts = new Map();
    for (const w of list) {
        const b = base(w);
        counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    const out = new Map();
    for (const w of list) {
        const b = base(w);
        if ((counts.get(b) ?? 0) === 1) {
            out.set(w, b);
        }
        else {
            const segs = w.replace(/\\/g, '/').split('/').filter(Boolean);
            out.set(w, segs.length >= 2 ? (segs.slice(-2).join('/')) : b);
        }
    }
    return out;
}
export function CostTab({ run, getSession, tick, reloadTick, metaOf, active }) {
    const [range, setRange] = useState('today');
    const [apiKey, setApiKey] = useState('all');
    const [platform, setPlatform] = useState('all');
    const [model, setModel] = useState('all');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    /** 请求序号：并发请求只采纳最后一次（快速切换时间范围时丢弃过期响应，避免旧范围数据覆盖新范围）。 */
    const loadSeqRef = useRef(0);
    /**
     * 每 range 的本地结果缓存：切回已加载过的范围时直接复用，不再向宿主重复拉取
     * （宿主侧另有持久缓存 + 结果级缓存，这里避免的是浏览器→宿主的网络往返）。
     */
    const rangeCacheRef = useRef(new Map());
    /** 上一次生效的 tick / reloadTick：二者未变时的 range 切换视为纯浏览操作，可走本地缓存。 */
    const lastRefreshRef = useRef({ tick, reloadTick });
    /** 最近一次真正加载出数据的范围：取消首次回填确认时回退到它（不加载被取消的范围）。 */
    const lastShownRangeRef = useRef('today');
    /** 首次回填确认弹框（state 渲染 + ref 同步镜像，防抖/effect 内同步读取）。 */
    const [confirm, setConfirm] = useState(null);
    const confirmRef = useRef(null);
    const setConfirmBoth = useCallback((v) => {
        confirmRef.current = v;
        setConfirm(v);
    }, []);
    /** 用户已确认、回填请求正在执行（期间不再重复预检/弹框）。 */
    const backfillInFlightRef = useRef(false);
    /** 本次打开弹框内用户取消过的范围（不再询问，也不静默加载）。 */
    const dismissedRef = useRef(new Set());
    /** 回填进行中的全量 loading 遮罩（含等待秒数）。 */
    const [backfilling, setBackfilling] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    /** 请求 costSeries（range 变化 / 自动 tick / 手动刷新都会触发）。 */
    const load = useCallback(async () => {
        const seq = ++loadSeqRef.current;
        // 确认弹框打开中：等待用户选择，不发请求（自动 tick 到来时同样等待）。
        if (confirmRef.current !== null)
            return;
        // 用户取消过该范围的首次回填：本次打开期间不再加载它。
        if (dismissedRef.current.has(range))
            return;
        // tick / reloadTick 变化 = 刷新语义（自动刷新 / 手动刷新），必须重新拉取；
        // 仅 range 变化且该 range 已加载过 → 直接复用本地缓存（不再发请求）。
        const forced = tick !== lastRefreshRef.current.tick || reloadTick !== lastRefreshRef.current.reloadTick;
        lastRefreshRef.current = { tick, reloadTick };
        if (!forced) {
            const cached = rangeCacheRef.current.get(range);
            if (cached !== undefined) {
                if (seq === loadSeqRef.current) {
                    lastShownRangeRef.current = range;
                    setData(cached);
                    setLoading(false);
                    setError('');
                    // 遮罩不拦截点击：回填期间切到已缓存范围时同样收尾（否则遮罩一直挂着）。
                    setBackfilling(false);
                    backfillInFlightRef.current = false;
                }
                return;
            }
        }
        // 首次回填确认：日/周/月/全部 首次查看可能触发一次性长回填（解析大量历史日志）。
        // 先做只读预检（宿主只读、不写存储）；确认后才发真正的 costSeries。
        if ((range === 'week7' || range === 'month1' || range === 'all') && !backfillInFlightRef.current) {
            try {
                const res = await run(getSession(), { op: 'seriesBackfillInfo', range });
                if (seq !== loadSeqRef.current)
                    return; // 预检期间又切换了范围：交给新请求处理
                const info = res?.ok === true && res.info !== null && typeof res.info === 'object'
                    ? res.info
                    : undefined;
                if (info?.pending === true) {
                    setConfirmBoth({
                        range,
                        windowBytes: typeof info.windowBytes === 'number' ? info.windowBytes : 0,
                        full: info.full === true,
                    });
                    return; // 等用户确认；不在此处发请求
                }
            }
            catch { /* 预检失败按无回填处理，直接加载 */ }
        }
        setLoading(true);
        setError('');
        try {
            const res = await run(getSession(), { op: 'costSeries', range });
            if (seq !== loadSeqRef.current)
                return; // 过期响应：已被更新的请求取代
            if (res.ok && res.series !== undefined) {
                const series = res.series;
                lastShownRangeRef.current = range;
                rangeCacheRef.current.set(range, series);
                setData(series);
            }
            else {
                setError(tErr(res, t('seriesError')));
            }
        }
        catch (e) {
            if (seq !== loadSeqRef.current)
                return;
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            if (seq === loadSeqRef.current) {
                setLoading(false);
                setBackfilling(false);
                backfillInFlightRef.current = false;
            }
        }
    }, [run, getSession, range, tick, reloadTick]);
    /** 确认首次回填：关闭弹框、标记回填中、显示全量 loading 遮罩，然后真正加载。 */
    const handleConfirmBackfill = useCallback(() => {
        setConfirmBoth(null);
        backfillInFlightRef.current = true;
        setBackfilling(true);
        setElapsed(0);
        void load();
    }, [load, setConfirmBoth]);
    /** 取消首次回填：记住该范围（本次打开不再询问），并回退到上一个正常加载的范围。 */
    const handleCancelBackfill = useCallback(() => {
        if (confirmRef.current !== null)
            dismissedRef.current.add(confirmRef.current.range);
        setConfirmBoth(null);
        setRange(lastShownRangeRef.current);
    }, [setConfirmBoth]);
    // 回填进行中：每秒刷新等待秒数。
    useEffect(() => {
        if (!backfilling)
            return;
        setElapsed(0);
        const id = setInterval(() => setElapsed((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [backfilling]);
    // 确认弹框打开期间切换了时间范围：关掉旧弹框（新范围会重新预检）。
    useEffect(() => {
        if (confirmRef.current !== null && confirmRef.current.range !== range)
            setConfirmBoth(null);
    }, [range, setConfirmBoth]);
    // 首次加载 / range 切换 / 自动 tick / 手动刷新。
    // 仅当费用 tab 可见时发请求：弹框打开但停在余额 tab 时不做任何 series 预取
    // （避免解析日志的同步段阻塞并发的余额查询；切到费用 tab 时 active 翻转即触发）。
    // 150ms 防抖：快速连点时间范围只发最后一个请求，避免向宿主并发发起多个
    // costSeries 扫描（配合宿主 single-flight，进一步压缩重复拉取）。
    useEffect(() => {
        if (!active)
            return;
        const timer = setTimeout(() => {
            void load();
        }, 150);
        return () => clearTimeout(timer);
    }, [load, tick, reloadTick, active]);
    /** 全部记录（未筛选）。 */
    const allRecords = useMemo(() => (data?.records ?? []).flat(), [data]);
    /** 全部记录 token 合计（空态判断）。 */
    const totalTokens = useMemo(() => allRecords.reduce((s, r) => s + tokensOf(r.buckets), 0), [allRecords]);
    // ── 级联筛选：平台 → API Key → 模型（选项逐级收敛，上游变化重置下游，避免选择错乱）──
    /** 平台选项：全部记录（不受下级筛选影响）。 */
    const platformOptions = useMemo(() => {
        const sums = new Map();
        for (const r of allRecords)
            sums.set(r.platform, (sums.get(r.platform) ?? 0) + tokensOf(r.buckets));
        return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => ({ value, label: value }));
    }, [allRecords]);
    /** API Key 选项：仅列出所选平台下的 key（平台 = all 时列出全部）。 */
    const apiKeyOptions = useMemo(() => {
        const scope = platform === 'all' ? allRecords : allRecords.filter((r) => r.platform === platform);
        const sums = new Map();
        for (const r of scope)
            sums.set(r.provider, (sums.get(r.provider) ?? 0) + tokensOf(r.buckets));
        return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([provider]) => {
            const meta = metaOf(provider);
            const label = meta.label !== '' ? meta.label : provider;
            return {
                value: provider,
                label: meta.masked !== undefined && meta.masked !== '' ? `${label} (${meta.masked})` : label,
            };
        });
    }, [allRecords, platform, metaOf]);
    /** 模型选项：仅列出所选平台 + API Key 下的模型；跨平台同名模型分开显示为「平台·模型」（value = platform\u0000model）。 */
    const modelOptions = useMemo(() => {
        const scope = allRecords.filter((r) => (platform === 'all' || r.platform === platform)
            && (apiKey === 'all' || r.provider === apiKey));
        const sums = new Map();
        for (const r of scope) {
            const key = r.platform + '\u0000' + r.model;
            sums.set(key, (sums.get(key) ?? 0) + tokensOf(r.buckets));
        }
        return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => {
            const [pl, m] = key.split('\u0000');
            return { value: key, label: `${pl}·${m}` };
        });
    }, [allRecords, platform, apiKey]);
    /** 平台变化：重置 API Key 与模型为「全部」（其选项集已随新平台收敛）。 */
    const handlePlatformChange = (value) => {
        setPlatform(value);
        setApiKey('all');
        setModel('all');
    };
    /** API Key 变化：重置模型为「全部」（模型选项集已随新 key 收敛）。 */
    const handleApiKeyChange = (value) => {
        setApiKey(value);
        setModel('all');
    };
    /**
     * 数据更新（切换时间范围 / 刷新）后：当前筛选值在新数据中已不存在则重置为「全部」，
     * 避免下拉框停留在旧选项而图表过滤不到任何记录（时间筛选看起来不生效）。
     */
    useEffect(() => {
        if (data === null)
            return;
        if (platform !== 'all' && !allRecords.some((r) => r.platform === platform))
            setPlatform('all');
        if (apiKey !== 'all' && !allRecords.some((r) => r.provider === apiKey && (platform === 'all' || r.platform === platform)))
            setApiKey('all');
        if (model !== 'all' && !allRecords.some((r) => r.platform + '\u0000' + r.model === model && (platform === 'all' || r.platform === platform) && (apiKey === 'all' || r.provider === apiKey)))
            setModel('all');
    }, [data, allRecords, platform, apiKey, model]);
    /** 按 API Key / 平台 / 模型筛选后的记录（每桶一组）。 */
    const filtered = useMemo(() => {
        if (data === null)
            return [];
        return data.records.map((bucket) => bucket.filter((r) => (apiKey === 'all' || r.provider === apiKey)
            && (platform === 'all' || r.platform === platform)
            && (model === 'all' || r.platform + '\u0000' + r.model === model)));
    }, [data, apiKey, platform, model]);
    const filteredTokens = useMemo(() => filtered.reduce((s, bucket) => s + bucket.reduce((x, r) => x + tokensOf(r.buckets), 0), 0), [filtered]);
    const labels = useMemo(() => (data?.points ?? []).map((p) => p.label), [data]);
    const currency = data?.currency ?? 'CNY';
    /** 每桶一个指标的合计序列。 */
    const perBucket = (metric) => filtered.map((bucket) => bucket.reduce((s, r) => s + metric(r), 0));
    /** 图 1：费用 —— 每 (平台·模型) 一条金额；仅展示已计费记录（未配置定价的不计费，不在此图中显示）。 */
    const costOption = useMemo(() => {
        const sums = new Map();
        for (const bucket of filtered) {
            for (const r of bucket) {
                if (!r.priced)
                    continue;
                const key = r.platform + '·' + r.model;
                sums.set(key, (sums.get(key) ?? 0) + r.amount);
            }
        }
        const series = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => ({
            name,
            data: filtered.map((bucket) => bucket.reduce((x, r) => x + (r.priced && r.platform + '·' + r.model === name ? r.amount : 0), 0)),
        }));
        // y 轴单位为「元」（取货币符号，CNY → ¥）。
        return stackedBarOption(labels, series, t('yAmount', { cur: currencySymbol(currency) }), (params) => costTooltip(params, currency));
    }, [filtered, labels, currency]);
    /** 图 2：Token 总量 —— 每 (平台·模型) 一条（四桶合计）。 */
    const tokensOption = useMemo(() => {
        const sums = new Map();
        for (const bucket of filtered) {
            for (const r of bucket) {
                const key = r.platform + '·' + r.model;
                sums.set(key, (sums.get(key) ?? 0) + tokensOf(r.buckets));
            }
        }
        const series = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => ({
            name,
            data: filtered.map((bucket) => bucket.reduce((x, r) => x + (r.platform + '·' + r.model === name ? tokensOf(r.buckets) : 0), 0)),
        }));
        return stackedBarOption(labels, series, t('yTokens'));
    }, [filtered, labels]);
    /** 图 3：工作区 —— 每工作区一条（四桶合计）。 */
    const workspaceOption = useMemo(() => {
        const sums = new Map();
        const workspaces = new Set();
        for (const bucket of filtered) {
            for (const r of bucket) {
                workspaces.add(r.workspace);
                sums.set(r.workspace, (sums.get(r.workspace) ?? 0) + tokensOf(r.buckets));
            }
        }
        const nameOf = workspaceLabels(workspaces);
        const series = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([ws]) => ({
            name: nameOf.get(ws) ?? ws,
            data: filtered.map((bucket) => bucket.reduce((x, r) => x + (r.workspace === ws ? tokensOf(r.buckets) : 0), 0)),
        }));
        return stackedBarOption(labels, series, t('yTokens'));
    }, [filtered, labels]);
    /** 图 4：缓存比例 —— 命中 / 未命中 两条（tooltip 附带命中缓存率）。 */
    const cacheOption = useMemo(() => {
        const hit = perBucket((r) => r.buckets.cacheRead);
        const miss = perBucket((r) => r.buckets.uncachedInput + r.buckets.cacheWrite);
        return stackedBarOption(labels, [
            { name: t('cacheHit'), data: hit, color: '#16a34a' },
            { name: t('cacheMiss'), data: miss, color: '#f59e0b' },
        ], t('yTokens'), cacheTooltip);
    }, [filtered, labels]);
    /** 图 5：工具占比 —— 工具调用 / 文本回复 / 纯推理 三条。 */
    const purposeOption = useMemo(() => {
        return stackedBarOption(labels, [
            { name: t('purposeTool'), data: perBucket((r) => r.purpose.tool), color: '#1668e3' },
            { name: t('purposeText'), data: perBucket((r) => r.purpose.text), color: '#16a34a' },
            { name: t('purposeReasoning'), data: perBucket((r) => r.purpose.reasoning), color: '#f59e0b' },
        ], t('yTokens'));
    }, [filtered, labels]);
    return (_jsxs("div", { className: "dshb-cost-root", children: [_jsx("p", { className: "dshb-hint", children: t('costTabHint') }), _jsxs("div", { className: "dshb-filters", children: [_jsxs("label", { className: "dshb-filter", children: [t('filterPlatform'), _jsxs("select", { className: "dshb-select", value: platform, "aria-label": t('filterPlatform'), onChange: (e) => handlePlatformChange(e.target.value), children: [_jsx("option", { value: "all", children: t('rangeAll') }), platformOptions.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value))] })] }), _jsxs("label", { className: "dshb-filter", children: [t('filterApiKey'), _jsxs("select", { className: "dshb-select", value: apiKey, "aria-label": t('filterApiKey'), onChange: (e) => handleApiKeyChange(e.target.value), children: [_jsx("option", { value: "all", children: t('rangeAll') }), apiKeyOptions.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value))] })] }), _jsxs("label", { className: "dshb-filter", children: [t('filterModel'), _jsxs("select", { className: "dshb-select", value: model, "aria-label": t('filterModel'), onChange: (e) => setModel(e.target.value), children: [_jsx("option", { value: "all", children: t('rangeAll') }), modelOptions.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value))] })] }), _jsxs("div", { className: "dshb-filter", children: [t('filterTime'), _jsx("div", { className: "dshb-segs", role: "tablist", "aria-label": t('filterTime'), children: RANGES.map((r) => (_jsx("button", { type: "button", role: "tab", "aria-selected": range === r.key, className: 'dshb-seg' + (range === r.key ? ' dshb-seg-active' : ''), onClick: () => setRange(r.key), children: t(r.labelKey) }, r.key))) })] })] }), data === null && loading
                ? (
                // 首次加载骨架占位：与真实图表同构同高，数据到达前布局不跳动
                _jsx("div", { className: "dshb-charts dshb-charts-placeholder", "aria-busy": "true", children: SKELETON_CARDS.map((i) => (_jsxs("div", { className: "dshb-chart dshb-chart-skeleton", children: [_jsx("div", { className: "dshb-chart-title dshb-skeleton-line", style: { width: '30%' } }), _jsx("div", { className: "dshb-chart-box dshb-skeleton-box" })] }, i))) }))
                : null, error !== ''
                ? (_jsxs("div", { className: "dshb-series-error", children: [_jsxs("span", { children: [t('seriesError'), "\uFF1A", error] }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: () => void load(), children: t('retry') })] }))
                : null, data !== null && filteredTokens === 0 && error === ''
                ? _jsx("div", { className: "dshb-series-empty", children: t('seriesEmpty') })
                : null, data !== null && filteredTokens > 0
                ? (
                // 刷新中（时间切换 / 自动刷新）：旧图表半透明提示「正在更新」，避免误以为未生效
                _jsxs("div", { className: 'dshb-charts' + (loading ? ' dshb-charts-loading' : ''), children: [_jsx(ChartCard, { title: t('chartCost'), option: costOption, active: active }), _jsx(ChartCard, { title: t('chartTokens'), option: tokensOption, active: active }), _jsx(ChartCard, { title: t('chartWorkspace'), option: workspaceOption, active: active }), _jsx(ChartCard, { title: t('chartCache'), option: cacheOption, active: active }), _jsx(ChartCard, { title: t('chartPurpose'), option: purposeOption, active: active })] }))
                : null, backfilling
                ? (_jsxs("div", { className: "dshb-backfill-overlay", role: "status", "aria-live": "polite", children: [_jsx("div", { className: "dshb-backfill-spinner", "aria-hidden": "true" }), _jsx("div", { children: t('backfillLoading') }), _jsx("div", { className: "dshb-backfill-elapsed", children: t('backfillLoadingElapsed', { s: elapsed }) })] }))
                : null, confirm !== null
                ? (_jsxs(ModalPortal, { backdropClass: "dshb-confirm-backdrop", modalClass: "dshb-modal-sm", onBackdropClose: handleCancelBackfill, children: [_jsxs("div", { className: "dshb-modal-header", children: [_jsx("span", { className: "dshb-modal-title", children: t('backfillConfirmTitle') }), _jsx("button", { type: "button", className: "dshb-close", "aria-label": t('close'), onClick: handleCancelBackfill, children: "\u2715" })] }), _jsxs("div", { className: "dshb-modal-body", children: [_jsx("div", { children: t('backfillConfirmText', { size: fmtBytes(confirm.windowBytes) }) }), _jsx("div", { className: "dshb-hint", children: t('backfillCancelHint') })] }), _jsxs("div", { className: "dshb-modal-footer", children: [_jsx("button", { type: "button", className: "dshb-btn", onClick: handleCancelBackfill, children: t('cancel') }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-primary", onClick: handleConfirmBackfill, children: t('backfillConfirmBtn') })] })] }))
                : null] }));
}
