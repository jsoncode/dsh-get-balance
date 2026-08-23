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
export interface NumberRollerProps {
    /** 当前数值；null 显示 fallback。 */
    value: number | null;
    /** 数值 → 展示文本（决定各列字符）。 */
    format: (v: number) => string;
    /** 无数据占位文本。 */
    fallback?: string;
    /** 附加类名（继承原有数字样式，如颜色 / 字重）。 */
    className?: string;
}
/**
 * 上下轮播数字：把展示文本拆成逐列字符，按「距右端距离」key 复用列实例，
 * 数字列滚动、非数字列静态。
 */
export declare function NumberRoller({ value, format, fallback, className }: NumberRollerProps): import("react").JSX.Element;
//# sourceMappingURL=NumberRoller.d.ts.map