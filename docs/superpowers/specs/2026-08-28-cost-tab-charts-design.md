# 费用 tab 改版：筛选器 + ECharts 图表 设计文档（修订版）

日期：2026-08-28（修订） · 状态：已与用户逐项确认 · 范围：dsh-get-balance 客户端费用 tab + 宿主新数据链路

## 1. 目标与背景

对余额弹框的【费用】tab 整体重构：现有「四类 × 各 API Key」明细表格替换为可筛选的 ECharts 图表视图。

- 筛选行（图表上方）：**API Key**、**平台**、**模型**、**时间** 四个维度。
- 五张堆叠柱状图（x 轴 = 时间桶）：费用、Token 总量、工作区、缓存比例、工具占比。
- 不保留统计卡片（用户确认）；旧明细表格完全删除。

已确认的关键决策（用户逐项选定）：

| 决策点 | 结论 |
| --- | --- |
| 旧明细表格 | 完全替换，删除 |
| 平台维度 | 按 baseURL 域名分组（如 api.deepseek.com / openrouter.ai）；同一域名多 key 算同一平台 |
| 模型展示 | 同一模型跨平台时分开显示为「平台·模型」（如 `api.deepseek.com·deepseek-v4-flash`） |
| 未配置定价的平台/模型 | 照常出现在费用图中，作为「未计费」独立堆叠层（金额 0，柱高按 token 量示意，tooltip 标注），token 照常统计 |
| 工具占比口径 | 按步骤用途拆分 token：工具调用 / 文本回复 / 纯推理（token 粒度只到步骤，无法按单个工具名拆分） |
| 统计卡片 | 不保留 |
| X 轴粒度 | 近一小时=10 分钟；今天=小时；近七天=天；近一个月=天；全部=天（跨度 > 90 天自动按月） |
| 时间默认值 | 今天 |
| 数据链路 | 宿主新增独立 `costSeries` op，不动现有 `cost` op |
| 请求次数 | `step/end` 事件计数（含失败/中断步，与官方 sessionStats steps 一致） |

## 2. 数据来源（真实日志结构，已在本机会话日志上验证）

- `request/context`：`{ provider, model }` → 模型/服务商追踪（沿用现有「就近追踪」语义）。
- `step/end`：`{ turn, step }` → 请求次数计数。
- `assistant/message`：`{ turn, step, message, usage }`；`message.content` 部件类型实际只有
  `reasoning` / `tool-call` / `text` 三种；`usage` 含 `inputTokens` / `outputTokens` /
  `cacheReadTokens` / `cacheWriteTokens`（部分缺失，缺省 0；`reasoningTokens` 属 output 子集，不单独计）。
- `tool/call`：`{ turn, step, callId, name }` —— 工具名可用，但 token 归因粒度到「步」，无法按工具名拆分。
- 用途分类规则：该 (turn, step) 的 assistant 消息部件含 `tool-call` → **工具调用**；否则含 `text` → **文本回复**；否则 → **纯推理**。
- 实测环境存在多平台/多模型：`deepseek-official`、`ds-self`、`openrouter`、`zai-coding-cn` 等 route，
  模型 `deepseek-v4-flash` / `deepseek-v4-pro` / `glm-5.3-flash` / `stealth/ox-alpha` 等。

## 3. 宿主：新 op `costSeries`（src/host/series.ts，新模块）

### 3.1 请求 / 响应契约

请求：`{ op: 'costSeries', range: 'hour1' | 'today' | 'week7' | 'month1' | 'all' }`

响应载荷：

```ts
interface SeriesPoint { ts: number; label: string }   // 桶起始 ms + 展示标签（08:00 / 02-12 / 2026-02）
interface PurposeTokens { tool: number; text: number; reasoning: number }  // 四桶合计的用途拆分
interface SeriesRecord {
  provider: string       // provider 路由（API Key 维度；request/context 就近追踪）
  platform: string       // 平台（baseURL 域名；未在配置中的 provider 用路由名）
  model: string          // 模型 id；'*' = request/context 缺失时的未知模型
  workspace: string      // 会话 cwd（日志 header）；缺省 ''
  buckets: UsageBuckets  // 四桶
  amount: number         // 官方 key 且精确/前缀命中价格档的金额；否则 0
  priced: boolean        // 是否官方 key 且命中价格档（false → 费用图「未计费」层）
  steps: number          // step/end 计数
  purpose: PurposeTokens
}
interface CostSeriesResult {
  range: string
  bucket: 'min10' | 'hour' | 'day' | 'month'
  points: SeriesPoint[]      // 固定长度桶轴（空桶补零），客户端无需对齐
  records: SeriesRecord[][]  // records[i] = points[i] 桶内的记录列表
  currency: string           // 首个计费档位币种（无计费 → 'CNY'）
}
```

