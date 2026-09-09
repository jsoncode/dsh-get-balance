/**
 * dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
 * 【当前会话 xxM | ≈¥xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与
 * 预估费用（≈ 在前、货币符号 ¥ 在后，与金额同绿）。文案空格固定为
 * 「前缀 1.87M | ≈¥0.2935」（前缀与 token 之间一个空格、| 两侧空格）。
 * 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
 * 会话可能中途切换 provider：按钮展示的是**合并统计结果**，**悬停**按钮
 * 弹出气泡弹框，逐 provider 列出当前会话统计（`ds-self 268K | ≈¥0.41`），
 * 鼠标移出按钮/气泡区域后自动收起。
 * 额外监听会话事件（三条冗余触发路径，350ms 合并 + 1.5s 节流，一次只查一次
 * cost op，且只更新 token 与预估费用）：
 * 1. useChat（插槽标准套件，主信号）：会话 chat 快照的已落盘节点里出现更高的
 *    assistant 消息 seq —— assistant/message 事件落盘即产生该节点，正是「一次
 *    响应结束」；
 * 2. sessions 服务的 eventSource（直连兜底）：窗口追加 assistant/message 事件
 *    时立即回调，不依赖插槽标准套件；
 * 3. useSession（插槽标准套件）：快照 running 从 true 变为 false —— 整轮结束
 *    时补一次，且**只有这条路径**会带 gate：最近一次完成的请求走 DeepSeek 官方
 *    接口（api.deepseek.com，cost op 的 lastRequestOfficial=true）才广播
 *    bumpBalanceTick 让 footer 强制刷新余额 —— 即每轮最多一次余额接口请求。
 *    前两条路径（每次响应结束）不碰余额接口，只更新 token 与预估费用。
 * 除上述事件信号外，以下时刻直接刷新一次：挂载、**切换会话 / 切换工作区后打开
 * 另一个会话**（清空上一会话的显示值并重查，宿主未就绪时自动重试）、定时更新
 * tick、价格保存 tick、点击按钮 / 悬停。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { currencySymbol, fmtAmount, fmtTokens, t } from '../i18n.ts'
import { NumberRoller } from './NumberRoller.tsx'
import type { RunFn } from '../rpc.ts'

/** 会话费用查询返回的最小读取形状。 */
interface BucketsView {
  uncachedInput: number
  cacheRead: number
  cacheWrite: number
  output: number
}

interface KeyCostView {
  provider: string
  buckets: BucketsView
  official: boolean
  amount: number
  currency: string
}

interface SessionCostView {
  amount?: number
  buckets?: BucketsView
  /** 按 provider（API key）分组的明细：气泡弹框逐行展示。 */
  byKey?: KeyCostView[]
}

/** providers op 的最小读取形状（气泡弹框把路由 key 解析为展示名）。 */
interface ProviderView {
  id: string
  label: string
}

/** 四桶 token 总数。 */
function totalTokensOf(b: NonNullable<SessionCostView['buckets']>): number {
  return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output
}

/** 会话 chat 快照中已落盘的节点（仅取判定所需字段）。 */
interface ChatNodeView {
  kind?: string
  seq?: number
}

/** 会话 chat 快照（useChat 选择器入参；宿主未注册 chat 目标时可能为空）。 */
interface ChatSnapshotView {
  legacy?: { nodes?: readonly ChatNodeView[] }
}

/**
 * 快照中 assistant 节点的最大事件 seq；没有任何 assistant 节点时为 0。
 * assistant/message 事件在会话日志中按序追加、seq 单调递增，落盘即产生一个
 * assistant 节点（流式 chunk 不产生节点，进行中的响应只存在于 legacy.partial）；
 * 窗口截断只会丢弃最早的节点，最大 seq 不受影响 —— 因此「最大 seq 变大」就是
 * 「一次 AI 请求完成」的稳定信号。
 */
function maxAssistantSeqOf(nodes: readonly ChatNodeView[] | undefined): number {
  if (!Array.isArray(nodes)) return 0
  let max = 0
  for (const node of nodes) {
    if (node && node.kind === 'assistant' && typeof node.seq === 'number' && node.seq > max) max = node.seq
  }
  return max
}

