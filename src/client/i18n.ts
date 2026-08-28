/**
 * dsh-get-balance —— 浏览器半边：语言与文案（中英双语，跟随主界面语言）。
 */

function resolveLang(): 'zh' | 'en' {
  if (typeof document !== 'undefined') {
    const host = document.documentElement.lang || navigator.language || 'zh-CN'
    return /^zh/i.test(host) ? 'zh' : 'en'
  }
  return 'zh'
}

export const LANG = resolveLang()

const COPY: Record<'zh' | 'en', Record<string, unknown>> = {
  zh: {
    balanceBtn: '余额',
    btnPeak: '高峰时段',
    btnOffPeak: '空闲时段 半价',
    tipPeak: '当前为高峰时段 {price}计费',
    tipOffPeak: '当前为空闲时段 {price}计费',
    tipFullPrice: '全价',
    tipHalfPrice: '半价',
    headerBtnPrefix: '当前会话',
    headerBreakdownTitle: '当前会话 · 各 Provider',
    timingBtn: '定时更新',
    timingTitle: '定时更新配置',
    timingHint: '每隔设定秒数自动刷新余额与费用（含顶部按钮与弹框）。',
    timingSeconds: '间隔（秒）',
    timingStart: '启动',
    timingStop: '停止',
    timingActive: '已开启：每 {n} 秒自动刷新',
    timingInvalid: '请输入 1–86400 之间的秒数',
    updatePill: '更新',
    updateTip: '发现新版本 v{latest}，当前 v{current}，点击更新',
    updateConfirmTitle: '更新插件',
    updateConfirmText: '发现新版本 v{latest}（当前 v{current}），确认执行以下命令更新插件？',
    updateConfirmBtn: '确认更新',
    updateLogTitle: '插件更新日志',
    updateRunning: '正在更新…',
    updateSuccess: '更新完成（退出码 0），请刷新页面使新版本生效',
    updateFailed: '更新失败（退出码 {code}）',
    updateLogStartFailed: '启动更新失败',
    updateDuration: '耗时 {s} 秒',
    updateNoOutput: '（暂无输出）',
    updateBgHint: '关闭弹框后更新仍在后台继续，可随时重新打开日志查看进度',
    updateRestartHint: '更新完成后请重启 dsh 服务使新版本生效',
    liveStatus: '实时刷新中',
    copy: '复制',
    copied: '已复制',
    modalTitle: '账户余额 · Token 调用量',
    tabBalance: '余额',
    tabCost: '费用',
    tabPrices: '价格设置',
    tabPlatformDeepseek: 'DeepSeek',
    refresh: '刷新',
    close: '关闭',
    save: '保存',
    saved: '已保存',
    saveFailed: '保存失败',
    cancel: '取消',
    add: '添加',
    delete: '删除',
    // 余额 tab
    noProviders: '未发现 DeepSeek 服务商。请在 dsh 设置中配置 llm-pi-ai / llm-deepseek 段，或在下方附加 API Key。',
    showBalanceToggle: '显示余额',
    showBalanceHint: '关闭后，底部「余额」入口与上方列表中的余额金额一律显示为 **（不影响查询与费用统计）',
    sourcePiAi: 'pi-ai 路由',
    sourceDeepseek: '官方路由',
    sourceExtra: '附加 Key',
    sharedAccountTitle: '与 {n} 共用同一 API Key（同一账号，余额相同）',
    noCredential: '未配置凭据',
    balanceTotal: '总余额',
    balanceGranted: '赠送余额',
    toppedOut: '已用完',
    summaryTodayCost: '今日消耗',
    summaryBalance: '余额',
    extraKeysTitle: '附加 API Key',
    extraKeysHint: '手动添加不在 dsh providers 配置中的 key（仅用于余额查询，明文保存在 $DSH_HOME/dsh-get-balance.json）',
    addKeyBtn: '附加 API Key',
    keyLabel: '备注',
    keyLabelPlaceholder: '选填，如「测试账号」',
    keyInput: 'API Key',
    keyInputPlaceholder: 'sk-…',
    keyRequired: '请填写 API Key',
    // 费用 tab（图表版）
    filterApiKey: 'API Key',
    filterPlatform: '平台',
    filterModel: '模型',
    filterTime: '时间',
    rangeAll: '全部',
    rangeHour1: '近一小时',
    rangeToday: '今天',
    rangeWeek7: '近七天',
    rangeMonth1: '近一个月',
    chartCost: '费用',
    chartTokens: 'Token 总量',
    chartWorkspace: '工作区',
    chartCache: '缓存比例',
    chartPurpose: '工具占比',
    purposeTool: '工具调用',
    purposeText: '文本回复',
    purposeReasoning: '纯推理',
    cacheHit: '缓存命中',
    cacheMiss: '未命中',
    cacheHitRate: '命中缓存率',
    notPriced: '未计费',
    notPricedTip: '未配置定价 · {n} tokens（不计费）',
    yAmount: '费用（{cur}）',
    yTokens: 'Token 量',
    workspaceUnknown: '未知工作区',
    seriesEmpty: '所选范围内暂无数据',
    seriesError: '加载失败',
    retry: '重试',
    costTabHint: '费用仅对官方 Key（api.deepseek.com）且已配置定价的模型计费；未配置定价的记录不计费，不在费用图中显示（费用图 y 轴单位为元）。筛选按 平台 → API Key → 模型 逐级关联，本地即时生效；时间切换重新统计。',
    // 价格 tab
    pricesHint: '单价单位为每百万 tokens；每档分别设置高峰与空闲两套单价；匹配优先级：精确模型 id > 前缀 > * 通配兜底。修改后保存即生效。',
    priceName: '名称',
    priceMatch: '模型匹配',
    priceCurrency: '货币',
    priceInput: '输入',
    priceCacheRead: '缓存命中',
    priceCacheWrite: '缓存写入',
    priceOps: '操作',
    priceModel: '模型版本',
    pricePeriodPeak: '高峰时段',
    pricePeriodOffPeak: '空闲时段',
    priceInputHit: '百万tokens输入\n（缓存命中）',
    priceInputMiss: '百万tokens输入\n（缓存未命中）',
    priceOutput: '百万tokens输出',
    windowTitle: '时段配置',
    weekendHalfPrice: '周六日半价',
    weekendHint: '勾选后，周六/周日整天按空闲时段单价计费（从高峰窗口中排除）',
    windowHint: '高峰时段窗口（其余时间为空闲时段），格式 HH:MM，按下方时区偏移解释。官方默认：北京时间 9:00–12:00、14:00–18:00。',
    windowStart: '开始',
    windowEnd: '结束',
    addWindow: '新增高峰时段',
    windowInvalid: '时段须为 HH:MM 且开始早于结束',
    tzOffset: '时区偏移',
    tzOffsetInvalid: '时区偏移须为数字',
    tzZero: '零时区',
    tzEast: '东{n}区',
    tzWest: '西{n}区',
    /** 中文数字（时区名用，如「东八区」）。 */
    cnNum: ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'],
    pricesSaved: '价格已保存',
    pricesEmpty: '至少保留一个价格档',
    fallbackHint: '通配档位：匹配所有未在上方列出的模型（match = *）',
    cmdNoResult: '命令未返回结果',
    errors: {
      'auth-failed': '认证失败：API Key 无效或已过期（HTTP 401/403）',
      'no-credential': '未配置凭据（apiKeyEnv 未解析到值）',
      'timeout': '请求超时',
      'network-failed': '网络请求失败',
      'http-error': '官方接口返回错误',
      'op-unknown': '未知操作',
      'params-invalid': '参数需为 JSON',
      'internal-error': '宿主内部错误',
      'forbidden': '请求被信任围栏拒绝',
    },
  },
  en: {
    balanceBtn: 'Balance',
    btnPeak: 'peak hours',
    btnOffPeak: 'off-peak, half price',
    tipPeak: 'Currently peak hours · {price} billing',
    tipOffPeak: 'Currently off-peak hours · {price} billing',
    tipFullPrice: 'full price',
    tipHalfPrice: 'half price',
    headerBtnPrefix: 'Session',
    headerBreakdownTitle: 'Session by provider',
    timingBtn: 'Auto',
    timingTitle: 'Auto refresh',
    timingHint: 'Refresh balance & cost every N seconds (header button and modal).',
    timingSeconds: 'Interval (s)',
    timingStart: 'Start',
    timingStop: 'Stop',
    timingActive: 'Active: every {n}s',
    timingInvalid: 'Enter seconds between 1 and 86400',
    updatePill: 'Update',
    updateTip: 'New version v{latest} available (current: v{current}). Click to update',
    updateConfirmTitle: 'Update plugin',
    updateConfirmText: 'New version v{latest} available (current v{current}). Confirm running the following command to update the plugin?',
    updateConfirmBtn: 'Update now',
    updateLogTitle: 'Plugin Update Log',
    updateRunning: 'Updating…',
    updateSuccess: 'Update finished (exit 0). Refresh the page to apply.',
    updateFailed: 'Update failed (exit code {code})',
    updateLogStartFailed: 'Failed to start the update',
    updateDuration: 'Elapsed {s}s',
    updateNoOutput: '(no output yet)',
    updateBgHint: 'Closing this dialog keeps the update running in the background; reopen the log anytime to watch progress',
    updateRestartHint: 'Restart the dsh service after the update finishes to apply the new version',
    liveStatus: 'Live',
    copy: 'Copy',
    copied: 'Copied',
    modalTitle: 'Balance & Token Usage',
    tabBalance: 'Balance',
    tabCost: 'Cost',
    tabPrices: 'Prices',
    tabPlatformDeepseek: 'DeepSeek',
    refresh: 'Refresh',
    close: 'Close',
    save: 'Save',
    saved: 'Saved',
    saveFailed: 'Save failed',
    cancel: 'Cancel',
    add: 'Add',
    delete: 'Delete',
    // balance tab
    noProviders: 'No DeepSeek providers found. Configure llm-pi-ai / llm-deepseek in dsh settings, or attach an API key below.',
    showBalanceToggle: 'Show balance',
    showBalanceHint: 'When off, balance amounts here and in the footer entry are masked as ** (queries and cost stats unaffected)',
    sourcePiAi: 'pi-ai route',
    sourceDeepseek: 'official route',
    sourceExtra: 'extra key',
    sharedAccountTitle: 'Shares API key with {n} (same account; identical balance)',
    noCredential: 'No credential',
    balanceTotal: 'Total',
    balanceGranted: 'Granted',
    toppedOut: 'used up',
    summaryTodayCost: 'Today spend',
    summaryBalance: 'Balance',
    extraKeysTitle: 'Extra API Keys',
    extraKeysHint: 'Manually attach keys not in dsh providers config (balance query only; stored as plain text in $DSH_HOME/dsh-get-balance.json)',
    addKeyBtn: 'Attach API Key',
    keyLabel: 'Label',
    keyLabelPlaceholder: 'Optional, e.g. "test account"',
    keyInput: 'API Key',
    keyInputPlaceholder: 'sk-…',
    keyRequired: 'API key is required',
    // cost tab (charts)
    filterApiKey: 'API Key',
    filterPlatform: 'Platform',
    filterModel: 'Model',
    filterTime: 'Time',
    rangeAll: 'All',
    rangeHour1: 'Last hour',
    rangeToday: 'Today',
    rangeWeek7: 'Last 7 days',
    rangeMonth1: 'Last 30 days',
    chartCost: 'Cost',
    chartTokens: 'Total tokens',
    chartWorkspace: 'Workspace',
    chartCache: 'Cache ratio',
    chartPurpose: 'Tool share',
    purposeTool: 'Tool calls',
    purposeText: 'Text replies',
    purposeReasoning: 'Reasoning only',
    cacheHit: 'Cache hit',
    cacheMiss: 'Cache miss',
    cacheHitRate: 'Cache hit rate',
    notPriced: 'Not priced',
    notPricedTip: 'No pricing config · {n} tokens (not billed)',
    yAmount: 'Cost ({cur})',
    yTokens: 'Tokens',
    workspaceUnknown: 'Unknown workspace',
    seriesEmpty: 'No data in the selected range',
    seriesError: 'Failed to load',
    retry: 'Retry',
    costTabHint: 'Only official keys (api.deepseek.com) with a configured price tier are billed; unpriced records are not billed and do not appear in the cost chart (cost-chart y axis is in the local currency). Filters cascade Platform → API Key → Model and apply locally; switching time range re-queries the host.',
    // prices tab
    pricesHint: 'Prices are per million tokens; each tier has peak and off-peak rates; match priority: exact model id > prefix > * fallback. Save to apply.',
    priceName: 'Name',
    priceMatch: 'Model match',
    priceCurrency: 'Currency',
    priceInput: 'Input',
    priceCacheRead: 'Cache hit',
    priceCacheWrite: 'Cache write',
    priceOps: 'Actions',
    priceModel: 'Model version',
    pricePeriodPeak: 'Peak',
    pricePeriodOffPeak: 'Off-peak',
    priceInputHit: 'Input\n(cache hit)',
    priceInputMiss: 'Input\n(cache miss)',
    priceOutput: 'Output',
    windowTitle: 'Time windows',
    weekendHalfPrice: 'Weekends half price',
    weekendHint: 'When checked, Saturdays and Sundays are billed at off-peak rates all day (excluded from peak windows)',
    windowHint: 'Peak windows (the rest is off-peak), format HH:MM, interpreted in the timezone offset below. Official default: Beijing 9:00-12:00, 14:00-18:00.',
    windowStart: 'Start',
    windowEnd: 'End',
    addWindow: 'Add peak window',
    windowInvalid: 'Windows must be HH:MM and start before end',
    tzOffset: 'Timezone offset',
    tzOffsetInvalid: 'Timezone offset must be a number',
    tzZero: 'UTC±0',
    tzEast: 'UTC+{n}',
    tzWest: 'UTC-{n}',
    pricesSaved: 'Prices saved',
    pricesEmpty: 'Keep at least one price tier',
    fallbackHint: 'Wildcard tier: matches any model not listed above (match = *)',
    cmdNoResult: 'Command returned no result',
    errors: {
      'auth-failed': 'Authentication failed: invalid or expired API key (HTTP 401/403)',
      'no-credential': 'No credential configured (apiKeyEnv resolved to nothing)',
      'timeout': 'Request timed out',
      'network-failed': 'Network request failed',
      'http-error': 'Official API returned an error',
      'op-unknown': 'Unknown operation',
      'params-invalid': 'Parameters must be JSON',
      'internal-error': 'Host internal error',
      'forbidden': 'Rejected by the trust fence',
    },
  },
}

