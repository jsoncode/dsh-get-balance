/**
 * dsh-get-balance —— 宿主半边：执行插件更新命令（后台进程 + 输出缓冲）。
 *
 * 浏览器半边点击「更新」胶囊 → 确认弹框 → 大日志弹框：本模块以子进程后台
 * 执行 `dsh plugin --profile web update dsh-get-balance`，stdout/stderr 实时
 * 追加进环形缓冲；客户端轮询 pluginUpdateStatus op 拉取增量日志与运行状态
 * （done / exitCode）。同一时刻只允许一个更新进程；进程内缓冲有上限防膨胀。
 *
 * 【排除「启动更新命令失败」】dsh CLI 常经 pnpm 全局安装，而宿主进程的 PATH
 * 未必包含其 bin 目录（如由服务 / 桌面快捷方式拉起、PATH 不完整），裸 spawn
 * 'dsh' 会失败。这里按优先级解析可执行文件：
 *   1. 显式覆盖 process.env.DSH_BIN（存在才用）；
 *   2. 常见全局 bin 目录：PNPM_HOME / %APPDATA%\npm / %LOCALAPPDATA%\pnpm /
 *      ~/.local/bin（Windows 依次试 dsh.cmd / dsh.exe / dsh）；
 *   3. where / which 沿 PATH 探测；
 *   4. 兜底裸命令名（Windows 经 shell 解析 .cmd，命中与否都写入日志，不静默）。
 */

import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** 被更新的插件包名（dsh plugin --profile web update <包名>）。 */
const PLUGIN_NAME = 'dsh-get-balance'

/** 输出缓冲上限（超过则截掉最旧内容，只留尾部）。 */
const MAX_OUTPUT = 512 * 1024

const WINDOWS = process.platform === 'win32'

interface UpdateRun {
  child: ChildProcessWithoutNullStreams
  /** 已收集的累计输出（含尾部换行分隔，环形截断）。 */
  output: string
  running: boolean
  exitCode: number | null
  error: string
  /** 启动时刻（epoch ms），供浏览器展示耗时。 */
  startedAt: number
  /** 结束时刻（epoch ms）；运行中为 null。 */
  finishedAt: number | null
}

let run: UpdateRun | null = null

function appendOutput(rec: UpdateRun, text: string): void {
  rec.output = (rec.output + text).slice(-MAX_OUTPUT)
}

export interface PluginUpdateStatus {
  running: boolean
  done: boolean
  output: string
  exitCode: number | null
  error: string
  startedAt: number | null
  finishedAt: number | null
}

/* ── dsh 可执行文件解析（排除「命令找不到」型启动失败）────────── */

/** 常见全局 bin 目录 × 平台扩展名，生成候选绝对路径。 */
function candidatePaths(): string[] {
  const names = WINDOWS ? ['dsh.cmd', 'dsh.exe', 'dsh'] : ['dsh']
  const dirs: Array<string | undefined> = [
    process.env.PNPM_HOME,                                   // pnpm 全局 bin（dsh 通常经 pnpm -g 安装）
    process.env.APPDATA !== undefined ? join(process.env.APPDATA, 'npm') : undefined, // npm 全局 bin
    process.env.LOCALAPPDATA !== undefined ? join(process.env.LOCALAPPDATA, 'pnpm') : undefined,
    process.env.USERPROFILE !== undefined ? join(process.env.USERPROFILE, '.local', 'bin') : undefined,
    process.env.HOME !== undefined ? join(process.env.HOME, '.local', 'bin') : undefined,
  ]
  const out: string[] = []
  for (const dir of dirs) {
    if (dir === undefined || dir.length === 0) continue
    for (const name of names) out.push(join(dir, name))
  }
  return out
}

/**
 * 解析 dsh 可执行文件：显式覆盖 > 常见全局 bin 目录 > where/which 探测 > 裸名。
 * 返回值是绝对路径或裸命令名（后者交给 PATH / shell 解析）。
 * （导出仅用于冒烟测试；不进入对外 API，index.ts 不 re-export。）
 */
export function resolveDshCommand(): string {
  const explicit = process.env.DSH_BIN
  if (explicit !== undefined && explicit.trim().length > 0 && existsSync(explicit.trim())) {
    return explicit.trim()
  }
  for (const candidate of candidatePaths()) {
    if (existsSync(candidate)) return candidate
  }
  try {
    // PATH 探测：避免依赖 shell 拼接的解析差异；失败（无 where/which）静默走兜底。
    const probe = spawnSync(WINDOWS ? 'where' : 'which', ['dsh'], { encoding: 'utf8', windowsHide: true })
    if (probe.status === 0 && typeof probe.stdout === 'string') {
      const hit = probe.stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0)
      if (hit !== undefined) return hit
    }
  } catch { /* 探测工具缺失时走兜底 */ }
  return 'dsh'
}

/* ── 更新进程生命周期 ─────────────────────────────────────────── */

/**
 * 启动更新进程。已在运行则返回 alreadyRunning=true（不重复启动）；
 * 上次已结束则丢弃旧记录重新开始。
 */
export function startPluginUpdate(): { ok: boolean; alreadyRunning?: boolean; error?: string } {
  if (run !== null && run.running) return { ok: true, alreadyRunning: true }
  run = null

  const command = resolveDshCommand()
  let child: ChildProcessWithoutNullStreams
  try {
    // Windows 下 dsh 是 .cmd 脚本，必须经 cmd 执行（含绝对路径命中时）；
    // 非 Windows 直接 spawn 绝对路径，命令缺失会触发 'error' 事件写入日志。
    child = spawn(command, ['plugin', '--profile', 'web', 'update', PLUGIN_NAME], {
      shell: WINDOWS,
      windowsHide: true,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  const rec: UpdateRun = { child, output: '', running: true, exitCode: null, error: '', startedAt: Date.now(), finishedAt: null }
  run = rec

  child.stdout.on('data', (d: Buffer) => appendOutput(rec, d.toString()))
  child.stderr.on('data', (d: Buffer) => appendOutput(rec, d.toString()))
  child.on('error', (err) => {
    appendOutput(rec, `\n[spawn error] ${err.message}\n`)
    rec.error = err.message
    rec.exitCode = -1
    rec.running = false
    rec.finishedAt = Date.now()
  })
  child.on('close', (code) => {
    appendOutput(rec, `\n[exit code ${code ?? 'null'}]\n`)
    rec.exitCode = code
    rec.running = false
    rec.finishedAt = Date.now()
  })

  return { ok: true }
}

/** 轮询用：当前更新进程（或最近一次已结束进程）的状态与累计输出。 */
export function getPluginUpdateStatus(): PluginUpdateStatus {
  if (run === null) return { running: false, done: false, output: '', exitCode: null, error: '', startedAt: null, finishedAt: null }
  return {
    running: run.running,
    done: !run.running,
    output: run.output,
    exitCode: run.exitCode,
    error: run.error,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  }
}
