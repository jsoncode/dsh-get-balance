/**
 * dsh-get-balance —— 侧边栏底部入口（sidebar.footer.action）：
 * 常驻的「余额」按钮（footer.action 区），点击打开统一弹框
 * （余额 / 费用 / 价格设置 三个 tab）。
 *
 * 右侧文案横排显示：「余额 ￥110.00 | ￥99.50 · 时段小圆点」——余额靠右对齐
 * （货币符号前缀、数字绿色），**每个服务商（账号）一段**，以 | 分隔；
 * 取不到余额的账号（未配置 key / 查询失败）以**红色 --** 占位（悬停显示原因）。
 * 时段文案收敛为小圆点（高峰红 / 空闲绿），悬停使用宿主的
 * Tooltip（@deepseek-ai/dsh-client-ui-primitives，运行时从宿主 seed 表解析）
 * 气泡提示完整信息「当前为高峰时段 全价计费」/「当前为空闲时段 半价计费」，
 * 其中价词着色（高峰「全价」红 / 空闲「半价」绿，与圆点同色）。
 * 时段判定与宿主一致（时区偏移 + 高峰窗口 + 周六日半价，按当前时间），
 * 每 60 秒刷新；弹框内保存价格成功或关闭弹框后立即刷新。
 *
 * 更新胶囊：宿主 updateCheck op（npm registry keywords:dsh-get-balance 最新版
 * vs 被安装根目录 package.json 版本）判定 hasUpdate=true 时，在按钮**最右侧**
 * 以小尺寸胶囊显示【更新】（琥珀色、圆角 999px），悬停原生 title 提示
 * 「发现新版本 v{latest}，当前 v{current}」。胶囊外包一层等宽、撑满按钮整高
 * 的父盒子（.dshb-update-zone）作点击热区：stopPropagation 阻断事件穿透（不会
 * 误开余额弹框），点击打开「确认更新」弹框 → 确认后打开更新日志大弹框
 * （dsh plugin --profile web update 的详细执行日志）。窄栏（仅图标圆形按钮）
 * 时以绝对定位小圆点徽标叠在按钮右上角。
 */

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { currencySymbol, t, tErr } from '../i18n.ts'
import { NumberRoller } from './NumberRoller.tsx'
import { BALANCE_LOGO_PNG } from '../logo.ts'
import type { RunFn } from '../rpc.ts'
import type { UpdateInfo } from '../store.ts'

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
  code?: string
  error?: string
  balance_infos?: BalanceInfoView[]
}

/** 余额栏的一个分段：一个服务商（账号）的余额，或「未取到」的占位。 */
interface BalanceSegment {
  ok: boolean
  total: string
  currency: string
  code?: string
  error?: string
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
  /** 余额刷新 tick（插件共享 store）：头部按钮确认刚完成的请求走 DeepSeek 官方接口后递增，此处强制刷新余额。 */
  useBalanceTick?(): number
  /** 「显示余额」开关（插件共享 store）：false 时各分段金额掩码为 **。 */
  useShowBalance?(): boolean
  /** 插件更新信息（插件共享 store）：hasUpdate=true 时按钮最右侧显示【更新】小胶囊。 */
  useUpdate?(): UpdateInfo | null
  /** 点击更新热区（胶囊父盒子）：打开「确认更新」弹框。 */
  onUpdateClick?(): void
}

