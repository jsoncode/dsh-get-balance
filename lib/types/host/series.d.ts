/**
 * dsh-get-balance —— 宿主半边：costSeries（费用 tab 图表数据链路）。
 *
 * 数据架构（历史聚合存储 + 当天实时，见 series-store.ts）：
 * - 历史日（< 今天）的图表数据按「本地日」持久化聚合（provider×model×workspace
 *   一组：peak/offPeak 分开的 token 四桶 + steps + 用途），不保存完整会话记录；
 * - 当天数据始终实时：每次请求解析今天的日志（内存缓存），覆盖写存储当天条目；
 * - 首次「全部」查询做一次全量回填（解析全部历史 → 按日聚合落盘，full=true），
 *   之后所有范围只做增量：每天首次查询回填 [coveredTo+1, 昨天]（含昨天尾部的
 *   修正），week7/month1 只回填各自窗口 —— 不再每次重复拉取宿主历史日志；
 * - 金额口径：仅官方 key（baseURL 域名 == api.deepseek.com）且模型精确/前缀命中
 *   价格档才计费（matchTier 的 '*' 通配兜底与 prices[0] 兜底不触发计费）；金额在
 *   查询时用当前价格档 × 存储的 peak/offPeak 桶现算（改价不影响历史桶）；
 * - 并发：同 (range, 配置) 请求 single-flight 合并为一次扫描；大范围首次回填
 *   每 ~150ms 让出事件循环，避免长时间冻结宿主。
 */
import type { CostSeriesResult, PriceConfig } from './types.ts';
/** 支持的 range 值（ops.ts 据此校验）。 */
export declare const SERIES_RANGES: readonly ["hour1", "today", "week7", "month1", "all"];
/** computeSeries 的可选参数。 */
export interface SeriesComputeOptions {
    /**
     * 持久化存储文件路径；null = 仅内存（测试注入用）；
     * 缺省 $DSH_HOME/dsh-get-balance-series-store.json。
     */
    storePath?: string | null;
}
/**
 * 计算费用 tab 图表数据（costSeries）。
 * @param range - 'hour1' | 'today' | 'week7' | 'month1' | 'all'（非法值由 ops.ts 拦截）。
 * @param config - 完整价格配置。
 * @param providerBaseUrls - provider 路由 → baseURL（平台名与官方判定）。
 * @param rootOverride - 测试注入的 sessions 根目录；缺省 dshHomePath('sessions')。
 * @param opts - 存储选项（持久化存储路径；测试注入 root 时缺省为仅内存）。
 */
export declare function computeSeries(range: string, config: PriceConfig, providerBaseUrls: Record<string, string>, rootOverride?: string, opts?: SeriesComputeOptions): Promise<CostSeriesResult>;
/** seriesBackfillInfo op 的返回载荷。 */
export interface SeriesBackfillInfo {
    /** 是否即将触发需要确认的一次性回填（首次全量 / 窗口首次回填 / 缺口回填）。 */
    pending: boolean;
    /** 回填窗口内日志总大小（压缩后字节；0 = 无回填），用于提示文案。 */
    windowBytes: number;
    /** 是否「全部」范围的全量回填（首次全量，耗时最长）。 */
    full: boolean;
}
/**
 * 只读预检：判断请求该 range 是否会触发一次性长回填（不执行回填、不写存储）。
 * 常规每日增量（覆盖只差昨天一天）不算 —— 那是一次性快操作，直接加载即可；
 * 全量回填后的底部缺口只需延伸覆盖标记、不解析日志，同样不算。
 * 与 ensureCoverage / backfillAll 用同一套覆盖判定口径，避免预检与真实回填不一致。
 */
export declare function seriesBackfillInfo(range: string, config: PriceConfig, rootOverride?: string, opts?: SeriesComputeOptions): Promise<SeriesBackfillInfo>;
//# sourceMappingURL=series.d.ts.map