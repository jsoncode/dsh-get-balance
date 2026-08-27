/**
 * dsh-get-balance —— config-file 模块冒烟验证（tsx scripts/verify-config-file.ts）。
 *
 * 覆盖：
 * 1. 无 settings 服务时：默认值、不产生文件；
 * 2. 保存（合并 + 原子写）→ 文件内容正确；
 * 3. 外部手改 → 立即生效；
 * 4. 损坏文件 → 备份 + 回退默认；
 * 5. 旧 settings 数据 → 一次性迁移到 JSON 文件。
 */

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'

let failures = 0
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log('ok:', msg)
  } else {
    failures++
    console.error('FAIL:', msg)
  }
}

/** 建一个干净的临时 DSH_HOME，返回其路径（调用方负责清理）。 */
function freshHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'dsh-balance-cfg-'))
  process.env.DSH_HOME = home
  return home
}

/* ── 1. 无 settings：默认值、不产生文件 ───────────────────────── */
{
  const home = freshHome()
  // 必须在设置 DSH_HOME 之后再动态导入（模块加载时解析路径）。
  const mod = await import('../src/host/config-file.ts')

  mod.initConfigFile({ ctx: new Context() })
  const cfg = await mod.readPluginConfig()
  assert(cfg.extraKeys.length === 0 && cfg.autoRefreshSeconds === 0 && cfg.prices.tiers.length > 0, '无 settings：返回默认配置')
  assert(!existsSync(join(home, 'dsh-get-balance.json')), '无 settings：不产生配置文件')

  /* ── 2. 保存（合并 + 原子写）── */
  await mod.savePluginConfig({ autoRefreshSeconds: 30 })
  assert(existsSync(join(home, 'dsh-get-balance.json')), '保存后文件已创建')
  const afterSave = JSON.parse(readFileSync(join(home, 'dsh-get-balance.json'), 'utf8'))
  assert(afterSave.autoRefreshSeconds === 30, '保存 autoRefreshSeconds=30 落盘正确')
  assert(Array.isArray(afterSave.extraKeys) && afterSave.extraKeys.length === 0, '未传字段保持默认')

  await mod.savePluginConfig({ extraKeys: [{ id: 'k1', label: '主', apiKey: 'sk-1' }] })
  const afterKeys = JSON.parse(readFileSync(join(home, 'dsh-get-balance.json'), 'utf8'))
  assert(afterKeys.extraKeys.length === 1 && afterKeys.extraKeys[0].apiKey === 'sk-1', '保存 extraKeys 落盘正确')
  assert(afterKeys.autoRefreshSeconds === 30, '合并保存：autoRefreshSeconds 未被覆盖')

  const reread = await mod.readPluginConfig()
  assert(reread.extraKeys[0]?.id === 'k1' && reread.autoRefreshSeconds === 30, 'readPluginConfig 读回一致')

  /* ── 3. 外部手改立即生效 ── */
  writeFileSync(join(home, 'dsh-get-balance.json'), JSON.stringify({ version: 1, autoRefreshSeconds: 99 }))
  const edited = await mod.readPluginConfig()
  assert(edited.autoRefreshSeconds === 99 && edited.extraKeys.length === 0, '外部手改立即生效')

  /* ── 4. 损坏文件 → 备份 + 默认 ── */
  writeFileSync(join(home, 'dsh-get-balance.json'), '{not-json!!')
  const afterCorrupt = await mod.readPluginConfig()
  assert(afterCorrupt.autoRefreshSeconds === 0 && afterCorrupt.extraKeys.length === 0, '损坏文件回退默认值')
  const backups = readdirSync(home).filter((f) => f.startsWith('dsh-get-balance.json.bak-'))
  assert(backups.length === 1, `损坏文件已备份（${backups[0] ?? '?'}）`)
  rmSync(home, { recursive: true, force: true })
}

/* ── 5. 旧 settings 数据 → 一次性迁移 ─────────────────────────── */
{
  const home = freshHome()
  const mod = await import('../src/host/config-file.ts?migrate')

  const fakeSettings = {
    get: () => undefined,
    register: (_ns: unknown, _schema: unknown, _opts?: unknown) => ({
      get: () => ({
        extraKeysJson: JSON.stringify([{ id: 'k9', label: '旧账号', apiKey: 'sk-legacy' }]),
        pricesJson: '',
        autoRefreshJson: '15',
      }),
    }),
  }
  // 与生产一致：settings 服务必须挂在传入的 ctx 上（子插件经 ctx 继承解析）。
  const ctx = new Context()
  ctx.provide('settings', fakeSettings as never)
  mod.initConfigFile({ ctx, settings: fakeSettings as never })
  const cfg = await mod.readPluginConfig()
  assert(cfg.extraKeys.length === 1 && cfg.extraKeys[0].apiKey === 'sk-legacy', '迁移：附加 key 已搬入 JSON')
  assert(cfg.autoRefreshSeconds === 15, '迁移：自动刷新间隔已搬入 JSON')
  const file = JSON.parse(readFileSync(join(home, 'dsh-get-balance.json'), 'utf8'))
  assert(file.autoRefreshSeconds === 15 && file.extraKeys[0].id === 'k9', '迁移文件落盘正确')

  // 再次初始化不应重复迁移（文件已存在）。
  const before = readFileSync(join(home, 'dsh-get-balance.json'), 'utf8')
  mod.initConfigFile({ ctx, settings: fakeSettings as never })
  await mod.readPluginConfig()
  assert(readFileSync(join(home, 'dsh-get-balance.json'), 'utf8') === before, '文件已存在：不重复迁移')

  rmSync(home, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`)
  process.exit(1)
}
console.log('\nverify-config-file OK')
