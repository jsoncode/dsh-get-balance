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

import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react'
import type { RunFn } from '../rpc.ts'
import { fmtAmount, t, tErr, zhNumeral } from '../i18n.ts'
import { CostTab } from './CostTab.tsx'

/* ── 宿主载荷的最小读取形状 ───────────────────────────────── */

interface ProviderView {
  id: string
  label: string
  baseUrl: string
  source: 'llm-pi-ai' | 'llm-deepseek' | 'extra'
  apiKeyEnv?: string
  apiKeyMasked?: string
  keySource?: string
  hasKey: boolean
  /** 解析到同一 API key（同一账号）而被折叠到本行的其它路由。 */
  sharedWith?: Array<{ id: string; label: string; source: ProviderView['source'] }>
}

interface BalanceInfoView {
  currency: string
  total_balance: string
  granted_balance: string
  topped_out: boolean
}

interface BalanceView {
  providerId: string
  ok: boolean
  error?: string
  code?: string
  balance_infos?: BalanceInfoView[]
}

interface BucketsView {
  uncachedInput: number
  cacheRead: number
  cacheWrite: number
  output: number
}

/** 单个 API Key 的用量与费用明细（token 不区分官方与否；费用只对官方计算）。 */
interface KeyCostEntryView {
  provider: string
  buckets: BucketsView
  official: boolean
  amount: number
  currency: string
}

interface CostEntryView {
  amount: number
  currency: string
  buckets: BucketsView
  /** 按 API Key（服务商条目）分组的明细，token 总数降序。 */
  byKey: KeyCostEntryView[]
}

interface CostResultView {
  lastTurn: CostEntryView
  session: CostEntryView
  todayProject: CostEntryView
  todayAll: CostEntryView
  sessionTier?: string
}

/** 一个时段（高峰 / 空闲）的四项单价。 */
interface RatesView {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
}

interface PriceView {
  id: string
  name: string
  currency: string
  match: string
  peak: RatesView
  offPeak: RatesView
}

interface TimeWindowView {
  start: string
  end: string
}

interface PriceWindowView {
  timezoneOffsetMinutes: number
  peakWindows: TimeWindowView[]
  /** 周六日半价：周六/周日整天按空闲时段计费。 */
  weekendOffPeak: boolean
}

interface KeyView {
  id: string
  label: string
  apiKeyMasked: string
}

type Tab = 'balance' | 'cost' | 'prices'

/** 价格设置内的二级平台 tab key（后续新增其他平台定价时在此扩展联合类型）。 */
type PricePlatform = 'deepseek'

export interface BalanceModalProps {
  run: RunFn
  useOpen(): boolean
  close(): void
  /** 当前会话 id（footer 入口上报），费用查询随请求上传。 */
  getSession(): string
  /** 自动刷新 tick（到点触发余额/费用刷新）。 */
  useTick(): number
  /** 当前定时刷新间隔（秒，0 = 关闭）。 */
  useAutoSeconds(): number
  /** 更新定时刷新间隔（秒）。 */
  setAutoSeconds(seconds: number): void
  /** 价格配置保存成功后调用：通知 footer / 头部按钮立即刷新时段与费用显示。 */
  bumpPriceTick(): void
  /** 「显示余额」开关当前值（false = footer 与余额列表金额掩码为 **）。 */
  useShowBalance(): boolean
  /** 切换「显示余额」开关：即时生效并持久化（footer 入口同步跟随）。 */
  setShowBalance(enabled: boolean): void
}

const sourceChipKey: Record<ProviderView['source'], string> = {
  'llm-pi-ai': 'sourcePiAi',
  'llm-deepseek': 'sourceDeepseek',
  'extra': 'sourceExtra',
}

/**
 * 会话事件中的 provider 路由是否命中某个（可能折叠的）服务商条目：
 * 命中本行 id / label，或命中本行 sharedWith 中任一条目的 id / label。
 * 折叠后（同一账号一行）费用统计仍能按任意共享路由匹配到该行。
 */
