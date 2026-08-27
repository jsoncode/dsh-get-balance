/**
 * dsh-get-balance —— 宿主半边：op 分发。
 *
 * HTTP 路由（/dsh-balance/api）与命令通道（dsh-balance）共用同一入口 runOp：
 * providers / balance / cost / pricesGet / pricesSave / keysGet / keysSave /
 * autoRefreshGet / autoRefreshSave / showBalanceGet / showBalanceSave /
 * updateCheck / pluginUpdateStart / pluginUpdateStatus。
 * 返回值恒为 OpResult 形状（ok=false 带 code/error），由调用方包信封。
 *
 * 插件持久数据（附加 key / 价格档 / 自动刷新间隔）读写 `$DSH_HOME/
 * dsh-get-balance.json`（见 config-file.ts），不再写入宿主 settings。
 */

import type { CredentialsService, SettingsService } from './providers.ts'
import { listDeepseekProviders, listProviderBaseUrls } from './providers.ts'
import { queryBalances } from './balance.ts'
import { readPluginConfig, savePluginConfig } from './config-file.ts'
import { computeCosts, normalizePriceConfig, type SessionsService } from './cost.ts'
import { checkPluginUpdate } from './update.ts'
import { getPluginUpdateStatus, startPluginUpdate } from './plugin-update.ts'
import type { ExtraKey, OpRequest, OpResult, PriceConfig } from './types.ts'

/** runOp 的全部依赖（由 index.ts 的 apply 注入）。 */
export interface OpDeps {
  settings?: SettingsService
  nsOf: (name: string) => unknown
  /** 按请求懒取 credentials 服务：apply 时刻不可用也能在请求时拿到（服务晚启动兜底）。 */
  getCredentials?: () => CredentialsService | undefined
  sessions?: SessionsService
}

/* ── 配置文件读写（$DSH_HOME/dsh-get-balance.json）────────────── */

/** 读取用户附加 key 列表。 */
export async function readExtraKeys(): Promise<ExtraKey[]> {
  return (await readPluginConfig()).extraKeys
}

/** 读取完整价格配置（用户已保存 > 内置默认；旧版扁平档位数组自动迁移）。 */
export async function readPriceConfig(): Promise<PriceConfig> {
  return (await readPluginConfig()).prices
}

/** 读取定时自动刷新间隔（秒，0 = 关闭）。 */
export async function readAutoSeconds(): Promise<number> {
  return (await readPluginConfig()).autoRefreshSeconds
}

/** 读取「显示余额」开关（false = footer 与余额列表的金额掩码为 **）。 */
export async function readShowBalance(): Promise<boolean> {
  return (await readPluginConfig()).showBalance
}

/* ── op 分发 ──────────────────────────────────────────────── */

/**
 * 执行一个 op。
 * @param deps - apply 注入的宿主依赖。
 * @param request - OpRequest（HTTP 与命令通道共用形状）。
 * @returns OpResult 形状载荷（不抛异常；内部错误映射为 ok:false）。
 */