/**
 * 多个完成信号合并为一次 cost 查询的窗口（毫秒）——同一次响应结束会同时命中
 * 多条信号，合并后只查一次。
 */
const REFRESH_COALESCE_MS = 350
/**
 * 两次「事件驱动」刷新之间的最小间隔（毫秒，节流）：一轮含多步时不会连续打
 * 宿主；窗口内最后一次信号由尾随刷新兜底，最终值不会丢。
 */
const REFRESH_MIN_INTERVAL_MS = 1500
/**
 * 会话切换后宿主的会话绑定 / 日志可能尚未就绪（cost 查询空返回或报错）：按此
 * 间隔重试，直到拿到本次会话的统计值。
 */
const SWITCH_REFRESH_RETRY_MS = 400
/** 会话切换后的最多重试次数（含首次共 4 次查询）。 */
const SWITCH_REFRESH_RETRIES = 3

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
   * 'session' → useSession）。用作「整轮结束」兜底信号，缺省时不做该监听。
   */
  useSession?(selector: (s: { running?: boolean }) => unknown): unknown
  /**
   * 宿主注入的会话 chat 选择 hook（会话级插槽标准套件；运行时提供
   * 'chat' → useChat）。主信号：assistant 消息节点落盘即一次响应结束。
   * 缺省时退化为仅靠 useSession / 定时 / 悬停触发。
   */
  useChat?(selector: (s: ChatSnapshotView) => unknown): unknown
  /**
   * 会话事件直连订阅（宿主 sessions 服务的 per-session eventSource，软依赖）：
   * assistant/message 落盘即回调。返回退订函数，服务不可达时返回 null。
   * 与上面两个 hook 互为冗余，任一可用即可感知「一次响应结束」。
   */
  subscribeSessionEvents?(sessionId: string, onAssistantMessage: () => void): (() => void) | null
  /** 余额刷新广播：刚完成的请求走 DeepSeek 官方接口时调用，footer 随之强制刷新余额。 */
  bumpBalanceTick?(): void
}

