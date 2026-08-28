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

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RunFn } from '../rpc.ts'
import { t, tErr } from '../i18n.ts'
import { ChartCard, costTooltip, stackedBarOption, type ChartSeriesDef } from './CostCharts.tsx'

/* ── 宿主载荷的最小读取形状（与 host/types.ts 的 SeriesRecord/CostSeriesResult 对齐） ── */

interface BucketsView {
  uncachedInput: number
  cacheRead: number
  cacheWrite: number
  output: number
}

interface PurposeView {
  tool: number
  text: number
  reasoning: number
}

interface SeriesRecordView {
  provider: string
  platform: string
  model: string
  workspace: string
  buckets: BucketsView
  amount: number
  priced: boolean
  steps: number
  purpose: PurposeView
}

interface SeriesPointView {
  ts: number
  label: string
}

interface SeriesResultView {
  range: string
  bucket: string
  points: SeriesPointView[]
  records: SeriesRecordView[][]
  currency: string
}

export interface CostTabProps {
  run: RunFn
  getSession(): string
  /** 自动刷新 tick（宿主定时器到点变化，重新请求）。 */
  tick: number
  /** 手动刷新请求计数（头部「刷新」按钮自增）。 */
  reloadTick: number
  /** provider 路由 → 展示信息（label + 脱敏 key），余额 tab 已加载的 providers 匹配。 */
  metaOf(route: string): { label: string; masked?: string }
  /** 费用 tab 是否可见（可见才初始化图表）。 */
  active: boolean
}

/** 时间范围（顺序即展示顺序）。 */
const RANGES: Array<{ key: string; labelKey: string }> = [
  { key: 'all', labelKey: 'rangeAll' },
  { key: 'hour1', labelKey: 'rangeHour1' },
  { key: 'today', labelKey: 'rangeToday' },
  { key: 'week7', labelKey: 'rangeWeek7' },
  { key: 'month1', labelKey: 'rangeMonth1' },
]

/** 四桶 token 总数。 */
function tokensOf(b: BucketsView): number {
  return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output
}

/** 工作区展示名：取路径末段（basename）；同名冲突时取末两段区分；空 → 未知工作区。 */
function workspaceLabels(workspaces: Iterable<string>): Map<string, string> {
  const list = [...workspaces]
  const base = (w: string): string => {
    if (w === '') return t('workspaceUnknown')
    const segs = w.replace(/\\/g, '/').split('/').filter(Boolean)
    return segs.length > 0 ? (segs[segs.length - 1] as string) : w
  }
  const counts = new Map<string, number>()
  for (const w of list) {
    const b = base(w)
    counts.set(b, (counts.get(b) ?? 0) + 1)
  }
  const out = new Map<string, string>()
  for (const w of list) {
    const b = base(w)
    if ((counts.get(b) ?? 0) === 1) {
      out.set(w, b)
    } else {
      const segs = w.replace(/\\/g, '/').split('/').filter(Boolean)
      out.set(w, segs.length >= 2 ? (segs.slice(-2).join('/')) : b)
    }
  }
  return out
}

