/**
 * dsh-get-balance —— 侧边栏底部入口（sidebar.footer.action）：
 * 常驻的「余额」按钮（footer.action 区），点击打开统一弹框
 * （余额 / 费用 / 价格设置 三个 tab）。
 *
 * 右侧文案横排显示：「余额 ¥110.00 · 时段小圆点」——余额靠右对齐（货币符号前缀、
 * 数字绿色）；时段文案收敛为小圆点（高峰红 / 空闲绿），悬停使用宿主的
 * Tooltip（@deepseek-ai/dsh-client-ui-primitives，运行时从宿主 seed 表解析）
 * 气泡提示完整信息「当前为高峰时段 全价计费」/「当前为空闲时段 半价计费」，
 * 其中价词着色（高峰「全价」红 / 空闲「半价」绿，与圆点同色）。
 * 时段判定与宿主一致（时区偏移 + 高峰窗口 + 周六日半价，按当前时间），
 * 每 60 秒刷新；弹框内保存价格成功或关闭弹框后立即刷新。
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { t } from '../i18n.ts'
import { NumberRoller } from './NumberRoller.tsx'
import { BALANCE_LOGO_PNG } from '../logo.ts'
import type { RunFn } from '../rpc.ts'

interface PeakWindowView {
  start: string
  end: string
}

interface PriceConfigView {
  timezoneOffsetMinutes?: number
  peakWindows?: PeakWindowView[]
  weekendOffPeak?: boolean
}

interface BalanceInfoView {
  currency: string
  total_balance: string
}

interface BalanceEntryView {
  providerId: string
  ok: boolean
  balance_infos?: BalanceInfoView[]
}

/** 解析 'HH:MM' 为当日分钟数；非法返回 undefined（与宿主 cost.ts 同规则）。 */
function parseClock(value: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim())
  if (m === null) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return undefined
  return h * 60 + min
}

/** 判定一个时刻是否处于高峰时段（与宿主 isPeakTime 同逻辑，含周六日半价）。 */
function isPeakNow(config: PriceConfigView, nowMs: number): boolean {
  const offset = typeof config.timezoneOffsetMinutes === 'number' ? config.timezoneOffsetMinutes : 480
  const local = new Date(nowMs + offset * 60_000)
  // 周六日半价：周六/周日整天视为空闲时段。
  if (config.weekendOffPeak === true) {
    const day = local.getUTCDay()
    if (day === 0 || day === 6) return false
  }
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes()
  for (const window of config.peakWindows ?? []) {
    const start = parseClock(window.start)
    const end = parseClock(window.end)
    if (start === undefined || end === undefined) continue
    // 支持跨午夜的窗口：start <= end 时取 [start, end)；start > end 时取 [start, 1440) ∪ [0, end)。
    if (start <= end) {
      if (minutes >= start && minutes < end) return true
    } else if (minutes >= start || minutes < end) {
      return true
    }
  }
  return false
}

/** 常见货币代码 → 符号（余额前缀展示）；未收录的代码回退为代码本身（无代码时为空）。 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  HKD: 'HK$',
  KRW: '₩',
  INR: '₹',
  RUB: '₽',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  CHF: 'Fr.',
  TWD: 'NT$',
}

function currencySymbol(code: string): string {
  const c = (code || '').trim().toUpperCase()
  return c !== '' ? (CURRENCY_SYMBOLS[c] ?? c) : ''
}

/** 时段气泡纯文本（aria-label / 窄栏按钮 title 用）：{price} 占位替换为价词文本。 */
function tipPlain(peak: boolean): string {
  const word = peak ? t('tipFullPrice') : t('tipHalfPrice')
  return t(peak ? 'tipPeak' : 'tipOffPeak').split('{price}').join(word)
}

/**
 * 时段气泡富文本（宿主 Tooltip 渲染）：{price} 处插入彩色价词
 * （高峰「全价」红 / 空闲「半价」绿，与圆点同色）。宿主 Tooltip 的 label
 * 类型仅声明为 string，但其运行时直接渲染 ReactNode，这里以函数形式 +
 * 类型收窄注入彩色片段（宿主运行时行为不变，无需改宿主）。
 */
function tipRich(peak: boolean): ReactNode {
  const [before, after] = t(peak ? 'tipPeak' : 'tipOffPeak').split('{price}')
  return (
    <span className="dshb-tip">
      {before}
      <b className={peak ? 'dshb-tip-full' : 'dshb-tip-half'}>{peak ? t('tipFullPrice') : t('tipHalfPrice')}</b>
      {after}
    </span>
  )
}

export interface FooterButtonProps {
  /** 打开统一「余额」弹框。 */
  onOpen(): void
  /** 上报当前会话 id（供费用查询经宿主读取内存会话）。 */
  reportSession?: (sessionId: string) => void
  wide?: boolean
  useSessions?: (selector: (s: { current?: string }) => unknown) => unknown
  /** 宿主 op 通道（pricesGet 取时段配置）。 */
  run: RunFn
  /** 弹框开合状态（关闭后刷新按钮时段文案）。 */
  useOpen(): boolean
  /** 价格配置保存 tick（弹框保存成功后变化，立即刷新时段文案）。 */
  usePriceTick?(): number
  /** 任务完成 tick（插件共享 store）：头部按钮广播会话任务结束后递增，此处强制刷新余额。 */
  useTaskTick?(): number
}

