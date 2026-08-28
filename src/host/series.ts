/**
 * dsh-get-balance —— 宿主半边：costSeries（费用 tab 图表数据链路）。
 *
 * 数据架构（历史聚合存储 + 当天实时，见 series-store.ts）：
 * - 历史日（< 今天）的图表数据按「本地日」持久化聚合（provider×model×workspace
 *   一组：peak/offPeak 分开的 token 四桶 + steps + 用途），不保存完整会话记录；
 * - 当天数据始终实时：每次请求解析今天的日志（内存缓存），覆盖写存储当天条目；
 * - 首次「全部」查询做一次全量回填（解析全部历史 → 按日聚合落盘，full=true），
 *   之后所有范围只做增量：每天首次查询回填 [coveredTo+1, 昨天]（含昨天尾部的
 *   修正），week7/month1 只回填各自窗口 —— 不再每次重复拉取宿主历史日志；
 * - 金额口径：仅官方 key（baseURL 域名 == api.deepseek.com）且模型精确/前缀命中
 *   价格档才计费（matchTier 的 '*' 通配兜底与 prices[0] 兜底不触发计费）；金额在
 *   查询时用当前价格档 × 存储的 peak/offPeak 桶现算（改价不影响历史桶）；
 * - 并发：同 (range, 配置) 请求 single-flight 合并为一次扫描；大范围首次回填
 *   每 ~150ms 让出事件循环，避免长时间冻结宿主。
 */

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { costOf, isOfficialProvider, isPeakTime, periodPricesOf } from './cost.ts'
import { getParsedFile, type FileRef, type FileSample } from './log-cache.ts'
import { loadSeriesStore, touchSeriesStore, type SeriesStoreFile, type StoredDay } from './series-store.ts'
import type { CostSeriesResult, PriceConfig, PriceTier, PurposeTokens, SeriesPoint, SeriesRecord, UsageBuckets } from './types.ts'

/** 支持的 range 值（ops.ts 据此校验）。 */
export const SERIES_RANGES = ['hour1', 'today', 'week7', 'month1', 'all'] as const

const MIN10 = 10 * 60_000
const HOUR = 60 * 60_000
const DAY = 24 * HOUR

/** 桶轴：固定长度，index = axisIndex(time)。startMs 为「本地时间当作 UTC」的移位帧值。 */
interface BucketAxis {
  bucket: 'min10' | 'hour' | 'day' | 'month'
  count: number
  /** 桶 0 起始（移位帧；真实 epoch = startMs - offsetMs）。 */
  startMs: number
  /** 桶宽（month 桶为 0，用 monthOf 差值）。 */
  bucketMs: number
  /** 真实 epoch 的时间过滤起点（hour1 = now-60min；日/月范围 = 本地零点；all = 0）。 */
  rangeStartMs: number
  offsetMs: number
}

/** 实时聚合中的一组（小时/10 分钟桶内 provider×model×workspace）。 */
interface Group {
  provider: string
  platform: string
  model: string
  workspace: string
  buckets: UsageBuckets
  amount: number
  official: boolean
  tier?: PriceTier
  steps: number
  purpose: PurposeTokens
  tokens: number
}

/** 按日聚合中的一组（peak/offPeak 分离，金额查询时现算）。 */
interface DayGroup {
  provider: string
  model: string
  workspace: string
  peak: UsageBuckets
  offPeak: UsageBuckets
  steps: number
  purpose: PurposeTokens
  tokens: number
}

const zeroBuckets = (): UsageBuckets => ({ uncachedInput: 0, cacheRead: 0, cacheWrite: 0, output: 0 })

/** 金额保留 6 位小数（与 token 单价的每百万口径精度匹配）。 */
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6

/** 四桶合计。 */
function totalTokens(b: UsageBuckets): number {
  return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output
}

function addBuckets(target: UsageBuckets, next: UsageBuckets): void {
  target.uncachedInput += next.uncachedInput
  target.cacheRead += next.cacheRead
  target.cacheWrite += next.cacheWrite
  target.output += next.output
}

/** sessions 根目录；解析失败（home 不可用）返回 undefined。 */
function sessionsRoot(): string | undefined {
  try {
    return dshHomePath('sessions')
  } catch {
    return undefined
  }
}

/** 平台名 = provider 的 baseURL 域名（api.deepseek.com / openrouter.ai …）；未配置 → 路由名。 */
function platformOf(provider: string, providerBaseUrls: Record<string, string>): string {
  const baseUrl = providerBaseUrls[provider]
  if (typeof baseUrl === 'string' && baseUrl.length > 0) {
    try {
      return new URL(baseUrl).hostname
    } catch {
      return provider
    }
  }
  return provider
}

/**
 * 价格档匹配（series 专用口径）：精确模型 id > 模型 id 前缀；
 * `match === '*'` 的兜底档与 prices[0] 兜底都**不算**（未配置定价 → 不计费）。
 */
