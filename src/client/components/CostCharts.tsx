/**
 * dsh-get-balance —— 费用 tab：ECharts 渲染层。
 *
 * - 按需注册：BarChart + LineChart + Grid/Tooltip/Legend 组件 + CanvasRenderer（不引入完整包）；
 * - ChartCard：tab 激活才 init，ResizeObserver 跟随容器宽度，卸载 dispose；
 * - stackedBarOption：其余图的公共骨架（堆叠柱、时间桶 x 轴、滚动图例），
 *   tooltip 默认按 token 压缩格式；
 * - costTokensComboOption：费用图专用组合图 —— 左轴金额（堆叠柱）+ 右轴 Token 量（折线），
 *   柱与线共用同一模型配色（线名自动加 Token 后缀以区分）。
 * - tooltip 通用防裁剪（纯 echarts API）：confine 把气泡钳制在图表区域内 ——
 *   靠近边缘时自动翻转/收拢，不再溢出图区、不被弹框边缘截断；
 *   extraCssText 限高 + 内部滚动兜底，模型很多时气泡也不会超出图表高度。
 * - 图例：plain 模式（不设 type:'scroll'）自动换行铺满宽度，不再滚动翻页；
 *   grid.bottom 预留多行图例空间。
 * - 深浅色：轴/分割线/文字颜色读 CSS 变量，柱色用固定调色板。
 */

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { currencySymbol, fmtAmount, fmtCompact, fmtTokens, getLang, t } from '../i18n.ts'

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

/** 固定调色板（模型 / 工作区堆叠按索引取色；缓存 / 用途用固定色）。 */
export const PALETTE = [
  '#1668e3', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
  '#f97316', '#84cc16', '#6366f1', '#14b8a6', '#e11d48', '#a3a3a3',
]

/** 读取 CSS 变量（深浅色主题跟随）；DOM 不可用或未定义时回退默认值。 */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v.length > 0 ? v : fallback
}

/** 一个堆叠柱系列。 */
export interface ChartSeriesDef {
  name: string
  data: number[]
  /** 缺省按索引取 PALETTE 色。 */
  color?: string
}

/** tooltip 防裁剪（echarts API）：钳制在图表区域内 + 限高内部滚动兜底。 */
const TOOLTIP_CONFINE = {
  confine: true,
  extraCssText: 'max-height:200px;overflow-y:auto;',
}

/** 堆叠柱状图公共 option 骨架。 */
export function stackedBarOption(
  labels: string[],
  series: ChartSeriesDef[],
  yName: string,
  tooltip?: (params: unknown[]) => string,
): EChartsCoreOption {
  const axisColor = cssVar('--dsw-alias-label-secondary', '#888')
  const gridColor = cssVar('--dsw-alias-border-l1', '#eee')
  const labelPrimary = cssVar('--dsw-alias-label-primary', '#222')
  const tooltipBg = cssVar('--dsw-alias-bg-layer-2', '#fff')
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: tooltipBg,
      borderColor: cssVar('--dsw-alias-border-l2', '#ddd'),
      textStyle: { color: labelPrimary, fontSize: 12 },
      formatter: tooltip ?? defaultTokenTooltip,
      ...TOOLTIP_CONFINE,
    },
    legend: {
      // plain 模式（缺省）：图例按宽度自动换行，不再滚动翻页。
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10,
      textStyle: { color: axisColor, fontSize: 11 },
    },
    // bottom 预留多行图例空间（图例锚在 bottom:0，行数多时向上生长）。
    grid: { left: 8, right: 14, top: 10, bottom: 64, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: cssVar('--dsw-alias-border-l2', '#ccc') } },
      axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: yName,
      nameTextStyle: { color: cssVar('--dsw-alias-label-tertiary', '#999'), fontSize: 10, padding: [0, 0, 0, -4] },
      // 网格线颜色淡化（低不透明度，仅作轻微刻度参考，不与柱体抢视觉）。
      splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.15 } },
      // 坐标简写：K / M / B / T（金额与 Token 两类轴统一）。
      axisLabel: { color: cssVar('--dsw-alias-label-tertiary', '#999'), fontSize: 10, formatter: (v: number) => fmtCompact(v) },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      data: s.data,
      itemStyle: { color: s.color ?? (PALETTE[i % PALETTE.length] as string) },
      emphasis: { focus: 'series' },
      barMaxWidth: 28,
    })),
  }
}