export async function runOp(deps: OpDeps, request: OpRequest): Promise<OpResult> {
  try {
    switch (request.op) {
      case 'providers': {
        // 按请求懒取 credentials：服务晚启动也能在请求时拿到。
        const credentials = deps.getCredentials?.()
        const entries = await listDeepseekProviders(deps.settings, deps.nsOf, credentials, await readExtraKeys())
        // 真实 key 不出宿主：只回脱敏串。
        const safe = entries.map(({ apiKey: _apiKey, ...rest }) => rest)
        return { ok: true, providers: safe, credentialsPresent: credentials !== undefined }
      }
      case 'balance': {
        const credentials = deps.getCredentials?.()
        const entries = await listDeepseekProviders(deps.settings, deps.nsOf, credentials, await readExtraKeys())
        const balances = await queryBalances(entries, request.refresh === true)
        return { ok: true, balances }
      }
      case 'cost': {
        const sessionId = typeof request.sessionId === 'string' ? request.sessionId : ''
        // 会话解析（内存 → 磁盘兜底）+ 子代理血缘并入「本会话」在 computeCosts 内部完成；
        // cwd 缺省回退 process.cwd()（computeCosts 内部优先用会话 header 的 cwd）。
        const providerBaseUrls = listProviderBaseUrls(deps.settings, deps.nsOf)
        const result = await computeCosts(sessionId, deps.sessions, await readPriceConfig(), process.cwd(), providerBaseUrls)
        return { ok: true, cost: result }
      }
      case 'pricesGet': {
        return { ok: true, config: await readPriceConfig() }
      }
      case 'pricesSave': {
        const raw = request.config
        if (raw === undefined || raw === null || typeof raw !== 'object' || !Array.isArray((raw as { tiers?: unknown }).tiers)) {
          return { ok: false, code: 'params-invalid', error: 'config.tiers must be an array' }
        }
        const config = normalizePriceConfig(raw)
        if (config.tiers.length === 0) {
          return { ok: false, code: 'params-invalid', error: 'keep at least one price tier' }
        }
        await savePluginConfig({ prices: config })
        return { ok: true, config }
      }
      case 'keysGet': {
        // 脱敏回显；apiKey 留空表示「保存时保留原值」。
        const keys = (await readExtraKeys()).map((key) => ({
          id: key.id,
          label: key.label,
          apiKeyMasked: maskKeyForClient(key.apiKey),
        }))
        return { ok: true, keys }
      }
      case 'keysSave': {
        if (!Array.isArray(request.keys)) {
          return { ok: false, code: 'params-invalid', error: 'keys must be an array' }
        }
        const previous = await readExtraKeys()
        const next: ExtraKey[] = request.keys.map((item, index) => {
          const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : `k${Date.now().toString(36)}-${index}`
          const incoming = typeof item.apiKey === 'string' ? item.apiKey.trim() : ''
          // 空串 = 客户端未改动 key：保留旧值（回显的是脱敏串，不可写回）。
          const kept = previous.find((p) => p.id === id)
          return {
            id,
            label: typeof item.label === 'string' ? item.label : '',
            apiKey: incoming.length > 0 ? incoming : (kept?.apiKey ?? ''),
          }
        }).filter((key) => key.apiKey.length > 0)
        await savePluginConfig({ extraKeys: next })
        return { ok: true, keys: next.map((key) => ({ id: key.id, label: key.label, apiKeyMasked: maskKeyForClient(key.apiKey) })) }
      }
      case 'autoRefreshGet': {
        return { ok: true, seconds: await readAutoSeconds() }
      }
      case 'autoRefreshSave': {
        const seconds = typeof request.seconds === 'number' && Number.isFinite(request.seconds)
          ? Math.round(request.seconds)
          : Number(String(request.seconds ?? '').trim())
        if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) {
          return { ok: false, code: 'params-invalid', error: 'seconds must be 0..86400' }
        }
        await savePluginConfig({ autoRefreshSeconds: seconds })
        return { ok: true, seconds }
      }
      case 'showBalanceGet': {
        return { ok: true, enabled: await readShowBalance() }
      }
      case 'showBalanceSave': {
        if (typeof request.enabled !== 'boolean') {
          return { ok: false, code: 'params-invalid', error: 'enabled must be a boolean' }
        }
        await savePluginConfig({ showBalance: request.enabled })
        return { ok: true, enabled: request.enabled }
      }
      case 'updateCheck': {
        // npm registry（keywords:dsh-get-balance）最新版 vs 被安装根目录
        // package.json 版本；每次调用实时读盘 + 实时请求 registry（无时间
        // 缓存，客户端每次页面刷新恰好触发一次），网络失败静默降级。
        const update = await checkPluginUpdate()
        return { ok: true, update }
      }
      case 'pluginUpdateStart': {
        // 后台执行 `dsh plugin --profile web update dsh-get-balance`，
        // stdout/stderr 进入宿主环形缓冲，客户端轮询 status 拉取日志。
        const start = startPluginUpdate()
        return start.ok
          ? { ok: true, alreadyRunning: start.alreadyRunning === true }
          : { ok: false, code: 'spawn-failed', error: start.error ?? 'failed to spawn dsh' }
      }
      case 'pluginUpdateStatus': {
        // 轮询当前更新进程状态与累计日志；版本读取已是实时（无缓存），
        // 更新落盘后下一次 updateCheck 自然读到新版本号。
        return { ok: true, status: getPluginUpdateStatus() }
      }
      default:
        return { ok: false, code: 'op-unknown', error: `unknown op: ${String(request.op)}` }
    }
  } catch (e) {
    return { ok: false, code: 'internal-error', error: e instanceof Error ? e.message : String(e) }
  }
}

/** 与 providers.maskApiKey 同规则的客户端脱敏（避免循环依赖，本地小副本）。 */
function maskKeyForClient(key: string): string {
  const k = String(key || '').trim()
  if (k.length === 0) return ''
  if (k.length <= 10) return k.slice(0, 2) + '****'
  return k.slice(0, 5) + '…' + k.slice(-4)
}
