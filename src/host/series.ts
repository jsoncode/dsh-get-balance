/**
 * dsh-get-balance —— 宿主半边：costSeries（费用 tab 图表数据链路）。
 *
 * 与 cost.ts 的「四类汇总」不同，本模块面向时间序列图表：
 * - 扫描 dshHomePath('sessions') 下全部会话日志（mtime >= 范围起点粗筛），
 *   只解析三类事件：request/context（model/provider 就近追踪）、step/end
 *   （请求次数，含失败/中断步）、assistant/message（usage + 用途分类）；
 * - 按配置时区把样本分桶（近一小时=10 分钟 / 今天=小时 / 近七天=天 /
 *   近一个月=天 / 全部=天，跨度 > 90 天自动按月），每桶内按
 *   (provider, model, workspace) 聚合，返回固定桶轴 + 记录数组，
 *   API Key / 平台 / 模型筛选与五张图的全部堆叠组合由浏览器侧本地完成；
 * - 金额口径（与 cost.ts 刻意不同）：仅官方 key（baseURL 域名 ==
 *   api.deepseek.com）且模型精确/前缀命中价格档才计费（matchTier 的 '*'
 *   通配兜底与 prices[0] 兜底不触发计费）；未命中 → amount=0、priced=false，
 *   记录照常返回（费用图归入「未计费」层）。时段单价沿用 isPeakTime +
 *   档位 peak/offPeak，按样本自身时间判时段。
 *
 * 文件级缓存：只缓存「解压 + 解析后的样本列表」（不含金额 —— 金额与价格
 * 配置相关，聚合时现算，价格改动无需失效）；mtime/size 变化即重扫。
 */

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { costOf, decodeLog, isOfficialProvider, isPeakTime, periodPricesOf } from './cost.ts'
import type { CostSeriesResult, PriceConfig, PriceTier, PurposeTokens, SeriesPoint, SeriesRecord, UsageBuckets } from './types.ts'

/** 支持的 range 值（ops.ts 据此校验）。 */
export const SERIES_RANGES = ['hour1', 'today', 'week7', 'month1', 'all'] as const

const MIN10 = 10 * 60_000
const HOUR = 60 * 60_000
const DAY = 24 * HOUR

/** 一个 step/end 样本（仅计数）。 */
interface StepSample {
  time: number
  provider: string
  model: string
}

/** 一个 assistant/message 样本（token + 用途）。 */
interface UsageSample {
  time: number
  provider: string
  model: string
  buckets: UsageBuckets
  purpose: PurposeTokens
}

/** 单个日志文件解析后的缓存载荷（不含金额）。 */
interface FileSample {
  cwd?: string
  steps: StepSample[]
  usages: UsageSample[]
}

/** 一个日志文件的引用（stat 结果）。 */
interface FileRef {
  path: string
  isZstd: boolean
  mtimeMs: number
}

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

/** 聚合中的一组（桶内 provider×model×workspace）。 */
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

/** 文件级解析缓存：mtime+size 未变则复用（与 cost.ts todayFileCache 同思路，但缓存原始样本）。 */
const seriesFileCache = new Map<string, { mtimeMs: number; size: number; sample: FileSample }>()

const zeroBuckets = (): UsageBuckets => ({ uncachedInput: 0, cacheRead: 0, cacheWrite: 0, output: 0 })

const numberOr = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

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

/* ── 日志解析 ─────────────────────────────────────────────── */

