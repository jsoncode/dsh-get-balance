# 费用 tab 改版：筛选器 + 统计卡片 + ECharts 图表 设计文档

日期：2026-08-28 · 状态：已与用户逐节确认 · 范围：dsh-get-balance 客户端费用 tab + 宿主新数据链路

## 1. 目标与背景

对余额弹框的【费用】tab 改版：现有「四类 × 各 API Key」明细表格替换为可筛选的统计视图——

- 新增筛选：**模型**（全部 + 范围内实际出现的模型，默认全部）、**时间**（今天/本周/本月/全部，默认今天）。
- 统计卡片：费用、请求次数、Token 使用量、缓存命中率。
- 引入 ECharts（按需加载）四张堆叠柱状图：费用、Token 用量、缓存命中、Token 去向。

已确认的关键决策（用户逐项选定）：

| 决策点 | 结论 |
| --- | --- |
| 旧明细表格 | 完全替换，删除 |
| X 轴粒度 | 今天=小时；本周=天；本月=天；全部=天，跨度 > 90 天自动按月 |
| Token 去向分类 | 按步骤产出：工具调用 / 文本回复 / 纯推理（依据日志实际部件类型） |
| 请求次数口径 | `step/end` 事件计数（含失败/中断步，与官方 sessionStats steps 一致） |
| 数据链路 | 方案 A：宿主新增独立 `costSeries` op，不动现有 `cost` op |
| 未配置价格的模型 | 不计算费用（费用图与费用卡片均不含） |

## 2. 数据来源（真实日志结构，已在本机会话日志上验证）

- `step/end`：`{ turn, step }` → 请求次数计数。
- `request/context`：`{ provider, model }` → 模型/服务商追踪（沿用现有「就近追踪」语义）。
- `assistant/message`：`{ turn, step, message, usage }`；`message.content` 部件类型实际只有
  `reasoning` / `tool-call` / `text` 三种；`usage` 含 `inputTokens` / `outputTokens` /
  `cacheReadTokens` / `cacheWriteTokens`（部分含 `reasoningTokens`，属 output 子集，不单独计）。
- 用途分类规则：该 (turn, step) 的 assistant 消息部件含 `tool-call` → **工具调用**（DSH 中
  函数调用即 tool-call）；否则含 `text` → **文本回复**；否则 → **纯推理**。
- token 归因粒度到「步」：一步的 usage 覆盖其整条消息（思考+文本+工具调用），无法按部件或
  工具名拆分，故按上述步骤产出分类整步归入。

## 3. 宿主：新 op `costSeries`（src/host/series.ts，新模块）

### 3.1 请求 / 响应契约

请求：`{ op: 'costSeries', range: 'today' | 'week' | 'month' | 'all' }`

响应载荷：

```ts
interface SeriesPoint { ts: number; label: string }   // 桶起始 ms + 展示标签（08:00 / 02-12 / 2026-02）
interface ModelSeries {
  model: string            // 模型 id；'*' = request/context 缺失时的未知模型
  priced: boolean          // 精确/前缀命中价格档才算已配置（'*' 兜底与 prices[0] 兜底不算）
  amount: number[]         // 每桶费用（未 priced 恒 0；官方 key 才计）
  tokens: number[]         // 每桶四桶合计
  steps: number[]          // 每桶 step/end 计数
  hit: number[]            // 每桶缓存命中读（cacheRead）
  miss: number[]           // 每桶未命中（uncachedInput + cacheWrite）
  purpose: Array<{ tool: number; text: number; reasoning: number }>  // 每桶用途 token（四桶合计）
}
interface CostSeriesResult {
  range: 'today' | 'week' | 'month' | 'all'
  bucket: 'hour' | 'day' | 'month'
  points: SeriesPoint[]
  models: ModelSeries[]
  currency: string
}
```

设计要点：

- `points` 为固定长度桶轴（今天 24 点、本周 7 点、本月当月天数、全部按实际跨度），空桶补零，
  客户端无需再对齐时间轴。「全部」且范围内无任何数据时 `points` 为空数组（跨度无从谈起），
  客户端据此显示空态。
- 每模型一条 `ModelSeries`，模型筛选/各图的全部组合都由客户端在该结构上过滤聚合，切模型不回宿主。

### 3.2 扫描与聚合

- 遍历 `dshHomePath('sessions')` 下全部项目/会话日志；`mtime >= rangeStart` 粗筛
  （今天/本周/本月按其起点；「全部」不过滤）；复用 cost.ts 导出的 `decodeLog`（zstd 逐帧解压）。
- 只解析三类事件：`step/end`（计数）、`request/context`（model/provider 追踪）、
  `assistant/message`（usage + time + 用途分类）；`provider` 不再是聚合主键（模型为主键，
  金额按官方判定），官方判定沿用 `isOfficialProvider`。
- 时间分桶按配置时区（`timezoneOffsetMinutes`）取本地小时/天/月，与现有计费时段口径一致。
- 范围起点（本地时区）：今天=当日零点；本周=含今天的周一零点；本月=当月 1 日零点；
  全部=不限（跨度 > 90 天时 `bucket='month'`，即"全部超 90 天按月"的自适应粒度）。

### 3.3 金额口径（与现有 cost op 的差异，刻意为之）

