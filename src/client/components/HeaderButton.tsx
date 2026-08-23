/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ≈¥xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与
 * 预估费用（≈ 在前、货币符号 ¥ 在后，与金额同绿）。文案空格固定为
 * 「前缀 1.87M | ≈¥0.2935」（前缀与 token 之间一个空格、| 两侧空格）。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 * 额外监听宿主会话快照的 running 标志（会话级插槽标准套件 useSession 注入）：
 * 任务执行中 running=true，完成后回落 false —— 在该回落瞬间广播 bumpTaskTick
 * （footer 入口随之刷新余额），自身经 useTaskTick 立即重算 token 与预估费用，
 * 保证一轮任务结束后的数字即为最终值。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtAmount, fmtTokens, t } from '../i18n.ts'
import { NumberRoller } from './NumberRoller.tsx'
import type { RunFn } from '../rpc.ts'

/** 会话费用查询返回的最小读取形状。 */
interface SessionCostView {
  amount?: number
  buckets?: { uncachedInput: number; cacheRead: number; cacheWrite: number; output: number }
}

/** 四桶 token 总数。 */
function totalTokensOf(b: NonNullable<SessionCostView['buckets']>): number {
  return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output
}

export interface HeaderButtonProps {
  /** 当前会话 id（插槽标准 props）。 */
  sessionId: string
  /** 宿主 op 通道。 */
  run: RunFn
  /** 自动刷新 tick（到点变化时触发刷新）。 */
  useTick(): number
  /** 价格配置保存 tick（弹框保存成功后变化，立即刷新费用金额）。 */
  usePriceTick?(): number
  /**
   * 宿主注入的会话快照选择 hook（会话级插槽标准套件；运行时提供
   * 'session' → useSession）。缺省时不做「任务完成」监听。
   */
  useSession?(selector: (s: { running?: boolean }) => unknown): unknown
  /** 任务完成 tick（插件共享 store）：会话任务结束时递增，自身订阅后刷新。 */
  useTaskTick?(): number
  /** 任务完成广播：检测到 running true→false 时调用，footer 入口随之刷新余额。 */
  bumpTaskTick?(): void
}

export function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, useTaskTick, bumpTaskTick }: HeaderButtonProps) {
  const tick = useTick()
  const priceTick = usePriceTick?.() ?? 0
  const taskTick = useTaskTick?.() ?? 0
  const [tokens, setTokens] = useState<number | null>(null)
  const [amount, setAmount] = useState<number | null>(null)

  const running = useSession ? (useSession((s) => s.running) as boolean | undefined) : undefined
  // 记录上一次 running：仅在 true→false（任务完成）瞬间广播。
  const prevRunning = useRef<boolean | null>(null)

  const refresh = useCallback(async () => {
    try {
      const costRes = await run(sessionId, { op: 'cost', sessionId })
      const session = (costRes.cost as { session?: SessionCostView } | undefined)?.session
      if (session === undefined) return
      if (session.amount !== undefined) setAmount(session.amount)
      if (session.buckets !== undefined) setTokens(totalTokensOf(session.buckets))
    } catch {
      // 保持上一次值。
    }
  }, [run, sessionId])

  // 挂载 / 会话切换 / 自动刷新 tick / 任务完成 tick / 价格保存 tick 变化时刷新；
  // 点击按钮手动刷新一次。
  useEffect(() => {
    void refresh()
  }, [refresh, tick, taskTick, priceTick])

  // 任务完成：会话快照 running 由 true 回落 false —— 广播 bumpTaskTick（footer
  // 余额随之刷新），自身经上方 useTaskTick 变化立即重算 token 与预估费用。
  useEffect(() => {
    if (running === undefined) return
    if (prevRunning.current === true && running === false) bumpTaskTick?.()
    prevRunning.current = running
  }, [running, bumpTaskTick])

  // 数字「上下轮播」动画：token 紧凑缩写（K/M/B/T/P 后缀列静态）、金额
  // （≈¥ 前缀之外的数字部分逐位滚动）。
  const tokensText = tokens === null ? '--' : fmtTokens(tokens)
  const amountText = amount === null ? '--' : fmtAmount(amount)
  const title = t('headerBtnPrefix') + ' ' + tokensText + ' | ≈¥' + amountText
  return (
    <button
      type="button"
      className="dshb-header-btn"
      title={title}
      aria-label={title}
      onClick={() => void refresh()}
    >
      <span>{t('headerBtnPrefix')}</span>
      {' '}
      <NumberRoller value={tokens} format={fmtTokens} fallback="--" className="dshb-header-tokens" />
      <span className="dshb-header-sep">|</span>
      <span className="dshb-header-amount">≈¥<NumberRoller value={amount} format={fmtAmount} fallback="--" className="dshb-header-amount-num" /></span>
    </button>
  )
}