function providerMatches(p: ProviderView, route: string): boolean {
  if (p.id === 'pi-ai:' + route || p.id === 'llm-deepseek:' + route || p.id === route || p.label === route) return true
  return (p.sharedWith ?? []).some((s) => s.id === 'pi-ai:' + route || s.id === 'llm-deepseek:' + route || s.id === route || s.label === route)
}

/** 严格对齐官方价格表：仅三组指标（输入-缓存命中 / 输入-缓存未命中 / 输出）。 */
const METRIC_GROUPS: Array<{ labelKey: string; field: 'input' | 'cacheRead' | 'output' }> = [
  { labelKey: 'priceInputHit', field: 'cacheRead' },
  { labelKey: 'priceInputMiss', field: 'input' },
  { labelKey: 'priceOutput', field: 'output' },
]

/** 价格设置内的平台 tab 清单（顺序即展示顺序；新增平台 = 加一项 + 一个 render 函数）。 */
const PRICE_PLATFORMS: Array<{ key: PricePlatform; labelKey: string }> = [
  { key: 'deepseek', labelKey: 'tabPlatformDeepseek' },
]

/** 把 UTC 偏移小时数格式化为时区名（zh：零时区 / 东八区 / 西五区；en：UTC±0 / UTC+8 / UTC-5）。 */
function formatTimezone(offsetHours: number): string {
  const h = Math.round(offsetHours)
  return t(h === 0 ? 'tzZero' : h > 0 ? 'tzEast' : 'tzWest', { n: zhNumeral(Math.abs(h)) })
}

