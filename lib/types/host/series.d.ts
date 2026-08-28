/**
 * dsh-get-balance —— 宿主半边：costSeries（费用 tab 图表数据链路）。
 *
 * 与 cost.ts 的「四类汇总」不同，本模块面向时间序列图表：
 * - 扫描 dshHomePath('sessions') 下全部会话日志（mtime >= 范围起点粗筛），
 *   只解析三类事件：request/context（model/provider 就近追踪）、step/end
 *   （请求次数，含失败/中断步）、assistant/message（usage + 用途分类）；
 * - 按配置时区把样本分桶（近一小时=10 分钟 / 今天=小时 / 近七天=天 /
 *   近一个月=天 / 全部=天，跨度 > 90 天自动按月），每桶内按
 *   (provider, model, workspace) 聚合，返回固定桶轴 + 记录数组，
 *   API Key / 平台 / 模型筛选与五张图的全部堆叠组合由浏览器侧本地完成；
 * - 金额口径（与 cost.ts 刻意不同）：仅官方 key（baseURL 域名 ==
 *   api.deepseek.com）且模型精确/前缀命中价格档才计费（matchTier 的 '*'
 *   通配兜底与 prices[0] 兜底不触发计费）；未命中 → amount=0、priced=false，
 *   记录照常返回（费用图归入「未计费」层）。时段单价沿用 isPeakTime +
 *   档位 peak/offPeak，按样本自身时间判时段。
 *
 * 文件级缓存：只缓存「解压 + 解析后的样本列表」（不含金额 —— 金额与价格
 * 配置相关，聚合时现算，价格改动无需失效）；mtime/size 变化即重扫。
 */
import type { CostSeriesResult, PriceConfig } from './types.ts';
/** 支持的 range 值（ops.ts 据此校验）。 */
export declare const SERIES_RANGES: readonly ["hour1", "today", "week7", "month1", "all"];
/**
 * 计算费用 tab 图表数据（costSeries）。
 * @param range - 'hour1' | 'today' | 'week7' | 'month1' | 'all'（非法值由 ops.ts 拦截）。
 * @param config - 完整价格配置。
 * @param providerBaseUrls - provider 路由 → baseURL（平台名与官方判定）。
 * @param rootOverride - 测试注入的 sessions 根目录；缺省 dshHomePath('sessions')。
 */
export declare function computeSeries(range: string, config: PriceConfig, providerBaseUrls: Record<string, string>, rootOverride?: string): Promise<CostSeriesResult>;
//# sourceMappingURL=series.d.ts.map