const dict = (COPY[LANG] || COPY.zh) as Record<string, any>

/** 取文案并替换 {var} 占位符。 */
export const t = (key: string, vars?: Record<string, string | number>): string => {
  let s = dict[key] !== undefined ? dict[key] : String(key)
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split('{' + k + '}').join(String(vars[k]))
    }
  }
  return s
}

/** 宿主错误通过 code 映射为本地化文本，未知错误回退原文。 */
export const tErr = (res: { code?: string; error?: string } | null | undefined, fallback?: string): string => {
  if (res && res.code) {
    const local = dict.errors[res.code]
    if (local !== undefined) {
      const zh = LANG === 'zh'
      if (res.code === 'network-failed' || res.code === 'timeout' || res.code === 'http-error') {
        const detail = res.error ? String(res.error).trim() : ''
        return local + (detail ? (zh ? '：' : ': ') + detail : '')
      }
      return local
    }
  }
  return (res && res.error) || fallback || ''
}

/** 中文数字（时区名用，如「东八区」）；zh 词典缺失或越界时回退阿拉伯数字。 */
export function zhNumeral(index: number): string {
  const list = (dict.cnNum as readonly string[] | undefined)
  return list !== undefined && index >= 0 && index < list.length ? (list[index] as string) : String(index)
}

