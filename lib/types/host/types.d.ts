/**
 * dsh-get-balance —— 宿主半边：共享类型。
 */
/** 计费四桶（与官方 tokenUsage 投影的桶一一对应）。 */
export interface UsageBuckets {
    /** 缓存未命中的输入 tokens（usage.inputTokens）。 */
    uncachedInput: number;
    /** 缓存命中读 tokens（usage.cacheReadTokens）。 */
    cacheRead: number;
    /** 缓存写入 tokens（usage.cacheWriteTokens）。 */
    cacheWrite: number;
    /** 输出 tokens（usage.outputTokens）。 */
    output: number;
}
/**
 * 一个时间段（高峰 / 空闲）的四项单价：每百万 tokens（CNY）。
 * 与官方计价口径一致：输入区分缓存命中与未命中，缓存写入恒为 0。
 */
export interface PricePeriodPrices {
    /** 缓存未命中的输入单价。 */
    input: number;
    /** 缓存命中读单价。 */
    cacheRead: number;
    /** 缓存写入单价（DeepSeek 官方为 0）。 */
    cacheWrite: number;
    /** 输出单价。 */
    output: number;
}
/**
 * 一档价格配置：同一模型在高峰与空闲两个时段各有一套单价。
 * `match` 为模型匹配串：精确模型 id > 模型 id 前缀 > `*` 通配兜底。
 */
export interface PriceTier {
    id: string;
    name: string;
    currency: string;
    match: string;
    /** 高峰时段单价（每百万 tokens）。 */
    peak: PricePeriodPrices;
    /** 空闲时段单价（每百万 tokens）。 */
    offPeak: PricePeriodPrices;
}
/** 一个高峰时段窗口：`HH:MM`，按配置的时区偏移解释。 */
export interface TimeWindow {
    start: string;
    end: string;
}
/**
 * 完整价格配置：价格档列表 + 高峰时段窗口（其余时间为空闲时段）。
 * 官方口径：高峰时段为北京时间 9:00–12:00、14:00–18:00（其余为空闲时段）。
 */
export interface PriceConfig {
    tiers: PriceTier[];
    /** 高峰时段窗口所依据的时区偏移（分钟；北京 UTC+8 = 480）。 */
    timezoneOffsetMinutes: number;
    peakWindows: TimeWindow[];
    /** 周六日半价：开启后周六/周日整天按空闲时段计费（从高峰窗口中排除）。 */
    weekendOffPeak?: boolean;
}
/** 用户手动附加的 API key（不在 dsh providers 配置中的）。 */
export interface ExtraKey {
    id: string;
    label: string;
    apiKey: string;
}
/**
 * 与主条目共享同一解析 API key 的另一条服务商路由。
 * 同一 key = 同一 DeepSeek 账号：余额查询对每个唯一 key 只发起一次，
 * 折叠路由以 sharedWith 标注在保留条目的行上。
 */
export interface ProviderShared {
    id: string;
    label: string;
    source: ProviderEntry['source'];
}
/** 一个可查余额的 DeepSeek 服务商条目。 */
export interface ProviderEntry {
    id: string;
    label: string;
    baseUrl: string;
    /** 来源：llm-pi-ai providers / llm-deepseek 官方路由 / 插件附加 key。 */
    source: 'llm-pi-ai' | 'llm-deepseek' | 'extra';
    /** 凭据引用（env 名）；extra 来源无。 */
    apiKeyEnv?: string;
    /** 解析出的真实 key（仅内部使用，不出宿主）。 */
    apiKey?: string;
    /** 脱敏展示用。 */
    apiKeyMasked: string;
    hasKey: boolean;
    /** 凭据来源层（env / file / project-env / user-env）；未配置时缺省。 */
    keySource?: string;
    /**
     * 与该条目解析到同一 API key（同一账号）而被折叠的路由。
     * 仅宿主内部组装时设置；providers op 原样透出给浏览器（不含真实 key）。
     */
    sharedWith?: ProviderShared[];
}
/** 官方 /user/balance 的一个币种条目。 */
export interface BalanceInfo {
    currency: string;
    total_balance: string;
    granted_balance: string;
    topped_out: boolean;
}
/** 单个服务商的余额查询结果。 */
export interface ProviderBalance {
    providerId: string;
    ok: boolean;
    error?: string;
    code?: string;
    is_available?: boolean;
    balance_infos?: BalanceInfo[];
}
/**
 * 单个 API key（服务商条目）的用量与费用明细。
 * token 四桶不区分官方与否（一律统计数量）；费用只对官方 key（api.deepseek.com）计算。
 */
