# 费用 tab 改版（四维筛选 + 五张 ECharts 图表）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把余额弹框的【费用】tab 从「四类 × 各 API Key」表格重构为「API Key / 平台 / 模型 / 时间」四维筛选器 + 五张 ECharts 堆叠柱状图（费用、Token 总量、工作区、缓存比例、工具占比）。

**架构：** 宿主新增 `costSeries` op（新模块 src/host/series.ts 扫描会话日志、按时区分桶、按 provider×model×workspace 聚合返回固定桶轴 + 记录数组）；客户端新增 CostTab.tsx（筛选 + 数据加载）与 CostCharts.tsx（五张 ECharts 图），BalanceModal 的费用面板改为渲染 CostTab。现有 `cost` op 与 footer/头部按钮/余额 tab 行为不动。

**技术栈：** TypeScript、Node（tsx / tsdown / tsc -b）、React 18、ECharts 6（echarts/core 按需注册）、既有 zh/en i18n 与 styles.ts 注入体系。

**参考规格：** `docs/superpowers/specs/2026-08-28-cost-tab-charts-design.md`（修订版，已批准）

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/host/series.ts`（新） | costSeries 数据链路：文件级解析缓存 + 分桶聚合 + 计费 |
| `src/host/types.ts`（改） | 新增 `PurposeTokens` / `SeriesPoint` / `SeriesRecord` / `CostSeriesResult`；`OpRequest.op` 加 `'costSeries'` 与 `range?` |
| `src/host/cost.ts`（改） | 导出 `decodeLog` / `parseLogEvents` / `costOf`（series 复用） |
| `src/host/ops.ts`（改） | `runOp` 加 `case 'costSeries'`（校验 range） |
| `scripts/verify-series.ts`（新） | 临时目录伪造日志，断言分桶/金额/用途/缓存拆分/step 计数/缓存失效/非法 range |
| `package.json`（改） | devDependencies 加 `echarts`；`verify` 脚本链加 `verify:series`；加 `verify:series` script |
| `src/client/components/CostTab.tsx`（新） | 费用 tab 主体：筛选行 + 数据加载 + 五图布局 |
| `src/client/components/CostCharts.tsx`（新） | ECharts 注册、ChartCard 生命周期、五张图的 option 构建 |
| `src/client/components/BalanceModal.tsx`（改） | 费用面板改渲染 CostTab；删除表格相关代码；保留 loadCost（余额 tab 今日消耗） |
| `src/client/i18n.ts`（改） | 新增 zh/en 文案（筛选、图题、用途、未计费、空态/错误） |
| `src/client/styles.ts`（改） | 筛选行 / 图表卡片 / 图容器样式 |

---

### 任务 1：添加 echarts 依赖

- [ ] **步骤 1：安装依赖**

```bash
pnpm add -D echarts
```

预期：package.json devDependencies 出现 `"echarts": "^6.1.0"`（或当前最新 6.x），node_modules/echarts 存在。

- [ ] **步骤 2：Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add echarts dependency for cost tab charts"
```

---

### 任务 2：宿主类型与导出（types.ts / cost.ts）

- [ ] **步骤 1：types.ts 新增 series 相关类型**

在 `src/host/types.ts` 末尾（`OpRequest` 之前或之后）新增：