/** 金额格式化（保留合理小数位）。 */
export const fmtAmount = (amount: number | undefined): string => {
  if (amount === undefined || !Number.isFinite(amount)) return '—'
  if (amount === 0) return '0'
  if (amount < 0.001) return amount.toExponential(2)
  if (amount < 1) return amount.toFixed(4)
  return amount.toFixed(2)
}

/** 常见货币代码 → 符号（余额前缀展示）；未收录的代码回退为代码本身（无代码时为空）。 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  HKD: 'HK$',
  KRW: '₩',
  INR: '₹',
  RUB: '₽',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  CHF: 'Fr.',
  TWD: 'NT$',
}

/** 货币代码 → 展示符号（CNY → ¥；未收录回退代码本身；空代码返回空串）。 */
export function currencySymbol(code: string): string {
  const c = (code || '').trim().toUpperCase()
  return c !== '' ? (CURRENCY_SYMBOLS[c] ?? c) : ''
}

/** 紧凑 token 单位（降序）：K=1e3 / M=1e6 / B=1e9 / T=1e12 / P=1e15。 */
const TOKEN_UNITS: ReadonlyArray<{ div: number; suffix: string }> = [
  { div: 1e15, suffix: 'P' },
  { div: 1e12, suffix: 'T' },
  { div: 1e9, suffix: 'B' },
  { div: 1e6, suffix: 'M' },
  { div: 1e3, suffix: 'K' },
]