export function FooterButton({ onOpen, reportSession, wide = false, useSessions, run, useOpen, usePriceTick, useBalanceTick, useShowBalance, useUpdate, onUpdateClick }: FooterButtonProps) {
  const currentSessionId = useSessions
    ? (useSessions((s) => s && s.current) as string | undefined)
    : null
  if (reportSession && currentSessionId) reportSession(currentSessionId)

  const open = useOpen()
  const priceTick = usePriceTick?.() ?? 0
  const balanceTick = useBalanceTick?.() ?? 0
  // 「显示余额」开关：关闭时各分段金额一律显示为 **（与余额 tab 列表同步）。
  const showBalance = useShowBalance?.() ?? true
  const update = useUpdate?.() ?? null
  const [peak, setPeak] = useState<boolean | null>(null)
  // 每个服务商（账号）一段；null = 尚未取到（不渲染），[] = 无服务商（不渲染）。
  const [bals, setBals] = useState<BalanceSegment[] | null>(null)

  // 更新热区按渲染宽度给按钮留白（按钮本体 ref）。
  const btnRef = useRef<HTMLButtonElement>(null)
  const zoneRef = useRef<HTMLSpanElement>(null)

  // 【更新】胶囊热区绝对定位在按钮右缘（覆盖在内容之上）：显示时给按钮右侧
  // 添加与热区**等宽**的 padding（按胶囊实际渲染宽度测量，中/英文宽度不同），
  // 避免余额等文案跑到胶囊下面被覆盖；窄栏圆点徽标在右上角、不占内容空间，
  // 无需留白（不设置 padding）。
  useEffect(() => {
    const btn = btnRef.current
    if (btn === null) return
    if (wide && update !== null && update.hasUpdate && zoneRef.current !== null) {
      btn.style.paddingRight = (zoneRef.current.offsetWidth + 6) + 'px'
    } else {
      btn.style.paddingRight = ''
    }
  }, [update, wide])

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
      // 官方请求完成触发的刷新 forceBalance=true 绕过缓存拿到最新余额。
      const res = await run('', { op: 'balance', refresh: forceBalance })
      const balances = res.balances as BalanceEntryView[] | undefined
      if (Array.isArray(balances)) {
        // 顺序与宿主服务商（账号）列表一致：每个条目一段；
        // 取不到余额（无 key 配置 / 查询失败）的条目以红色 -- 占位。
        setBals(balances.map((b) => {
          const info = b.ok === true ? b.balance_infos?.[0] : undefined
          return {
            ok: b.ok === true && info !== undefined,
            total: info?.total_balance ?? '',
            currency: info?.currency ?? '',
            code: b.code,
            error: b.error,
          }
        }))
      }
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
  // 官方请求完成（头部按钮广播，仅 DeepSeek 官方接口的请求）：立即强制刷新余额
  // （绕过 60s 缓存）+ 时段文案。非官方请求不触发 —— 只更新 token 与预估费用。
  useEffect(() => {
    if (balanceTick > 0) void refresh(true)
  }, [balanceTick, refresh])

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
  // 多账号文案：每个服务商（账号）一段，| 分隔；取不到余额的分段以 -- 占位；
  // 「显示余额」关闭时全部分段掩码为 **。
  const balText = bals === null || bals.length === 0
    ? ''
    : bals.map((seg) => !showBalance ? '**' : seg.ok ? currencySymbol(seg.currency) + seg.total : '--').join(' | ')
  const fullLabel = t('balanceBtn') + (balText !== '' ? ' ' + balText : '') + (periodTip !== '' ? ' ' + periodTip : '')

  return (
    <div className={'dshb-footer-group' + (wide ? '' : ' dshb-footer-rail-group')}>
      <button
        ref={btnRef}
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
              {bals !== null && bals.length > 0 ? (
                <span className="dshb-footer-balance">
                  {bals.map((seg, i) => (
                    <Fragment key={i}>
                      {i > 0 ? <span className="dshb-footer-balance-sep" aria-hidden="true">|</span> : null}
                      {!showBalance
                        ? <span className="dshb-footer-balance-seg">**</span>
                        : seg.ok
                          ? (() => {
                            const sym = currencySymbol(seg.currency)
                            const n = parseFloat(seg.total)
                            return (
                              <span className="dshb-footer-balance-seg">
                                {sym !== '' ? <span className="dshb-footer-cur">{sym}</span> : null}
                                <NumberRoller value={Number.isFinite(n) ? n : null} format={(v) => v.toFixed(2)} fallback="--" className="dshb-footer-balance-num" />
                              </span>
                            )
                          })()
                          : (
                            <span className="dshb-footer-balance-seg dshb-footer-balance-err" title={tErr({ code: seg.code, error: seg.error }, t('noCredential'))}>--</span>
                          )}
                    </Fragment>
                  ))}
                </span>
              ) : null}
            </span>
          )
          : null}
        {/* 更新胶囊：按钮最右侧（余额之后），小尺寸琥珀色圆角；悬停提示新旧版本号。
            窄栏圆形按钮放不下文字胶囊，退化为右上角小圆点徽标（语义走 aria-label）。
            胶囊外包一层等宽、撑满按钮整高的父盒子（.dshb-update-zone）作点击热区：
            stopPropagation 阻断事件穿透——点击热区不会冒泡到按钮误开余额弹框，
            而是触发更新确认；整条热区都是可点击区域，不只胶囊文字本身。 */}
        {update !== null && update.hasUpdate ? (
          <span
            ref={zoneRef}
            className="dshb-update-zone"
            title={t('updateTip', { latest: update.latest, current: update.current })}
            aria-label={t('updateTip', { latest: update.latest, current: update.current })}
            onClick={(e) => { e.stopPropagation(); onUpdateClick?.() }}
          >
            <span className={'dshb-update-pill' + (wide ? '' : ' dshb-update-pill-dot')}>
              {wide ? t('updatePill') : ''}
            </span>
          </span>
        ) : null}
      </button>
    </div>
  )
}