```ts
/** 按步骤用途拆分的 token 量（四桶合计）。 */
export interface PurposeTokens {
  /** 工具调用步骤（assistant 消息含 tool-call 部件）。 */
  tool: number
  /** 文本回复步骤（含 text 部件且无 tool-call）。 */
  text: number
  /** 纯推理步骤（既无 tool-call 也无 text）。 */
  reasoning: number
}

/** 时间轴上的一个桶。 */
export interface SeriesPoint {
  /** 桶起始（真实 epoch ms，本地时区对齐）。 */
  ts: number
  /** 展示标签（08:00 / 02-12 / 2026-02）。 */
  label: string
}

/** 一个桶内按 (provider, model, workspace) 聚合的一条记录。 */
export interface SeriesRecord {
  /** provider 路由（API Key 维度）。 */
  provider: string
  /** 平台（baseURL 域名；未配置的 provider 用路由名）。 */
  platform: string
  /** 模型 id；'*' = 未知。 */
  model: string
  /** 会话 cwd（日志 header）；缺省 ''。 */
  workspace: string
  buckets: UsageBuckets
  /** 官方 key 且精确/前缀命中价格档的金额；否则 0。 */
  amount: number
  /** 是否官方 key 且命中价格档（false → 费用图「未计费」层）。 */
  priced: boolean
  /** step/end 计数（含失败/中断步）。 */
  steps: number
  purpose: PurposeTokens
}

/** costSeries op 的返回载荷。 */
export interface CostSeriesResult {
  range: 'hour1' | 'today' | 'week7' | 'month1' | 'all'
  bucket: 'min10' | 'hour' | 'day' | 'month'
  /** 固定长度桶轴（空桶补零）；「全部」且无数据时为空数组。 */
  points: SeriesPoint[]
  /** records[i] = points[i] 桶内的记录列表。 */
  records: SeriesRecord[][]
  /** 首个计费档位币种；无计费 → 'CNY'。 */
  currency: string
}
```

`OpRequest.op` 联合类型加 `'costSeries'`，并加字段 `range?: string`。

- [ ] **步骤 2：cost.ts 导出复用函数**

`src/host/cost.ts` 中给 `decodeLog`、`parseLogEvents`、`costOf` 三个函数前加 `export` 关键字（`function` → `export function`）。

- [ ] **步骤 3：Commit**

```bash
git add src/host/types.ts src/host/cost.ts
git commit -m "feat: series types + export decodeLog/parseLogEvents/costOf for costSeries"
```

---

### 任务 3：宿主 series.ts 新模块

- [ ] **步骤 1：实现 src/host/series.ts**

核心契约：

```ts
export function computeSeries(
  range: string,                                  // 'hour1'|'today'|'week7'|'month1'|'all'（非法由 ops 拦截）
  config: PriceConfig,
  providerBaseUrls: Record<string, string>,
  rootOverride?: string,                          // 测试注入临时目录；缺省 dshHomePath('sessions')
): Promise<CostSeriesResult>
```

实现要点（全部写入文件，含注释）：
- 常量 `RANGES`、`MIN10 = 10*60_000`、`HOUR = 60*60_000`、`DAY = 24*HOUR`。
- 文件级缓存 `seriesFileCache: Map<path, { mtimeMs, size, sample: FileSample }>`，`FileSample = { cwd?: string; steps: StepSample[]; usages: UsageSample[] }`（缓存解析结果不含金额，价格改动无需失效）。
- `parseFile(path, isZstd)`：解压逐行解析 —— `session` 首行取 cwd；`request/context` 就近追踪 model/provider；`step/end` 记入 `steps`（`{ time, provider, model }`）；`assistant/message` 记入 `usages`（`{ time, provider, model, buckets, purpose }`）。用途分类：content 部件含 `tool-call` → tool；否则含 `text` → text；否则 → reasoning（整步四桶合计归入该类）。
- 桶轴构造：`hour1` = 本地 10 分钟桶 × 6（起点 = (now-60min) 对齐 10 分钟）；`today` = 本地小时桶 × 24（本地零点起）；`week7` = 本地日桶 × 7（今日零点-6 天起）；`month1` = 本地日桶 × 30（今日零点-29 天起）；`all` = 先扫描取最早样本的本地日，跨度 ≤ 90 天用日桶（最早本地零点 → 今日含），否则月桶（最早月首 → 当月含）。
- 时间过滤：`hour1` 用真实 `now-60min` 起点；其余用本地零点换算的真实 epoch；`all` 不过滤。
- 聚合：每桶内按 `(provider, model, workspace)` 建组 —— `steps` 累加 `step/end` 数；`usages` 累加四桶与 purpose，金额按 `isOfficialProvider` + `pricedTierOf(model, tiers)`（**精确或前缀命中，`match` 为 `'*'` 的兜底档不算**）+ `isPeakTime`/`periodPricesOf`/`costOf`（用样本自身 time）。
- 平台名：`platformOf(provider, providerBaseUrls)` = `new URL(baseUrl).hostname`，解析失败或未配置 → 路由名。
- 全零且 steps=0 的组剔除；`records[i]` 内组按 token 总量降序。
- `currency` = 首个 priced 组的档位币种，否则 `'CNY'`。
- sessions 根不可读 → 返回空 points（按粒度生成）+ 空 records。