function pricedTierOf(model: string | undefined, tiers: readonly PriceTier[]): PriceTier | undefined {
  const m = model ?? ''
  if (m.length > 0) {
    const exact = tiers.find((t) => t.match === m)
    if (exact !== undefined) return exact
    const prefix = tiers.find((t) => t.match !== '*' && t.match.length > 0 && m.startsWith(t.match))
    if (prefix !== undefined) return prefix
  }
  return undefined
}

/* ── 本地日工具（与 cost.ts 的时区口径一致：事件时间 + 配置偏移）── */

/** 移位帧下的本地日零点（Date.UTC 由本地日历分量构造）。 */
function shiftedDayStart(shiftedMs: number): number {
  const d = new Date(shiftedMs)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** 移位帧下的本地月首。 */
function shiftedMonthStart(shiftedMs: number): number {
  const d = new Date(shiftedMs)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

/** 移位帧下的「年月序号」（用于月桶差值）。 */
function monthOf(shiftedMs: number): number {
  const d = new Date(shiftedMs)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

/** 移位帧时间 → 本地日键 'YYYY-MM-DD'。 */
function dayKeyOf(shiftedMs: number): string {
  const d = new Date(shiftedMs)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

/** 本地日键 → 该日零点（真实 epoch）。 */
function dayStartOfKey(key: string, offsetMs: number): number {
  const parts = key.split('-').map(Number)
  return Date.UTC(parts[0] as number, (parts[1] as number) - 1, parts[2] as number) - offsetMs
}

/** 本地日键 ± n 天。 */
function dayAdd(key: string, n: number): string {
  const parts = key.split('-').map(Number)
  return dayKeyOf(Date.UTC(parts[0] as number, (parts[1] as number) - 1, parts[2] as number) + n * DAY)
}

/* ── 桶轴 ────────────────────────────────────────────────── */

/** 构造桶轴；「全部」依赖最早样本时间（minTime），其余由 now 直接确定。 */
function buildAxis(range: string, now: number, offsetMs: number, minTime: number): BucketAxis {
  const shiftedNow = now + offsetMs
  switch (range) {
    case 'hour1': {
      const start = Math.floor((shiftedNow - 60 * MIN10) / MIN10) * MIN10
      return { bucket: 'min10', count: 6, startMs: start, bucketMs: MIN10, rangeStartMs: now - 60 * MIN10, offsetMs }
    }
    case 'today': {
      const start = shiftedDayStart(shiftedNow)
      return { bucket: 'hour', count: 24, startMs: start, bucketMs: HOUR, rangeStartMs: start - offsetMs, offsetMs }
    }
    case 'week7': {
      const start = shiftedDayStart(shiftedNow) - 6 * DAY
      return { bucket: 'day', count: 7, startMs: start, bucketMs: DAY, rangeStartMs: start - offsetMs, offsetMs }
    }
    case 'month1': {
      const start = shiftedDayStart(shiftedNow) - 29 * DAY
      return { bucket: 'day', count: 30, startMs: start, bucketMs: DAY, rangeStartMs: start - offsetMs, offsetMs }
    }
    case 'all': {
      if (!Number.isFinite(minTime)) {
        return { bucket: 'day', count: 0, startMs: 0, bucketMs: DAY, rangeStartMs: 0, offsetMs }
      }
      const firstDay = shiftedDayStart(minTime + offsetMs)
      const lastDay = shiftedDayStart(shiftedNow)
      const days = Math.floor((lastDay - firstDay) / DAY) + 1
      if (days > 90) {
        const firstMonth = shiftedMonthStart(minTime + offsetMs)
        const lastMonth = shiftedMonthStart(shiftedNow)
        return { bucket: 'month', count: monthOf(lastMonth) - monthOf(firstMonth) + 1, startMs: firstMonth, bucketMs: 0, rangeStartMs: 0, offsetMs }
      }
      return { bucket: 'day', count: days, startMs: firstDay, bucketMs: DAY, rangeStartMs: 0, offsetMs }
    }
    default:
      return { bucket: 'day', count: 0, startMs: 0, bucketMs: DAY, rangeStartMs: 0, offsetMs }
  }
}

/** 桶 i 的起始（移位帧）；month 桶逐月推进。 */
function bucketStart(axis: BucketAxis, i: number): number {
  if (axis.bucket === 'month') {
    const base = new Date(axis.startMs)
    return Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, 1)
  }
  return axis.startMs + i * axis.bucketMs
}

/** 样本时间 → 桶下标；范围外返回 -1（超尾钳制到最后一桶）。 */
function axisIndex(axis: BucketAxis, timeMs: number): number {
  const shifted = timeMs + axis.offsetMs
  const idx = axis.bucket === 'month'
    ? monthOf(shifted) - monthOf(axis.startMs)
    : Math.floor((shifted - axis.startMs) / axis.bucketMs)
  if (idx < 0) return -1
  if (idx >= axis.count) return axis.count - 1
  return idx
}

/** 桶展示标签（08:00 / 02-12 / 2026-02）。 */
function pointLabel(bucket: BucketAxis['bucket'], shiftedMs: number): string {
  const d = new Date(shiftedMs)
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (bucket === 'min10' || bucket === 'hour') return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes())
  if (bucket === 'month') return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1)
  return pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

/* ── 实时聚合（hour1 / today 的小时桶）────────────────────── */

function groupOf(
  map: Map<string, Group>,
  provider: string,
  model: string,
  workspace: string,
  providerBaseUrls: Record<string, string>,
  tiers: readonly PriceTier[],
): Group {
  const key = provider + '\u0000' + model + '\u0000' + workspace
  let g = map.get(key)
  if (g === undefined) {
    const official = isOfficialProvider(provider, providerBaseUrls)
    const tier = official ? pricedTierOf(model === '*' ? undefined : model, tiers) : undefined
    g = {
      provider,
      platform: platformOf(provider, providerBaseUrls),
      model,
      workspace,
      buckets: zeroBuckets(),
      amount: 0,
      official,
      ...tier === undefined ? {} : { tier },
      steps: 0,
      purpose: { tool: 0, text: 0, reasoning: 0 },
      tokens: 0,
    }
    map.set(key, g)
  }
  return g
}

/** 遍历项目/会话目录收集日志文件（zstd 优先，明文兜底）。 */
function collectFiles(root: string | undefined): FileRef[] {
  if (root === undefined) return []
  const out: FileRef[] = []
  let projects: string[]
  try {
    projects = readdirSync(root)
  } catch {
    return out
  }
  for (const project of projects) {
    const projectDir = join(root, project)
    let names: string[]
    try {
      names = readdirSync(projectDir)
    } catch {
      continue
    }
    for (const name of names) {
      const dir = join(projectDir, name)
      const candidates: Array<{ path: string; isZstd: boolean }> = [
        { path: join(dir, 'session.jsonl.zstd'), isZstd: true },
        { path: join(dir, 'session.jsonl'), isZstd: false },
      ]
      for (const candidate of candidates) {
        let stat
        try {
          stat = statSync(candidate.path)
        } catch {
          continue
        }
        out.push({ path: candidate.path, isZstd: candidate.isZstd, mtimeMs: stat.mtimeMs, size: stat.size })
        break
      }
    }
  }
  return out
}

/**
 * 实时计算 hour1 / today（小时桶，纯当天日志，不读历史存储）。
 * @returns 结果 + 本次解析的样本（today 调用方用于覆盖写存储当天条目）。
 */
function computeLive(
  range: 'hour1' | 'today',
  now: number,
  offsetMs: number,
  root: string | undefined,
  config: PriceConfig,
  providerBaseUrls: Record<string, string>,
): { result: CostSeriesResult; samples: FileSample[] } {
  const coarseStart = range === 'hour1'
    ? now - 60 * MIN10
    : shiftedDayStart(now + offsetMs) - offsetMs
  const refs = collectFiles(root).filter((ref) => ref.mtimeMs >= coarseStart)
  const samples: FileSample[] = []
  for (const ref of refs) {
    const sample = getParsedFile(ref)
    if (sample !== undefined) samples.push(sample)
  }
  const axis = buildAxis(range, now, offsetMs, 0)
  const points: SeriesPoint[] = []
  for (let i = 0; i < axis.count; i++) {
    const start = bucketStart(axis, i)
    points.push({ ts: start - offsetMs, label: pointLabel(axis.bucket, start) })
  }
  const bucketsArr: Array<Map<string, Group>> = []
  for (let i = 0; i < axis.count; i++) bucketsArr.push(new Map())
  let currency = 'CNY'
  let currencySet = false
  for (const sample of samples) {
    const workspace = sample.cwd ?? ''
    for (const st of sample.steps) {
      if (st.time < axis.rangeStartMs) continue
      const idx = axisIndex(axis, st.time)
      if (idx < 0) continue
      const g = groupOf(bucketsArr[idx] as Map<string, Group>, st.provider, st.model, workspace, providerBaseUrls, config.tiers)
      g.steps += 1
    }
    for (const u of sample.usages) {
      if (u.time < axis.rangeStartMs) continue
      const idx = axisIndex(axis, u.time)
      if (idx < 0) continue
      const g = groupOf(bucketsArr[idx] as Map<string, Group>, u.provider, u.model, workspace, providerBaseUrls, config.tiers)
      addBuckets(g.buckets, u.buckets)
      g.purpose.tool += u.purpose.tool
      g.purpose.text += u.purpose.text
      g.purpose.reasoning += u.purpose.reasoning
      g.tokens += totalTokens(u.buckets)
      if (g.official && g.tier !== undefined) {
        if (!currencySet && g.tier.currency !== '') {
          currency = g.tier.currency
          currencySet = true
        }
        g.amount += costOf(u.buckets, periodPricesOf(g.tier, u.time, config))
      }
    }
  }
  const records: SeriesRecord[][] = bucketsArr.map((m) => [...m.values()]
    .filter((g) => g.tokens > 0 || g.steps > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .map((g) => ({
      provider: g.provider,
      platform: g.platform,
      model: g.model,
      workspace: g.workspace,
      buckets: { ...g.buckets },
      amount: round6(g.amount),
      priced: g.official && g.tier !== undefined,
      steps: g.steps,
      purpose: { ...g.purpose },
    })))
  return {
    result: { range: range as CostSeriesResult['range'], bucket: axis.bucket, points, records, currency },
    samples,
  }
}

/* ── 按日聚合（历史存储的构建单元）────────────────────────── */

/** 取（或新建）某天聚合表内的一组。 */
function dayGroupOf(groups: Map<string, DayGroup>, provider: string, model: string, workspace: string): DayGroup {
  const key = provider + '\u0000' + model + '\u0000' + workspace
  let g = groups.get(key)
  if (g === undefined) {
    g = {
      provider,
      model,
      workspace,
      peak: zeroBuckets(),
      offPeak: zeroBuckets(),
      steps: 0,
      purpose: { tool: 0, text: 0, reasoning: 0 },
      tokens: 0,
    }
    groups.set(key, g)
  }
  return g
}

/**
 * 把一批样本按「本地日」聚合（每个样本按自身时间归入所在日；peak/offPeak 按时段
 * 拆开 —— 金额用当前价格档现算，改价不改历史桶）。返回 日键 → 聚合组。
 */
async function collectDayGroups(
  root: string | undefined,
  parseFromMs: number,
  parseFromKey: string | undefined,
  needToKey: string,
  offsetMs: number,
  config: PriceConfig,
): Promise<Map<string, Map<string, DayGroup>>> {
  const refs = collectFiles(root).filter((ref) => ref.mtimeMs >= parseFromMs)
  const dayMaps = new Map<string, Map<string, DayGroup>>()
  let lastYieldAt = Date.now()
  for (const ref of refs) {
    const sample = getParsedFile(ref)
    if (sample === undefined) continue
    const workspace = sample.cwd ?? ''
    for (const st of sample.steps) {
      if (st.time < parseFromMs) continue
      const key = dayKeyOf(st.time + offsetMs)
      if (parseFromKey !== undefined && key < parseFromKey) continue
      if (key > needToKey) continue
      dayGroupOf(dayGroupsOf(dayMaps, key), st.provider, st.model, workspace).steps += 1
    }
    for (const u of sample.usages) {
      if (u.time < parseFromMs) continue
      const key = dayKeyOf(u.time + offsetMs)
      if (parseFromKey !== undefined && key < parseFromKey) continue
      if (key > needToKey) continue
      const g = dayGroupOf(dayGroupsOf(dayMaps, key), u.provider, u.model, workspace)
      const peak = isPeakTime(u.time, config)
      addBuckets(peak ? g.peak : g.offPeak, u.buckets)
      g.purpose.tool += u.purpose.tool
      g.purpose.text += u.purpose.text
      g.purpose.reasoning += u.purpose.reasoning
      g.tokens += totalTokens(u.buckets)
    }
    // 首次大范围回填是唯一的重活：每 ~150ms 让出事件循环，避免冻结宿主服务。
    if (Date.now() - lastYieldAt > 150) {
      lastYieldAt = Date.now()
      await new Promise((resolve) => setImmediate(resolve))
    }
  }
  return dayMaps
}

/** 取（或新建）某天的聚合表。 */
function dayGroupsOf(dayMaps: Map<string, Map<string, DayGroup>>, dayKey: string): Map<string, DayGroup> {
  let groups = dayMaps.get(dayKey)
  if (groups === undefined) {
    groups = new Map()
    dayMaps.set(dayKey, groups)
  }
  return groups
}

/** DayGroup → 存储紧凑格式。 */
function storedOf(groups: Iterable<DayGroup>): StoredDay['g'] {
  return [...groups].map((g) => ({
    p: g.provider,
    m: g.model,
    w: g.workspace,
    pk: [g.peak.uncachedInput, g.peak.cacheRead, g.peak.cacheWrite, g.peak.output],
    op: [g.offPeak.uncachedInput, g.offPeak.cacheRead, g.offPeak.cacheWrite, g.offPeak.output],
    st: g.steps,
    pt: [g.purpose.tool, g.purpose.text, g.purpose.reasoning],
    tk: g.tokens,
  }))
}

/** 存储紧凑格式 → DayGroup。 */
function decodeStoredDay(day: StoredDay | undefined): DayGroup[] {
  if (day === undefined) return []
  return day.g.map((sg) => ({
    provider: sg.p,
    model: sg.m,
    workspace: sg.w,
    peak: { uncachedInput: sg.pk[0], cacheRead: sg.pk[1], cacheWrite: sg.pk[2], output: sg.pk[3] },
    offPeak: { uncachedInput: sg.op[0], cacheRead: sg.op[1], cacheWrite: sg.op[2], output: sg.op[3] },
    steps: sg.st,
    purpose: { tool: sg.pt[0], text: sg.pt[1], reasoning: sg.pt[2] },
    tokens: sg.tk,
  }))
}

/** 一天的聚合组 → 图表记录（金额用当前价格档 × peak/offPeak 现算）。 */
function dayGroupsToRecords(
  groups: Iterable<DayGroup>,
  providerBaseUrls: Record<string, string>,
  tiers: readonly PriceTier[],
): { records: SeriesRecord[]; currency: string } {
  const records: SeriesRecord[] = []
  let currency = ''
  for (const g of groups) {
    if (g.tokens <= 0 && g.steps <= 0) continue
    const official = isOfficialProvider(g.provider, providerBaseUrls)
    const tier = official ? pricedTierOf(g.model === '*' ? undefined : g.model, tiers) : undefined
    const amount = official && tier !== undefined
      ? costOf(g.peak, tier.peak) + costOf(g.offPeak, tier.offPeak)
      : 0
    if (official && tier !== undefined && currency === '' && tier.currency !== '') {
      currency = tier.currency
    }
    records.push({
      provider: g.provider,
      platform: platformOf(g.provider, providerBaseUrls),
      model: g.model,
      workspace: g.workspace,
      buckets: {
        uncachedInput: g.peak.uncachedInput + g.offPeak.uncachedInput,
        cacheRead: g.peak.cacheRead + g.offPeak.cacheRead,
        cacheWrite: g.peak.cacheWrite + g.offPeak.cacheWrite,
        output: g.peak.output + g.offPeak.output,
      },
      amount: round6(amount),
      priced: official && tier !== undefined,
      steps: g.steps,
      purpose: { ...g.purpose },
    })
  }
  records.sort((a, b) =>
    (b.buckets.uncachedInput + b.buckets.cacheRead + b.buckets.cacheWrite + b.buckets.output)
    - (a.buckets.uncachedInput + a.buckets.cacheRead + a.buckets.cacheWrite + a.buckets.output))
  return { records, currency }
}

/* ── 历史覆盖（增量回填）──────────────────────────────────── */

/** 一次回填的窗口判定（ensureCoverage 与 seriesBackfillInfo 共用同一口径）。 */
interface BackfillWindow {
  /** 实际需要解析的窗口起点（day key；undefined = 无需解析日志）。 */
  parseFromKey?: string
  /** 实际需要解析的窗口起点（epoch ms；与 parseFromKey 同时出现）。 */
  parseFromMs?: number
}

/**
 * 计算 [needFromKey, needToKey]（needTo 恒为昨天）相对当前存储的覆盖缺口：
 * - 返回 null：已覆盖，无需任何动作；
 * - parseFromKey undefined：只需把 coveredFrom 延伸到 needFromKey（全量回填后
 *   的底部缺口 —— 覆盖起点之前的日无数据，全量回填已捕获全部，重扫是浪费）；
 * - 其余：解析 [parseFromKey, needToKey] 窗口（含上次「今天」的尾部修正）。
 */
function backfillWindow(store: SeriesStoreFile, needFromKey: string, needToKey: string, offsetMs: number): BackfillWindow | null {
  const haveFrom = store.coveredFrom
  const haveTo = store.coveredTo
  if (haveFrom !== undefined && haveTo !== undefined && haveFrom <= needFromKey && haveTo >= needToKey) {
    return null // 已覆盖
  }
  if (store.full === true && haveFrom !== undefined && haveTo !== undefined && haveFrom > needFromKey) {
    // 全量回填后的底部缺口：只需延伸标记；顶部缺口照常解析。
    if (haveTo >= needToKey) return { }
    const parseFromKey = dayAdd(haveTo, 1)
    if (parseFromKey > needToKey) return { }
    return { parseFromKey, parseFromMs: dayStartOfKey(parseFromKey, offsetMs) }
  }
  let parseFromKey: string
  if (haveFrom !== undefined && haveFrom <= needFromKey && haveTo !== undefined && haveTo >= needFromKey) {
    parseFromKey = dayAdd(haveTo, 1) // 底部已覆盖到 needFrom，只补顶部（含昨天尾部修正）
  } else {
    parseFromKey = needFromKey // 底部缺口或完全没有覆盖
  }
  if (parseFromKey > needToKey) return { }
  return { parseFromKey, parseFromMs: dayStartOfKey(parseFromKey, offsetMs) }
}

/**
 * 确保存储已覆盖 [needFromKey, needToKey]（needTo 恒为昨天）。未覆盖的窗口
 * 解析 mtime 在该窗口起点之后的日志，按日聚合后覆盖写存储。窗口内含上次
 * 「今天」的部分数据（尾部修正），已完整覆盖的日不被重扫。
 */
async function ensureCoverage(
  store: SeriesStoreFile,
  needFromKey: string,
  needToKey: string,
  root: string | undefined,
  offsetMs: number,
  config: PriceConfig,
): Promise<void> {
  const win = backfillWindow(store, needFromKey, needToKey, offsetMs)
  if (win === null) return // 已覆盖
  if (win.parseFromKey === undefined) {
    // 仅延伸覆盖标记（全量回填后的底部缺口）：不解析日志。
    if (store.coveredFrom === undefined || store.coveredFrom > needFromKey) store.coveredFrom = needFromKey
    store.coveredTo = needToKey
    touchSeriesStore()
    return
  }
  const dayMaps = await collectDayGroups(root, win.parseFromMs as number, win.parseFromKey, needToKey, offsetMs, config)
  for (const [key, groups] of dayMaps) {
    store.days[key] = { g: storedOf(groups.values()) }
  }
  if (store.coveredFrom === undefined || store.coveredFrom > needFromKey) store.coveredFrom = needFromKey
  store.coveredTo = needToKey
  touchSeriesStore()
}

/** 首次「全部」查询的全量回填：解析全部历史，按日聚合落盘。 */
async function backfillAll(
  store: SeriesStoreFile,
  root: string | undefined,
  offsetMs: number,
  todayKey: string,
  toKey: string,
  config: PriceConfig,
): Promise<void> {
  const dayMaps = await collectDayGroups(root, 0, undefined, toKey, offsetMs, config)
  let earliest: string | undefined
  for (const [key, groups] of dayMaps) {
    store.days[key] = { g: storedOf(groups.values()) }
    if (earliest === undefined || key < earliest) earliest = key
  }
  store.full = true
  store.coveredFrom = earliest ?? todayKey
  store.coveredTo = toKey
  touchSeriesStore()
}

/** 把某月的所有日聚合组合并为一组（all 跨度 > 90 天的月桶）。 */
function mergeMonthGroups(
  store: SeriesStoreFile,
  todayKey: string,
  todayGroups: Map<string, DayGroup>,
  monthIdx: number,
  axis: BucketAxis,
  offsetMs: number,
): Map<string, DayGroup> {
  const merged = new Map<string, DayGroup>()
  const add = (groups: Iterable<DayGroup>): void => {
    for (const g of groups) {
      const t = dayGroupOf(merged, g.provider, g.model, g.workspace)
      addBuckets(t.peak, g.peak)
      addBuckets(t.offPeak, g.offPeak)
      t.steps += g.steps
      t.purpose.tool += g.purpose.tool
      t.purpose.text += g.purpose.text
      t.purpose.reasoning += g.purpose.reasoning
      t.tokens += g.tokens
    }
  }
  const base = monthOf(axis.startMs)
  for (const [key, day] of Object.entries(store.days)) {
    if (monthOf(dayStartOfKey(key, offsetMs) + offsetMs) - base !== monthIdx) continue
    add(decodeStoredDay(day))
  }
  if (monthOf(dayStartOfKey(todayKey, offsetMs) + offsetMs) - base === monthIdx) {
    add(todayGroups.values())
  }
  return merged
}

/* ── 计算入口（single-flight）──────────────────────────────── */

/** computeSeries 的可选参数。 */
export interface SeriesComputeOptions {
  /**
   * 持久化存储文件路径；null = 仅内存（测试注入用）；
   * 缺省 $DSH_HOME/dsh-get-balance-series-store.json。
   */
  storePath?: string | null
}

/** single-flight：并发同 (range, 配置) 请求合并为一次扫描。 */
const seriesInFlight = new Map<string, Promise<CostSeriesResult>>()

/** 配置指纹（价格档 + 时区 + 高峰窗口 + provider baseURL），用于 single-flight 键。 */
function seriesConfigKey(config: PriceConfig, providerBaseUrls: Record<string, string>): string {
  return JSON.stringify({
    tiers: config.tiers,
    offset: config.timezoneOffsetMinutes,
    windows: config.peakWindows,
    weekend: config.weekendOffPeak === true,
    providers: providerBaseUrls,
  })
}

/**
 * 计算费用 tab 图表数据（costSeries）。
 * @param range - 'hour1' | 'today' | 'week7' | 'month1' | 'all'（非法值由 ops.ts 拦截）。
 * @param config - 完整价格配置。
 * @param providerBaseUrls - provider 路由 → baseURL（平台名与官方判定）。
 * @param rootOverride - 测试注入的 sessions 根目录；缺省 dshHomePath('sessions')。
 * @param opts - 存储选项（持久化存储路径；测试注入 root 时缺省为仅内存）。
 */
export async function computeSeries(
  range: string,
  config: PriceConfig,
  providerBaseUrls: Record<string, string>,
  rootOverride?: string,
  opts?: SeriesComputeOptions,
): Promise<CostSeriesResult> {
  // 测试注入 root 时默认不落盘（避免测试写真实 $DSH_HOME）。
  const storePath = rootOverride !== undefined && opts?.storePath === undefined ? null : opts?.storePath
  const flightKey = range + '\u0000' + seriesConfigKey(config, providerBaseUrls)
  const inFlight = seriesInFlight.get(flightKey)
  if (inFlight !== undefined) return inFlight
  const promise = doComputeSeries(range, config, providerBaseUrls, rootOverride, storePath)
  seriesInFlight.set(flightKey, promise)
  try {
    return await promise
  } finally {
    if (seriesInFlight.get(flightKey) === promise) seriesInFlight.delete(flightKey)
  }
}

/** computeSeries 的实际执行体（single-flight 合并后只有一个实例在跑）。 */
async function doComputeSeries(
  range: string,
  config: PriceConfig,
  providerBaseUrls: Record<string, string>,
  rootOverride: string | undefined,
  storePath: string | null | undefined,
): Promise<CostSeriesResult> {
  const store = await loadSeriesStore(storePath)
  const now = Date.now()
  const offsetMs = config.timezoneOffsetMinutes * 60_000
  const root = rootOverride ?? sessionsRoot()
  const todayKey = dayKeyOf(now + offsetMs)
  const yesterdayKey = dayAdd(todayKey, -1)
  const todayStart = shiftedDayStart(now + offsetMs) - offsetMs

  // 实时范围：hour1 / today（当天日志，内存缓存解析；today 顺带覆盖写存储当天条目）。
  if (range === 'hour1') {
    const { result } = computeLive('hour1', now, offsetMs, root, config, providerBaseUrls)
    return result
  }
  if (range === 'today') {
    const { result, samples } = computeLive('today', now, offsetMs, root, config, providerBaseUrls)
    const todayGroups = aggregateDayGroups(samples, todayStart, Infinity, config)
    store.days[todayKey] = { g: storedOf(todayGroups.values()) }
    touchSeriesStore()
    return result
  }

  // 历史范围：先保证存储覆盖（首次「全部」全量回填；其余窗口增量回填）。
  if (range === 'all') {
    if (store.full !== true) {
      await backfillAll(store, root, offsetMs, todayKey, yesterdayKey, config)
    } else {
      await ensureCoverage(store, store.coveredFrom ?? todayKey, yesterdayKey, root, offsetMs, config)
    }
  } else {
    const needFromKey = dayAdd(todayKey, range === 'week7' ? -6 : -29)
    await ensureCoverage(store, needFromKey, yesterdayKey, root, offsetMs, config)
  }

  // 当天实时聚合（历史范围的今天桶 + 覆盖写存储当天条目）。
  const todayRefs = collectFiles(root).filter((ref) => ref.mtimeMs >= todayStart)
  const todaySamples: FileSample[] = []
  for (const ref of todayRefs) {
    const sample = getParsedFile(ref)
    if (sample !== undefined) todaySamples.push(sample)
  }
  const todayGroups = aggregateDayGroups(todaySamples, todayStart, Infinity, config)
  store.days[todayKey] = { g: storedOf(todayGroups.values()) }
  touchSeriesStore()

  // 轴：week7/month1 由 now 定；all 依赖最早一天。
  let minTime: number
  if (range === 'all') {
    const dayKeys = Object.keys(store.days)
    const earliestKey = dayKeys.length > 0 ? dayKeys.reduce((a, b) => (a < b ? a : b)) : todayKey
    minTime = dayKeys.length > 0 || todaySamples.length > 0 ? dayStartOfKey(earliestKey, offsetMs) : Infinity
  } else {
    minTime = 0
  }
  const axis = buildAxis(range, now, offsetMs, minTime)
  const points: SeriesPoint[] = []
  for (let i = 0; i < axis.count; i++) {
    const start = bucketStart(axis, i)
    points.push({ ts: start - offsetMs, label: pointLabel(axis.bucket, start) })
  }

  // 记录：日桶从存储（历史）+ 当天实时；月桶（all 跨度 > 90 天）合并日聚合。
  const records: SeriesRecord[][] = []
  let currency = ''
  for (let i = 0; i < axis.count; i++) {
    const start = bucketStart(axis, i)
    if (axis.bucket === 'month') {
      const groups = mergeMonthGroups(store, todayKey, todayGroups, monthOf(start) - monthOf(axis.startMs), axis, offsetMs)
      const out = dayGroupsToRecords(groups.values(), providerBaseUrls, config.tiers)
      records.push(out.records)
      if (currency === '' && out.currency !== '') currency = out.currency
    } else {
      const key = dayKeyOf(start)
      const groups = key === todayKey ? todayGroups.values() : decodeStoredDay(store.days[key])
      const out = dayGroupsToRecords(groups, providerBaseUrls, config.tiers)
      records.push(out.records)
      if (currency === '' && out.currency !== '') currency = out.currency
    }
  }

  return { range: range as CostSeriesResult['range'], bucket: axis.bucket, points, records, currency: currency || 'CNY' }
}

/** 把当天样本聚合为一天一组（dayStart 起至未来）。 */
function aggregateDayGroups(
  samples: Iterable<FileSample>,
  dayStartMs: number,
  dayEndMs: number,
  config: PriceConfig,
): Map<string, DayGroup> {
  const groups = new Map<string, DayGroup>()
  for (const sample of samples) {
    const workspace = sample.cwd ?? ''
    for (const st of sample.steps) {
      if (st.time < dayStartMs || st.time >= dayEndMs) continue
      dayGroupOf(groups, st.provider, st.model, workspace).steps += 1
    }
    for (const u of sample.usages) {
      if (u.time < dayStartMs || u.time >= dayEndMs) continue
      const g = dayGroupOf(groups, u.provider, u.model, workspace)
      const peak = isPeakTime(u.time, config)
      addBuckets(peak ? g.peak : g.offPeak, u.buckets)
      g.purpose.tool += u.purpose.tool
      g.purpose.text += u.purpose.text
      g.purpose.reasoning += u.purpose.reasoning
      g.tokens += totalTokens(u.buckets)
    }
  }
  return groups
}

/* ── 首次回填探测（客户端确认弹框前的只读预检）───────────────── */

/** 需要确认的一次性回填的最小日志量（字节）：小于该量说明回填很快，不打扰用户。 */
const BACKFILL_CONFIRM_MIN_BYTES = 10 * 1024 * 1024

/** seriesBackfillInfo op 的返回载荷。 */
export interface SeriesBackfillInfo {
  /** 是否即将触发需要确认的一次性回填（首次全量 / 窗口首次回填 / 缺口回填）。 */
  pending: boolean
  /** 回填窗口内日志总大小（压缩后字节；0 = 无回填），用于提示文案。 */
  windowBytes: number
  /** 是否「全部」范围的全量回填（首次全量，耗时最长）。 */
  full: boolean
}

/**
 * 只读预检：判断请求该 range 是否会触发一次性长回填（不执行回填、不写存储）。
 * 常规每日增量（覆盖只差昨天一天）不算 —— 那是一次性快操作，直接加载即可；
 * 全量回填后的底部缺口只需延伸覆盖标记、不解析日志，同样不算。
 * 与 ensureCoverage / backfillAll 用同一套覆盖判定口径，避免预检与真实回填不一致。
 */
export async function seriesBackfillInfo(
  range: string,
  config: PriceConfig,
  rootOverride?: string,
  opts?: SeriesComputeOptions,
): Promise<SeriesBackfillInfo> {
  // 测试注入 root 时同样走内存存储（与 computeSeries 一致）。
  const storePath = rootOverride !== undefined && opts?.storePath === undefined ? null : opts?.storePath
  // 实时范围从不回填历史。
  if (range === 'hour1' || range === 'today') return { pending: false, windowBytes: 0, full: false }
  const store = await loadSeriesStore(storePath)
  const now = Date.now()
  const offsetMs = config.timezoneOffsetMinutes * 60_000
  const root = rootOverride ?? sessionsRoot()
  const todayKey = dayKeyOf(now + offsetMs)
  const needToKey = dayAdd(todayKey, -1)

  // 「全部」首次：全量回填（窗口 = 全部日志）。
  if (range === 'all' && store.full !== true) {
    const refs = collectFiles(root)
    const bytes = refs.reduce((s, r) => s + r.size, 0)
    return { pending: bytes > BACKFILL_CONFIRM_MIN_BYTES, windowBytes: bytes, full: true }
  }

  const needFromKey = range === 'all' ? store.coveredFrom ?? todayKey : dayAdd(todayKey, range === 'week7' ? -6 : -29)
  const win = backfillWindow(store, needFromKey, needToKey, offsetMs)
  if (win === null || win.parseFromKey === undefined) {
    // 已覆盖，或只需延伸覆盖标记（不解析日志）→ 无需确认。
    return { pending: false, windowBytes: 0, full: false }
  }
  // 常规每日增量：回填窗口恰好只有昨天一天（无论底部是否已覆盖）→ 不打扰。
  const routineTail = win.parseFromKey === needToKey
  if (routineTail) return { pending: false, windowBytes: 0, full: false }

  const parseFromMs = win.parseFromMs as number
  const refs = collectFiles(root).filter((r) => r.mtimeMs >= parseFromMs)
  const bytes = refs.reduce((s, r) => s + r.size, 0)
  return { pending: bytes > BACKFILL_CONFIRM_MIN_BYTES, windowBytes: bytes, full: false }
}