- **series 新口径**：仅官方 key（baseURL 域名 == api.deepseek.com）且模型精确/前缀命中价格档
  才计费；`matchTier` 的 `'*'` 通配兜底与 `prices[0]` 兜底**不触发计费**（落实「未配置价格的
  模型不做计算」）。时段单价沿用 `isPeakTime` + 档位 peak/offPeak。
- **现有 `cost` op 不动**：四类表格（现已被删除，但 op 保留供 footer/头部按钮使用）维持旧
  兜底计费口径。两处金额允许存在差异，以 series 为新口径；文档与代码注释写明。

### 3.4 缓存

- `seriesFileCache: Map<path, { mtimeMs, size, localDayKey, configKey, 聚合载荷 }>`；
  configKey = 时区偏移 + 高峰窗口 + 周末半价 + 价格档 + providers 表（与 todayFileCache 同思路，
  增加价格档维度，因为金额在文件级聚合时已算好）。
- 任一成分变化即失效重扫；跨本地日自然失效。

### 3.5 边界处理

- `range` 非法 → `{ ok:false, code:'params-invalid' }`。
- sessions 根目录不可读 → 返回空序列（points 仍按粒度生成）。
- 单文件解码/解析失败 → 跳过该文件，不中断整体。
- op 注册进 `OpRequest['op']` 联合类型与 `runOp` 分发（HTTP 与命令通道同时生效）。

## 4. 客户端：费用 tab 重写（BalanceModal 内费用面板拆为 CostTab.tsx + CostCharts.tsx）

### 4.1 页面结构（自上而下，旧表格删除）

1. **筛选行**：模型下拉（`全部` + series 返回模型，按 token 总量降序，默认全部）；
   时间分段按钮 `今天 | 本周 | 本月 | 全部`（默认今天，切换回宿主重新请求）。
2. **统计卡片**（4 张，横排、窄面板 2×2）：费用（两位小数 + 币种）、请求次数、
   Token 使用量（K/M/B）、缓存命中率（hit ÷ (hit+miss)，分母为 0 显示 —）。
   全部跟随模型+时间筛选（前端过滤，不回宿主）。
3. **图表区 2×2**（见 4.2）。

弹框高度：`dshb-modal-body` 增加 `max-height: 70vh` + 激活面板内部滚动；价格设置页内容高度
低于上限、行为不变；费用页超高时内部滚动。

加载/空态/错误：请求中 spinner；范围内无数据（所有模型全零）显示「暂无数据」空态；请求失败
显示错误行 + 重试按钮。

### 4.2 四张图（全部堆叠柱状图，x = 时间桶）

| 图 | y 轴 | series（堆叠） | 说明 |
| --- | --- | --- | --- |
| 费用 | 金额 | 每个模型一条（仅 priced=true 的模型） | tooltip 两位小数 + 币种；未配置价格模型不出现 |
| Token 用量 | 数量 | 每个模型一条（四桶合计） | y 轴/tooltip K/M/B 压缩 |
| 缓存命中 | 数量 | 命中 / 未命中 两条 | 命中=cacheRead；未命中=uncachedInput+cacheWrite |
| Token 去向 | 数量 | 工具调用 / 文本回复 / 纯推理 三条 | 口径见 §2 |

### 4.3 ECharts 集成

- 依赖：`echarts`（devDependency，客户端构建内联——lib/client.js 为单文件 CJS 工厂，无法跨
  文件分包；体积 +约 350KB min / ~120KB gzip，本地 GUI 可接受）。
- 按需注册：`echarts/core` + `BarChart` + `GridComponent` + `TooltipComponent` +
  `LegendComponent` + `CanvasRenderer`，`echarts.use([...])` 一次注册，不引入完整包。
- 生命周期：tab 激活且数据就绪才 `echarts.init`（隐藏 display:none 容器不初始化）；
  `ResizeObserver` 跟随容器宽度；弹框关闭 `dispose()` 全部实例。
- 主题：轴/分割线/文字颜色读 CSS 变量适配深浅色；柱色用固定调色板（按模型/用途稳定映射）。
- 自动刷新：现有 tick 机制在费用 tab 激活时同时刷新 series。

## 5. i18n

新增 zh/en 文案：筛选项标签、时间范围名、四张统计卡标题、四张图标题、用途名、空态/错误、
粒度提示等；键入 `COPY` 两语言字典，`verify:i18n` 校验双语键齐全。

## 6. 测试与验证

- `scripts/verify-series.ts`（挂入 `verify` 聚合脚本）：临时目录伪造会话日志——多模型、
  跨天、tool-call/text/reasoning 三类步、官方与非官方 key、价格档命中与未命中、`step/end`
  含失败步；断言：分桶（小时/天/月）、金额（未配置价格=0；非官方=0）、step 计数、用途分类、
  缓存命中/未命中拆分、缓存键失效（改价格配置后金额变化）、`range` 非法报错。
- `tsc -b`（check）通过；`pnpm run build` 成功；`verify`、`verify:i18n` 全绿。
- 手工验收：打开弹框费用 tab，四图渲染、筛选联动、深浅色、窗口缩放跟随、弹框滚动。

## 7. 非目标（YAGNI）

- 不做图表导出、数据下钻、自定义时间区间。
- 不改动余额 tab、价格设置 tab、footer/头部按钮的现有行为与数据。
- 不为「按工具名细分 Token 去向」做尝试（日志 token 粒度不支持）。