- [ ] **步骤 2：ops.ts 注册 costSeries**

`src/host/ops.ts` 的 `runOp` switch 增加：

```ts
case 'costSeries': {
  const range = typeof request.range === 'string' ? request.range : ''
  if (!['hour1', 'today', 'week7', 'month1', 'all'].includes(range)) {
    return { ok: false, code: 'params-invalid', error: 'range must be one of hour1|today|week7|month1|all' }
  }
  const providerBaseUrls = listProviderBaseUrls(deps.settings, deps.nsOf)
  const series = await computeSeries(range, await readPriceConfig(), providerBaseUrls)
  return { ok: true, series }
}
```

并在 import 处加 `import { computeSeries } from './series.ts'`。

- [ ] **步骤 3：tsc 校验**

运行：`pnpm exec tsc -b --pretty false`
预期：无类型错误。

- [ ] **步骤 4：Commit**

```bash
git add src/host/series.ts src/host/ops.ts
git commit -m "feat: host costSeries op (bucket aggregation of session logs)"
```

---

### 任务 4：宿主验证脚本 verify-series.ts

- [ ] **步骤 1：实现 scripts/verify-series.ts**

用临时目录伪造日志（`session.jsonl` 明文即可）：
- 项目/会话目录结构：`<tmp>/proj-a/s1/session.jsonl`（header cwd = `C:\work\proj-a`）、`<tmp>/proj-a/s2/session.jsonl`（cwd = `C:\work\proj-b`）。
- 事件（时间用 `Date.now()` 及今天零点偏移构造）：
  - s1：`deepseek-official` / `deepseek-v4-flash`，一条 tool-call 步（input/cacheRead/output 各若干 + step/end），一条 text 步（纯 input + step/end），一条 reasoning 步（无 tool-call/text，input + step/end），另加一条失败步（仅 step/end，无 assistant/message）；
  - s2：`openrouter` / `stealth/ox-alpha`（非官方，未配置定价），一条 assistant/message（含 usage）+ step/end；再一条 `deepseek-official` / `deepseek-v4-pro`（官方但价格档未命中前缀，priced=false）；
  - 跨天：s2 中放一条昨天的事件（验证 today 过滤与 all 的日桶跨度）。
- `providerBaseUrls = { 'deepseek-official': 'https://api.deepseek.com', 'openrouter': 'https://openrouter.ai' }`；config 用 `DEFAULT_PRICE_CONFIG`。

断言（沿用 verify-cost-attribution 的 `assert` 风格，`failures` 计数 + `process.exit`）：
1. `hour1`：points.length === 6；`today`：24；`week7`：7；`month1`：30。
2. `today` 桶内：deepseek-v4-flash 记录 `amount > 0` 且 `priced === true`；openrouter 记录 `amount === 0` 且 `priced === false`；deepseek-v4-pro 记录 `amount === 0` 且 `priced === false`。
3. 用途拆分：tool-call 步的 bucket 里 `purpose.tool === 该步 token 合计`；text 步 → `purpose.text`；reasoning 步 → `purpose.reasoning`。
4. 缓存拆分：`buckets.cacheRead` 与 `buckets.uncachedInput + buckets.cacheWrite` 分别正确累计。
5. `steps`：失败步计入（某桶 steps === 对应 step/end 数）。
6. 工作区：`workspace` 字段 = header cwd。
7. `all`：points 跨度覆盖今天与昨天（≥ 2 个日桶）。
8. 缓存失效：向 s1 追加一条 assistant/message + step/end（改 mtime），再次调用 today，token 增加。
9. 平台名：openrouter 记录 `platform === 'openrouter.ai'`。

- [ ] **步骤 2：接入 package.json**

`scripts.verify` 改为 `node scripts/verify-client.mjs && tsx scripts/verify-series.ts`；新增 `"verify:series": "tsx scripts/verify-series.ts"`。

