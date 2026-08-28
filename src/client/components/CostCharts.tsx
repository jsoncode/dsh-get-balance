/**
 * dsh-get-balance —— 费用 tab：ECharts 渲染层。
 *
 * - 按需注册：BarChart + Grid/Tooltip/Legend 组件 + CanvasRenderer（不引入完整包）；
 * - ChartCard：tab 激活才 init，ResizeObserver 跟随容器宽度，卸载 dispose；
 * - stackedBarOption：五张图的公共骨架（堆叠柱、时间桶 x 轴、滚动图例），
 *   tooltip 默认按 token 压缩格式，费用图传入自定义 formatter。
 * - 深浅色：轴/分割线/文字颜色读 CSS 变量，柱色用固定调色板。
 */

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { fmtAmount, fmtTokens } from '../i18n.ts'

echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

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
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: axisColor, fontSize: 11 },
      pageTextStyle: { color: axisColor },
    },
    grid: { left: 8, right: 14, top: 10, bottom: 38, containLabel: true },
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
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLabel: { color: cssVar('--dsw-alias-label-tertiary', '#999'), fontSize: 10 },
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

/** 费用图 tooltip：priced 系列金额两位小数 + 币种；「未计费」系列显示 token 量提示。 */
export function costTooltip(params: unknown[], currency: string, notPricedName: string): string {
  const rows = params as Array<{ marker?: string; seriesName?: string; value?: unknown; axisValue?: unknown }>
  const axis = rows[0]?.axisValue
  let html = '<div style="font-weight:600;margin-bottom:4px">' + String(axis ?? '') + '</div>'
  for (const p of rows) {
    const v = typeof p.value === 'number' ? p.value : 0
    if (v <= 0) continue
    if (p.seriesName === notPricedName) {
      html += '<div>' + (p.marker ?? '') + (p.seriesName ?? '') + ': <b>' + fmtTokens(v) + '</b> tokens（未配置定价）</div>'
    } else {
      html += '<div>' + (p.marker ?? '') + (p.seriesName ?? '') + ': <b>≈' + fmtAmount(v) + ' ' + currency + '</b></div>'
    }
  }
  return html
}

export interface ChartCardProps {
  title: string
  option: EChartsCoreOption
  /** tab 激活（可见）才 init；隐藏容器不初始化。 */
  active: boolean
  /** 全宽卡片（grid-column 1/-1）。 */
  wide?: boolean
}

/**
 * 单张 ECharts 卡片：init / ResizeObserver / dispose 生命周期管理。
 * option 变化以 notMerge 重建（筛选/时间切换后系列集合变化）。
 */
export function ChartCard({ title, option, active, wide }: ChartCardProps) {
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
    <div className={'dshb-chart' + (wide === true ? ' dshb-chart-wide' : '')}>
      <div className="dshb-chart-title">{title}</div>
      <div className="dshb-chart-box" ref={boxRef} />
    </div>
  )
}