/** token 数量紧凑格式化：1234567 → 1.23M，减小长数字占位（最多 3 位有效数字）。 */
export const fmtTokens = (n: number | undefined): string => {
  if (n === undefined || !Number.isFinite(n)) return '0'
  const v = Math.round(n)
  const abs = Math.abs(v)
  if (abs < 1000) return String(v)
  /** 缩放后的数值保留最多 3 位有效数字并去掉尾随 0。 */
  const scale = (div: number): string => {
    const scaled = v / div
    const intDigits = Math.max(1, Math.floor(Math.log10(Math.abs(scaled))) + 1)
    let s = scaled.toFixed(Math.min(2, Math.max(0, 3 - intDigits)))
    if (s.includes('.')) s = s.replace(/\.?0+$/, '')
    return s
  }
  for (let i = 0; i < TOKEN_UNITS.length; i++) {
    const unit = TOKEN_UNITS[i] as { div: number; suffix: string }
    if (abs >= unit.div) {
      // 四舍五入可能进位到上一档（如 999999999 → "1000M"），逐级上调单位。
      let s = scale(unit.div)
      let j = i
      while (Math.abs(Number(s)) >= 1000 && j > 0) {
        j -= 1
        s = scale((TOKEN_UNITS[j] as { div: number }).div)
      }
      return s + (TOKEN_UNITS[j] as { suffix: string }).suffix
    }
  }
  return String(v)
}

