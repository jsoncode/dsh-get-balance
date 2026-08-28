import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * dsh-get-balance —— 费用 tab（图表版）：筛选行 + 数据加载 + 五张图布局。
 *
 * 数据链路：宿主 `costSeries` op 返回固定桶轴（points）+ 每桶记录
 * （provider×model×workspace 聚合）。API Key / 平台 / 模型筛选为纯前端过滤
 * （本地聚合，不回宿主）；时间切换（range）重新请求。
 *
 * 五张图（全部堆叠柱状图，x = 时间桶）：
 * 1. 费用：每个已配置定价的 (平台·模型) 一条（金额）；未配置定价的记录合并为
 *    「未计费」层（柱高按 token 量示意，tooltip 注明不计费）。
 * 2. Token 总量：每个 (平台·模型) 一条（四桶合计）。
 * 3. 工作区：每个工作区（cwd）一条。
 * 4. 缓存比例：缓存命中 / 未命中 两条。
 * 5. 工具占比：工具调用 / 文本回复 / 纯推理 三条。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t, tErr } from "../i18n.js";
import { ChartCard, costTooltip, stackedBarOption } from "./CostCharts.js";
/** 时间范围（顺序即展示顺序）。 */
const RANGES = [
    { key: 'all', labelKey: 'rangeAll' },
    { key: 'hour1', labelKey: 'rangeHour1' },
    { key: 'today', labelKey: 'rangeToday' },
    { key: 'week7', labelKey: 'rangeWeek7' },
    { key: 'month1', labelKey: 'rangeMonth1' },
];
/** 四桶 token 总数。 */
function tokensOf(b) {
    return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
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
    /** 请求 costSeries（range 变化 / 自动 tick / 手动刷新都会触发）。 */
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await run(getSession(), { op: 'costSeries', range });
            if (res.ok && res.series !== undefined) {
                setData(res.series);
            }
            else {
                setError(tErr(res, t('seriesError')));
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }, [run, getSession, range]);
    // 首次加载 / range 切换 / 自动 tick / 手动刷新。
    useEffect(() => {
        void load();
    }, [load, tick, reloadTick]);
    /** 全部记录（未筛选）。 */
    const allRecords = useMemo(() => (data?.records ?? []).flat(), [data]);
    /** 全部记录 token 合计（空态判断）。 */
    const totalTokens = useMemo(() => allRecords.reduce((s, r) => s + tokensOf(r.buckets), 0), [allRecords]);
    // 筛选选项（按 token 总量降序）。
    const apiKeyOptions = useMemo(() => {
        const sums = new Map();
        for (const r of allRecords)
            sums.set(r.provider, (sums.get(r.provider) ?? 0) + tokensOf(r.buckets));
        return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([provider]) => {
            const meta = metaOf(provider);
            const label = meta.label !== '' ? meta.label : provider;
            return {
                value: provider,
                label: meta.masked !== undefined && meta.masked !== '' ? `${label} (${meta.masked})` : label,
            };
        });
    }, [allRecords, metaOf]);
    const platformOptions = useMemo(() => {
        const sums = new Map();
        for (const r of allRecords)
            sums.set(r.platform, (sums.get(r.platform) ?? 0) + tokensOf(r.buckets));
        return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => ({ value, label: value }));
    }, [allRecords]);
    /** 模型选项：跨平台同名模型分开显示为「平台·模型」（value = platform\u0000model）。 */
    const modelOptions = useMemo(() => {
        const sums = new Map();
        for (const r of allRecords) {
            const key = r.platform + '\u0000' + r.model;
            sums.set(key, (sums.get(key) ?? 0) + tokensOf(r.buckets));
        }
        return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => {
            const [pl, m] = key.split('\u0000');
            return { value: key, label: `${pl}·${m}` };
        });
    }, [allRecords]);
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
    /** 图 1：费用 —— 每 (平台·模型) 一条金额；未配置定价的记录合并为「未计费」层（token 示意）。 */
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
        const notPriced = perBucket((r) => (r.priced ? 0 : tokensOf(r.buckets)));
        if (notPriced.some((v) => v > 0)) {
            series.push({ name: t('notPriced'), data: notPriced, color: '#9ca3af' });
        }
        const notPricedName = t('notPriced');
        return stackedBarOption(labels, series, t('yAmount', { cur: currency }), (params) => costTooltip(params, currency, notPricedName));
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
    /** 图 4：缓存比例 —— 命中 / 未命中 两条。 */
    const cacheOption = useMemo(() => {
        const hit = perBucket((r) => r.buckets.cacheRead);
        const miss = perBucket((r) => r.buckets.uncachedInput + r.buckets.cacheWrite);
        return stackedBarOption(labels, [
            { name: t('cacheHit'), data: hit, color: '#16a34a' },
            { name: t('cacheMiss'), data: miss, color: '#f59e0b' },
        ], t('yTokens'));
    }, [filtered, labels]);
    /** 图 5：工具占比 —— 工具调用 / 文本回复 / 纯推理 三条。 */
    const purposeOption = useMemo(() => {
        return stackedBarOption(labels, [
            { name: t('purposeTool'), data: perBucket((r) => r.purpose.tool), color: '#1668e3' },
            { name: t('purposeText'), data: perBucket((r) => r.purpose.text), color: '#16a34a' },
            { name: t('purposeReasoning'), data: perBucket((r) => r.purpose.reasoning), color: '#f59e0b' },
        ], t('yTokens'));
    }, [filtered, labels]);
    return (_jsxs("div", { children: [_jsx("p", { className: "dshb-hint", children: t('costTabHint') }), _jsxs("div", { className: "dshb-filters", children: [_jsxs("label", { className: "dshb-filter", children: [t('filterApiKey'), _jsxs("select", { className: "dshb-select", value: apiKey, "aria-label": t('filterApiKey'), onChange: (e) => setApiKey(e.target.value), children: [_jsx("option", { value: "all", children: t('rangeAll') }), apiKeyOptions.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value))] })] }), _jsxs("label", { className: "dshb-filter", children: [t('filterPlatform'), _jsxs("select", { className: "dshb-select", value: platform, "aria-label": t('filterPlatform'), onChange: (e) => setPlatform(e.target.value), children: [_jsx("option", { value: "all", children: t('rangeAll') }), platformOptions.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value))] })] }), _jsxs("label", { className: "dshb-filter", children: [t('filterModel'), _jsxs("select", { className: "dshb-select", value: model, "aria-label": t('filterModel'), onChange: (e) => setModel(e.target.value), children: [_jsx("option", { value: "all", children: t('rangeAll') }), modelOptions.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value))] })] }), _jsxs("div", { className: "dshb-filter", children: [t('filterTime'), _jsx("div", { className: "dshb-segs", role: "tablist", "aria-label": t('filterTime'), children: RANGES.map((r) => (_jsx("button", { type: "button", role: "tab", "aria-selected": range === r.key, className: 'dshb-seg' + (range === r.key ? ' dshb-seg-active' : ''), onClick: () => setRange(r.key), children: t(r.labelKey) }, r.key))) })] })] }), loading && data === null ? _jsx("div", { className: "dshb-spinner" }) : null, error !== ''
                ? (_jsxs("div", { className: "dshb-series-error", children: [_jsxs("span", { children: [t('seriesError'), "\uFF1A", error] }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: () => void load(), children: t('retry') })] }))
                : null, data !== null && filteredTokens === 0 && error === ''
                ? _jsx("div", { className: "dshb-series-empty", children: t('seriesEmpty') })
                : null, data !== null && filteredTokens > 0
                ? (_jsxs("div", { className: "dshb-charts", children: [_jsx(ChartCard, { title: t('chartCost'), option: costOption, active: active }), _jsx(ChartCard, { title: t('chartTokens'), option: tokensOption, active: active }), _jsx(ChartCard, { title: t('chartWorkspace'), option: workspaceOption, active: active, wide: true }), _jsx(ChartCard, { title: t('chartCache'), option: cacheOption, active: active, wide: true }), _jsx(ChartCard, { title: t('chartPurpose'), option: purposeOption, active: active, wide: true })] }))
                : null] }));
}
