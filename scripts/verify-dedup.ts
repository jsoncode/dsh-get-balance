/**
 * dsh-get-balance —— 验证「同一账号折叠」逻辑（按解析 API key 去重）。
 *
 * 用与运行实例一致的真实配置形状（settings.yaml 的 llm-pi-ai / llm-deepseek
 * 段 + .credentials.yaml 的凭据）驱动 listDeepseekProviders，断言：
 *   1. 同一 key（DEEPSEEK_API_KEY）的两条路由折叠为一行，sharedWith 标注另一路由；
 *   2. 不同 key 的两条路由保留为两行（不误折叠）；
 *   3. 无 key 的条目不被折叠。
 *
 * 运行：pnpm exec tsx scripts/verify-dedup.ts
 */
import { readFileSync } from 'node:fs'
import { listDeepseekProviders, maskApiKey, type SettingsService } from '../src/host/providers.ts'

/** 从 .credentials.yaml 读取 { ref: value }（严格映射，同宿主解析器口径）。 */
function readCredentialsFile(path: string): Map<string, string> {
  const text = readFileSync(path, 'utf8')
  const raw = text.trim()
  if (raw.length === 0) return new Map()
  if (!raw.startsWith('{') || !raw.endsWith('}')) throw new Error(`unexpected credentials shape: ${path}`)
  const inner = raw.slice(1, -1).trim()
  const map = new Map<string, string>()
  if (inner.length === 0) return map
  for (const pair of inner.split(',')) {
    const [k, ...rest] = pair.split(':')
    const ref = (k ?? '').trim()
    const value = rest.join(':').trim().replace(/^['"]|['"]$/g, '')
    if (ref.length > 0) map.set(ref, value)
  }
  return map
}

let failures = 0
function assert(cond: boolean, label: string): void {
  if (cond) {
    console.log(`  ok   ${label}`)
  } else {
    failures += 1
    console.error(`  FAIL ${label}`)
  }
}

/** 构建与真实运行一致的最小 settings / credentials 桩。 */
function makeDeps(opts: {
  piAiApiKeyEnv?: string
  llmDeepseekApiKeyEnv?: string
  credentials: (ref: string) => { value: string; source?: string } | undefined
}): { settings: SettingsService; nsOf: (n: string) => unknown; credentials: { resolve(ref: string): Promise<{ value: string; source?: string } | undefined> } } {
  const sections: Record<string, unknown> = {
    'llm-pi-ai': {
      providers: {
        deepseek: {
          apiKeyEnv: opts.piAiApiKeyEnv,
          baseURL: 'https://api.deepseek.com',
          models: [{ id: 'deepseek-v4-flash' }],
        },
      },
    },
    // 运行实例中 llm-deepseek 段未在 settings.yaml 显式配置，宿主返回的生效配置
    // apiKeyEnv 缺省（插件侧回退 DEEPSEEK_API_KEY）。
    'llm-deepseek': opts.llmDeepseekApiKeyEnv === undefined ? {} : { apiKeyEnv: opts.llmDeepseekApiKeyEnv },
  }
  const settings: SettingsService = {
    get(ns: unknown): unknown {
      return sections[String(ns)] ?? undefined
    },
    register(): unknown {
      return undefined
    },
  }
  const credentials = {
    async resolve(ref: string): Promise<{ value: string; source?: string } | undefined> {
      return opts.credentials(ref)
    },
  }
  return { settings, nsOf: (n: string) => n, credentials }
}

async function main(): Promise<void> {
  const credsPath = process.env.DSH_HOME
    ? `${process.env.DSH_HOME}/.credentials.yaml`
    : 'C:\\Users\\Chris\\.dsh\\.credentials.yaml'
  const creds = readCredentialsFile(credsPath)
  const deepseekKey = creds.get('DEEPSEEK_API_KEY')
  if (deepseekKey === undefined) throw new Error(`DEEPSEEK_API_KEY missing in ${credsPath}`)

  console.log(`[1] 真实配置：pi-ai:deepseek 与 llm-deepseek:deepseek-official 均引用 DEEPSEEK_API_KEY（同一 key）`)
  {
    const deps = makeDeps({
      piAiApiKeyEnv: 'DEEPSEEK_API_KEY',
      llmDeepseekApiKeyEnv: undefined,
      credentials: (ref) => (creds.get(ref) !== undefined ? { value: creds.get(ref) as string, source: 'file' } : undefined),
    })
    const entries = await listDeepseekProviders(deps.settings, deps.nsOf, deps.credentials, [])
    assert(entries.length === 1, `折叠为 1 行（实际 ${entries.length} 行）`)
    const kept = entries[0]
    assert(kept?.id === 'pi-ai:deepseek', `保留首条目 pi-ai:deepseek（实际 ${kept?.id}）`)
    assert(kept?.sharedWith?.length === 1, `sharedWith 标注 1 条共享路由`)
    const shared = kept?.sharedWith?.[0]
    assert(shared?.id === 'llm-deepseek:deepseek-official', `共享路由 id=llm-deepseek:deepseek-official（实际 ${shared?.id}）`)
    assert(shared?.source === 'llm-deepseek', `共享路由 source=llm-deepseek（实际 ${shared?.source}）`)
    assert(kept?.apiKeyMasked === maskApiKey(deepseekKey), `脱敏 key 与解析值一致（实际 ${kept?.apiKeyMasked}）`)
  }

  console.log('[1b] 当前真实配置：pi-ai:ds-self（DS_SELF_API_KEY）与官方（DEEPSEEK_API_KEY）为两个不同账号 → 两行、脱敏 key 不同')
  {
    const dsSelfKey = creds.get('DS_SELF_API_KEY')
    if (dsSelfKey === undefined) throw new Error('DS_SELF_API_KEY missing in .credentials.yaml')
    const deps = makeDeps({
      piAiApiKeyEnv: 'DS_SELF_API_KEY',
      llmDeepseekApiKeyEnv: 'DEEPSEEK_API_KEY',
      credentials: (ref) => (creds.get(ref) !== undefined ? { value: creds.get(ref) as string, source: 'file' } : undefined),
    })
    const entries = await listDeepseekProviders(deps.settings, deps.nsOf, deps.credentials, [])
    assert(entries.length === 2, `保留 2 行（实际 ${entries.length}）`)
    const masks = entries.map((e) => e.apiKeyMasked).sort()
    assert(masks[0] === maskApiKey(dsSelfKey) && masks[1] === maskApiKey(deepseekKey), `两个不同脱敏 key（实际 ${masks.join(' / ')}）`)
    assert(entries.every((e) => e.sharedWith === undefined), `两条目均无 sharedWith 标注`)
  }

  console.log('[2] 两个不同 key 的两条路由：应保留两行（不误折叠）')
  {
    const deps = makeDeps({
      piAiApiKeyEnv: 'PI_AI_API_KEY',
      llmDeepseekApiKeyEnv: 'DEEPSEEK_API_KEY',
      credentials: (ref) => {
        const table: Record<string, string> = { PI_AI_API_KEY: 'sk-aaa111222333444555', DEEPSEEK_API_KEY: deepseekKey }
        const value = table[ref]
        return value !== undefined ? { value, source: 'file' } : undefined
      },
    })
    const entries = await listDeepseekProviders(deps.settings, deps.nsOf, deps.credentials, [])
    assert(entries.length === 2, `保留 2 行（实际 ${entries.length}）`)
    assert(entries.every((e) => e.sharedWith === undefined), `两条目均无 sharedWith 标注`)
  }

  console.log('[3] 无 key 条目（apiKeyEnv 未配置）：不折叠，正常展示「未配置凭据」')
  {
    const deps = makeDeps({
      piAiApiKeyEnv: undefined,
      llmDeepseekApiKeyEnv: undefined,
      credentials: () => undefined,
    })
    const entries = await listDeepseekProviders(deps.settings, deps.nsOf, deps.credentials, [])
    assert(entries.length === 2, `两条目均保留（实际 ${entries.length}）`)
    assert(entries.every((e) => e.hasKey === false), `两条目 hasKey=false`)
    assert(entries.every((e) => e.sharedWith === undefined), `无 sharedWith 标注`)
  }

  console.log('[4] 附加 key 与 providers 同 key：折叠进同一行（同一账号）')
  {
    const deps = makeDeps({
      piAiApiKeyEnv: 'DEEPSEEK_API_KEY',
      llmDeepseekApiKeyEnv: undefined,
      credentials: (ref) => (creds.get(ref) !== undefined ? { value: creds.get(ref) as string, source: 'file' } : undefined),
    })
    const entries = await listDeepseekProviders(deps.settings, deps.nsOf, deps.credentials, [
      { id: 'extra-1', label: '手动附加', apiKey: deepseekKey },
    ])
    assert(entries.length === 1, `折叠为 1 行（实际 ${entries.length}）`)
    assert(entries[0]?.sharedWith?.some((s) => s.id === 'extra:extra-1'), `extra 路由进入 sharedWith`)
  }

  console.log(failures === 0 ? '\n全部通过 ✓' : `\n${failures} 项失败 ✗`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
