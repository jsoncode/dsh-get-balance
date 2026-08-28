/**
 * dsh-get-balance —— 费用 tab（图表版）：筛选行 + 数据加载 + 五张图布局。
 *
 * 数据链路：宿主 `costSeries` op 返回固定桶轴（points）+ 每桶记录
 * （provider×model×workspace 聚合）。API Key / 平台 / 模型筛选为纯前端过滤
 * （本地聚合，不回宿主）；时间切换（range）重新请求。
 *
 * 五张图（全部堆叠柱状图，x = 时间桶）：
 * 1. 费用：每个已配置定价的 (平台·模型) 一条金额（y 轴单位为元）；未配置定价的不计费、不显示。
 * 2. Token 总量：每个 (平台·模型) 一条（四桶合计）。
 * 3. 工作区：每个工作区（cwd）一条。
 * 4. 缓存比例：缓存命中 / 未命中 两条（tooltip 附命中缓存率）。
 * 5. 工具占比：工具调用 / 文本回复 / 纯推理 三条。
 *
 * 加载体验：未加载完成前用骨架占位固定图表区高度；切换时间范围时旧数据半透明
 * 示「刷新中」，并发请求只采纳最后一次（避免慢请求后到覆盖新范围的数据）。
 */
import type { RunFn } from '../rpc.ts';
export interface CostTabProps {
    run: RunFn;
    getSession(): string;
    /** 自动刷新 tick（宿主定时器到点变化，重新请求）。 */
    tick: number;
    /** 手动刷新请求计数（头部「刷新」按钮自增）。 */
    reloadTick: number;
    /** provider 路由 → 展示信息（label + 脱敏 key），余额 tab 已加载的 providers 匹配。 */
    metaOf(route: string): {
        label: string;
        masked?: string;
    };
    /** 费用 tab 是否可见（可见才初始化图表）。 */
    active: boolean;
}
export declare function CostTab({ run, getSession, tick, reloadTick, metaOf, active }: CostTabProps): import("react").JSX.Element;
//# sourceMappingURL=CostTab.d.ts.map