- [ ] **步骤 3：运行验证**

运行：`pnpm exec tsx scripts/verify-series.ts`
预期：全部断言 `ok`，退出码 0。

- [ ] **步骤 4：Commit**

```bash
git add scripts/verify-series.ts package.json
git commit -m "test: verify-series fixtures for costSeries bucketing/pricing/purpose"
```

---

### 任务 5：客户端 CostCharts.tsx（ECharts 渲染层）

- [ ] **步骤 1：实现 src/client/components/CostCharts.tsx**

- 按需注册：`import * as echarts from 'echarts/core'` + `BarChart`（echarts/charts）+ `GridComponent/TooltipComponent/LegendComponent`（echarts/components）+ `CanvasRenderer`（echarts/renderers），`echarts.use([...])`。
- `ChartCard` 组件：props `{ title, option, active }`；容器 ref；`active` 为 true 时 `echarts.init` + `ResizeObserver` resize + 卸载 `dispose`；option 变化 `setOption(option, true)`（notMerge）。
- 导出五个 option 构建函数（输入：`points: SeriesPoint[]`、`records: SeriesRecord[][]`、筛选后的记录、currency、文案字典 t）：
  - `buildCostOption`：堆叠 = 每个 priced 模型一条（金额）+ 「未计费」层（priced=false 记录的 token 合计，柱高按 token 示意）；y 轴名「费用（{cur}）」；tooltip 金额两位小数 + 币种、未计费层显示「未配置定价 · N tokens（不计费）」。
  - `buildTokensOption`：堆叠 = 每模型一条（四桶合计），y 轴「Token 量」，数值 K/M/B。
  - `buildWorkspaceOption`：堆叠 = 每工作区一条（cwd basename，空 → 「未知工作区」）。
  - `buildCacheOption`：两条 —— 缓存命中（cacheRead）/ 未命中（uncachedInput + cacheWrite）。
  - `buildPurposeOption`：三条 —— 工具调用 / 文本回复 / 纯推理。
- 公共 option 骨架：`stack: 'total'`、`xAxis category`（labels）、`yAxis value`、`tooltip axis trigger`、`legend`（图例多时 `type: 'scroll'`）、`grid` 留出图例空间、颜色从固定调色板 + CSS 变量（`--dsw-alias-label-secondary` 等）读取。
- 导出 `ChartCard` 供 CostTab 使用。

- [ ] **步骤 2：Commit**

```bash
git add src/client/components/CostCharts.tsx
git commit -m "feat: client ECharts render layer (ChartCard + five stacked bar options)"
```

---

### 任务 6：客户端 CostTab.tsx + BalanceModal 接入

- [ ] **步骤 1：实现 src/client/components/CostTab.tsx**

Props：`{ run, getSession, tick, reloadTick, providers, metaOf, active }`（见设计文档 §4.1）。
- 状态：`range`（默认 `'today'`）、`apiKey`/`platform`/`model`（默认 `'all'`）、`data`（CostSeriesResult 最小视图）、`loading`、`error`。
- 数据加载：`run(getSession(), { op: 'costSeries', range })`；mount 加载、`tick`/`reloadTick` 变化重新加载、`range` 变化重新加载。
- 派生：从 records 汇总 —— apiKey 列表（metaOf 显示 label + 脱敏 key）、platform 列表、model 列表（跨平台同名显示「平台·模型」），均按 token 总量降序。
- 筛选：按 apiKey/platform/model 过滤 records（纯前端）。
- 渲染：筛选行（API Key / 平台 / 模型 三个 select + 时间 5 个分段按钮）+ 五张图（2 列并排：费用、Token 总量；全宽：工作区、缓存比例、工具占比）。空态（无记录）与错误（错误行 + 重试按钮，重试 = reloadTick 自增或本地重载）。
- 时间切换时重请求，保持已选 apiKey/platform/model。

- [ ] **步骤 2：BalanceModal 接入**

