/**
 * dsh-get-balance —— 费用 tab：ECharts 渲染层。
 *
 * - 按需注册：BarChart + Grid/Tooltip/Legend 组件 + CanvasRenderer（不引入完整包）；
 * - ChartCard：tab 激活才 init，ResizeObserver 跟随容器宽度，卸载 dispose；
 * - stackedBarOption：五张图的公共骨架（堆叠柱、时间桶 x 轴、滚动图例），
 *   tooltip 默认按 token 压缩格式，费用图传入自定义 formatter。
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
/** 费用图 tooltip：仅展示已计费金额（两位小数 + 币种符号，CNY → ¥）。 */
export declare function costTooltip(params: unknown[], currency: string): string;
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