export interface KeyCostEntry {
    /** 服务商路由 key（会话事件 request/context 的 provider）。 */
    provider: string;
    /** 该 key 的全部 token 四桶（不区分官方与否，仅统计数量）。 */
    buckets: UsageBuckets;
    /** 是否 DeepSeek 官方（baseURL 域名 == api.deepseek.com）。 */
    official: boolean;
    /** 官方计费金额；非官方恒为 0。 */
    amount: number;
    /** 官方计费币种；非官方为空串。 */
    currency: string;
}
/** 一项费用统计（金额 + 桶明细 + 生效档位摘要）。 */
export interface CostEntry {
    /** 金额（仅 DeepSeek 官方 api.deepseek.com 请求计费）；无用量时为 0。 */
    amount: number;
    currency: string;
    /** 全量 token 用量（所有 key 合计，不区分官方与否，仅统计数量）。 */
    buckets: UsageBuckets;
    /** 按 API key（服务商条目）分组的明细，token 总数降序。 */
    byKey: KeyCostEntry[];
}
/** cost op 的返回载荷。 */
export interface CostResult {
    lastTurn: CostEntry;
    session: CostEntry;
    todayProject: CostEntry;
    todayAll: CostEntry;
    /** 当前会话命中的价格档（展示用）。 */
    sessionTier?: string;
    /** 最近一次已完成的 AI 请求是否走 DeepSeek 官方接口（api.deepseek.com）；
     *  无任何已完成的请求时为 false。浏览器侧据此决定请求完成后是否强制刷新余额：
     *  非官方请求只更新 token 与预估费用，不发起余额查询。 */
    lastRequestOfficial: boolean;
}
/** 按步骤用途拆分的 token 量（四桶合计）。 */
export interface PurposeTokens {
    /** 工具调用步骤（assistant 消息含 tool-call 部件）。 */
    tool: number;
    /** 文本回复步骤（含 text 部件且无 tool-call）。 */
    text: number;
    /** 纯推理步骤（既无 tool-call 也无 text）。 */
    reasoning: number;
}
/** 时间轴上的一个桶。 */
export interface SeriesPoint {
    /** 桶起始（真实 epoch ms，本地时区对齐）。 */
    ts: number;
    /** 展示标签（08:00 / 02-12 / 2026-02）。 */
    label: string;
}
/** 一个桶内按 (provider, model, workspace) 聚合的一条记录。 */
export interface SeriesRecord {
    /** provider 路由（API Key 维度；request/context 就近追踪）。 */
    provider: string;
    /** 平台（baseURL 域名；未在配置中的 provider 用路由名）。 */
    platform: string;
    /** 模型 id；'*' = request/context 缺失时的未知模型。 */
    model: string;
    /** 会话 cwd（日志 header）；缺省 ''。 */
    workspace: string;
    /** 四桶（不区分官方与否，仅统计数量）。 */
    buckets: UsageBuckets;
    /** 官方 key 且精确/前缀命中价格档的金额；否则 0。 */
    amount: number;
    /** 是否官方 key 且命中价格档（false → 费用图「未计费」层）。 */
    priced: boolean;
    /** step/end 计数（含失败/中断步，与官方 sessionStats steps 一致）。 */
    steps: number;
    /** 该记录四桶合计的用途拆分。 */
    purpose: PurposeTokens;
}
/** costSeries op 的返回载荷。 */
export interface CostSeriesResult {
    range: 'hour1' | 'today' | 'week7' | 'month1' | 'all';
    bucket: 'min10' | 'hour' | 'day' | 'month';
    /** 固定长度桶轴（空桶补零）；「全部」且范围内无任何数据时为空数组。 */
    points: SeriesPoint[];
    /** records[i] = points[i] 桶内的记录列表（按 token 总量降序）。 */
    records: SeriesRecord[][];
    /** 首个计费档位的币种；无任何计费 → 'CNY'。 */
    currency: string;
}
/** /dsh-balance/api 请求体（HTTP 与命令通道共用）。 */
export interface OpRequest {
    op: 'providers' | 'balance' | 'cost' | 'costSeries' | 'pricesGet' | 'pricesSave' | 'keysGet' | 'keysSave' | 'autoRefreshGet' | 'autoRefreshSave' | 'showBalanceGet' | 'showBalanceSave' | 'updateCheck' | 'pluginUpdateStart' | 'pluginUpdateStatus' | '';
    sessionId?: string;
    /** balance：绕过 60s 缓存。 */
    refresh?: boolean;
    /** costSeries：时间范围（hour1 | today | week7 | month1 | all）。 */
    range?: string;
    /** pricesSave：完整价格配置（档位 + 高峰时段窗口）。 */
    config?: PriceConfig;
    /** keysSave：完整附加 key 列表。 */
    keys?: ExtraKey[];
    /** autoRefreshSave：定时自动刷新间隔（秒，0 = 关闭）。 */
    seconds?: number;
    /** showBalanceSave：「显示余额」开关（true = 展示，false = 全部掩码为 **）。 */
    enabled?: boolean;
}
/** op 载荷统一形状：ok=false 时带 code/error。 */
export interface OpResult {
    ok: boolean;
    code?: string;
    error?: string;
    [key: string]: unknown;
}
//# sourceMappingURL=types.d.ts.map