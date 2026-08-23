/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ≈¥xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与
 * 预估费用（≈ 在前、货币符号 ¥ 在后，与金额同绿）。文案空格固定为
 * 「前缀 1.87M | ≈¥0.2935」（前缀与 token 之间一个空格、| 两侧空格）。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 * 额外监听宿主会话快照（会话级插槽标准套件 useSession 注入）：每次 AI 请求
 * 完成（assistant/message 事件落盘，快照中新增一个更高 seq 的 assistant 节点）
 * 即重算 token 与预估费用 —— 不是流式逐 token 更新，而是每次请求完成更新一次
 * （一轮含多次请求时逐次更新）。余额刷新按请求走的接口区分：该请求走 DeepSeek
 * 官方接口（api.deepseek.com，cost op 的 lastRequestOfficial=true）才广播
 * bumpBalanceTick 让 footer 强制刷新余额；非官方接口只更新 token 与预估费用。
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

/** 会话快照中已落盘的 assistant 消息节点视图（仅取判定所需字段）。 */
interface AssistantSeqView {
  readonly nodes?: readonly { kind?: string; seq?: number }[]
}

/** 快照中 assistant 消息节点的最大事件 seq；没有任何 assistant 消息时为 0。
 *  assistant/message 事件在会话日志中按序追加，seq 单调递增；窗口截断只会
 *  丢弃最早的节点，最大 seq 不受影响，因此是「请求完成」的稳定信号。 */
function maxAssistantSeqOf(nodes: readonly { kind?: string; seq?: number }[] | undefined): number {
  if (!Array.isArray(nodes)) return 0
  let max = 0
  for (const node of nodes) {
    if (node && node.kind === 'assistant' && typeof node.seq === 'number' && node.seq > max) max = node.seq
  }
  return max
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
   * 'session' → useSession）。缺省时不做「请求完成」监听。
   */
  useSession?(selector: (s: { nodes?: readonly { kind?: string; seq?: number }[] }) => unknown): unknown
  /** 余额刷新广播：刚完成的请求走 DeepSeek 官方接口时调用，footer 随之强制刷新余额。 */
  bumpBalanceTick?(): void
}

export function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, bumpBalanceTick }: HeaderButtonProps) {
  const tick = useTick()
  const priceTick = usePriceTick?.() ?? 0
  const [tokens, setTokens] = useState<number | null>(null)
  const [amount, setAmount] = useState<number | null>(null)

  // 已落盘的 assistant 消息最大事件 seq：每次 AI 请求完成（assistant/message）
  // 都会让它增大，作为「请求完成」的稳定信号（流式 chunk 不改变它）。
  const assistantSeq = useSession ? (useSession((s: AssistantSeqView) => maxAssistantSeqOf(s.nodes)) as number) : 0
  // 会话切换时重置观察状态（组件实例可能被复用）。
  const prevSessionId = useRef<string | null>(null)
  // 历史最大 assistant seq：超过它即视为一次新的 AI 请求完成。
  const maxAssistantSeq = useRef<number | null>(null)

  /**
   * 刷新 token 与预估费用（cost op）。gateBalance=true 时（请求完成路径）：
   * 仅当最近一次完成的请求走 DeepSeek 官方接口（lastRequestOfficial=true）才
   * 广播 bumpBalanceTick —— 非官方接口的请求不触发余额查询。
   */
  const refresh = useCallback(async (gateBalance = false) => {
    try {
      const costRes = await run(sessionId, { op: 'cost', sessionId })
      const cost = costRes.cost as ({ session?: SessionCostView } & { lastRequestOfficial?: boolean }) | undefined
      const session = cost?.session
      if (session === undefined) return
      if (session.amount !== undefined) setAmount(session.amount)
      if (session.buckets !== undefined) setTokens(totalTokensOf(session.buckets))
      if (gateBalance && cost?.lastRequestOfficial === true) bumpBalanceTick?.()
    } catch {
      // 保持上一次值。
    }
  }, [run, sessionId, bumpBalanceTick])

  // 挂载 / 会话切换 / 自动刷新 tick / 价格保存 tick 变化时刷新；点击按钮手动刷新一次。
  // 请求完成不在此列：由下方完成 effect 直接调用 refresh(true)，避免重复 cost 查询。
  useEffect(() => {
    void refresh()
  }, [refresh, tick, priceTick])

  // 会话切换：清空观察状态，避免把上一会话的 seq 当作增量误触发。
  useEffect(() => {
    if (prevSessionId.current !== sessionId) {
      prevSessionId.current = sessionId
      maxAssistantSeq.current = null
    }
  }, [sessionId])

  // 每次 AI 请求完成（assistant/message 落盘 → 快照出现更高 seq 的 assistant 节点）：
  // 立即重算 token 与预估费用；若该请求走 DeepSeek 官方接口，附带广播 bumpBalanceTick
  // （footer 余额随之强制刷新）。首次观察只记录历史存量（会话已有历史消息），不触发。
  useEffect(() => {
    if (useSession === undefined) return
    if (maxAssistantSeq.current === null) {
      maxAssistantSeq.current = assistantSeq
      return
    }
    if (assistantSeq > maxAssistantSeq.current) {
      maxAssistantSeq.current = assistantSeq
      void refresh(true)
    }
  }, [useSession, assistantSeq, refresh])

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