/** 默认 tooltip：token 压缩格式，跳过零值。 */
function defaultTokenTooltip(params: unknown[]): string {
  const rows = params as Array<{ marker?: string; seriesName?: string; value?: unknown; axisValue?: unknown }>
  const axis = rows[0]?.axisValue
  let html = '<div style="font-weight:600;margin-bottom:4px">' + String(axis ?? '') + '</div>'
  for (const p of rows) {
    const v = typeof p.value === 'number' ? p.value : 0
    if (v <= 0) continue
    html += '<div>' + (p.marker ?? '') + (p.seriesName ?? '') + ': <b>' + fmtTokens(v) + '</b></div>'
  }
  return html
}

/** 组合图（费用 + Token）的一个模型系列：柱（金额）与线（token）共用模型名与配色。 */
export interface ComboSeriesDef {
  /** 模型展示名（平台·模型）。 */
  name: string
  /** 每桶金额（未计费为 0；全 0 的模型不出柱，只出线）。 */
  amounts: number[]
  /** 每桶 token 四桶合计。 */
  tokens: number[]
  /** 缺省按索引取 PALETTE 色。 */
  color?: string
}

/**
 * 费用 + Token 组合图：左轴金额（各模型堆叠柱），右轴 Token 量（各模型折线）。
 * 柱仅含已计费模型；线含全部模型（未计费模型也有 Token 用量可看）。
 * 柱与线按统一模型清单取同一 PALETTE 色；线名加 Token 后缀，避免与柱同名混淆。
 */
export function costTokensComboOption(
  labels: string[],
  series: ComboSeriesDef[],
  yLeftName: string,
  yRightName: string,
  currency: string,
): EChartsCoreOption {
  const axisColor = cssVar('--dsw-alias-label-secondary', '#888')
  const gridColor = cssVar('--dsw-alias-border-l1', '#eee')
  const labelPrimary = cssVar('--dsw-alias-label-primary', '#222')
  const tooltipBg = cssVar('--dsw-alias-bg-layer-2', '#fff')
  const colorOf = (s: ComboSeriesDef, i: number): string => s.color ?? (PALETTE[i % PALETTE.length] as string)
  const tokenSuffix = t('tokenSuffix')
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: tooltipBg,
      borderColor: cssVar('--dsw-alias-border-l2', '#ddd'),
      textStyle: { color: labelPrimary, fontSize: 12 },
      formatter: (params: unknown[]) => comboTooltip(params, currency),
      ...TOOLTIP_CONFINE,
    },
    legend: {
      // plain 模式（缺省）：图例按宽度自动换行，不再滚动翻页。
      // 不强制 icon：柱系列默认圆角矩形、线系列默认线形，图例上即可区分两类。
      bottom: 0,
      itemWidth: 14,
      itemHeight: 8,
      itemGap: 10,
      textStyle: { color: axisColor, fontSize: 11 },
    },
    // bottom 预留多行图例空间（柱 + 线系列多，图例行数可能较多）。
    grid: { left: 8, right: 8, top: 10, bottom: 64, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: cssVar('--dsw-alias-border-l2', '#ccc') } },
      axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 10 },
    },
    yAxis: [
      {
        // 左轴：金额（元）。
        type: 'value',
        name: yLeftName,
        nameTextStyle: { color: cssVar('--dsw-alias-label-tertiary', '#999'), fontSize: 10, padding: [0, 0, 0, -4] },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.15 } },
        axisLabel: { color: cssVar('--dsw-alias-label-tertiary', '#999'), fontSize: 10, formatter: (v: number) => fmtCompact(v) },
      },
      {
        // 右轴：Token 数量（不带网格线，避免与左轴刻度线打架）。
        type: 'value',
        name: yRightName,
        position: 'right',
        nameTextStyle: { color: cssVar('--dsw-alias-label-tertiary', '#999'), fontSize: 10, padding: [0, -4, 0, 0] },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: cssVar('--dsw-alias-label-tertiary', '#999'), fontSize: 10, formatter: (v: number) => fmtCompact(v) },
      },
    ],
    series: [
      // 柱：各模型费用堆叠（仅已计费模型；统一按传入顺序取色）。
      ...series
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.amounts.some((v) => v > 0))
        .map(({ s, i }) => ({
          name: s.name,
          type: 'bar',
          stack: 'cost',
          yAxisIndex: 0,
          data: s.amounts,
          itemStyle: { color: colorOf(s, i) },
          emphasis: { focus: 'series' },
          barMaxWidth: 28,
        })),
      // 线：各模型 Token 用量（含未计费模型；与对应柱同色，形状区分）。
      ...series.map((s, i) => ({
        name: s.name + tokenSuffix,
        type: 'line',
        yAxisIndex: 1,
        data: s.tokens,
        itemStyle: { color: colorOf(s, i) },
        lineStyle: { width: 1.5, color: colorOf(s, i) },
        smooth: false,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: false,
        emphasis: { focus: 'series' },
      })),
    ],
  }
}

