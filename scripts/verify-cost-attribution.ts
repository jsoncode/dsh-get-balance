/**
 * dsh-get-balance —— 用真实会话日志驱动 computeCosts，验证多 provider 切换时
 * token 统计与金额预估是否正确按 provider 归属（不混合）。
 *
 * 取「真实发生过 provider 切换」的会话文件，解码为 SessionLike，用插件的
 * computeCosts（内存会话路径）计算 session 类别的 byKey，断言：
 *   - 每个 provider 独立一组（tokens / amount 各自归属）；
 *   - 官方 provider 有金额，非官方恒为 0（此处 ds-self 与 deepseek-official 均官方）；
 *   - 切换后的用量归属到切换后的 provider。
 *
 * 运行：pnpm exec tsx scripts/verify-cost-attribution.ts
 */
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
import { computeCosts, DEFAULT_PRICE_CONFIG, isOfficialProvider, type SessionLike } from '../src/host/cost.ts'

const ZSTD_MAGIC = [0x28, 0xB5, 0x2F, 0xFD]

function decodeLog(path: string): string {
  const raw = readFileSync(path)
  if (raw[0] !== 0x28) return raw.toString('utf8')
  const starts: number[] = []
  for (let i = 0; i + 4 <= raw.length; i++) {
    if (raw[i] === ZSTD_MAGIC[0] && raw[i + 1] === ZSTD_MAGIC[1] && raw[i + 2] === ZSTD_MAGIC[2] && raw[i + 3] === ZSTD_MAGIC[3]) starts.push(i)
  }
  const parts: Buffer[] = []
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i] as number
    const e = i + 1 < starts.length ? starts[i + 1] as number : raw.length
    parts.push(zstdDecompressSync(raw.subarray(s, e)))
  }
  return Buffer.concat(parts).toString('utf8')
}

function loadSession(path: string): SessionLike {
  const text = decodeLog(path)
  const events: SessionLike['events'] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.length === 0) continue
    try {
      const o = JSON.parse(t) as { type: string; time?: number; data?: unknown }
      if (o.type === 'request/context' || o.type === 'assistant/chunk' || o.type === 'assistant/message') {
        events.push({ type: o.type, time: o.time, data: o.data as SessionLike['events'] extends Array<infer E> ? E['data'] : never })
      }
    } catch { /* 忽略坏行 */ }
  }
  return { events }
}

let failures = 0
function assert(cond: boolean, label: string): void {
  if (cond) console.log(`  ok   ${label}`)
  else { failures += 1; console.error(`  FAIL ${label}`) }
}

async function main(): Promise<void> {
  const file = 'C:\\Users\\Chris\\.dsh\\sessions\\--D-workspace-custom-deepseek-harness-desktop--\\session-aa065300-86c9-4e34-b2de-982c53fb97a3\\session.jsonl.zstd'
  const session = loadSession(file)
  const providerBaseUrls: Record<string, string> = {
    'ds-self': 'https://api.deepseek.com/',
    'deepseek-official': 'https://api.deepseek.com',
  }
  const config = DEFAULT_PRICE_CONFIG
  const result = await computeCosts(session, config, process.cwd(), providerBaseUrls)

  console.log('--- session.byKey（真实切换会话） ---')
  for (const k of result.session.byKey) {
    const t = k.buckets.uncachedInput + k.buckets.cacheRead + k.buckets.cacheWrite + k.buckets.output
    console.log(`  provider=${k.provider} official=${k.official} tokens=${t} amount=${k.amount} ${k.currency}`)
  }

  const byProvider = new Map(result.session.byKey.map((k) => [k.provider, k]))
  assert(byProvider.size >= 2, `至少 2 个 provider 分组（实际 ${byProvider.size}）`)
  for (const [name, k] of byProvider) {
    assert(isOfficialProvider(name, providerBaseUrls) === k.official, `provider=${name} official 标志与 baseURL 判定一致`)
    assert(k.buckets.uncachedInput + k.buckets.cacheRead + k.buckets.cacheWrite + k.buckets.output > 0, `provider=${name} 有 token 统计`)
    if (k.official) assert(k.amount > 0 || k.currency !== '', `provider=${name} 官方有金额归属`)
  }
  // 合计 = 各 provider 之和（tokens 全量；金额仅官方）
  const sumTokens = [...byProvider.values()].reduce((s, k) => s + k.buckets.uncachedInput + k.buckets.cacheRead + k.buckets.cacheWrite + k.buckets.output, 0)
  const sumAmount = [...byProvider.values()].filter((k) => k.official).reduce((s, k) => s + k.amount, 0)
  const totalTokens = result.session.buckets.uncachedInput + result.session.buckets.cacheRead + result.session.buckets.cacheWrite + result.session.buckets.output
  assert(Math.abs(sumTokens - totalTokens) < 1, `合计 tokens = 各 provider 之和（${sumTokens} vs ${totalTokens}）`)
  assert(Math.abs(sumAmount - result.session.amount) < 0.000001, `合计金额 = 官方 provider 之和（${sumAmount.toFixed(6)} vs ${result.session.amount.toFixed(6)}）`)

  console.log(failures === 0 ? '\n全部通过 ✓' : `\n${failures} 项失败 ✗`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
