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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RunFn } from '../rpc.ts'
import { currencySymbol, t, tErr } from '../i18n.ts'
import { ChartCard, cacheTooltip, costTooltip, stackedBarOption, type ChartSeriesDef } from './CostCharts.tsx'

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

/** 首次加载骨架占位卡片（与五张图一一对应，固定图表区高度）。 */
const SKELETON_CARDS = [0, 1, 2, 3, 4]

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
  /** 请求序号：并发请求只采纳最后一次（快速切换时间范围时丢弃过期响应，避免旧范围数据覆盖新范围）。 */
  const loadSeqRef = useRef(0)

  /** 请求 costSeries（range 变化 / 自动 tick / 手动刷新都会触发）。 */
  const load = useCallback(async (): Promise<void> => {
    const seq = ++loadSeqRef.current
    setLoading(true)
    setError('')
    try {
      const res = await run(getSession(), { op: 'costSeries', range })
      if (seq !== loadSeqRef.current) return // 过期响应：已被更新的请求取代
      if (res.ok && res.series !== undefined) {
        setData(res.series as SeriesResultView)
      } else {
        setError(tErr(res, t('seriesError')))
      }
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
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

  // ── 级联筛选：平台 → API Key → 模型（选项逐级收敛，上游变化重置下游，避免选择错乱）──

  /** 平台选项：全部记录（不受下级筛选影响）。 */
  const platformOptions = useMemo(() => {
    const sums = new Map<string, number>()
    for (const r of allRecords) sums.set(r.platform, (sums.get(r.platform) ?? 0) + tokensOf(r.buckets))
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => ({ value, label: value }))
  }, [allRecords])

  /** API Key 选项：仅列出所选平台下的 key（平台 = all 时列出全部）。 */
  const apiKeyOptions = useMemo(() => {
    const scope = platform === 'all' ? allRecords : allRecords.filter((r) => r.platform === platform)
    const sums = new Map<string, number>()
    for (const r of scope) sums.set(r.provider, (sums.get(r.provider) ?? 0) + tokensOf(r.buckets))
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([provider]) => {
      const meta = metaOf(provider)
      const label = meta.label !== '' ? meta.label : provider
      return {
        value: provider,
        label: meta.masked !== undefined && meta.masked !== '' ? `${label} (${meta.masked})` : label,
      }
    })
  }, [allRecords, platform, metaOf])

  /** 模型选项：仅列出所选平台 + API Key 下的模型；跨平台同名模型分开显示为「平台·模型」（value = platform\u0000model）。 */
  const modelOptions = useMemo(() => {
    const scope = allRecords.filter((r) =>
      (platform === 'all' || r.platform === platform)
      && (apiKey === 'all' || r.provider === apiKey),
    )
    const sums = new Map<string, number>()
    for (const r of scope) {
      const key = r.platform + '\u0000' + r.model
      sums.set(key, (sums.get(key) ?? 0) + tokensOf(r.buckets))
    }
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => {
      const [pl, m] = key.split('\u0000')
      return { value: key, label: `${pl}·${m}` }
    })
  }, [allRecords, platform, apiKey])

  /** 平台变化：重置 API Key 与模型为「全部」（其选项集已随新平台收敛）。 */
  const handlePlatformChange = (value: string): void => {
    setPlatform(value)
    setApiKey('all')
    setModel('all')
  }

  /** API Key 变化：重置模型为「全部」（模型选项集已随新 key 收敛）。 */
  const handleApiKeyChange = (value: string): void => {
    setApiKey(value)
    setModel('all')
  }

  /**
   * 数据更新（切换时间范围 / 刷新）后：当前筛选值在新数据中已不存在则重置为「全部」，
   * 避免下拉框停留在旧选项而图表过滤不到任何记录（时间筛选看起来不生效）。
   */
  useEffect(() => {
    if (data === null) return
    if (platform !== 'all' && !allRecords.some((r) => r.platform === platform)) setPlatform('all')
    if (apiKey !== 'all' && !allRecords.some((r) => r.provider === apiKey && (platform === 'all' || r.platform === platform))) setApiKey('all')
    if (model !== 'all' && !allRecords.some((r) => r.platform + '\u0000' + r.model === model && (platform === 'all' || r.platform === platform) && (apiKey === 'all' || r.provider === apiKey))) setModel('all')
  }, [data, allRecords, platform, apiKey, model])

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

  /** 图 1：费用 —— 每 (平台·模型) 一条金额；仅展示已计费记录（未配置定价的不计费，不在此图中显示）。 */
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
    // y 轴单位为「元」（取货币符号，CNY → ¥）。
    return stackedBarOption(labels, series, t('yAmount', { cur: currencySymbol(currency) }), (params) => costTooltip(params, currency))
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

  /** 图 4：缓存比例 —— 命中 / 未命中 两条（tooltip 附带命中缓存率）。 */
  const cacheOption = useMemo(() => {
    const hit = perBucket((r) => r.buckets.cacheRead)
    const miss = perBucket((r) => r.buckets.uncachedInput + r.buckets.cacheWrite)
    return stackedBarOption(labels, [
      { name: t('cacheHit'), data: hit, color: '#16a34a' },
      { name: t('cacheMiss'), data: miss, color: '#f59e0b' },
    ], t('yTokens'), cacheTooltip)
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
      {/* 筛选行：平台 → API Key → 模型 逐级关联 + 时间分段按钮 */}
      <div className="dshb-filters">
        <label className="dshb-filter">
          {t('filterPlatform')}
          <select className="dshb-select" value={platform} aria-label={t('filterPlatform')} onChange={(e) => handlePlatformChange(e.target.value)}>
            <option value="all">{t('rangeAll')}</option>
            {platformOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="dshb-filter">
          {t('filterApiKey')}
          <select className="dshb-select" value={apiKey} aria-label={t('filterApiKey')} onChange={(e) => handleApiKeyChange(e.target.value)}>
            <option value="all">{t('rangeAll')}</option>
            {apiKeyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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

      {/* 加载占位 / 错误 / 空态 / 图表 */}
      {data === null && loading
        ? (
          // 首次加载骨架占位：与真实图表同构同高，数据到达前布局不跳动
          <div className="dshb-charts dshb-charts-placeholder" aria-busy="true">
            {SKELETON_CARDS.map((i) => (
              <div className="dshb-chart dshb-chart-skeleton" key={i}>
                <div className="dshb-chart-title dshb-skeleton-line" style={{ width: '30%' }} />
                <div className="dshb-chart-box dshb-skeleton-box" />
              </div>
            ))}
          </div>
        )
        : null}
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
          // 刷新中（时间切换 / 自动刷新）：旧图表半透明提示「正在更新」，避免误以为未生效
          <div className={'dshb-charts' + (loading ? ' dshb-charts-loading' : '')}>
            <ChartCard title={t('chartCost')} option={costOption} active={active} />
            <ChartCard title={t('chartTokens')} option={tokensOption} active={active} />
            <ChartCard title={t('chartWorkspace')} option={workspaceOption} active={active} />
            <ChartCard title={t('chartCache')} option={cacheOption} active={active} />
            <ChartCard title={t('chartPurpose')} option={purposeOption} active={active} />
          </div>
        )
        : null}
    </div>
  )
}