/** 坐标轴简写单位（降序）：T=1e12 / B=1e9 / M=1e6 / K=1e3。 */
const COMPACT_UNITS: ReadonlyArray<{ div: number; suffix: string }> = [
  { div: 1e12, suffix: 'T' },
  { div: 1e9, suffix: 'B' },
  { div: 1e6, suffix: 'M' },
  { div: 1e3, suffix: 'K' },
]

/**
 * 坐标轴紧凑简写：1234 → 1.2K，2345678 → 2.3M，0.05 → 0.05（小数保留合理精度）。
 * 与 fmtTokens 一样处理四舍五入进位（999.99B → 1T），适用于金额/Token 两类轴。
 */
export const fmtCompact = (n: number | undefined): string => {
  if (n === undefined || !Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  /** 去掉小数末尾多余的 0（1.0 → 1，2.50 → 2.5）。 */
  const strip = (s: string): string => (s.includes('.') ? s.replace(/\.?0+$/, '') : s)
  // 小于 1000：按数量级保留精度（整数 1 位小数、小数额外补位）。
  if (abs < 1000) {
    if (abs >= 1) return strip(n.toFixed(1))
    if (abs >= 0.01) return strip(n.toFixed(2))
    return strip(n.toFixed(4))
  }
  // 取最大适用单位（T 优先）。
  let i = 0
  for (let k = 0; k < COMPACT_UNITS.length; k++) {
    if (abs >= (COMPACT_UNITS[k] as { div: number }).div) {
      i = k
      break
    }
  }
  let s = strip((n / (COMPACT_UNITS[i] as { div: number }).div).toFixed(1))
  // 四舍五入进位（999.99B → 1000B）→ 上调到更大单位（1T）。
  while (Math.abs(Number(s)) >= 1000 && i > 0) {
    i -= 1
    s = strip((n / (COMPACT_UNITS[i] as { div: number }).div).toFixed(1))
  }
  return s + (COMPACT_UNITS[i] as { suffix: string }).suffix
}