- import `CostTab`；`renderCostTab` 改为渲染 `<CostTab ... />`（传 `run`、`getSession`、`tick`、`reloadTick`（新增 `const [costReload, setCostReload] = useState(0)`）、`providers={providers ?? []}`、`metaOf={providerMeta}`、`active={tab === 'cost'}`）。
- 删除表格渲染相关代码：`renderCostTab` 表格实现、`COST_ROWS`、`costRowCells`、`keyEntryOf`、`officialOf`、`bucketsSum`、`cacheHitRate`、`fmtRate`、`CostEntryView` 接口（保留 `CostResultView` / `KeyCostEntryView` / `BucketsView`，`loadCost` 仍被余额 tab 的 `todayCostOf` 与 tick 使用）。
- 头部「刷新」按钮：cost tab 时改为 `onClick={() => setCostReload(n => n + 1)}`（不再直接调 loadCost）。
- 保留 `dshb-hint`（costHint 文案可删，费用 tab 由 CostTab 自管提示）。

- [ ] **步骤 3：i18n 新增文案（zh + en 键一一对应）**

新增键：`filterApiKey` / `filterPlatform` / `filterModel` / `filterTime` / `rangeAll` / `rangeHour1` / `rangeToday` / `rangeWeek7` / `rangeMonth1` / `chartCost` / `chartTokens` / `chartWorkspace` / `chartCache` / `chartPurpose` / `purposeTool` / `purposeText` / `purposeReasoning` / `cacheHit` / `cacheMiss` / `notPriced` / `notPricedTip`（含 `{n}`）/ `yAmount`（含 `{cur}`）/ `yTokens` / `workspaceUnknown` / `seriesEmpty` / `seriesError` / `retry`。两语言 dict 同步添加。

- [ ] **步骤 4：styles.ts 新增样式**

- `.dshb-filters`（flex wrap 筛选行）、`.dshb-filter`（label + select 行）、`.dshb-select`（复用 dshb-input 外观）、`.dshb-seg`（时间分段按钮，复用 dshb-subtab 外观）。
- `.dshb-charts`（grid 2 列 gap）、`.dshb-chart`（卡片：标题 + 容器）、`.dshb-chart-wide`（grid-column 1/-1）、`.dshb-chart-box`（height 220px）、`.dshb-chart-title`。

- [ ] **步骤 5：运行校验**

运行：`pnpm exec tsc -b --pretty false`（client 与 host 两个工程）
预期：无类型错误。

- [ ] **步骤 6：Commit**

```bash
git add src/client
git commit -m "feat: cost tab revamp — filters + five ECharts charts (CostTab/CostCharts)"
```

---

### 任务 7：全量验证

- [ ] **步骤 1：完整构建**

运行：`pnpm run build`
预期：`lib/index.js` 与 `lib/client.js`（含 echarts 内联）构建成功；`lib/client.js` 体积增大（+约 350KB min）。

- [ ] **步骤 2：全部验证脚本**

运行：`pnpm run verify`（verify-client + verify-series）、`pnpm run verify:i18n`
预期：全绿，退出码 0。

- [ ] **步骤 3：手工验收指引（提交说明中注明）**

GUI 打开余额弹框 → 费用 tab：五图渲染、时间切换重请求、API Key/平台/模型筛选联动、未计费层与 tooltip、深浅色跟随、窗口缩放图表自适应、弹框内部滚动；余额 tab 今日消耗不受影响。

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "build: full verification for cost tab charts revamp"
```

---

## 自检

- **规格覆盖度**：筛选器（API Key/平台/模型/时间）→ 任务 5/6；五张图 → 任务 5；未计费层 → 任务 3（priced 标志）+ 任务 5（未计费层）；用途拆分 → 任务 3/5；平台=域名 → 任务 3；模型「平台·模型」→ 任务 6；时间粒度 → 任务 3；缓存 → 任务 3.4；i18n → 任务 6.3；测试 → 任务 4；现有 cost op 不动 → 任务 6.2 仅删表格、保留 loadCost。
- **占位符**：无 TODO/待定。
- **类型一致性**：`CostSeriesResult.records` 为 `SeriesRecord[][]`（index 对齐 points）；客户端 `RecordsView` 与宿主类型字段一致（provider/platform/model/workspace/buckets/amount/priced/steps/purpose）。
