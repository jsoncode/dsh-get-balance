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
    '.dshb-footer-btn{box-sizing:border-box;position:relative;cursor:pointer;width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);background:transparent;border:none;border-radius:12px;flex:none;align-items:center;gap:8px;margin:4px -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:22px;display:flex;overflow:hidden}',
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
    // 更新胶囊：registry 有新版本时显示在按钮**最右侧**的小尺寸圆角胶囊
    // （琥珀色警示色，白字 10px）；窄栏圆形按钮放不下文字，改为右上角小圆点徽标。
    '.dshb-update-pill{display:inline-flex;align-items:center;height:16px;padding:0 7px;border-radius:999px;background:var(--dsw-alias-state-warn-primary,#f59e0b);color:#fff;font-size:10px;font-weight:600;line-height:1;letter-spacing:.02em;white-space:nowrap;flex:none;margin-left:8px}',
    '.dshb-update-pill-dot{position:absolute;top:2px;right:2px;width:10px;height:10px;padding:0;margin-left:0;font-size:0;z-index:1}',
    // 更新点击热区：胶囊的父盒子，等宽（撑满胶囊 + 两侧余量）、撑满按钮整高
    // （top:0/bottom:0）。阻断点击冒泡（stopPropagation），避免事件穿透到按钮
    // 误开余额弹框；整条热区点击都触发更新确认，而非只有胶囊文字本身。
    // 无 hover 背景色：按钮本身已有 hover 态，热区再叠一层会显得「双重高亮」。
    '.dshb-update-zone{position:absolute;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:0 10px;border-radius:12px;cursor:pointer;z-index:2}',
    '.dshb-footer-btn-rail .dshb-update-zone{top:0;right:0;bottom:auto;left:auto;width:20px;height:20px;padding:0;border-radius:50%}',
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
    // 弹框蒙版：半透明黑 + 高斯模糊（与 dsh-jenkins 的 dshj-backdrop 一致，
    // Safari 前缀 -webkit-backdrop-filter；不支持时优雅降级为纯半透明遮罩）
    '.dshb-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.32);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:auto;-webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2)}',
    // 弹框本体：玻璃拟态（半透明底色 + 自身 blur），与 dshj-modal 一致
    '.dshb-modal{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 78%,transparent);border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.28);width:min(760px,100%);display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary,#222);font-size:14px;-webkit-backdrop-filter:blur(24px) saturate(1.5);backdrop-filter:blur(24px) saturate(1.5)}',
    // 主弹框（余额 / 费用 / 价格设置）：高度固定 90vh；更新确认/日志弹框不命中此规则，保持内容自适应
    '.dshb-modal:not(.dshb-modal-sm):not(.dshb-modal-log){height:90vh}',
    // 更新确认/日志弹框：层级高于余额弹框（z 1150），互斥打开互不干扰
    '.dshb-confirm-backdrop{z-index:1150}',
    // 更新确认弹框（小）与更新日志弹框（大）
    '.dshb-modal-sm{width:min(420px,100%);min-height:0;max-height:60vh}',
    '.dshb-modal-log{width:min(720px,100%);min-height:380px}',
    // 更新弹框 body 覆盖基础的 grid stacking（grid-area:1/1 会把多个子元素叠到
    // 同一格）：确认弹框的描述文字与命令代码块、日志弹框的状态行/日志/提示
    // 均改为纵向 flex 布局，避免元素互相叠压。
    '.dshb-modal-sm .dshb-modal-body{display:flex;flex-direction:column;gap:12px}',
    '.dshb-modal-log .dshb-modal-body{display:flex;flex-direction:column}',
    // 弹框头部标题块：标题 + 副标题（执行命令）纵向排列，flex:1 把关闭按钮推到最右
    '.dshb-modal-head{flex:1;min-width:0}',
    '.dshb-modal-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:2px;word-break:break-all}',
    '.dshb-update-cmd-sub{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}',
    // 终端式日志面板：深底等宽字体，内部滚动；flex:1 撑满日志弹框主体
    '.dshb-update-log{flex:1;min-height:0;overflow:auto;background:#0f1419;color:#d5d8dc;border:1px solid var(--dsw-alias-border-l2,#333);border-radius:8px;padding:10px 12px;margin:0 0 10px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word}',
    '.dshb-update-status{display:flex;align-items:center;gap:8px;font-size:12px;margin:0 0 10px;color:var(--dsw-alias-label-secondary,#888)}',
    '.dshb-update-status-ok{color:#16a34a}',
    '.dshb-update-status-err{color:var(--dsw-alias-state-error-primary,#d33)}',
    '.dshb-update-duration{flex:none;white-space:nowrap;margin-left:auto;font-variant-numeric:tabular-nums}',
    '.dshb-spinner-inline{width:12px;height:12px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,#ccc);border-top-color:var(--dsw-alias-brand-primary,#1668e3);animation:dshb-spin .8s linear infinite;flex:none}',
    '.dshb-update-actions{display:flex;align-items:center;gap:8px;margin-left:auto}',
    // 运行中的「实时刷新中」标记（标题旁绿色小胶囊）
    '.dshb-log-live-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--dsw-alias-state-success-primary,#2a7d3c);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2a7d3c) 12%,transparent);border-radius:999px;padding:1px 8px;margin-left:8px;vertical-align:1px}',
    // 更新完成提示（页脚左侧，靠左）
    '.dshb-update-hint{margin-right:auto;font-size:12px;color:var(--dsw-alias-label-secondary,#888);display:inline-flex;align-items:center;gap:6px;flex:none}',
    // 代码块（确认弹框中的更新命令）：浅色玻璃底板，横向可滚动
    '.dshb-code{margin:0;padding:12px 14px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#fff) 84%,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:auto;max-height:52vh;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary,#222);white-space:pre;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
    // 不支持 backdrop-filter 时的降级底色
    '@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))){.dshb-modal{background:var(--dsw-alias-bg-layer-1,#fff)}.dshb-code{background:var(--dsw-alias-bg-base,#fff)}}',
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
    // 二级平台 tab（价格设置内）：小号胶囊分段，与主 tab 区分层级
    '.dshb-subtabs{display:flex;gap:6px;margin-bottom:12px;flex:none}',
    '.dshb-subtab{padding:3px 12px;border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font-size:12px;cursor:pointer;white-space:nowrap}',
    '.dshb-subtab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}',
    '.dshb-subtab-active{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#1668e3));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:500}',
    // 二级平台面板：grid stacking（与弹框主体同模式），平台增多后切换二级 tab 不跳动
    '.dshb-subpanes{display:grid;min-width:0}',
    '.dshb-subpanes>*{grid-area:1/1;min-width:0}',
    // 弹框主体：grid stacking —— 三个 tab 面板叠放同一格；隐藏面板不占高度
    // （height:0 + overflow 裁剪），激活面板决定弹框高度，切换 tab 不会出现
    // 永久超高弹框（费用页图表区很高，由 body 内部滚动承载）。
    '.dshb-modal-body{flex:1;overflow-y:auto;padding:16px 18px;min-width:0;min-height:0;max-height:70vh;display:grid}',
    // 主弹框（固定 90vh）：body 撑满剩余空间（去掉 70vh 上限），内部滚动承载内容；
    // 更新确认/日志弹框保留 70vh 上限（内容自适应 + 上限裁剪）。
    '.dshb-modal:not(.dshb-modal-sm):not(.dshb-modal-log) .dshb-modal-body{max-height:none}',
    '.dshb-modal-body>*{grid-area:1/1;min-width:0}',
    '.dshb-pane-off{visibility:hidden;pointer-events:none;height:0;overflow:hidden}',
    '.dshb-modal-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l1,#eee);flex:none;flex-wrap:wrap}',
    '.dshb-modal-footer .dshb-msg{margin:0 auto 0 0;font-size:12px}',
    // 余额 tab：「显示余额」滑动开关行（位于余额列表上方）
    '.dshb-showbalance-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}',
    '.dshb-showbalance-text{min-width:0}',
    '.dshb-showbalance-title{font-size:13px;font-weight:600}',
    // 滑动开关：圆角轨道 + 圆形滑块；开启态为绿色（与余额金额的 #16a34a 一致，
    // 与白色圆心对比明确），hover 加深一档；thumb 过渡动画模拟滑动。
    // 对比度：关闭态轨道取 label-primary 的 42% 半透明混合 —— 明显深于白色圆心，
    // 浅色主题下约 ≈#9b9b9b、深色主题下变浅灰但同样与纯白圆心拉开层次；
    // hover 再加深一档。圆心附极细暗描边 + 投影，任何背景下都不与轨道糊在一起。
    '.dshb-switch{position:relative;display:inline-block;width:40px;height:22px;padding:0;border:none;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#222) 42%,transparent);cursor:pointer;flex:none;transition:background-color .2s}',
    '.dshb-switch:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#222) 55%,transparent)}',
    '.dshb-switch:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary,#1668e3) 18%,transparent)}',
    '.dshb-switch-on{background:#16a34a}',
    '.dshb-switch-on:hover{background:#117f39}',
    '.dshb-switch-thumb{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06),0 1px 4px rgba(0,0,0,.35);transition:left .2s cubic-bezier(.25,.8,.35,1)}',
    '.dshb-switch-on .dshb-switch-thumb{left:20px}',
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
    // 费用 tab（图表版）：筛选行
    '.dshb-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-bottom:10px}',
    '.dshb-filter{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#888);white-space:nowrap}',
    // 筛选下拉框：最小宽度占位，选项加载前后宽度稳定不跳动
    '.dshb-select{box-sizing:border-box;min-width:110px;max-width:200px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:8px;padding:4px 8px;font-size:12px;font-family:inherit;cursor:pointer}',
    '.dshb-select:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#1668e3)}',
    '.dshb-segs{display:inline-flex;gap:4px;flex-wrap:wrap}',
    '.dshb-seg{padding:3px 10px;border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font-size:12px;cursor:pointer;white-space:nowrap;font-family:inherit}',
    '.dshb-seg:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}',
    '.dshb-seg-active{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#1668e3));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:500}',
    // 费用 tab（图表版）：图表区（每行一张，全部全宽）
    '.dshb-charts{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}',
    // 刷新中（时间切换 / 自动刷新）：旧图表半透明提示「正在更新」，指针锁定防误操作
    '.dshb-charts-loading{opacity:.5;pointer-events:none;transition:opacity .15s}',
    '.dshb-chart{min-width:0;border:1px solid var(--dsw-alias-border-l1,#eee);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2,#fafafa)}',
    '.dshb-chart-title{font-size:13px;font-weight:600;margin:0 0 6px;color:var(--dsw-alias-label-primary,#222)}',
    '.dshb-chart-box{height:220px;min-width:0}',
    // 首次加载骨架占位：与真实图表卡片同构同高（标题行 + 220px 图区），数据到达前布局不跳动
    '.dshb-charts-placeholder{pointer-events:none}',
    '.dshb-chart-skeleton{display:flex;flex-direction:column}',
    '.dshb-skeleton-line{height:14px;border-radius:4px;background:rgba(128,128,128,.15);margin:0 0 8px}',
    '.dshb-skeleton-box{border-radius:6px;background:rgba(128,128,128,.07)}',
    '.dshb-chart-tip{font-size:11px;color:var(--dsw-alias-label-tertiary,#999);margin:4px 0 0;line-height:1.4}',
    '.dshb-series-empty{padding:36px 16px;text-align:center;color:var(--dsw-alias-label-secondary,#888);font-size:13px}',
    '.dshb-series-error{display:flex;align-items:center;gap:8px;padding:12px;font-size:12px;color:var(--dsw-alias-state-error-primary,#d33)}',
    // 首次回填确认后的全量 loading 遮罩：position:fixed 相对弹框本体（.dshb-modal 的
    // backdrop-filter 是 fixed 后代的包含块；不支持时退化为视口）—— 始终覆盖**可视
    // 区域**并居中，不再随内容高度垂直居中（内容很高时转圈会跑到视口外看不见）。
    // pointer-events:none：仅视觉提示，不拦截点击（模态框标题/关闭按钮仍可操作）。
    '.dshb-backfill-overlay{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 76%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:var(--dsw-alias-label-primary,#222);font-size:14px;pointer-events:none}',
    '.dshb-backfill-spinner{width:34px;height:34px;border-radius:50%;border:3px solid var(--dsw-alias-border-l2,#ccc);border-top-color:var(--dsw-alias-brand-primary,#1668e3);animation:dshb-spin .8s linear infinite;flex:none}',
    '.dshb-backfill-elapsed{font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}',
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
