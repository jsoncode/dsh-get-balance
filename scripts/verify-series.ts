/**
 * dsh-get-balance —— 用临时目录伪造会话日志驱动 computeSeries，验证 costSeries
 * 数据链路的正确性：
 *   - 桶轴：近一小时=6 桶 / 今天=24 桶 / 近七天=7 桶 / 近一个月=30 桶 / 全部=日桶（跨天）；
 *   - 金额：官方 key 且命中价格档 > 0；非官方平台 = 0 且 priced=false；官方但未配置
 *     定价的模型 = 0 且 priced=false（「未计费」层数据）；
 *   - 用途拆分：tool-call / text / reasoning 三类步的 token 整步归入对应类别；
 *   - 缓存拆分：cacheRead 与 uncachedInput+cacheWrite 分别累计；
 *   - steps：step/end 计数（含无 usage 的失败步）；
 *   - 工作区：记录 workspace = 日志 header cwd；
 *   - 平台名：非官方平台记录 platform = baseURL 域名；
 *   - 缓存失效：追加事件（mtime/size 变化）后再次扫描 token 增加；
 *   - range 非法：runOp 返回 params-invalid。
 *
 * 运行：pnpm exec tsx scripts/verify-series.ts
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_PRICE_CONFIG, type PriceConfig } from '../src/host/cost.ts'
import { computeSeries, SERIES_RANGES } from '../src/host/series.ts'
import { runOp } from '../src/host/ops.ts'

const MIN = 60_000
const DAY = 24 * 60 * MIN
// 测试用配置：时区偏移 0（本地 = UTC），便于推算桶边界。
const config: PriceConfig = { ...DEFAULT_PRICE_CONFIG, timezoneOffsetMinutes: 0 }

const providerBaseUrls: Record<string, string> = {
  'deepseek-official': 'https://api.deepseek.com',
  'openrouter': 'https://openrouter.ai',
}

/** 今日零点（真实 epoch，本地=UTC）。 */
function todayStart(now: number): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

let failures = 0
function assert(cond: boolean, label: string): void {
  if (cond) console.log(`  ok   ${label}`)
  else { failures += 1; console.error(`  FAIL ${label}`) }
}

function usage(input: number, output: number, cacheRead = 0, cacheWrite = 0): string {
  return JSON.stringify({ inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite })
}