interface UsageLike {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/**
 * 解析一个日志文件为样本列表（header cwd + step/end 计数 + assistant/message 用量）。
 * 用途分类：该步 assistant 消息的 content 部件含 tool-call → 工具调用；否则含 text
 * → 文本回复；否则 → 纯推理（整步四桶合计归入该类 —— token 粒度只到步骤）。
 */
function parseFileSteps(path: string, isZstd: boolean): FileSample | undefined {
  const text = decodeLog(path, isZstd)
  if (text === undefined) return undefined
  const sample: FileSample = { steps: [], usages: [] }
  let currentModel: string | undefined
  let currentProvider: string | undefined
  let first = true
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      continue
    }
    if (first) {
      first = false
      if (parsed.type === 'session' && typeof parsed.cwd === 'string') sample.cwd = parsed.cwd
      continue
    }
    if (parsed.type === 'request/context') {
      const data = parsed.data as { model?: unknown; provider?: unknown } | undefined
      if (typeof data?.model === 'string' && data.model.length > 0) currentModel = data.model
      if (typeof data?.provider === 'string' && data.provider.length > 0) currentProvider = data.provider
      continue
    }
    if (parsed.type === 'step/end') {
      if (typeof parsed.time === 'number' && Number.isFinite(parsed.time)) {
        sample.steps.push({ time: parsed.time, provider: currentProvider ?? 'unknown', model: currentModel ?? '*' })
      }
      continue
    }
    if (parsed.type !== 'assistant/message') continue
    if (typeof parsed.time !== 'number' || !Number.isFinite(parsed.time)) continue
    const data = parsed.data as { usage?: UsageLike; message?: { content?: Array<{ type?: string }> } } | undefined
    const usage = data?.usage
    if (usage === undefined) continue
    const buckets: UsageBuckets = {
      uncachedInput: numberOr(usage.inputTokens),
      cacheRead: numberOr(usage.cacheReadTokens),
      cacheWrite: numberOr(usage.cacheWriteTokens),
      output: numberOr(usage.outputTokens),
    }
    const parts = data?.message?.content ?? []
    const total = totalTokens(buckets)
    const purpose: PurposeTokens = parts.some((p) => p.type === 'tool-call')
      ? { tool: total, text: 0, reasoning: 0 }
      : parts.some((p) => p.type === 'text')
        ? { tool: 0, text: total, reasoning: 0 }
        : { tool: 0, text: 0, reasoning: total }
    sample.usages.push({ time: parsed.time, provider: currentProvider ?? 'unknown', model: currentModel ?? '*', buckets, purpose })
  }
  return sample
}

/** 读取（含缓存命中）一个日志文件的样本。 */
function ensureParsed(ref: FileRef): FileSample | undefined {
  const cached = seriesFileCache.get(ref.path)
  let stat
  try {
    stat = statSync(ref.path)
  } catch {
    return undefined
  }
  if (cached !== undefined && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.sample
  }
  const sample = parseFileSteps(ref.path, ref.isZstd)
  if (sample !== undefined) {
    seriesFileCache.set(ref.path, { mtimeMs: stat.mtimeMs, size: stat.size, sample })
  }
  return sample
}

/* ── 桶轴 ────────────────────────────────────────────────── */

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

/* ── 聚合 ─────────────────────────────────────────────────── */

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
        out.push({ path: candidate.path, isZstd: candidate.isZstd, mtimeMs: stat.mtimeMs })
        break
      }
    }
  }
  return out
}

/**
 * 计算费用 tab 图表数据（costSeries）。
 * @param range - 'hour1' | 'today' | 'week7' | 'month1' | 'all'（非法值由 ops.ts 拦截）。
 * @param config - 完整价格配置。
 * @param providerBaseUrls - provider 路由 → baseURL（平台名与官方判定）。
 * @param rootOverride - 测试注入的 sessions 根目录；缺省 dshHomePath('sessions')。
 */
export async function computeSeries(
  range: string,
  config: PriceConfig,
  providerBaseUrls: Record<string, string>,
  rootOverride?: string,
): Promise<CostSeriesResult> {
  const now = Date.now()
  const offsetMs = config.timezoneOffsetMinutes * 60_000
  const root = rootOverride ?? sessionsRoot()

  // mtime 粗筛起点（真实 epoch；「全部」不过滤）。
  let coarseStart = 0
  if (range !== 'all') {
    const shiftedNow = now + offsetMs
    const todayStart = shiftedDayStart(shiftedNow) - offsetMs
    if (range === 'hour1') coarseStart = now - 60 * MIN10
    else if (range === 'today') coarseStart = todayStart
    else if (range === 'week7') coarseStart = todayStart - 6 * DAY
    else if (range === 'month1') coarseStart = todayStart - 29 * DAY
  }
  const refs = collectFiles(root).filter((ref) => ref.mtimeMs >= coarseStart)

  // 解析（缓存命中）并收集最早样本时间（「全部」的桶轴依赖它）。
  const samples: FileSample[] = []
  let minTime = Infinity
  for (const ref of refs) {
    const sample = ensureParsed(ref)
    if (sample === undefined) continue
    samples.push(sample)
    for (const st of sample.steps) if (st.time < minTime) minTime = st.time
    for (const u of sample.usages) if (u.time < minTime) minTime = u.time
  }

  const axis = buildAxis(range, now, offsetMs, minTime)
  const points: SeriesPoint[] = []
  for (let i = 0; i < axis.count; i++) {
    const start = bucketStart(axis, i)
    points.push({ ts: start - offsetMs, label: pointLabel(axis.bucket, start) })
  }

  // 分桶聚合。
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

  return { range: range as CostSeriesResult['range'], bucket: axis.bucket, points, records, currency }
}