export function CostTab({ run, getSession, tick, reloadTick, metaOf, active }: CostTabProps) {
  const [range, setRange] = useState('today')
  const [apiKey, setApiKey] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [model, setModel] = useState('all')
  const [data, setData] = useState<SeriesResultView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /** 请求 costSeries（range 变化 / 自动 tick / 手动刷新都会触发）。 */
  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const res = await run(getSession(), { op: 'costSeries', range })
      if (res.ok && res.series !== undefined) {
        setData(res.series as SeriesResultView)
      } else {
        setError(tErr(res, t('seriesError')))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [run, getSession, range])

  // 首次加载 / range 切换 / 自动 tick / 手动刷新。
  useEffect(() => {
    void load()
  }, [load, tick, reloadTick])

  /** 全部记录（未筛选）。 */
  const allRecords = useMemo(() => (data?.records ?? []).flat(), [data])
  /** 全部记录 token 合计（空态判断）。 */
  const totalTokens = useMemo(() => allRecords.reduce((s, r) => s + tokensOf(r.buckets), 0), [allRecords])

  // 筛选选项（按 token 总量降序）。
  const apiKeyOptions = useMemo(() => {
    const sums = new Map<string, number>()
    for (const r of allRecords) sums.set(r.provider, (sums.get(r.provider) ?? 0) + tokensOf(r.buckets))
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([provider]) => {
      const meta = metaOf(provider)
      const label = meta.label !== '' ? meta.label : provider
      return {
        value: provider,
        label: meta.masked !== undefined && meta.masked !== '' ? `${label} (${meta.masked})` : label,
      }
    })
  }, [allRecords, metaOf])

  const platformOptions = useMemo(() => {
    const sums = new Map<string, number>()
    for (const r of allRecords) sums.set(r.platform, (sums.get(r.platform) ?? 0) + tokensOf(r.buckets))
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => ({ value, label: value }))
  }, [allRecords])

  /** 模型选项：跨平台同名模型分开显示为「平台·模型」（value = platform\u0000model）。 */
  const modelOptions = useMemo(() => {
    const sums = new Map<string, number>()
    for (const r of allRecords) {
      const key = r.platform + '\u0000' + r.model
      sums.set(key, (sums.get(key) ?? 0) + tokensOf(r.buckets))
    }
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => {
      const [pl, m] = key.split('\u0000')
      return { value: key, label: `${pl}·${m}` }
    })
  }, [allRecords])

  /** 按 API Key / 平台 / 模型筛选后的记录（每桶一组）。 */
  const filtered = useMemo(() => {
    if (data === null) return [] as SeriesRecordView[][]
    return data.records.map((bucket) => bucket.filter((r) =>
      (apiKey === 'all' || r.provider === apiKey)
      && (platform === 'all' || r.platform === platform)
      && (model === 'all' || r.platform + '\u0000' + r.model === model),
    ))
  }, [data, apiKey, platform, model])

  const filteredTokens = useMemo(
    () => filtered.reduce((s, bucket) => s + bucket.reduce((x, r) => x + tokensOf(r.buckets), 0), 0),
    [filtered],
  )

  const labels = useMemo(() => (data?.points ?? []).map((p) => p.label), [data])
  const currency = data?.currency ?? 'CNY'

  /** 每桶一个指标的合计序列。 */
  const perBucket = (metric: (r: SeriesRecordView) => number): number[] =>
    filtered.map((bucket) => bucket.reduce((s, r) => s + metric(r), 0))

  /** 图 1：费用 —— 每 (平台·模型) 一条金额；未配置定价的记录合并为「未计费」层（token 示意）。 */
  const costOption = useMemo(() => {
    const sums = new Map<string, number>()
    for (const bucket of filtered) {
      for (const r of bucket) {
        if (!r.priced) continue
        const key = r.platform + '·' + r.model
        sums.set(key, (sums.get(key) ?? 0) + r.amount)
      }
    }
    const series: ChartSeriesDef[] = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => ({
      name,
      data: filtered.map((bucket) => bucket.reduce((x, r) => x + (r.priced && r.platform + '·' + r.model === name ? r.amount : 0), 0)),
    }))
    const notPriced = perBucket((r) => (r.priced ? 0 : tokensOf(r.buckets)))
    if (notPriced.some((v) => v > 0)) {
      series.push({ name: t('notPriced'), data: notPriced, color: '#9ca3af' })
    }
    const notPricedName = t('notPriced')
    return stackedBarOption(labels, series, t('yAmount', { cur: currency }), (params) => costTooltip(params, currency, notPricedName))
  }, [filtered, labels, currency])

  /** 图 2：Token 总量 —— 每 (平台·模型) 一条（四桶合计）。 */
  const tokensOption = useMemo(() => {
    const sums = new Map<string, number>()
    for (const bucket of filtered) {
      for (const r of bucket) {
        const key = r.platform + '·' + r.model
        sums.set(key, (sums.get(key) ?? 0) + tokensOf(r.buckets))
      }
    }
    const series: ChartSeriesDef[] = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => ({
      name,
      data: filtered.map((bucket) => bucket.reduce((x, r) => x + (r.platform + '·' + r.model === name ? tokensOf(r.buckets) : 0), 0)),
    }))
    return stackedBarOption(labels, series, t('yTokens'))
  }, [filtered, labels])

  /** 图 3：工作区 —— 每工作区一条（四桶合计）。 */
  const workspaceOption = useMemo(() => {
    const sums = new Map<string, number>()
    const workspaces = new Set<string>()
    for (const bucket of filtered) {
      for (const r of bucket) {
        workspaces.add(r.workspace)
        sums.set(r.workspace, (sums.get(r.workspace) ?? 0) + tokensOf(r.buckets))
      }
    }
    const nameOf = workspaceLabels(workspaces)
    const series: ChartSeriesDef[] = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([ws]) => ({
      name: nameOf.get(ws) ?? ws,
      data: filtered.map((bucket) => bucket.reduce((x, r) => x + (r.workspace === ws ? tokensOf(r.buckets) : 0), 0)),
    }))
    return stackedBarOption(labels, series, t('yTokens'))
  }, [filtered, labels])

  /** 图 4：缓存比例 —— 命中 / 未命中 两条。 */
  const cacheOption = useMemo(() => {
    const hit = perBucket((r) => r.buckets.cacheRead)
    const miss = perBucket((r) => r.buckets.uncachedInput + r.buckets.cacheWrite)
    return stackedBarOption(labels, [
      { name: t('cacheHit'), data: hit, color: '#16a34a' },
      { name: t('cacheMiss'), data: miss, color: '#f59e0b' },
    ], t('yTokens'))
  }, [filtered, labels])

  /** 图 5：工具占比 —— 工具调用 / 文本回复 / 纯推理 三条。 */
  const purposeOption = useMemo(() => {
    return stackedBarOption(labels, [
      { name: t('purposeTool'), data: perBucket((r) => r.purpose.tool), color: '#1668e3' },
      { name: t('purposeText'), data: perBucket((r) => r.purpose.text), color: '#16a34a' },
      { name: t('purposeReasoning'), data: perBucket((r) => r.purpose.reasoning), color: '#f59e0b' },
    ], t('yTokens'))
  }, [filtered, labels])

  return (
    <div>
      <p className="dshb-hint">{t('costTabHint')}</p>
      {/* 筛选行：API Key / 平台 / 模型 下拉 + 时间分段按钮 */}
      <div className="dshb-filters">
        <label className="dshb-filter">
          {t('filterApiKey')}
          <select className="dshb-select" value={apiKey} aria-label={t('filterApiKey')} onChange={(e) => setApiKey(e.target.value)}>
            <option value="all">{t('rangeAll')}</option>
            {apiKeyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="dshb-filter">
          {t('filterPlatform')}
          <select className="dshb-select" value={platform} aria-label={t('filterPlatform')} onChange={(e) => setPlatform(e.target.value)}>
            <option value="all">{t('rangeAll')}</option>
            {platformOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="dshb-filter">
          {t('filterModel')}
          <select className="dshb-select" value={model} aria-label={t('filterModel')} onChange={(e) => setModel(e.target.value)}>
            <option value="all">{t('rangeAll')}</option>
            {modelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div className="dshb-filter">
          {t('filterTime')}
          <div className="dshb-segs" role="tablist" aria-label={t('filterTime')}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={range === r.key}
                className={'dshb-seg' + (range === r.key ? ' dshb-seg-active' : '')}
                onClick={() => setRange(r.key)}
              >{t(r.labelKey)}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 加载 / 错误 / 空态 / 图表 */}
      {loading && data === null ? <div className="dshb-spinner" /> : null}
      {error !== ''
        ? (
          <div className="dshb-series-error">
            <span>{t('seriesError')}：{error}</span>
            <button type="button" className="dshb-btn dshb-btn-small" onClick={() => void load()}>{t('retry')}</button>
          </div>
        )
        : null}
      {data !== null && filteredTokens === 0 && error === ''
        ? <div className="dshb-series-empty">{t('seriesEmpty')}</div>
        : null}
      {data !== null && filteredTokens > 0
        ? (
          <div className="dshb-charts">
            <ChartCard title={t('chartCost')} option={costOption} active={active} />
            <ChartCard title={t('chartTokens')} option={tokensOption} active={active} />
            <ChartCard title={t('chartWorkspace')} option={workspaceOption} active={active} wide />
            <ChartCard title={t('chartCache')} option={cacheOption} active={active} wide />
            <ChartCard title={t('chartPurpose')} option={purposeOption} active={active} wide />
          </div>
        )
        : null}
    </div>
  )
}
