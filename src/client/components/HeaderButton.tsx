/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ¥≈xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与预估费用。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 */

import { useCallback, useEffect, useState } from 'react'
import { fmtAmount, fmtTokens, t } from '../i18n.ts'
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
}

export function HeaderButton({ sessionId, run, useTick, usePriceTick }: HeaderButtonProps) {
  const tick = useTick()
  const priceTick = usePriceTick?.() ?? 0
  const [tokens, setTokens] = useState<number | null>(null)
  const [amount, setAmount] = useState<number | null>(null)

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

  // 挂载 / 会话切换 / 自动刷新 tick / 价格保存 tick 变化时刷新；点击按钮手动刷新一次。
  useEffect(() => {
    void refresh()
  }, [refresh, tick, priceTick])

  const tokensText = tokens === null ? '--' : fmtTokens(tokens)
  const amountText = amount === null ? '--' : '≈' + fmtAmount(amount)
  const title = t('headerBtnPrefix') + ' ' + tokensText + ' | ¥' + amountText
  return (
    <button
      type="button"
      className="dshb-header-btn"
      title={title}
      aria-label={title}
      onClick={() => void refresh()}
    >
      <span>{t('headerBtnPrefix')}</span>
      <span className="dshb-header-tokens">{tokensText}</span>
      <span className="dshb-header-sep">|</span>
      <span className="dshb-header-amount">¥{amountText}</span>
    </button>
  )
}