设计要点：

- `points` 固定长度桶轴（近一小时 6 点、今天 24 点、近七天 7 点、近一个月 30 点、全部按实际跨度）；
  「全部」且范围内无任何数据时 `points` 为空数组，客户端据此显示空态。
- `records[i]` 内按 (provider, model, workspace) 聚合；API Key / 平台 / 模型筛选与五张图的全部
  堆叠组合都由客户端在该结构上过滤聚合，切筛选不回宿主。
- 平台名 = baseURL 域名（如 `api.deepseek.com`）；provider 未在配置中登记 → 平台 = 路由名。

### 3.2 扫描与聚合

- 遍历 `dshHomePath('sessions')` 下全部项目/会话日志；`mtime >= rangeStart` 粗筛
  （近一小时/今天/近七天/近一个月按其起点；「全部」不过滤）；复用 cost.ts 导出的 `decodeLog`
  （zstd 逐帧解压）与 `parseLogEvents` 视图。
- 只解析三类事件：`request/context`（model/provider 追踪）、`step/end`（计数）、
  `assistant/message`（usage + time + 用途分类）；每条 assistant/message 即一个计费样本
  （与 cost.ts 不同，series 不需要 turn/step 折叠 —— 每个 (turn,step) 恰好一条最终消息）。
- 样本字段：`{ time, provider, model, workspace(cwd), buckets, purpose }`；金额在聚合时按
  样本自身 time 判时段计价，官方判定沿用 `isOfficialProvider`。
- 时间分桶按配置时区（`timezoneOffsetMinutes`）取本地 10 分钟/小时/天/月。
- 范围起点（本地时区）：近一小时 = now - 60min；今天 = 当日零点；近七天 = 今日零点 - 6 天；
  近一个月 = 今日零点 - 29 天；全部 = 不限（跨度 > 90 天时 `bucket='month'`）。

### 3.3 金额口径（与现有 cost op 的差异，刻意为之）

- **series 新口径**：仅官方 key（baseURL 域名 == api.deepseek.com）且模型精确/前缀命中价格档
  才计费（`matchTier` 的 `'*'` 通配兜底与 `prices[0]` 兜底不触发计费）；未命中 → `amount=0,
  priced=false`，记录照常返回（费用图归入「未计费」层）。时段单价沿用 `isPeakTime` + 档位 peak/offPeak。
- **现有 `cost` op 不动**：footer/头部按钮/余额 tab 今日消耗维持旧口径；文档与代码注释写明两处口径差异。

### 3.4 缓存

- `seriesFileCache: Map<path, { mtimeMs, size, cwd?, steps: 样本[] }>`：文件级缓存**解压+解析后
  的样本列表**（不含金额 —— 金额与价格配置相关，聚合时现算，避免价格改动后缓存失效重扫）。
  任一成分变化（mtime/size）即失效重扫；跨本地日不失效（时间过滤在聚合时做，天然正确）。
- 聚合（分桶 + 计费 + 分组）每次请求现算：样本量小（每文件 ~30 步），代价可忽略。

### 3.5 边界处理

- `range` 非法 → `{ ok:false, code:'params-invalid' }`。
- sessions 根目录不可读 → 返回空序列（points 仍按粒度生成）。
- 单文件解码/解析失败 → 跳过该文件，不中断整体。
- op 注册进 `OpRequest['op']` 联合类型与 `runOp` 分发（HTTP 与命令通道同时生效）。

## 4. 客户端：费用 tab 重写（BalanceModal 内费用面板拆为 CostTab.tsx + CostCharts.tsx）

### 4.1 页面结构（自上而下，旧表格删除）

