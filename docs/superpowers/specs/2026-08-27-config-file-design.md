# 设计：插件持久数据迁移到 `$DSH_HOME/dsh-get-balance.json`

- 日期：2026-08-27
- 状态：已批准（用户确认方案 A：读穿透 + 原子写；位置 `$DSH_HOME`；一次性自动迁移；彻底移除 settings 命名空间）

## 背景

`dsh-get-balance` 目前把三份持久数据写入宿主默认设置
（`$DSH_HOME/settings.yaml` 的 `dsh-balance` 命名空间，字段为 JSON 字符串）：

- `extraKeysJson` —— 手动附加的 API key 列表（明文）
- `pricesJson` —— 价格档配置
- `autoRefreshJson` —— 定时自动刷新间隔（秒）

目标：不再写入宿主默认设置，改为自定义配置文件 `$DSH_HOME/dsh-get-balance.json`。

## 决策

| 决策点 | 结论 |
| --- | --- |
| 文件位置 | `$DSH_HOME/dsh-get-balance.json`（`dshHomePath('dsh-get-balance.json')`，与 settings.yaml 同目录） |
| 旧数据 | 一次性自动迁移（JSON 文件不存在且 settings 有非默认数据时） |
| settings 命名空间 | 彻底移除：迁移后不再注册、不再读写；settings.yaml 中旧字段不主动删除 |
| 读写策略 | 方案 A：每次 op 现读文件（读穿透）；写操作串行化 + 原子替换（tmp + rename） |

## JSON 文件格式

```json
{
  "version": 1,
  "extraKeys": [ { "id": "k1", "label": "主账号", "apiKey": "sk-..." } ],
  "prices": {
    "tiers": [ { "id": "...", "name": "...", "currency": "CNY", "match": "...",
                 "peak": { "input": 0, "cacheRead": 0, "cacheWrite": 0, "output": 0 },
                 "offPeak": { "input": 0, "cacheRead": 0, "cacheWrite": 0, "output": 0 } } ],
    "timezoneOffsetMinutes": 480,
    "peakWindows": [ { "start": "09:00", "end": "12:00" }, { "start": "14:00", "end": "18:00" } ],
    "weekendOffPeak": false
  },
  "autoRefreshSeconds": 0
}
```

原生 JSON 对象（不再用「JSON 字符串包 JSON」，该 hack 仅为绕开 schemastery 深冻结，
文件存储下不需要）。`version` 保留用于未来格式演进。

## 新模块 `src/host/config-file.ts`

- 路径：`dshHomePath('dsh-get-balance.json')`
- `readPluginConfig(): Promise<PluginConfigFile>`
  - 首次调用前先执行一次性迁移（见下）
  - 每次现读文件；缺失 → 返回默认值（首次保存才落盘，避免全新安装产生空文件）
  - 损坏 → 备份为 `dsh-get-balance.json.bak-<时间戳>` + warn 一次 + 返回默认值
- `savePluginConfig(patch)`：合并到当前值 → 整体写入；写操作经 promise 链串行化；
  先写 `*.tmp` 再 `rename` 原子替换；写前 `mkdir(dirname, { recursive: true })` 兜底；
  失败 → 抛错，op 层映射为保存失败
- 默认值：`DEFAULT_PRICES` / 空 key 列表 / `autoRefreshSeconds: 0`

## 一次性迁移

- 模块内懒初始化：首次 `readPluginConfig()` 前跑 `ensureMigrated(deps)`
- JSON 文件已存在 → 跳过
- 否则在一次性子插件上下文（`ctx.plugin({ apply })`，读完立即 dispose）里临时注册
  旧 `dsh-balance` 命名空间（`settings.get()` 只认已注册命名空间），读出三字段
- 有非默认数据 → 写入 JSON 文件 + 日志「已从 settings 迁移」；全默认 → 不写文件
- 迁移后不再注册旧命名空间

## 改动清单

- `src/host/config-file.ts`（新增）：上述模块
- `src/host/ops.ts`：`OpDeps` 删除 `scope`；`readJson/writeJson` 及
  `readExtraKeys/readPriceConfig/readAutoSeconds` 改调 config-file；
  `pricesSave/keysSave/autoRefreshSave` 改调 `savePluginConfig`
- `src/host/index.ts`：删除 `BalanceSettingsSchema` 与 settings 命名空间注册；
  settings 服务保留（仍读 llm-pi-ai / llm-deepseek 段）；apply 时 `initConfigFile(ctx)`
- `src/client/i18n.ts`：`extraKeysHint` 的 `$DSH_HOME/settings.yaml` → `$DSH_HOME/dsh-get-balance.json`
- `README.md` / `README.zh-CN.md`：配置文件一节（位置、格式、可手改且即时生效）

## 验证

- `pnpm check` + `pnpm build` + `pnpm verify`
- 冒烟：首次保存 key → 文件出现；手改文件 → 立即生效；损坏文件 → 备份 + 回退默认；
  旧 settings 数据 → 首次启动自动迁移
