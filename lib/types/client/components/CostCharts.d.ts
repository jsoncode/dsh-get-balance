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
import type { EChartsCoreOption } from 'echarts/core';
/** 固定调色板（模型 / 工作区堆叠按索引取色；缓存 / 用途用固定色）。 */
export declare const PALETTE: string[];
/** 读取 CSS 变量（深浅色主题跟随）；DOM 不可用或未定义时回退默认值。 */
export declare function cssVar(name: string, fallback: string): string;
/** 一个堆叠柱系列。 */
export interface ChartSeriesDef {
    name: string;
    data: number[];
    /** 缺省按索引取 PALETTE 色。 */
    color?: string;
}
/** 堆叠柱状图公共 option 骨架。 */
export declare function stackedBarOption(labels: string[], series: ChartSeriesDef[], yName: string, tooltip?: (params: unknown[]) => string): EChartsCoreOption;
/** 组合图（费用 + Token）的一个模型系列：柱（金额）与线（token）共用模型名与配色。 */
export interface ComboSeriesDef {
    /** 模型展示名（平台·模型）。 */
    name: string;
    /** 每桶金额（未计费为 0；全 0 的模型不出柱，只出线）。 */
    amounts: number[];
    /** 每桶 token 四桶合计。 */
    tokens: number[];
    /** 缺省按索引取 PALETTE 色。 */
    color?: string;
}
/**
 * 费用 + Token 组合图：左轴金额（各模型堆叠柱），右轴 Token 量（各模型折线）。
 * 柱仅含已计费模型；线含全部模型（未计费模型也有 Token 用量可看）。
 * 柱与线按统一模型清单取同一 PALETTE 色；线名加 Token 后缀，避免与柱同名混淆。
 */
export declare function costTokensComboOption(labels: string[], series: ComboSeriesDef[], yLeftName: string, yRightName: string, currency: string): EChartsCoreOption;
/** 缓存比例图 tooltip：命中/未命中 token 量 + 底部「命中缓存率」（命中 ÷ 输入侧总量）。 */
export declare function cacheTooltip(params: unknown[]): string;
export interface ChartCardProps {
    title: string;
    option: EChartsCoreOption;
    /** tab 激活（可见）才 init；隐藏容器不初始化。 */
    active: boolean;
}
/**
 * 单张 ECharts 卡片：init / ResizeObserver / dispose 生命周期管理。
 * option 变化以 notMerge 重建（筛选/时间切换后系列集合变化）。
 */
export declare function ChartCard({ title, option, active }: ChartCardProps): import("react").JSX.Element;
//# sourceMappingURL=CostCharts.d.ts.map