1. **筛选行**（4 个控件，横排可换行）：
   - API Key 下拉：`全部` + series 出现的 provider（按 token 总量降序；显示 label + 脱敏 key，
     经余额 tab 已加载的 providers 列表匹配，未匹配显示路由名）。
   - 平台下拉：`全部` + 平台列表（按 token 总量降序）。
   - 模型下拉：`全部` + 模型列表，跨平台同名模型显示为「平台·模型」（按 token 总量降序）。
   - 时间分段按钮：`全部 | 近一小时 | 今天 | 近七天 | 近一个月`（默认今天，切换回宿主重新请求）。
2. **图表区**（5 张，全部堆叠柱状图，x = 时间桶）：前两张（费用、Token 总量）2 列并排；
   后三张（工作区、缓存比例、工具占比）全宽依次排列。

弹框高度：`dshb-modal-body` 增加 `max-height: 70vh` + 激活面板内部滚动；价格设置页内容高度
低于上限、行为不变；费用页超高时内部滚动。

加载/空态/错误：请求中 spinner；范围内无数据（无任何记录）显示「暂无数据」空态；请求失败
显示错误行 + 重试按钮。

### 4.2 五张图（全部堆叠柱状图，x = 时间桶）

| 图 | y 轴 | series（堆叠） | 说明 |
| --- | --- | --- | --- |
| 费用 | 金额 | 每个 priced 模型一条（金额）；未计费（priced=false）记录合并为「未计费」层 | 未计费层柱高按 token 量示意、tooltip 标注「未配置定价 · xx tokens」；priced 层 tooltip 两位小数 + 币种 |
| Token 总量 | token 数 | 每个模型一条（四桶合计） | y 轴/tooltip K/M/B 压缩 |
| 工作区 | token 数 | 每个工作区（cwd）一条 | cwd 显示短化（basename，过长省略）；工作区多时图例可滚动 |
| 缓存比例 | token 数 | 命中（cacheRead）/ 未命中（uncachedInput+cacheWrite）两条 | — |
| 工具占比 | token 数 | 工具调用 / 文本回复 / 纯推理 三条 | 口径见 §2 |

### 4.3 ECharts 集成

- 依赖：`echarts`（devDependency，客户端构建内联 —— lib/client.js 为单文件 CJS 工厂，无法跨
  文件分包；体积 +约 350KB min / ~120KB gzip，本地 GUI 可接受）。
- 按需注册：`echarts/core` + `BarChart` + `GridComponent` + `TooltipComponent` +
  `LegendComponent` + `CanvasRenderer`，`echarts.use([...])` 一次注册，不引入完整包。
- 生命周期：tab 激活且数据就绪才 `echarts.init`（隐藏 display:none 容器不初始化）；
  `ResizeObserver` 跟随容器宽度；弹框关闭 `dispose()` 全部实例。
- 主题：轴/分割线/文字颜色读 CSS 变量适配深浅色；柱色用固定调色板（模型/工作区按索引取色，
  缓存/用途用固定色）。
- 自动刷新：现有 tick 机制在费用 tab 激活时同时刷新 series。

## 5. i18n

新增 zh/en 文案：筛选项标签、时间范围名、五张图标题、用途名、「未计费」、空态/错误、
粒度提示等；键入 `COPY` 两语言字典，`verify:i18n` 校验双语键齐全。

## 6. 测试与验证

- `scripts/verify-series.ts`（挂入 `verify` 聚合脚本）：临时目录伪造会话日志——多 provider
  （官方/非官方）、多平台、多模型、跨天、tool-call/text/reasoning 三类步、`step/end` 计数、
  价格档命中与未命中；断言：分桶（10 分钟/小时/天/月）、金额（未配置价格=0；非官方=0）、
  priced 标志、step 计数、用途分类、缓存命中/未命中拆分、缓存键失效（改文件后重扫）、
  `range` 非法报错。
- `tsc -b`（check）通过；`pnpm run build` 成功；`verify`、`verify:i18n` 全绿。
- 手工验收：打开弹框费用 tab，五图渲染、筛选联动、深浅色、窗口缩放跟随、弹框滚动。

## 7. 非目标（YAGNI）

- 不做图表导出、数据下钻、自定义时间区间、统计卡片。
- 不改动余额 tab、价格设置 tab、footer/头部按钮的现有行为与数据（`cost` op 保留）。
- 不为「按工具名细分 Token 去向」做尝试（日志 token 粒度不支持）。