function writeFixture(root: string, now: number): void {
  const t0 = todayStart(now)
  const projA = join(root, 'proj-a')
  const projB = join(root, 'proj-b')
  mkdirSync(join(projA, 's1'), { recursive: true })
  mkdirSync(join(projB, 's2'), { recursive: true })

  // s1：官方 key + deepseek-v4-flash（命中默认价格档），三类用途步 + 一个失败步。
  const s1 = join(projA, 's1', 'session.jsonl')
  const lines1: string[] = [
    JSON.stringify({ type: 'session', version: 0, id: 's1', cwd: 'C:\\work\\proj-a' }),
    JSON.stringify({ type: 'request/context', seq: 1, time: t0 + MIN, data: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } }),
    // 工具调用步：input 1000 + cacheRead 300 + output 200 = 1500
    JSON.stringify({ type: 'assistant/message', seq: 2, time: t0 + 65 * MIN, data: { turn: 1, step: 1, usage: JSON.parse(usage(1000, 200, 300)), message: { content: [{ type: 'reasoning' }, { type: 'tool-call', name: 'read' }] } } }),
    JSON.stringify({ type: 'step/end', seq: 3, time: t0 + 65 * MIN, data: { turn: 1, step: 1 } }),
    // 文本回复步：input 500 + output 100 = 600
    JSON.stringify({ type: 'assistant/message', seq: 4, time: t0 + 2 * 60 * MIN, data: { turn: 1, step: 2, usage: JSON.parse(usage(500, 100)), message: { content: [{ type: 'text', text: 'hi' }] } } }),
    JSON.stringify({ type: 'step/end', seq: 5, time: t0 + 2 * 60 * MIN, data: { turn: 1, step: 2 } }),
    // 纯推理步：input 800 + cacheWrite 50 = 850
    JSON.stringify({ type: 'assistant/message', seq: 6, time: t0 + 3 * 60 * MIN, data: { turn: 1, step: 3, usage: JSON.parse(usage(800, 0, 0, 50)), message: { content: [{ type: 'reasoning', text: 'think' }] } } }),
    JSON.stringify({ type: 'step/end', seq: 7, time: t0 + 3 * 60 * MIN, data: { turn: 1, step: 3 } }),
    // 失败步：仅 step/end，无 assistant/message（计数但无 token）
    JSON.stringify({ type: 'step/end', seq: 8, time: t0 + 4 * 60 * MIN, data: { turn: 1, step: 4 } }),
  ]
  writeFileSync(s1, lines1.join('\n') + '\n', 'utf8')

  // s2：非官方平台（openrouter，未配置定价）+ 官方但模型未配置定价（deepseek-v3.2）+ 昨天的跨天事件。
  const s2 = join(projB, 's2', 'session.jsonl')
  const lines2: string[] = [
    JSON.stringify({ type: 'session', version: 0, id: 's2', cwd: 'C:\\work\\proj-b' }),
    JSON.stringify({ type: 'request/context', seq: 1, time: t0 + MIN, data: { provider: 'openrouter', model: 'stealth/ox-alpha' } }),
    JSON.stringify({ type: 'assistant/message', seq: 2, time: t0 + 70 * MIN, data: { turn: 1, step: 1, usage: JSON.parse(usage(2000, 500)), message: { content: [{ type: 'text', text: 'hi' }] } } }),
    JSON.stringify({ type: 'step/end', seq: 3, time: t0 + 70 * MIN, data: { turn: 1, step: 1 } }),
    JSON.stringify({ type: 'request/context', seq: 4, time: t0 + 5 * 60 * MIN, data: { provider: 'deepseek-official', model: 'deepseek-v3.2' } }),
    JSON.stringify({ type: 'assistant/message', seq: 5, time: t0 + 5 * 60 * MIN, data: { turn: 1, step: 2, usage: JSON.parse(usage(100, 50)), message: { content: [{ type: 'text', text: 'hi' }] } } }),
    JSON.stringify({ type: 'step/end', seq: 6, time: t0 + 5 * 60 * MIN, data: { turn: 1, step: 2 } }),
    // 昨天：官方 + 命中价格档（跨天验证 all 的日桶）
    JSON.stringify({ type: 'request/context', seq: 7, time: t0 - MIN, data: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } }),
    JSON.stringify({ type: 'assistant/message', seq: 8, time: t0 - 1000, data: { turn: 1, step: 3, usage: JSON.parse(usage(1000, 100)), message: { content: [{ type: 'text', text: 'hi' }] } } }),
    JSON.stringify({ type: 'step/end', seq: 9, time: t0 - 1000, data: { turn: 1, step: 3 } }),
  ]
  writeFileSync(s2, lines2.join('\n') + '\n', 'utf8')
}

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'dshb-series-'))
  const now = Date.now()
  writeFixture(root, now)

  // 桶轴
  const hour1 = await computeSeries('hour1', config, providerBaseUrls, root)
  assert(hour1.bucket === 'min10' && hour1.points.length === 6, `hour1: 6 个 10 分钟桶（实际 ${hour1.points.length}）`)
  const today = await computeSeries('today', config, providerBaseUrls, root)
  assert(today.bucket === 'hour' && today.points.length === 24, `today: 24 个 小时桶（实际 ${today.points.length}）`)
  const week7 = await computeSeries('week7', config, providerBaseUrls, root)
  assert(week7.points.length === 7, `week7: 7 个日桶（实际 ${week7.points.length}）`)
  const month1 = await computeSeries('month1', config, providerBaseUrls, root)
  assert(month1.points.length === 30, `month1: 30 个日桶（实际 ${month1.points.length}）`)
  const all = await computeSeries('all', config, providerBaseUrls, root)
  assert(all.bucket === 'day' && all.points.length === 2, `all: 2 个日桶（昨天+今天，实际 ${all.points.length} ${all.bucket}）`)

  // 扁平化 today 记录并按 (provider|model|workspace) 跨桶聚合（同键可能落在多个时间桶）。
  const aggMap = new Map<string, {
    buckets: { uncachedInput: number; cacheRead: number; cacheWrite: number; output: number }
    amount: number
    priced: boolean
    steps: number
    purpose: { tool: number; text: number; reasoning: number }
    workspace: string
    platform: string
  }>()
  for (const r of today.records.flat()) {
    const key = r.provider + '|' + r.model + '|' + r.workspace
    const a = aggMap.get(key)
    if (a === undefined) {
      aggMap.set(key, {
        buckets: { ...r.buckets },
        amount: r.amount,
        priced: r.priced,
        steps: r.steps,
        purpose: { ...r.purpose },
        workspace: r.workspace,
        platform: r.platform,
      })
    } else {
      a.buckets.uncachedInput += r.buckets.uncachedInput
      a.buckets.cacheRead += r.buckets.cacheRead
      a.buckets.cacheWrite += r.buckets.cacheWrite
      a.buckets.output += r.buckets.output
      a.amount += r.amount
      a.steps += r.steps
      a.purpose.tool += r.purpose.tool
      a.purpose.text += r.purpose.text
      a.purpose.reasoning += r.purpose.reasoning
    }
  }
  const byKey = aggMap

  const flashA = byKey.get('deepseek-official|deepseek-v4-flash|C:\\work\\proj-a')
  assert(flashA !== undefined, 'deepseek-v4-flash（官方·proj-a）记录存在')
  if (flashA !== undefined) {
    assert(flashA.priced === true && flashA.amount > 0, `官方且命中价格档 → priced=true 且金额 > 0（amount=${flashA.amount}）`)
    assert(flashA.workspace === 'C:\\work\\proj-a', 'workspace = header cwd')
    assert(flashA.steps === 4, `steps 计入失败步（4 个 step/end，实际 ${flashA.steps}）`)
    assert(flashA.buckets.cacheRead === 300, `缓存命中 300（实际 ${flashA.buckets.cacheRead}）`)
    assert(flashA.buckets.uncachedInput === 2300 && flashA.buckets.cacheWrite === 50 && flashA.buckets.output === 300,
      `未命中输入 2300 / 缓存写入 50 / 输出 300（实际 ${JSON.stringify(flashA.buckets)}）`)
    assert(flashA.purpose.tool === 1500, `工具调用步 token 1500 归入 tool（实际 ${flashA.purpose.tool}）`)
    assert(flashA.purpose.text === 600, `文本回复步 token 600 归入 text（实际 ${flashA.purpose.text}）`)
    assert(flashA.purpose.reasoning === 850, `纯推理步 token 850 归入 reasoning（实际 ${flashA.purpose.reasoning}）`)
  }

  const openrouter = byKey.get('openrouter|stealth/ox-alpha|C:\\work\\proj-b')
  assert(openrouter !== undefined, 'openrouter（非官方·proj-b）记录存在')
  if (openrouter !== undefined) {
    assert(openrouter.priced === false && openrouter.amount === 0, '非官方平台 → priced=false 且金额 0')
    assert(openrouter.platform === 'openrouter.ai', `平台名 = baseURL 域名（实际 ${openrouter.platform}）`)
    assert(openrouter.buckets.uncachedInput === 2000 && openrouter.buckets.output === 500, 'openrouter token 照常统计')
  }

  const v32 = byKey.get('deepseek-official|deepseek-v3.2|C:\\work\\proj-b')
  assert(v32 !== undefined, 'deepseek-v3.2（官方但未配置定价）记录存在')
  if (v32 !== undefined) {
    assert(v32.priced === false && v32.amount === 0, '官方但模型未命中价格档 → priced=false 且金额 0（未计费）')
  }

  // all：昨天的流量进入独立的更早日桶（deepseek-v4-flash 总 steps = 4 + 1）
  const allFlash = all.records.flat().filter((r) => r.provider === 'deepseek-official' && r.model === 'deepseek-v4-flash')
  const allSteps = allFlash.reduce((s, r) => s + r.steps, 0)
  assert(allSteps === 5, `all 范围 deepseek-v4-flash steps = 5（今天 4 + 昨天 1，实际 ${allSteps}）`)
  assert(allFlash.some((r) => r.workspace === 'C:\\work\\proj-b' && r.steps === 1), '昨天的记录归属 proj-b 日桶')

  // 缓存失效：向 s1 追加一条事件（mtime/size 变化）→ 重新扫描 token 增加
  const s1 = join(root, 'proj-a', 's1', 'session.jsonl')
  appendFileSync(s1, JSON.stringify({
    type: 'assistant/message', seq: 100, time: todayStart(now) + 6 * 60 * MIN,
    data: { turn: 1, step: 5, usage: JSON.parse(usage(777, 0)), message: { content: [{ type: 'text', text: 'more' }] } },
  }) + '\n' + JSON.stringify({ type: 'step/end', seq: 101, time: todayStart(now) + 6 * 60 * MIN, data: { turn: 1, step: 5 } }) + '\n', 'utf8')
  const today2 = await computeSeries('today', config, providerBaseUrls, root)
  const agg2 = new Map<string, { tokens: number; steps: number }>()
  for (const r of today2.records.flat()) {
    const key = r.provider + '|' + r.model + '|' + r.workspace
    const a = agg2.get(key) ?? { tokens: 0, steps: 0 }
    a.tokens += r.buckets.uncachedInput + r.buckets.cacheRead + r.buckets.cacheWrite + r.buckets.output
    a.steps += r.steps
    agg2.set(key, a)
  }
  const flashA2 = agg2.get('deepseek-official|deepseek-v4-flash|C:\\work\\proj-a')
  const total2 = flashA2?.tokens ?? 0
  assert(total2 === 2950 + 777, `缓存失效重扫：追加 777 token 后合计 ${total2}（预期 ${2950 + 777}）`)
  const steps2 = flashA2?.steps ?? 0
  assert(steps2 === 5, `追加后 steps = 5（实际 ${steps2}）`)

  // range 非法 → runOp 返回 params-invalid
  const bad = await runOp({ nsOf: () => 'ns' } as Parameters<typeof runOp>[0], { op: 'costSeries', range: 'bogus' })
  assert(bad.ok === false && bad.code === 'params-invalid', 'range 非法 → params-invalid')
  assert((SERIES_RANGES as readonly string[]).length === 5, 'SERIES_RANGES 恰有 5 个取值')

  rmSync(root, { recursive: true, force: true })
  console.log(failures === 0 ? '\n全部通过 ✓' : `\n${failures} 项失败 ✗`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