export function FooterButton({ onOpen, reportSession, wide = false, useSessions, run, useOpen, usePriceTick, useTaskTick }: FooterButtonProps) {
  const currentSessionId = useSessions
    ? (useSessions((s) => s && s.current) as string | undefined)
    : null
  if (reportSession && currentSessionId) reportSession(currentSessionId)

  const open = useOpen()
  const priceTick = usePriceTick?.() ?? 0
  const taskTick = useTaskTick?.() ?? 0
  const [peak, setPeak] = useState<boolean | null>(null)
  const [bal, setBal] = useState<{ total: string; currency: string } | null>(null)

  const refresh = useCallback(async (forceBalance = false) => {
    try {
      const res = await run('', { op: 'pricesGet' })
      const config = res.config as PriceConfigView | undefined
      if (config !== undefined) setPeak(isPeakNow(config, Date.now()))
    } catch {
      // 网络/路由异常时保持上一次状态，不闪断。
    }
    try {
      // refresh:false 命中宿主 60s 余额缓存，不触发真实请求；
      // 任务完成触发的刷新 forceBalance=true 绕过缓存拿到最新余额。
      const res = await run('', { op: 'balance', refresh: forceBalance })
      const balances = res.balances as BalanceEntryView[] | undefined
      const first = Array.isArray(balances)
        ? balances.find((b) => b.ok === true && Array.isArray(b.balance_infos) && b.balance_infos.length > 0)
        : undefined
      const info = first?.balance_infos?.[0]
      if (info !== undefined) setBal({ total: info.total_balance, currency: info.currency })
    } catch {
      // 余额查询失败时保持上一次状态。
    }
  }, [run])

  // 挂载即查 + 每 60 秒随当前时间刷新；弹框关闭（可能刚保存过价格）立即刷新。
  useEffect(() => {
    void refresh()
    const id = setInterval(() => { void refresh() }, 60_000)
    return () => clearInterval(id)
  }, [refresh])
  useEffect(() => {
    if (!open) void refresh()
  }, [open, refresh])
  // 弹框内保存价格成功（含周六日半价开关）：跳过 60s 轮询立即刷新时段文案。
  useEffect(() => {
    if (priceTick > 0) void refresh()
  }, [priceTick, refresh])
  // 会话任务完成（头部按钮广播）：立即强制刷新余额（绕过 60s 缓存）+ 时段文案。
  useEffect(() => {
    if (taskTick > 0) void refresh(true)
  }, [taskTick, refresh])

  // 「余额」+ 时段小圆点作为一个整体锚点挂宿主 Tooltip：悬停二字或圆点都显示
  // 气泡（高峰红 / 空闲绿，价词着色：高峰「全价」红 / 空闲「半价」绿）。
  const periodTip = peak === null ? '' : tipPlain(peak)
  const periodGroup = peak === null
    ? <span className="dshb-footer-word">{t('balanceBtn')}</span>
    : (
      <Tooltip label={(() => tipRich(peak)) as unknown as () => string} side="top" delayMs={300}>
        <span className="dshb-footer-word-group">
          <span className="dshb-footer-word">{t('balanceBtn')}</span>
          <span
            className={'dshb-period-dot ' + (peak ? 'dshb-period-dot-peak' : 'dshb-period-dot-off')}
            aria-label={periodTip}
          />
        </span>
      </Tooltip>
    )
  const curSym = bal === null ? '' : currencySymbol(bal.currency)
  const balText = bal === null ? '' : curSym + bal.total
  const fullLabel = t('balanceBtn') + (balText !== '' ? ' ' + balText : '') + (periodTip !== '' ? ' ' + periodTip : '')

  // 余额数字「上下轮播」动画：值变化时逐位滚动到新值（2 位小数）。
  const balValue = bal === null
    ? null
    : (() => {
      const n = parseFloat(bal.total)
      return Number.isFinite(n) ? n : null
    })()

  return (
    <div className={'dshb-footer-group' + (wide ? '' : ' dshb-footer-rail-group')}>
      <button
        type="button"
        className={'dshb-footer-btn' + (wide ? '' : ' dshb-footer-btn-rail')}
        // 宽模式信息全部可见（余额文案 + 圆点气泡），再挂原生 title 会在悬停
        // 圆点时与 Tooltip 气泡双重弹出；窄栏（仅图标）保留原生 title 兜底。
        title={wide ? undefined : fullLabel}
        aria-label={fullLabel}
        onClick={onOpen}
      >
        <img src={BALANCE_LOGO_PNG} alt="" className="dshb-footer-logo" />
        {wide
          ? (
            <span className="dshb-footer-label">
              {periodGroup}
              {bal !== null ? (
                <span className="dshb-footer-balance">
                  {curSym !== '' ? <span className="dshb-footer-cur">{curSym}</span> : null}
                  <NumberRoller value={balValue} format={(v) => v.toFixed(2)} fallback="--" className="dshb-footer-balance-num" />
                </span>
              ) : null}
            </span>
          )
          : null}
      </button>
    </div>
  )
}
