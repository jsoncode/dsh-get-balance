/**
 * dsh-get-balance —— 数字「上下轮播」动画（odometer 风格）。
 *
 * 每位数字一列：列内是 0-9 纵向条带（重复 3 份，中间份为基准展示位，
 * 两侧供 9↔0 环绕滚动），值变化时列沿最短路径上下滚动到新位
 * （增大向上滚、减小向下滚）；非数字字符（小数点、K/M/B/T/P 后缀等）静态展示。
 * 按「距右端距离」作为列 key 做右对齐映射：位数增减时数字列保持原位不漂移，
 * 只在最左侧增删列（新列直接出现，不做滚动），小数点与后缀列相对右端固定。
 * 首次展示直接显示目标值（无滚动）；prefers-reduced-motion 下禁用过渡。
 */

import { useEffect, useRef, type ReactNode } from 'react'

/** 列内条带：0-9 重复 3 份。 */
const DIGIT_CELLS = Array.from('0123456789'.repeat(3))

/** 从 from 滚到 to 的最短步数（-5..4）：正数向上滚，负数向下滚。 */
function shortestStep(from: number, to: number): number {
  return ((to - from + 5) % 10 + 10) % 10 - 5
}

/** 单个数字列：条带按当前位平移；首次挂载静态显示，之后沿最短路径滚动。 */
function RollDigit({ digit }: { digit: number }) {
  const prevRef = useRef(digit)
  const mountedRef = useRef(false)
  // 基准展示位在中间份：index = 10 + digit；变化时从旧位 + 最短步数落位。
  let index = 10 + digit
  if (mountedRef.current) {
    const prev = prevRef.current
    if (prev !== digit) index = 10 + prev + shortestStep(prev, digit)
  }
  useEffect(() => {
    prevRef.current = digit
    mountedRef.current = true
  })
  return (
    <span className={'dshb-roll-col' + (mountedRef.current ? '' : ' dshb-roll-col-static')}>
      <span className="dshb-roll-strip" style={{ transform: `translateY(${-index}em)` }}>
        {DIGIT_CELLS.map((d, i) => <span key={i} className="dshb-roll-cell">{d}</span>)}
      </span>
    </span>
  )
}

export interface NumberRollerProps {
  /** 当前数值；null 显示 fallback。 */
  value: number | null
  /** 数值 → 展示文本（决定各列字符）。 */
  format: (v: number) => string
  /** 无数据占位文本。 */
  fallback?: string
  /** 附加类名（继承原有数字样式，如颜色 / 字重）。 */
  className?: string
}

/**
 * 上下轮播数字：把展示文本拆成逐列字符，按「距右端距离」key 复用列实例，
 * 数字列滚动、非数字列静态。
 */
export function NumberRoller({ value, format, fallback = '--', className }: NumberRollerProps) {
  const display = value === null ? fallback : format(value)
  const n = display.length
  const cells: ReactNode[] = []
  for (let p = 0; p < n; p++) {
    const ch = display[p]
    // 右对齐 key：距右端距离；同一 key 的列实例跨渲染复用，数字列内部自行
    // 记住上一数字并沿最短路径滚动，位数增减时其余列保持原位。
    const key = 'r' + (n - 1 - p)
    if (ch >= '0' && ch <= '9') {
      cells.push(<RollDigit key={key} digit={ch.charCodeAt(0) - 48} />)
    } else {
      cells.push(<span key={key} className="dshb-roll-char">{ch}</span>)
    }
  }
  return <span className={'dshb-roller' + (className !== undefined ? ' ' + className : '')}>{cells}</span>
}
