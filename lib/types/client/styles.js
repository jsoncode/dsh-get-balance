/**
 * dsh-get-balance —— 浏览器半边：样式注入（与 dsh-jenkins 相同的 bundle CSS 注入模式）。
 */
const CSS_ID = 'dsh-get-balance/settings.css';
export const css = [
    // 通用
    '.dshb-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer}',
    '.dshb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}',
    '.dshb-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.dshb-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#1668e3));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}',
    '.dshb-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#1668e3))}',
    '.dshb-btn-small{padding:3px 10px;font-size:12px}',
    '.dshb-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:currentColor}',
    '.dshb-head-ops{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}',
    '.dshb-err{color:var(--dsw-alias-state-error-primary,#d33);font-size:12px;margin:4px 0 0}',
    '.dshb-ok{color:var(--dsw-alias-state-success-primary,#2a7d3c);font-size:12px;margin:4px 0 0}',
    '.dshb-empty{padding:28px 16px;text-align:center;color:var(--dsw-alias-label-secondary,#888);font-size:13px}',
    '.dshb-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin:0 0 10px;line-height:1.5}',
    '.dshb-input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;transition:border-color .15s,box-shadow .15s}',
    '.dshb-input:hover{border-color:var(--dsw-alias-border-l3,#b8b8b8)}',
    '.dshb-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#1668e3);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary,#1668e3) 18%,transparent)}',
    '.dshb-input::placeholder{color:var(--dsw-alias-label-tertiary,#aaa)}',
    '.dshb-spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,#ccc);border-top-color:var(--dsw-alias-brand-primary,#1668e3);animation:dshb-spin .8s linear infinite;margin:12px auto}',
    '@keyframes dshb-spin{to{transform:rotate(360deg)}}',
    // 侧边栏底部入口：样式对齐 DSH 设置按钮（sidebar.settings 的 trigger）——
    // 高 42px（窄栏 36px）、字号 14px/行高 22px、宽模式左对齐、图标 + 文字（仅宽模式显示文字）
    '.dshb-footer-btn{box-sizing:border-box;cursor:pointer;width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);background:transparent;border:none;border-radius:12px;flex:none;align-items:center;gap:8px;margin:4px -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:22px;display:flex;overflow:hidden}',
    '.dshb-footer-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
    '.dshb-footer-btn-rail{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 10px;padding:0}',
    '.dshb-footer-group{width:100%;min-width:0}',
    '.dshb-footer-rail-group{width:auto}',
    // 图标：28px 钱包双色 PNG（自带配色，object-fit:contain 保持比例居中；
    // pointer-events:none 让右键/拖拽落到下层按钮上，不出现「图片另存为」菜单）
    '.dshb-footer-logo{height:28px;width:28px;flex:none;display:block;object-fit:contain;pointer-events:none}',
    '.dshb-footer-label{flex:1 1 auto;display:flex;flex-direction:row;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden}',
    '.dshb-footer-word{font-size:14px;font-weight:500;color:var(--dsw-alias-label-primary,#222)}',
    // 「余额」+ 时段小圆点整体作为 Tooltip 锚点：内联 flex 保持二字与圆点同排同距
    '.dshb-footer-word-group{display:inline-flex;align-items:center;gap:6px;min-width:0}',
    // 余额靠右对齐：margin-left:auto 推到按钮右缘；货币符号与金额整体绿色，金额加粗
    '.dshb-footer-balance{display:inline-flex;align-items:baseline;gap:2px;margin-left:auto;font-size:12px;font-weight:500;color:#16a34a;white-space:nowrap;flex:none;font-variant-numeric:tabular-nums}',
    '.dshb-footer-cur{flex:none}',
    '.dshb-footer-balance-num{font-weight:700}',
    // 多账号余额分段：| 分隔；取不到余额的分段以红色 -- 占位（悬停显示原因）
    '.dshb-footer-balance-seg{display:inline-flex;align-items:baseline;gap:2px}',
    '.dshb-footer-balance-sep{color:var(--dsw-alias-label-tertiary,#888);margin:0 3px;flex:none}',
    '.dshb-footer-balance-err{color:var(--dsw-alias-state-error-primary,#d33);font-weight:700}',
    // 时段小圆点：高峰红 / 空闲绿，悬停气泡提示完整信息（宿主 Tooltip）
    '.dshb-period-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}',
    '.dshb-period-dot-peak{background:var(--dsw-alias-state-error-primary,#d33)}',
    '.dshb-period-dot-off{background:#16a34a}',
    // 气泡内价词着色（宿主 Tooltip 深色底板白字之上覆盖）：高峰「全价」红 / 空闲「半价」绿
    '.dshb-tip{white-space:nowrap}',
    '.dshb-tip b{font-weight:600}',
    '.dshb-tip .dshb-tip-full{color:var(--dsw-alias-state-error-primary,#d33)}',
    '.dshb-tip .dshb-tip-half{color:#16a34a}',
    // 数字「上下轮播」（odometer）：每位数字一列，列内 0-9 纵向条带（3 份支持环绕），
    // 值变化沿最短路径滚动；非数字字符（小数点 / K/M 后缀）静态列。
    // 注意：不写 prefers-reduced-motion 的禁用规则——数字变化是余额/费用的实时反馈，
    // 有意在系统「减少动态效果」开启时也保持滚动（宿主其它装饰性动画仍会随之关闭）。
    '.dshb-roller{display:inline-block;white-space:nowrap;line-height:1em;font-variant-numeric:tabular-nums}',
    '.dshb-roll-col{display:inline-block;height:1em;overflow:hidden;vertical-align:top}',
    '.dshb-roll-strip{display:block;transition:transform .35s cubic-bezier(.25,.8,.35,1);will-change:transform}',
    '.dshb-roll-col-static .dshb-roll-strip{transition:none}',
    '.dshb-roll-cell{display:block;height:1em;line-height:1em;text-align:center}',
    '.dshb-roll-char{display:inline-block;height:1em;line-height:1em;vertical-align:top}',
    // 宿主 sidebar.footer.action 列表容器：改为纵向堆叠，多个按钮各占一行、按 order 升序
    'div:has(> [data-slot="sidebar.footer.action"]){flex-direction:column}',
    // 弹框
    // 弹框蒙版：半透明黑 + 高斯模糊（backdrop-filter 模糊蒙版背后的页面内容，
    // Safari 前缀 -webkit-backdrop-filter；不支持时优雅降级为纯半透明遮罩）
    '.dshb-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:auto}',
    '.dshb-modal{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.28);width:min(760px,100%);min-height:420px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary,#222);font-size:14px}',
    // 弹框头部单行：标题 + tab 同行，右侧操作区（margin-left:auto 推到最右）
    '.dshb-modal-header{display:flex;align-items:center;gap:12px;padding:8px 14px 8px 18px;border-bottom:1px solid var(--dsw-alias-border-l1,#eee);flex:none}',
    '.dshb-modal-title{font-size:15px;font-weight:600;white-space:nowrap}',
    '.dshb-close{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#888);font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px}',
    '.dshb-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.15));color:var(--dsw-alias-label-primary,#222)}',
    // tab 组：嵌入头部行，去掉自身的 padding / 分隔线
    '.dshb-tabs{display:flex;gap:6px;overflow-x:auto;flex:none;min-width:0}',
    '.dshb-tab{padding:5px 12px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font-size:13px;cursor:pointer;white-space:nowrap}',
    '.dshb-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}',
    '.dshb-tab-active{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#1668e3));color:var(--dsw-alias-label-primary-foreground,#fff);border-color:transparent;font-weight:500}',
    // 弹框主体：grid stacking —— 三个 tab 面板叠放同一格，隐藏面板仍占位参与布局，
    // 弹框高度恒等于最高面板（价格设置页），保证其不出现滚动、切换 tab 不跳动
    '.dshb-modal-body{flex:1;overflow-y:auto;padding:16px 18px;min-width:0;min-height:0;display:grid}',
    '.dshb-modal-body>*{grid-area:1/1;min-width:0}',
    '.dshb-pane-off{visibility:hidden;pointer-events:none}',
    '.dshb-modal-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l1,#eee);flex:none;flex-wrap:wrap}',
    '.dshb-modal-footer .dshb-msg{margin:0 auto 0 0;font-size:12px}',
    // 余额 tab：服务商卡片行
    '.dshb-prov-list{display:flex;flex-direction:column;gap:8px}',
    '.dshb-prov{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,#eee);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fafafa)}',
    '.dshb-prov-main{min-width:0;flex:1}',
    '.dshb-prov-name-row{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}',
    '.dshb-prov-name{font-size:13px;font-weight:600}',
    '.dshb-prov-meta{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:2px;word-break:break-all}',
    '.dshb-chip{font-size:11px;color:var(--dsw-alias-label-secondary,#888);background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l1,#eee);padding:1px 9px;border-radius:999px;white-space:nowrap}',
    '.dshb-chip-brand{color:var(--dsw-alias-brand-primary,#1668e3);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#1668e3) 35%,transparent)}',
    '.dshb-prov-side{flex:none;text-align:right;min-width:250px}',
    '.dshb-prov-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:2px}',
    '.dshb-prov-err{font-size:12px;color:var(--dsw-alias-state-error-primary,#d33);max-width:220px;word-break:break-all}',
    '.dshb-topped{color:var(--dsw-alias-state-warn-primary,#b8860b)}',
    // 余额 tab 每个 API key 行：今日消耗 ≈xx CNY | 余额 xx CNY
    '.dshb-prov-costline{display:flex;align-items:center;justify-content:flex-end;gap:5px;font-size:13px;margin-bottom:2px;white-space:nowrap}',
    '.dshb-balance-num{font-weight:600;color:#16a34a;font-variant-numeric:tabular-nums}',
    '.dshb-balance-sep{color:var(--dsw-alias-label-tertiary,#bbb)}',
    // 附加 key 区
    '.dshb-keys{margin-top:16px;border-top:1px dashed var(--dsw-alias-border-l3,#bbb);padding-top:12px}',
    '.dshb-keys-title{font-size:13px;font-weight:600;margin-bottom:4px}',
    '.dshb-key-row{display:flex;align-items:center;gap:8px;padding:6px 0}',
    '.dshb-key-row .dshb-chip{flex:none}',
    '.dshb-key-mask{flex:1;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary,#888);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dshb-key-form{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) auto auto;gap:8px;align-items:center;margin-top:8px}',
    // 费用 tab：表格（行为 API Key 组 × 四类别，token 列 rowSpan 合并；首组为合计）
    '.dshb-cost-table{min-width:640px}',
    '.dshb-cost-table th{white-space:nowrap}',
    '.dshb-cost-table .dshb-cost-num{text-align:right;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.dshb-cost-table .dshb-cost-cat{white-space:nowrap;color:var(--dsw-alias-label-secondary,#888);font-size:12px}',
    '.dshb-cost-key{vertical-align:top;min-width:110px}',
    // 第一列：provider 名称 + 官方/非官方 tag 一行，脱敏 key 一行
    '.dshb-cost-key-name-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.dshb-cost-key-name-row .dshb-chip{flex:none}',
    '.dshb-cost-key-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#222);word-break:break-all}',
    // 第一列主体：脱敏 token（大字等宽）
    '.dshb-cost-key-token{margin-top:4px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#222);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}',
    '.dshb-cost-key-label{margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary,#888)}',
    '.dshb-cost-key-mask{margin-top:2px;font-size:11px;color:var(--dsw-alias-label-tertiary,#999);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}',
    '.dshb-cost-amount-cell{color:#16a34a;font-weight:500}',
    '.dshb-cost-total>td{background:var(--dsw-alias-bg-layer-2,#fafafa)}',
    // 会话头部工具区按钮 + 定时更新弹框
    '.dshb-header-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08));color:var(--dsw-alias-label-primary);border-radius:999px;padding:2px 10px;font-size:11px;font-family:inherit;white-space:nowrap;cursor:pointer;line-height:1.6}',
    '.dshb-header-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}',
    '.dshb-header-tokens{color:#16a34a;font-weight:500;font-variant-numeric:tabular-nums}',
    '.dshb-header-sep{color:var(--dsw-alias-label-tertiary,#bbb);margin:0 3px}',
    '.dshb-header-amount{color:#16a34a;font-weight:500}',
    // 会话头部按钮的逐 provider 气泡弹框：悬停展开（wrapper 圈定 hover 区域，
    // 气泡 fixed 定位避开头部容器 overflow 裁剪），每行 = 名称 + token + | + ≈金额；
    // 非官方行金额位显示「不计费」
    '.dshb-header-wrap{display:inline-flex}',
    '.dshb-header-bd{position:fixed;z-index:1200;min-width:230px;max-width:min(340px,90vw);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:8px 10px;font-size:12px;color:var(--dsw-alias-label-primary,#222)}',
    '.dshb-header-bd-title{font-size:11px;color:var(--dsw-alias-label-tertiary,#888);margin:0 0 6px;font-weight:500}',
    '.dshb-header-bd-empty{color:var(--dsw-alias-label-tertiary,#888);text-align:center;padding:4px 0}',
    '.dshb-header-bd-row{display:flex;align-items:baseline;gap:6px;white-space:nowrap;padding:3px 0;min-width:0}',
    '.dshb-header-bd-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:140px}',
    '.dshb-header-bd-tokens{color:#16a34a;font-variant-numeric:tabular-nums}',
    '.dshb-header-bd-sep{color:var(--dsw-alias-label-tertiary,#bbb);margin:0 2px}',
    '.dshb-header-bd-amount{color:#16a34a;font-weight:600;font-variant-numeric:tabular-nums}',
    '.dshb-header-bd-nobill{color:var(--dsw-alias-label-secondary,#888);font-weight:400}',
    '.dshb-timing-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:1200}',
    '.dshb-timing-dialog{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:16px;width:300px;max-width:calc(100vw - 40px);box-shadow:0 8px 30px rgba(0,0,0,.2)}',
    '.dshb-timing-title{font-size:14px;font-weight:600;margin-bottom:6px}',
    '.dshb-timing-field{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:10px}',
    '.dshb-timing-field .dshb-input{width:90px}',
    '.dshb-timing-active{margin-top:8px;font-size:11px;color:#16a34a}',
    '.dshb-timing-actions{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}',
    '.dshb-cost-tier{margin-top:12px;font-size:12px;color:var(--dsw-alias-label-secondary,#888)}',
    '.dshb-cost-tier b{color:var(--dsw-alias-label-primary,#222);font-weight:500}',
    // 价格 tab：档位表格（行内编辑）
    '.dshb-table{width:100%;border-collapse:collapse;font-size:13px}',
    '.dshb-table th{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary,#666);text-align:left;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,#eee);white-space:nowrap}',
    '.dshb-table td{padding:5px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,#eee);vertical-align:middle}',
    '.dshb-table .dshb-input{padding:5px 8px;font-size:12px;border-radius:6px}',
    '.dshb-table .dshb-num{width:74px;text-align:right;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}',
    '.dshb-table .dshb-cur{width:64px}',
    '.dshb-table-ops{white-space:nowrap;text-align:right}',
    // 价格 tab：时段窗口配置
    '.dshb-window-box{border:1px solid var(--dsw-alias-border-l1,#eee);border-radius:10px;padding:10px 12px;margin-bottom:12px}',
    // 窗口标题行：标题居左，周六日半价开关居右
    '.dshb-window-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}',
    '.dshb-window-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,#222)}',
    '.dshb-weekend{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#888);cursor:pointer;white-space:nowrap;flex:none}',
    '.dshb-weekend:hover{color:var(--dsw-alias-label-primary,#222)}',
    '.dshb-weekend input{margin:0;accent-color:var(--dsw-alias-brand-primary,#1668e3);cursor:pointer}',
    '.dshb-window-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}',
    '.dshb-window-row{display:flex;align-items:center;gap:6px;flex:none;white-space:nowrap}',
    '.dshb-window-row .dshb-btn{flex:none}',
    '.dshb-window-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
    '.dshb-window-actions .dshb-btn{flex:none}',
    '.dshb-window-tz{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#888);flex:none}',
    '.dshb-window-tz .dshb-range{width:140px;accent-color:var(--dsw-alias-brand-primary,#1668e3);cursor:pointer}',
    '.dshb-window-tz-label{font-weight:500;color:var(--dsw-alias-label-primary,#222);font-size:12px;min-width:52px;text-align:left}',
    '.dshb-window-del{white-space:nowrap}',
    // 价格 tab：官方价格表式排版（左 2 列标签区 rowspan 合并 + 每模型一列）
    '.dshb-price-scroll{overflow-x:auto}',
    '.dshb-price-table{width:100%;min-width:520px}',
    '.dshb-price-table th,.dshb-price-table td{padding:3px 4px;vertical-align:middle;text-align:center}',
    '.dshb-price-table .dshb-input{padding:5px 8px;font-size:12px;border-radius:6px}',
    '.dshb-price-corner{white-space:nowrap;text-align:center;font-weight:500}',
    '.dshb-price-head-cell{width:20%;min-width:0}',
    '.dshb-price-model-name{display:block;font-size:12px;line-height:1.35;word-break:break-word}',
    '.dshb-price-metric{width:64px;min-width:64px;white-space:pre-line;word-break:break-word;font-weight:500;color:var(--dsw-alias-label-primary,#222);font-size:12px;line-height:1.35}',
    '.dshb-price-period{white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-secondary,#666);width:64px}',
    '.dshb-period-peak{color:var(--dsw-alias-state-error-primary,#d33);font-weight:500}',
    '.dshb-period-off{color:#16a34a;font-weight:500}',
    '.dshb-price-cell .dshb-num{width:100%;box-sizing:border-box;text-align:center;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}',
].join('\n');
/** 注入 <style>（幂等：已存在则不重复注入）。 */
export function injectStyles() {
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + CSS_ID + '"]') === null) {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-get-balance';
        tag.dataset.pluginCss = CSS_ID;
        tag.textContent = css;
        document.head.appendChild(tag);
    }
}