export function BalanceModal({ run, useOpen, close, getSession, useTick, useAutoSeconds, setAutoSeconds, bumpPriceTick, useShowBalance, setShowBalance }: BalanceModalProps) {
  const open = useOpen()
  const tick = useTick()
  const autoSeconds = useAutoSeconds()
  const showBalance = useShowBalance()
  const [tab, setTab] = useState<Tab>('balance')
  // 价格设置内的二级平台 tab（当前仅 DeepSeek，后续扩展其他平台）
  const [pricePlatform, setPricePlatform] = useState<PricePlatform>('deepseek')
  // 定时更新配置弹框
  const [timingOpen, setTimingOpen] = useState(false)
  const [timingInput, setTimingInput] = useState('')
  const [timingErr, setTimingErr] = useState('')

  // 余额 tab
  const [providers, setProviders] = useState<ProviderView[] | null>(null)
  const [balances, setBalances] = useState<Record<string, BalanceView>>({})
  const [balLoading, setBalLoading] = useState(false)
  const [balError, setBalError] = useState('')
  // 附加 key
  const [keys, setKeys] = useState<KeyView[]>([])
  const [keyFormOpen, setKeyFormOpen] = useState(false)
  const [keyLabel, setKeyLabel] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [keyErr, setKeyErr] = useState('')
  // 费用 tab
  const [cost, setCost] = useState<CostResultView | null>(null)
  const [costLoading, setCostLoading] = useState(false)
  /** 手动刷新请求计数：头部「刷新」按钮自增，CostTab 监听后重新请求 costSeries。 */
  const [costReload, setCostReload] = useState(0)
  // 价格 tab
  const [prices, setPrices] = useState<PriceView[] | null>(null)
  const [windowCfg, setWindowCfg] = useState<PriceWindowView>({ timezoneOffsetMinutes: 480, peakWindows: [], weekendOffPeak: false })
  const [priceMsg, setPriceMsg] = useState('')

  /** 余额查询：providers 与 balances 一并回填。 */
  const loadBalances = useCallback(async (refresh: boolean): Promise<void> => {
    setBalLoading(true)
    setBalError('')
    try {
      const provRes = await run(getSession(), { op: 'providers' })
      if (provRes.ok && Array.isArray(provRes.providers)) {
        setProviders(provRes.providers as ProviderView[])
      }
      const res = await run(getSession(), { op: 'balance', refresh })
      if (res.ok && Array.isArray(res.balances)) {
        const map: Record<string, BalanceView> = {}
        for (const b of res.balances as BalanceView[]) map[b.providerId] = b
        setBalances(map)
      } else {
        setBalError(tErr(res, t('saveFailed')))
      }
    } finally {
      setBalLoading(false)
    }
  }, [run, getSession])

  const loadKeys = useCallback(async (): Promise<void> => {
    const res = await run(getSession(), { op: 'keysGet' })
    if (res.ok && Array.isArray(res.keys)) setKeys(res.keys as KeyView[])
  }, [run, getSession])

  const loadCost = useCallback(async (): Promise<void> => {
    setCostLoading(true)
    try {
      const res = await run(getSession(), { op: 'cost', sessionId: getSession() })
      if (res.ok && res.cost !== undefined) setCost(res.cost as CostResultView)
    } finally {
      setCostLoading(false)
    }
  }, [run, getSession])

  const loadPrices = useCallback(async (): Promise<void> => {
    const res = await run(getSession(), { op: 'pricesGet' })
    if (res.ok) {
      const config = res.config as { tiers?: PriceView[]; timezoneOffsetMinutes?: number; peakWindows?: TimeWindowView[]; weekendOffPeak?: boolean } | undefined
      if (Array.isArray(config?.tiers)) setPrices(config.tiers as PriceView[])
      if (config !== undefined) {
        setWindowCfg({
          timezoneOffsetMinutes: typeof config.timezoneOffsetMinutes === 'number' ? config.timezoneOffsetMinutes : 480,
          peakWindows: Array.isArray(config.peakWindows) ? config.peakWindows as TimeWindowView[] : [],
          weekendOffPeak: config.weekendOffPeak === true,
        })
      }
    }
  }, [run, getSession])

  // 弹框打开时全量拉取；切换 tab 也保证数据新鲜（轻量：宿主有缓存）。
  useEffect(() => {
    if (!open) return
    void loadBalances(false)
    void loadKeys()
    void loadCost()
    void loadPrices()
  }, [open, tab, loadBalances, loadKeys, loadCost, loadPrices])

  // 定时自动刷新：宿主定时器到点 bump tick，这里刷新余额与费用（tick 初始 0 跳过）。
  useEffect(() => {
    if (!open || tick <= 0) return
    void loadBalances(false)
    void loadCost()
  }, [tick, open, loadBalances, loadCost])

  /* ── 定时更新配置 ── */

  const saveAutoSeconds = async (seconds: number): Promise<boolean> => {
    try {
      const res = await run('', { op: 'autoRefreshSave', seconds })
      if (res.ok && typeof res.seconds === 'number') {
        setAutoSeconds(res.seconds)
        setTimingErr('')
        return true
      }
      setTimingErr(tErr(res, t('saveFailed')))
      return false
    } catch {
      setTimingErr(tErr(null, t('saveFailed')))
      return false
    }
  }

  const openTimingDialog = (): void => {
    setTimingInput(autoSeconds > 0 ? String(autoSeconds) : '60')
    setTimingErr('')
    setTimingOpen(true)
  }

  if (!open) return null

  /* ── 附加 key 操作 ── */

  const saveKeys = async (next: Array<{ id?: string; label: string; apiKey: string }>): Promise<void> => {
    const res = await run(getSession(), { op: 'keysSave', keys: next })
    if (res.ok) {
      await loadKeys()
      void loadBalances(true)
    } else {
      setKeyErr(tErr(res, t('saveFailed')))
    }
  }

  const submitKey = (): void => {
    const value = keyValue.trim()
    if (value.length === 0) {
      setKeyErr(t('keyRequired'))
      return
    }
    setKeyErr('')
    setKeyFormOpen(false)
    setKeyValue('')
    setKeyLabel('')
    void saveKeys([...keys.map((k) => ({ id: k.id, label: k.label, apiKey: '' })), { label: keyLabel.trim(), apiKey: value }])
  }

  const removeKey = (id: string): void => {
    void saveKeys(keys.filter((k) => k.id !== id).map((k) => ({ id: k.id, label: k.label, apiKey: '' })))
  }

  /* ── 价格档操作 ── */

  const updatePrice = (index: number, patch: Partial<PriceView>): void => {
    setPrices((prev) => {
      if (prev === null) return prev
      const next = prev.slice()
      next[index] = { ...next[index] as PriceView, ...patch }
      return next
    })
  }

  /** 更新某档某个时段的单项单价。 */
  const updateRate = (index: number, period: 'peak' | 'offPeak', field: keyof RatesView, value: number): void => {
    setPrices((prev) => {
      if (prev === null) return prev
      const next = prev.slice()
      const tier = next[index] as PriceView
      next[index] = { ...tier, [period]: { ...tier[period], [field]: value } }
      return next
    })
  }

  const savePrices = async (list: PriceView[], windowCfgNext?: PriceWindowView): Promise<void> => {
    if (list.length === 0) {
      setPriceMsg(t('pricesEmpty'))
      return
    }
    const cfg = windowCfgNext ?? windowCfg
    const res = await run(getSession(), {
      op: 'pricesSave',
      config: { tiers: list, timezoneOffsetMinutes: cfg.timezoneOffsetMinutes, peakWindows: cfg.peakWindows, weekendOffPeak: cfg.weekendOffPeak },
    })
    if (res.ok) {
      const config = res.config as { tiers?: PriceView[]; timezoneOffsetMinutes?: number; peakWindows?: TimeWindowView[]; weekendOffPeak?: boolean } | undefined
      if (Array.isArray(config?.tiers)) setPrices(config.tiers as PriceView[])
      if (config !== undefined) {
        setWindowCfg({
          timezoneOffsetMinutes: typeof config.timezoneOffsetMinutes === 'number' ? config.timezoneOffsetMinutes : 480,
          peakWindows: Array.isArray(config.peakWindows) ? config.peakWindows as TimeWindowView[] : [],
          weekendOffPeak: config.weekendOffPeak === true,
        })
      }
      setPriceMsg(t('pricesSaved'))
      // 广播「价格已保存」：footer 时段徽标 / 头部费用按钮立即刷新（无需关闭弹框）。
      bumpPriceTick()
      // 价格变化影响图表金额：强制 costSeries 重新拉取（绕过 CostTab 的 range 本地缓存）。
      setCostReload((n) => n + 1)
      void loadCost()
    } else {
      setPriceMsg(tErr(res, t('saveFailed')))
    }
  }

  /* ── 渲染 ── */

  const balanceOf = (id: string): BalanceView | undefined => balances[id]

  /** 余额金额展示：「显示余额」关闭时统一掩码为 **（footer 入口同步生效）。 */
  const balanceText = (v: string): string => (showBalance ? v : '**')

  /**
   * 单个服务商条目（API key）的今日消耗：从 cost.todayAll.byKey 按
   * 服务商路由匹配（pi-ai:<route> / llm-deepseek:<route> / label / 共享路由）。
   * 无用量时返回 undefined，展示为 ≈0.00 CNY。
   */
  const todayCostOf = (p: ProviderView): KeyCostEntryView | undefined => {
    const list = cost?.todayAll?.byKey ?? []
    return list.find((k) => providerMatches(p, k.provider))
  }

  const renderBalanceTab = () => (
    <div>
      {/* 显示余额滑动开关：位于余额列表上方；关闭后 footer 入口与本列表的金额一律显示为 ** */}
      <div className="dshb-showbalance-row">
        <div className="dshb-showbalance-text">
          <div className="dshb-showbalance-title">{t('showBalanceToggle')}</div>
          <p className="dshb-showbalance-hint">{t('showBalanceHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showBalance}
          aria-label={t('showBalanceToggle')}
          title={t('showBalanceToggle')}
          className={'dshb-switch' + (showBalance ? ' dshb-switch-on' : '')}
          onClick={() => setShowBalance(!showBalance)}
        >
          <span className="dshb-switch-thumb" />
        </button>
      </div>
      {providers === null
        ? <div className="dshb-spinner" />
        : providers.length === 0
          ? <div className="dshb-empty">{t('noProviders')}</div>
          : (
            <div className="dshb-prov-list">
              {providers.map((p) => {
                const b = balanceOf(p.id)
                const infos = b?.ok ? (b.balance_infos ?? []) : []
                return (
                  <div className="dshb-prov" key={p.id}>
                    <div className="dshb-prov-main">
                      <div className="dshb-prov-name-row">
                        <span className="dshb-prov-name">{p.label}</span>
                        <span className={'dshb-chip' + (p.source === 'extra' ? ' dshb-chip-brand' : '')}>{t(sourceChipKey[p.source])}</span>
                        {(p.sharedWith ?? []).map((s) => (
                          <span key={s.id} className="dshb-chip" title={t('sharedAccountTitle', { n: s.label !== '' ? s.label : s.id })}>
                            {t(sourceChipKey[s.source])}
                          </span>
                        ))}
                        {!p.hasKey
                          ? (
                            <span className="dshb-chip" title={p.keySource !== undefined ? 'source: ' + p.keySource : undefined}>
                              {t('noCredential')}{p.apiKeyEnv !== undefined ? ' · ' + p.apiKeyEnv : ''}
                            </span>
                          )
                          : null}
                      </div>
                      <div className="dshb-prov-meta">
                        {p.baseUrl}
                        {p.apiKeyMasked ? ` · ${p.apiKeyMasked}` : ''}
                      </div>
                    </div>
                    <div className="dshb-prov-side">
                      {b === undefined
                        ? (balLoading ? <div className="dshb-spinner" style={{ margin: '4px 0 4px auto' }} /> : <span className="dshb-prov-sub">—</span>)
                        : b.ok
                          ? infos.length === 0
                            ? <span className="dshb-prov-sub">—</span>
                            : infos.map((info, i) => {
                              const kc = todayCostOf(p)
                              const kcCurrency = kc !== undefined && kc.currency !== '' ? kc.currency : 'CNY'
                              return (
                                <div key={i}>
                                  <div className="dshb-prov-costline">
                                    <span>{t('summaryTodayCost')}</span>
                                    <span className="dshb-balance-num">≈{fmtAmount(kc?.amount ?? 0)} {kcCurrency}</span>
                                    <span className="dshb-balance-sep">|</span>
                                    <span>{t('summaryBalance')}</span>
                                    <span className="dshb-balance-num">{balanceText(info.total_balance)} {info.currency}</span>
                                  </div>
                                  <div className={'dshb-prov-sub' + (info.topped_out ? ' dshb-topped' : '')}>
                                    {t('balanceGranted')} {balanceText(info.granted_balance)}
                                    {info.topped_out ? ` · ${t('toppedOut')}` : ''}
                                  </div>
                                </div>
                              )
                            })
                          : <div className="dshb-prov-err">{tErr(b)}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      {balError !== '' ? <p className="dshb-err">{balError}</p> : null}

      {/* 附加 API Key 区 */}
      <div className="dshb-keys">
        <div className="dshb-keys-title">{t('extraKeysTitle')}</div>
        <p className="dshb-hint">{t('extraKeysHint')}</p>
        {keys.map((k) => (
          <div className="dshb-key-row" key={k.id}>
            <span className="dshb-chip">{k.label !== '' ? k.label : t('sourceExtra')}</span>
            <span className="dshb-key-mask">{k.apiKeyMasked}</span>
            <button type="button" className="dshb-btn dshb-btn-small dshb-btn-danger" onClick={() => removeKey(k.id)}>{t('delete')}</button>
          </div>
        ))}
        {keyFormOpen
          ? (
            <div className="dshb-key-form">
              <input className="dshb-input" value={keyLabel} placeholder={t('keyLabelPlaceholder')} aria-label={t('keyLabel')} onChange={(e) => setKeyLabel(e.target.value)} />
              <input className="dshb-input" value={keyValue} placeholder={t('keyInputPlaceholder')} aria-label={t('keyInput')} onChange={(e) => setKeyValue(e.target.value)} />
              <button type="button" className="dshb-btn dshb-btn-small dshb-btn-primary" onClick={submitKey}>{t('add')}</button>
              <button type="button" className="dshb-btn dshb-btn-small" onClick={() => { setKeyFormOpen(false); setKeyErr('') }}>{t('cancel')}</button>
            </div>
          )
          : <button type="button" className="dshb-btn dshb-btn-small" onClick={() => setKeyFormOpen(true)}>+ {t('addKeyBtn')}</button>}
        {keyErr !== '' ? <p className="dshb-err">{keyErr}</p> : null}
      </div>
    </div>
  )

  /** 服务商路由 key → 展示信息（label + 脱敏 key + 来源）；用余额 tab 已加载的 providers 列表匹配（含折叠的共享路由）。 */
  const providerMeta = (provider: string): { label: string; masked?: string; source?: ProviderView['source'] } => {
    const hit = (providers ?? []).find((p) => providerMatches(p, provider))
    if (hit !== undefined) {
      return {
        label: hit.label !== '' ? hit.label : provider,
        ...hit.apiKeyMasked !== undefined && hit.apiKeyMasked !== '' ? { masked: hit.apiKeyMasked } : {},
        source: hit.source,
      }
    }
    return { label: provider }
  }

  /** 费用 tab（图表版）：筛选器 + 五张 ECharts 图（CostTab 自管数据加载与刷新）。 */
  const renderCostTab = () => (
    <CostTab
      run={run}
      getSession={getSession}
      tick={tick}
      reloadTick={costReload}
      metaOf={providerMeta}
      active={tab === 'cost'}
    />
  )

  /** DeepSeek 平台定价：时段配置 + 官方价格表式价格档编辑。 */
  const renderDeepseekPrices = () => (
    <div>
      <p className="dshb-hint">{t('pricesHint')}</p>
      {prices === null
        ? <div className="dshb-spinner" />
        : (
          <div>
            <div className="dshb-window-box">
              <div className="dshb-window-head">
                <span className="dshb-window-title">{t('windowTitle')}</span>
                {/* 周六日半价：勾选后周六/周日整天按空闲时段计费（随「保存」持久化） */}
                <label className="dshb-weekend" title={t('weekendHint')}>
                  <input
                    type="checkbox"
                    checked={windowCfg.weekendOffPeak}
                    aria-label={t('weekendHalfPrice')}
                    onChange={(e) => setWindowCfg({ ...windowCfg, weekendOffPeak: e.target.checked })}
                  />
                  <span>{t('weekendHalfPrice')}</span>
                </label>
              </div>
              <p className="dshb-hint">{t('windowHint')}</p>
              <div className="dshb-window-list">
                {windowCfg.peakWindows.map((w, wi) => (
                  <div className="dshb-window-row" key={wi}>
                    <input className="dshb-input dshb-cur" value={w.start} aria-label={t('windowStart')} placeholder="09:00"
                      onChange={(e) => {
                        const next = windowCfg.peakWindows.map((x, j) => j === wi ? { ...x, start: e.target.value } : x)
                        setWindowCfg({ ...windowCfg, peakWindows: next })
                      }}
                    />
                    <span>–</span>
                    <input className="dshb-input dshb-cur" value={w.end} aria-label={t('windowEnd')} placeholder="12:00"
                      onChange={(e) => {
                        const next = windowCfg.peakWindows.map((x, j) => j === wi ? { ...x, end: e.target.value } : x)
                        setWindowCfg({ ...windowCfg, peakWindows: next })
                      }}
                    />
                    <button type="button" className="dshb-btn dshb-btn-small dshb-btn-danger dshb-window-del"
                      onClick={() => setWindowCfg({ ...windowCfg, peakWindows: windowCfg.peakWindows.filter((_, j) => j !== wi) })}
                    >{t('delete')}</button>
                  </div>
                ))}
              </div>
              <div className="dshb-window-actions">
                <button type="button" className="dshb-btn dshb-btn-small"
                  onClick={() => setWindowCfg({ ...windowCfg, peakWindows: [...windowCfg.peakWindows, { start: '09:00', end: '12:00' }] })}
                >+ {t('addWindow')}</button>
                <label className="dshb-window-tz">
                  <span>{t('tzOffset')}</span>
                  <input
                    className="dshb-range"
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={Math.round(windowCfg.timezoneOffsetMinutes / 60)}
                    aria-label={t('tzOffset')}
                    onChange={(e) => setWindowCfg({ ...windowCfg, timezoneOffsetMinutes: Number(e.target.value) * 60 })}
                  />
                  <b className="dshb-window-tz-label">{formatTimezone(windowCfg.timezoneOffsetMinutes / 60)}</b>
                </label>
              </div>
            </div>

            <div className="dshb-price-scroll">
              <table className="dshb-table dshb-price-table">
                <thead>
                  <tr>
                    <th className="dshb-price-corner" colSpan={2}>{t('priceModel')}</th>
                    {prices.map((tier, i) => (
                      <th key={tier.id} className="dshb-price-head-cell">
                        <span className="dshb-price-model-name" title={tier.match === '*' ? t('fallbackHint') : undefined}>
                          {tier.name || tier.match}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRIC_GROUPS.map((group) => (
                    <Fragment key={group.field}>
                      <tr>
                        <th rowSpan={2} className="dshb-price-metric">{t(group.labelKey)}</th>
                        <td className="dshb-price-period dshb-period-off">{t('pricePeriodOffPeak')}</td>
                        {prices.map((tier, i) => (
                          <td key={tier.id} className="dshb-price-cell">
                            <input className="dshb-input dshb-num" type="number" step="any" min={0}
                              value={tier.offPeak[group.field]}
                              aria-label={t(group.labelKey) + ' · ' + t('pricePeriodOffPeak')}
                              onChange={(e) => updateRate(i, 'offPeak', group.field, Number(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="dshb-price-period dshb-period-peak">{t('pricePeriodPeak')}</td>
                        {prices.map((tier, i) => (
                          <td key={tier.id} className="dshb-price-cell">
                            <input className="dshb-input dshb-num" type="number" step="any" min={0}
                              value={tier.peak[group.field]}
                              aria-label={t(group.labelKey) + ' · ' + t('pricePeriodPeak')}
                              onChange={(e) => updateRate(i, 'peak', group.field, Number(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  )

  /**
   * 价格设置容器：二级平台 tab 行 + 各平台面板。
   * 面板与弹框主体一样采用 grid 叠放常驻：隐藏面板仍参与布局，
   * 平台增多后切换二级 tab 也不会引起弹框高度跳动。
   */
  const renderPricesTab = () => {
    const platformViews: Record<PricePlatform, () => ReactNode> = { deepseek: renderDeepseekPrices }
    return (
      <div>
        <div className="dshb-subtabs" role="tablist" aria-label={t('tabPrices')}>
          {PRICE_PLATFORMS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={pricePlatform === p.key}
              className={'dshb-subtab' + (pricePlatform === p.key ? ' dshb-subtab-active' : '')}
              onClick={() => setPricePlatform(p.key)}
            >{t(p.labelKey)}</button>
          ))}
        </div>
        <div className="dshb-subpanes">
          {PRICE_PLATFORMS.map((p) => (
            <div key={p.key} className={'dshb-pane' + (pricePlatform === p.key ? '' : ' dshb-pane-off')}>
              {platformViews[p.key]()}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="dshb-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="dshb-modal" role="dialog" aria-modal="true">
        {/* 单行头部：标题 + 三个 tab 同行，右侧为 定时更新 / 刷新 / 关闭 */}
        <div className="dshb-modal-header">
          <div className="dshb-modal-title">{t('modalTitle')}</div>
          <div className="dshb-tabs">
            <button type="button" className={'dshb-tab' + (tab === 'balance' ? ' dshb-tab-active' : '')} onClick={() => setTab('balance')}>{t('tabBalance')}</button>
            <button type="button" className={'dshb-tab' + (tab === 'cost' ? ' dshb-tab-active' : '')} onClick={() => setTab('cost')}>{t('tabCost')}</button>
            <button type="button" className={'dshb-tab' + (tab === 'prices' ? ' dshb-tab-active' : '')} onClick={() => setTab('prices')}>{t('tabPrices')}</button>
          </div>
          <div className="dshb-head-ops">
            {/* 定时更新：位于刷新按钮左侧 */}
            <button type="button" className="dshb-btn dshb-btn-small" onClick={openTimingDialog}>
              {t('timingBtn')}{autoSeconds > 0 ? '·' + autoSeconds + 's' : ''}
            </button>
            {/* 刷新：文案恒定不切换「加载中…」，避免按钮宽度抖动；加载中仅禁用 */}
            {tab === 'balance'
              ? <button type="button" className="dshb-btn dshb-btn-small" disabled={balLoading} onClick={() => void loadBalances(true)}>{t('refresh')}</button>
              : null}
            {tab === 'cost'
              ? <button type="button" className="dshb-btn dshb-btn-small" onClick={() => setCostReload((n) => n + 1)}>{t('refresh')}</button>
              : null}
            <button type="button" className="dshb-close" aria-label={t('close')} onClick={close}>✕</button>
          </div>
        </div>
        {/* 三个面板常驻并叠放在同一格（grid stacking）：隐藏面板仍参与布局，
            弹框高度恒等于最高的【价格设置】页 → 该页不出现滚动、切换 tab 不跳动 */}
        <div className="dshb-modal-body">
          <div className={'dshb-pane' + (tab === 'balance' ? '' : ' dshb-pane-off')}>{renderBalanceTab()}</div>
          <div className={'dshb-pane' + (tab === 'cost' ? '' : ' dshb-pane-off')}>{renderCostTab()}</div>
          <div className={'dshb-pane' + (tab === 'prices' ? '' : ' dshb-pane-off')}>{renderPricesTab()}</div>
        </div>
        {/* 底部操作区：置底显示，不随内容滚动（当前承载价格设置的保存动作） */}
        {tab === 'prices'
          ? (
            <div className="dshb-modal-footer">
              {priceMsg !== ''
                ? <p className={'dshb-msg ' + (priceMsg === t('pricesSaved') ? 'dshb-ok' : 'dshb-err')}>{priceMsg}</p>
                : null}
              <button type="button" className="dshb-btn dshb-btn-small dshb-btn-primary" disabled={prices === null}
                onClick={() => { if (prices !== null) void savePrices(prices) }}>{t('save')}</button>
            </div>
          )
          : null}
      </div>
      {timingOpen
        ? (
          <div className="dshb-timing-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setTimingOpen(false) }}>
            <div className="dshb-timing-dialog" role="dialog" aria-modal="true">
              <div className="dshb-timing-title">{t('timingTitle')}</div>
              <p className="dshb-hint">{t('timingHint')}</p>
              <label className="dshb-timing-field">
                {t('timingSeconds')}
                <input
                  className="dshb-input"
                  type="number"
                  min={1}
                  max={86400}
                  value={timingInput}
                  placeholder="60"
                  disabled={autoSeconds > 0}
                  onChange={(e) => setTimingInput(e.target.value)}
                />
              </label>
              {autoSeconds > 0
                ? <div className="dshb-timing-active">{t('timingActive', { n: String(autoSeconds) })}</div>
                : null}
              {timingErr !== '' ? <p className="dshb-err">{timingErr}</p> : null}
              <div className="dshb-timing-actions">
                <button
                  type="button"
                  className="dshb-btn dshb-btn-small dshb-btn-primary"
                  disabled={autoSeconds > 0}
                  onClick={() => {
                    const n = Number(String(timingInput).trim())
                    if (!Number.isFinite(n) || n <= 0 || n > 86400) {
                      setTimingErr(t('timingInvalid'))
                      return
                    }
                    void saveAutoSeconds(Math.round(n)).then((ok) => {
                      if (!ok) return
                      // 启动成功立即刷新一次，让效果可见；弹框保持打开。
                      void loadBalances(false)
                      void loadCost()
                    })
                  }}
                >{t('timingStart')}</button>
                <button
                  type="button"
                  className="dshb-btn dshb-btn-small"
                  disabled={autoSeconds <= 0}
                  onClick={() => {
                    void saveAutoSeconds(0)
                  }}
                >{t('timingStop')}</button>
                <button type="button" className="dshb-btn dshb-btn-small" onClick={() => setTimingOpen(false)}>{t('close')}</button>
              </div>
            </div>
          </div>
        )
        : null}
    </div>
  )
}