export function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, useChat, subscribeSessionEvents, bumpBalanceTick }: HeaderButtonProps) {
  const tick = useTick()
  const priceTick = usePriceTick?.() ?? 0
  const [tokens, setTokens] = useState<number | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  // 逐 provider 明细（气泡弹框）：cost.session.byKey（token 降序，宿主已排）。
  const [byKey, setByKey] = useState<KeyCostView[] | null>(null)
  // 气泡弹框开关与锚点位置（fixed 定位，避免被头部容器 overflow 裁剪）。
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  // providers 展示名缓存（路由 key → label），气泡弹框展示用。
  const [providerLabels, setProviderLabels] = useState<Record<string, string> | null>(null)

  // ─── 完成信号（会话级插槽标准套件注入的 hook）─────────────────────
  // 主信号：chat 快照里已落盘的 assistant 节点最大 seq（落盘 +1 = 一次响应结束）。
  const assistantSeq = useChat ? (useChat((s: ChatSnapshotView) => maxAssistantSeqOf(s?.legacy?.nodes)) as number) : 0
  // 兜底信号：会话 running（true → false = 整轮结束，含子代理并入的用量）。
  const running = useSession ? (useSession((s: { running?: boolean }) => s.running ?? false) as boolean) : false
  // 会话切换时重置观察状态（组件实例可能被复用）。
  const prevSessionId = useRef<string | null>(null)
  // 当前会话 id 镜像：cost 响应回来时判定是否已被会话切换淘汰。
  const sessionIdRef = useRef<string>(sessionId)
  // 显示值所属的会话 id：与 sessionId 不同即发生切换（需要清空旧值并重查）。
  const shownSessionIdRef = useRef<string | null>(null)
  // 上一次观察到的 assistant seq：null = 尚未观察（首次只记录，不触发）。
  const prevAssistantSeq = useRef<number | null>(null)
  // 上一次的 running 值：检测 true → false 转换。
  const prevRunning = useRef<boolean>(false)

  /**
   * 刷新 token 与预估费用（cost op）。gateBalance=true 时（请求完成路径）：
   * 仅当最近一次完成的请求走 DeepSeek 官方接口（lastRequestOfficial=true）才
   * 广播 bumpBalanceTick —— 非官方接口的请求不触发余额查询。
   * @param gateBalance - 是否允许本次查询触发余额刷新广播。
   * @returns 是否已把本次会话的统计值写入显示状态（false = 空返回 / 失败 / 已被切换淘汰）。
   */
  const refresh = useCallback(async (gateBalance = false): Promise<boolean> => {
    // 发起时的会话 id：响应回来时用它判定是否已被会话切换淘汰。
    const target = sessionId
    if (target.length === 0) return false
    try {
      const costRes = await run(target, { op: 'cost', sessionId: target })
      // 会话已切换：丢弃上一会话的迟到响应，否则新会话会闪出旧数字。
      if (sessionIdRef.current !== target) return false
      const cost = costRes.cost as ({ session?: SessionCostView } & { lastRequestOfficial?: boolean }) | undefined
      const session = cost?.session
      if (session === undefined) return false
      if (session.amount !== undefined) setAmount(session.amount)
      if (session.buckets !== undefined) setTokens(totalTokensOf(session.buckets))
      if (Array.isArray(session.byKey)) setByKey(session.byKey)
      if (gateBalance && cost?.lastRequestOfficial === true) bumpBalanceTick?.()
      return session.amount !== undefined || session.buckets !== undefined
    } catch {
      // 保持上一次值（会话切换路径由调用方重试）。
      return false
    }
  }, [run, sessionId, bumpBalanceTick])

  // 气泡弹框展示名：路由 key → providers 列表 label（一次拉取缓存）。
  const labelOf = (route: string): string => providerLabels?.[route] ?? route
  const loadProviderLabels = useCallback(async (): Promise<void> => {
    if (providerLabels !== null) return
    try {
      const res = await run('', { op: 'providers' })
      const providers = res.providers as ProviderView[] | undefined
      if (!Array.isArray(providers)) return
      const map: Record<string, string> = {}
      for (const p of providers) {
        // 会话事件里的 provider 是路由 key（如 ds-self / deepseek-official），
        // 与 providers 条目的 id（pi-ai:ds-self / llm-deepseek:deepseek-official）对应。
        const route = p.id.replace(/^(pi-ai|llm-deepseek|extra):/, '')
        if (route.length > 0 && p.label.length > 0) map[route] = p.label
        if (p.label.length > 0) map[p.label] = p.label
      }
      setProviderLabels(map)
    } catch { /* 宿主不可达：保留原始路由名 */ }
  }, [run, providerLabels])

  // 挂载即取 providers 展示名（气泡弹框用）。
  useEffect(() => {
    void loadProviderLabels()
  }, [loadProviderLabels])

  // ─── 挂载 / 会话切换 / 自动刷新 tick / 价格保存 tick → 刷新 ──────────
  // 会话切换（含切换工作区后打开另一个会话）必须立即更新：先清空上一会话的
  // 显示值，再查一次 cost op；宿主在切换瞬间可能尚未就绪（cost op 空返回或
  // 报错），按 SWITCH_REFRESH_RETRY_MS 间隔重试 SWITCH_REFRESH_RETRIES 次兜底。
  // 依赖里放的是会话 id / tick 这些原始值而非 refresh 回调，会话切换只走这一条
  // 路径，不会与下方事件驱动调度重复查询。点击按钮仍走手动刷新一次。
  // 请求完成不在此列：由下方完成 effect 走合并窗口调度，避免重复 cost 查询。
  useEffect(() => {
    sessionIdRef.current = sessionId
    // 复用实例（未重新挂载）时也要清空旧值：显示值必须属于当前会话。
    if (shownSessionIdRef.current !== sessionId) {
      shownSessionIdRef.current = sessionId
      setTokens(null)
      setAmount(null)
      setByKey(null)
    }
    let cancelled = false
    let timer: number | null = null
    let attempts = 0
    const kick = (): void => {
      void refresh().then((applied) => {
        // 已切换走了：不再为上一个会话补查（显示值已被下一次 effect 清空）。
        if (cancelled || sessionIdRef.current !== sessionId) return
        if (applied || attempts >= SWITCH_REFRESH_RETRIES) return
        attempts += 1
        timer = window.setTimeout(kick, SWITCH_REFRESH_RETRY_MS)
      })
    }
    kick()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
    // refresh 仅在 run / sessionId / bumpBalanceTick 变化时重建，其中只有
    // sessionId 会随本次 effect 一起变化（run 与 bumpBalanceTick 是插件级稳定值）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, tick, priceTick])

  // ─── 完成信号 → 合并 + 节流调度 ──────────────────────────────────
  // 一次响应结束会同时命中多个信号（assistant 节点落盘、事件流追加），
  // 350ms 窗口内合并为一次 cost 查询；两次查询之间至少间隔 1500ms，窗口内
  // 最后一次信号由尾随刷新兜底。gate（余额刷新）只在整轮结束时带上。
  const coalesceTimerRef = useRef<number | null>(null)
  const gateRef = useRef(false)
  const lastRefreshAtRef = useRef(0)
  const busyRef = useRef(false)
  const scheduleRefresh = useCallback((gate: boolean): void => {
    if (gate) gateRef.current = true
    if (coalesceTimerRef.current !== null) return
    const wait = Math.max(
      REFRESH_COALESCE_MS,
      lastRefreshAtRef.current + REFRESH_MIN_INTERVAL_MS - Date.now(),
    )
    coalesceTimerRef.current = window.setTimeout(() => {
      coalesceTimerRef.current = null
      // 上一次查询仍在途：稍后重试（尾随刷新），避免请求叠加。
      if (busyRef.current) {
        scheduleRefresh(false)
        return
      }
      const withGate = gateRef.current
      gateRef.current = false
      lastRefreshAtRef.current = Date.now()
      busyRef.current = true
      void refresh(withGate).finally(() => { busyRef.current = false })
    }, Math.max(0, wait))
  }, [refresh])

  // 会话切换：清空观察状态，避免把上一会话的信号误判为本次完成。
  useEffect(() => {
    if (prevSessionId.current !== sessionId) {
      prevSessionId.current = sessionId
      prevRunning.current = false
      prevAssistantSeq.current = null
    }
  }, [sessionId])

  // 主信号：assistant 消息节点落盘（最大 seq 变大）→ 一次 AI 响应结束。
  // 只更新 token 与预估费用（不查余额接口）。首次观察只记录存量，不触发；
  // 观察到 0 时同样只记录 —— 会话切换后 chat 快照先空后有，加载完成会把最大
  // seq 从 0 抬到存量值，那是一次「载入」而非一次「完成」（切换时已由上方
  // 会话切换 effect 查过一次），否则每次切换都要多打一次 cost op。
  useEffect(() => {
    if (useChat === undefined) return
    const previous = prevAssistantSeq.current
    prevAssistantSeq.current = assistantSeq
    if (previous === null || previous === 0 || assistantSeq <= previous) return
    scheduleRefresh(false)
  }, [useChat, assistantSeq, scheduleRefresh])

  // 兜底信号：直接订阅会话事件流（宿主 sessions 服务的 eventSource），
  // assistant/message 落盘即刷新 token 与预估费用 —— 不依赖插槽标准套件 hook。
  // 宿主服务尚未就绪时按 1s 间隔重试（最多 10 次），卸载时清理订阅与定时器。
  useEffect(() => {
    if (subscribeSessionEvents === undefined) return
    let dispose: (() => void) | null = null
    let timer: number | null = null
    let attempts = 0
    const attach = (): void => {
      try {
        dispose = subscribeSessionEvents(sessionId, () => scheduleRefresh(false))
      } catch {
        dispose = null
      }
      if (dispose !== null || attempts++ >= 10) return
      timer = window.setTimeout(() => { timer = null; attach() }, 1000)
    }
    attach()
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      try { dispose?.() } catch { /* 退订失败忽略 */ }
    }
  }, [subscribeSessionEvents, sessionId, scheduleRefresh])

  // 整轮结束信号：running 从 true 变为 false —— 重算 token 与预估费用，
  // 并且只有这条路径带 gate（最近一次完成的请求走官方接口才广播
  // bumpBalanceTick 强制刷新 footer 余额，即每轮最多一次余额接口请求）。
  // 首次挂载只记录当前状态，不触发。
  useEffect(() => {
    if (useSession === undefined) return
    const wasRunning = prevRunning.current
    prevRunning.current = running
    if (wasRunning && !running) scheduleRefresh(true)
  }, [useSession, running, scheduleRefresh])

  // 卸载时清理合并窗口定时器。
  useEffect(() => () => {
    if (coalesceTimerRef.current !== null) window.clearTimeout(coalesceTimerRef.current)
  }, [])

  // 数字「上下轮播」动画：token 紧凑缩写（K/M/B/T/P 后缀列静态）、金额
  // （≈¥ 前缀之外的数字部分逐位滚动）。
  const tokensText = tokens === null ? '--' : fmtTokens(tokens)
  const amountText = amount === null ? '--' : fmtAmount(amount)
  const title = t('headerBtnPrefix') + ' ' + tokensText + ' | ≈¥' + amountText

  // 悬停交互：鼠标进入按钮/气泡区域即展开逐 provider 明细（fixed 锚定按钮下缘），
  // 离开后延迟 150ms 收起 —— 短暂延迟桥接按钮与气泡之间的空隙，
  // 指针跨空隙或移入气泡时 openPopover 会取消待执行的关闭，气泡不闪断。
  const hoverRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const clearCloseTimer = (): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }
  const openPopover = (): void => {
    hoverRef.current = true
    clearCloseTimer()
    void refresh()
    const el = btnRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setPopoverPos({ top: r.bottom + 6, left: Math.max(8, r.right - 260) })
    }
    setPopoverOpen(true)
  }
  const scheduleClose = (): void => {
    hoverRef.current = false
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      if (!hoverRef.current) setPopoverOpen(false)
    }, 150)
  }
  // 卸载时清理悬停关闭定时器。
  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
  }, [])

  return (
    <span className="dshb-header-wrap" onMouseEnter={openPopover} onMouseLeave={scheduleClose}>
      <button
        ref={btnRef}
        type="button"
        className="dshb-header-btn"
        title={title}
        aria-label={title}
        aria-expanded={popoverOpen}
        onClick={() => void refresh()}
      >
        <span>{t('headerBtnPrefix')}</span>
        {' '}
        <NumberRoller value={tokens} format={fmtTokens} fallback="--" className="dshb-header-tokens" />
        <span className="dshb-header-sep">|</span>
        <span className="dshb-header-amount">≈¥<NumberRoller value={amount} format={fmtAmount} fallback="--" className="dshb-header-amount-num" /></span>
      </button>
      {popoverOpen ? (
        <div className="dshb-header-bd" role="dialog" aria-label={t('headerBreakdownTitle')}
          style={popoverPos !== null ? { top: popoverPos.top, left: popoverPos.left } : undefined}>
          <div className="dshb-header-bd-title">{t('headerBreakdownTitle')}</div>
          {byKey === null || byKey.length === 0
            ? <div className="dshb-header-bd-empty">—</div>
            : byKey.map((k) => (
              <div className="dshb-header-bd-row" key={k.provider}>
                <span className="dshb-header-bd-name" title={k.provider}>{labelOf(k.provider)}</span>
                <span className="dshb-header-bd-tokens">{fmtTokens(totalTokensOf(k.buckets))}</span>
                <span className="dshb-header-bd-sep">|</span>
                {k.official
                  ? <span className="dshb-header-bd-amount">≈{currencySymbol(k.currency)}{fmtAmount(k.amount)}</span>
                  : <span className="dshb-header-bd-amount dshb-header-bd-nobill">{t('notBilled')}</span>}
              </div>
            ))}
        </div>
      ) : null}
    </span>
  )
}