/** 组合图 tooltip：柱行显示金额（≈ + 币种），线行显示 token 压缩格式；跳过零值。 */
function comboTooltip(params: unknown[], currency: string): string {
  const rows = params as Array<{ marker?: string; seriesName?: string; seriesType?: string; value?: unknown; axisValue?: unknown }>
  const axis = rows[0]?.axisValue
  let html = '<div style="font-weight:600;margin-bottom:4px">' + String(axis ?? '') + '</div>'
  for (const p of rows) {
    const v = typeof p.value === 'number' ? p.value : 0
    if (v <= 0) continue
    if (p.seriesType === 'line') {
      html += '<div>' + (p.marker ?? '') + (p.seriesName ?? '') + ': <b>' + fmtTokens(v) + '</b></div>'
    } else {
      html += '<div>' + (p.marker ?? '') + (p.seriesName ?? '') + ': <b>≈' + currencySymbol(currency) + fmtAmount(v) + '</b></div>'
    }
  }
  return html
}

/** 缓存比例图 tooltip：命中/未命中 token 量 + 底部「命中缓存率」（命中 ÷ 输入侧总量）。 */
export function cacheTooltip(params: unknown[]): string {
  const rows = params as Array<{ marker?: string; seriesName?: string; value?: unknown; axisValue?: unknown }>
  const axis = rows[0]?.axisValue
  const hit = typeof rows[0]?.value === 'number' ? rows[0].value : 0
  const miss = typeof rows[1]?.value === 'number' ? rows[1].value : 0
  const total = hit + miss
  let html = '<div style="font-weight:600;margin-bottom:4px">' + String(axis ?? '') + '</div>'
  for (const p of rows) {
    const v = typeof p.value === 'number' ? p.value : 0
    if (v <= 0) continue
    html += '<div>' + (p.marker ?? '') + (p.seriesName ?? '') + ': <b>' + fmtTokens(v) + '</b></div>'
  }
  if (total > 0) {
    const rate = (hit / total) * 100
    html += '<div style="margin-top:4px;border-top:1px solid rgba(128,128,128,.25);padding-top:4px">' + t('cacheHitRate') + (getLang() === 'zh' ? '：' : ': ') + '<b>' + rate.toFixed(1) + '%</b></div>'
  }
  return html
}

export interface ChartCardProps {
  title: string
  option: EChartsCoreOption
  /** tab 激活（可见）才 init；隐藏容器不初始化。 */
  active: boolean
}

/**
 * 单张 ECharts 卡片：init / ResizeObserver / dispose 生命周期管理。
 * option 变化以 notMerge 重建（筛选/时间切换后系列集合变化）。
 */
export function ChartCard({ title, option, active }: ChartCardProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null)
  const optionRef = useRef(option)
  optionRef.current = option

  // option 变化（数据/筛选/主题刷新）→ 重设（notMerge 重建系列）。
  useEffect(() => {
    chartRef.current?.setOption(optionRef.current, true)
  }, [option])

  // tab 激活才 init；失活/卸载 dispose。
  useEffect(() => {
    if (!active) return
    const el = boxRef.current
    if (el === null) return
    const chart = echarts.init(el)
    chart.setOption(optionRef.current, true)
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [active])

  return (
    <div className="dshb-chart">
      <div className="dshb-chart-title">{title}</div>
      <div className="dshb-chart-box" ref={boxRef} />
    </div>
  )
}
