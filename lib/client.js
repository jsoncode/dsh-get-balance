window.__ModuleLoader__.load({ id: 'dsh-get-balance', factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
let react_jsx_runtime = require("react/jsx-runtime");
let react_dom = require("react-dom");
//#region src/client/styles.ts
/**
* dsh-get-balance —— 浏览器半边：样式注入（与 dsh-jenkins 相同的 bundle CSS 注入模式）。
*/
const CSS_ID = "dsh-get-balance/settings.css";
const css = [
	".dshb-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer}",
	".dshb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}",
	".dshb-btn:disabled{opacity:.5;cursor:not-allowed}",
	".dshb-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#1668e3));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}",
	".dshb-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#1668e3))}",
	".dshb-btn-small{padding:3px 10px;font-size:12px}",
	".dshb-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:currentColor}",
	".dshb-head-ops{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}",
	".dshb-err{color:var(--dsw-alias-state-error-primary,#d33);font-size:12px;margin:4px 0 0}",
	".dshb-ok{color:var(--dsw-alias-state-success-primary,#2a7d3c);font-size:12px;margin:4px 0 0}",
	".dshb-empty{padding:28px 16px;text-align:center;color:var(--dsw-alias-label-secondary,#888);font-size:13px}",
	".dshb-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin:0 0 10px;line-height:1.5}",
	".dshb-input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;transition:border-color .15s,box-shadow .15s}",
	".dshb-input:hover{border-color:var(--dsw-alias-border-l3,#b8b8b8)}",
	".dshb-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#1668e3);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary,#1668e3) 18%,transparent)}",
	".dshb-input::placeholder{color:var(--dsw-alias-label-tertiary,#aaa)}",
	".dshb-spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,#ccc);border-top-color:var(--dsw-alias-brand-primary,#1668e3);animation:dshb-spin .8s linear infinite;margin:12px auto}",
	"@keyframes dshb-spin{to{transform:rotate(360deg)}}",
	".dshb-footer-btn{box-sizing:border-box;position:relative;cursor:pointer;width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);background:transparent;border:none;border-radius:12px;flex:none;align-items:center;gap:8px;margin:4px -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:22px;display:flex;overflow:hidden}",
	".dshb-footer-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
	".dshb-footer-btn-rail{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 10px;padding:0}",
	".dshb-footer-group{width:100%;min-width:0}",
	".dshb-footer-rail-group{width:auto}",
	".dshb-footer-logo{height:28px;width:28px;flex:none;display:block;object-fit:contain;pointer-events:none}",
	".dshb-footer-label{flex:1 1 auto;display:flex;flex-direction:row;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden}",
	".dshb-footer-word{font-size:14px;font-weight:500;color:var(--dsw-alias-label-primary,#222)}",
	".dshb-footer-word-group{display:inline-flex;align-items:center;gap:6px;min-width:0}",
	".dshb-footer-balance{display:inline-flex;align-items:baseline;gap:2px;margin-left:auto;font-size:12px;font-weight:500;color:#16a34a;white-space:nowrap;flex:none;font-variant-numeric:tabular-nums}",
	".dshb-footer-cur{flex:none}",
	".dshb-footer-balance-num{font-weight:700}",
	".dshb-footer-balance-seg{display:inline-flex;align-items:baseline;gap:2px}",
	".dshb-footer-balance-sep{color:var(--dsw-alias-label-tertiary,#888);margin:0 3px;flex:none}",
	".dshb-footer-balance-err{color:var(--dsw-alias-state-error-primary,#d33);font-weight:700}",
	".dshb-period-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}",
	".dshb-period-dot-peak{background:var(--dsw-alias-state-error-primary,#d33)}",
	".dshb-period-dot-off{background:#16a34a}",
	".dshb-update-pill{display:inline-flex;align-items:center;height:16px;padding:0 7px;border-radius:999px;background:var(--dsw-alias-state-warn-primary,#f59e0b);color:#fff;font-size:10px;font-weight:600;line-height:1;letter-spacing:.02em;white-space:nowrap;flex:none;margin-left:8px}",
	".dshb-update-pill-dot{position:absolute;top:2px;right:2px;width:10px;height:10px;padding:0;margin-left:0;font-size:0;z-index:1}",
	".dshb-update-zone{position:absolute;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:0 10px;border-radius:12px;cursor:pointer;z-index:2}",
	".dshb-footer-btn-rail .dshb-update-zone{top:0;right:0;bottom:auto;left:auto;width:20px;height:20px;padding:0;border-radius:50%}",
	".dshb-tip{white-space:nowrap}",
	".dshb-tip b{font-weight:600}",
	".dshb-tip .dshb-tip-full{color:var(--dsw-alias-state-error-primary,#d33)}",
	".dshb-tip .dshb-tip-half{color:#16a34a}",
	".dshb-roller{display:inline-block;white-space:nowrap;line-height:1em;font-variant-numeric:tabular-nums}",
	".dshb-roll-col{display:inline-block;height:1em;overflow:hidden;vertical-align:top}",
	".dshb-roll-strip{display:block;transition:transform .35s cubic-bezier(.25,.8,.35,1);will-change:transform}",
	".dshb-roll-col-static .dshb-roll-strip{transition:none}",
	".dshb-roll-cell{display:block;height:1em;line-height:1em;text-align:center}",
	".dshb-roll-char{display:inline-block;height:1em;line-height:1em;vertical-align:top}",
	"div:has(> [data-slot=\"sidebar.footer.action\"]){flex-direction:column}",
	".dshb-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.32);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:auto;-webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2)}",
	".dshb-modal{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 78%,transparent);border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.28);width:min(760px,100%);min-height:420px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary,#222);font-size:14px;-webkit-backdrop-filter:blur(24px) saturate(1.5);backdrop-filter:blur(24px) saturate(1.5)}",
	".dshb-confirm-backdrop{z-index:1150}",
	".dshb-modal-sm{width:min(420px,100%);min-height:0;max-height:60vh}",
	".dshb-modal-log{width:min(720px,100%);min-height:380px}",
	".dshb-modal-sm .dshb-modal-body{display:flex;flex-direction:column;gap:12px}",
	".dshb-modal-log .dshb-modal-body{display:flex;flex-direction:column}",
	".dshb-modal-head{flex:1;min-width:0}",
	".dshb-modal-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:2px;word-break:break-all}",
	".dshb-update-cmd-sub{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}",
	".dshb-update-log{flex:1;min-height:0;overflow:auto;background:#0f1419;color:#d5d8dc;border:1px solid var(--dsw-alias-border-l2,#333);border-radius:8px;padding:10px 12px;margin:0 0 10px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word}",
	".dshb-update-status{display:flex;align-items:center;gap:8px;font-size:12px;margin:0 0 10px;color:var(--dsw-alias-label-secondary,#888)}",
	".dshb-update-status-ok{color:#16a34a}",
	".dshb-update-status-err{color:var(--dsw-alias-state-error-primary,#d33)}",
	".dshb-update-duration{flex:none;white-space:nowrap;margin-left:auto;font-variant-numeric:tabular-nums}",
	".dshb-spinner-inline{width:12px;height:12px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,#ccc);border-top-color:var(--dsw-alias-brand-primary,#1668e3);animation:dshb-spin .8s linear infinite;flex:none}",
	".dshb-update-actions{display:flex;align-items:center;gap:8px;margin-left:auto}",
	".dshb-log-live-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--dsw-alias-state-success-primary,#2a7d3c);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2a7d3c) 12%,transparent);border-radius:999px;padding:1px 8px;margin-left:8px;vertical-align:1px}",
	".dshb-update-hint{margin-right:auto;font-size:12px;color:var(--dsw-alias-label-secondary,#888);display:inline-flex;align-items:center;gap:6px;flex:none}",
	".dshb-code{margin:0;padding:12px 14px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#fff) 84%,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:auto;max-height:52vh;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary,#222);white-space:pre;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}",
	"@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))){.dshb-modal{background:var(--dsw-alias-bg-layer-1,#fff)}.dshb-code{background:var(--dsw-alias-bg-base,#fff)}}",
	".dshb-modal-header{display:flex;align-items:center;gap:12px;padding:8px 14px 8px 18px;border-bottom:1px solid var(--dsw-alias-border-l1,#eee);flex:none}",
	".dshb-modal-title{font-size:15px;font-weight:600;white-space:nowrap}",
	".dshb-close{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#888);font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px}",
	".dshb-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.15));color:var(--dsw-alias-label-primary,#222)}",
	".dshb-tabs{display:flex;gap:6px;overflow-x:auto;flex:none;min-width:0}",
	".dshb-tab{padding:5px 12px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font-size:13px;cursor:pointer;white-space:nowrap}",
	".dshb-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}",
	".dshb-tab-active{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#1668e3));color:var(--dsw-alias-label-primary-foreground,#fff);border-color:transparent;font-weight:500}",
	".dshb-modal-body{flex:1;overflow-y:auto;padding:16px 18px;min-width:0;min-height:0;display:grid}",
	".dshb-modal-body>*{grid-area:1/1;min-width:0}",
	".dshb-pane-off{visibility:hidden;pointer-events:none}",
	".dshb-modal-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l1,#eee);flex:none;flex-wrap:wrap}",
	".dshb-modal-footer .dshb-msg{margin:0 auto 0 0;font-size:12px}",
	".dshb-prov-list{display:flex;flex-direction:column;gap:8px}",
	".dshb-prov{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,#eee);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fafafa)}",
	".dshb-prov-main{min-width:0;flex:1}",
	".dshb-prov-name-row{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}",
	".dshb-prov-name{font-size:13px;font-weight:600}",
	".dshb-prov-meta{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:2px;word-break:break-all}",
	".dshb-chip{font-size:11px;color:var(--dsw-alias-label-secondary,#888);background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l1,#eee);padding:1px 9px;border-radius:999px;white-space:nowrap}",
	".dshb-chip-brand{color:var(--dsw-alias-brand-primary,#1668e3);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#1668e3) 35%,transparent)}",
	".dshb-prov-side{flex:none;text-align:right;min-width:250px}",
	".dshb-prov-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:2px}",
	".dshb-prov-err{font-size:12px;color:var(--dsw-alias-state-error-primary,#d33);max-width:220px;word-break:break-all}",
	".dshb-topped{color:var(--dsw-alias-state-warn-primary,#b8860b)}",
	".dshb-prov-costline{display:flex;align-items:center;justify-content:flex-end;gap:5px;font-size:13px;margin-bottom:2px;white-space:nowrap}",
	".dshb-balance-num{font-weight:600;color:#16a34a;font-variant-numeric:tabular-nums}",
	".dshb-balance-sep{color:var(--dsw-alias-label-tertiary,#bbb)}",
	".dshb-keys{margin-top:16px;border-top:1px dashed var(--dsw-alias-border-l3,#bbb);padding-top:12px}",
	".dshb-keys-title{font-size:13px;font-weight:600;margin-bottom:4px}",
	".dshb-key-row{display:flex;align-items:center;gap:8px;padding:6px 0}",
	".dshb-key-row .dshb-chip{flex:none}",
	".dshb-key-mask{flex:1;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary,#888);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".dshb-key-form{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) auto auto;gap:8px;align-items:center;margin-top:8px}",
	".dshb-cost-table{min-width:640px}",
	".dshb-cost-table th{white-space:nowrap}",
	".dshb-cost-table .dshb-cost-num{text-align:right;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums;white-space:nowrap}",
	".dshb-cost-table .dshb-cost-cat{white-space:nowrap;color:var(--dsw-alias-label-secondary,#888);font-size:12px}",
	".dshb-cost-key{vertical-align:top;min-width:110px}",
	".dshb-cost-key-name-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
	".dshb-cost-key-name-row .dshb-chip{flex:none}",
	".dshb-cost-key-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#222);word-break:break-all}",
	".dshb-cost-key-token{margin-top:4px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#222);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}",
	".dshb-cost-key-label{margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary,#888)}",
	".dshb-cost-key-mask{margin-top:2px;font-size:11px;color:var(--dsw-alias-label-tertiary,#999);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}",
	".dshb-cost-amount-cell{color:#16a34a;font-weight:500}",
	".dshb-cost-total>td{background:var(--dsw-alias-bg-layer-2,#fafafa)}",
	".dshb-header-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08));color:var(--dsw-alias-label-primary);border-radius:999px;padding:2px 10px;font-size:11px;font-family:inherit;white-space:nowrap;cursor:pointer;line-height:1.6}",
	".dshb-header-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}",
	".dshb-header-tokens{color:#16a34a;font-weight:500;font-variant-numeric:tabular-nums}",
	".dshb-header-sep{color:var(--dsw-alias-label-tertiary,#bbb);margin:0 3px}",
	".dshb-header-amount{color:#16a34a;font-weight:500}",
	".dshb-header-wrap{display:inline-flex}",
	".dshb-header-bd{position:fixed;z-index:1200;min-width:230px;max-width:min(340px,90vw);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:8px 10px;font-size:12px;color:var(--dsw-alias-label-primary,#222)}",
	".dshb-header-bd-title{font-size:11px;color:var(--dsw-alias-label-tertiary,#888);margin:0 0 6px;font-weight:500}",
	".dshb-header-bd-empty{color:var(--dsw-alias-label-tertiary,#888);text-align:center;padding:4px 0}",
	".dshb-header-bd-row{display:flex;align-items:baseline;gap:6px;white-space:nowrap;padding:3px 0;min-width:0}",
	".dshb-header-bd-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:140px}",
	".dshb-header-bd-tokens{color:#16a34a;font-variant-numeric:tabular-nums}",
	".dshb-header-bd-sep{color:var(--dsw-alias-label-tertiary,#bbb);margin:0 2px}",
	".dshb-header-bd-amount{color:#16a34a;font-weight:600;font-variant-numeric:tabular-nums}",
	".dshb-header-bd-nobill{color:var(--dsw-alias-label-secondary,#888);font-weight:400}",
	".dshb-timing-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:1200}",
	".dshb-timing-dialog{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:16px;width:300px;max-width:calc(100vw - 40px);box-shadow:0 8px 30px rgba(0,0,0,.2)}",
	".dshb-timing-title{font-size:14px;font-weight:600;margin-bottom:6px}",
	".dshb-timing-field{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:10px}",
	".dshb-timing-field .dshb-input{width:90px}",
	".dshb-timing-active{margin-top:8px;font-size:11px;color:#16a34a}",
	".dshb-timing-actions{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}",
	".dshb-cost-tier{margin-top:12px;font-size:12px;color:var(--dsw-alias-label-secondary,#888)}",
	".dshb-cost-tier b{color:var(--dsw-alias-label-primary,#222);font-weight:500}",
	".dshb-table{width:100%;border-collapse:collapse;font-size:13px}",
	".dshb-table th{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary,#666);text-align:left;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,#eee);white-space:nowrap}",
	".dshb-table td{padding:5px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,#eee);vertical-align:middle}",
	".dshb-table .dshb-input{padding:5px 8px;font-size:12px;border-radius:6px}",
	".dshb-table .dshb-num{width:74px;text-align:right;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}",
	".dshb-table .dshb-cur{width:64px}",
	".dshb-table-ops{white-space:nowrap;text-align:right}",
	".dshb-window-box{border:1px solid var(--dsw-alias-border-l1,#eee);border-radius:10px;padding:10px 12px;margin-bottom:12px}",
	".dshb-window-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}",
	".dshb-window-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,#222)}",
	".dshb-weekend{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#888);cursor:pointer;white-space:nowrap;flex:none}",
	".dshb-weekend:hover{color:var(--dsw-alias-label-primary,#222)}",
	".dshb-weekend input{margin:0;accent-color:var(--dsw-alias-brand-primary,#1668e3);cursor:pointer}",
	".dshb-window-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}",
	".dshb-window-row{display:flex;align-items:center;gap:6px;flex:none;white-space:nowrap}",
	".dshb-window-row .dshb-btn{flex:none}",
	".dshb-window-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}",
	".dshb-window-actions .dshb-btn{flex:none}",
	".dshb-window-tz{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#888);flex:none}",
	".dshb-window-tz .dshb-range{width:140px;accent-color:var(--dsw-alias-brand-primary,#1668e3);cursor:pointer}",
	".dshb-window-tz-label{font-weight:500;color:var(--dsw-alias-label-primary,#222);font-size:12px;min-width:52px;text-align:left}",
	".dshb-window-del{white-space:nowrap}",
	".dshb-price-scroll{overflow-x:auto}",
	".dshb-price-table{width:100%;min-width:520px}",
	".dshb-price-table th,.dshb-price-table td{padding:3px 4px;vertical-align:middle;text-align:center}",
	".dshb-price-table .dshb-input{padding:5px 8px;font-size:12px;border-radius:6px}",
	".dshb-price-corner{white-space:nowrap;text-align:center;font-weight:500}",
	".dshb-price-head-cell{width:20%;min-width:0}",
	".dshb-price-model-name{display:block;font-size:12px;line-height:1.35;word-break:break-word}",
	".dshb-price-metric{width:64px;min-width:64px;white-space:pre-line;word-break:break-word;font-weight:500;color:var(--dsw-alias-label-primary,#222);font-size:12px;line-height:1.35}",
	".dshb-price-period{white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-secondary,#666);width:64px}",
	".dshb-period-peak{color:var(--dsw-alias-state-error-primary,#d33);font-weight:500}",
	".dshb-period-off{color:#16a34a;font-weight:500}",
	".dshb-price-cell .dshb-num{width:100%;box-sizing:border-box;text-align:center;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}"
].join("\n");
/** 注入 <style>（幂等：已存在则不重复注入）。 */
function injectStyles() {
	if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + CSS_ID + "\"]") === null) {
		const tag = document.createElement("style");
		tag.dataset.plugin = "dsh-get-balance";
		tag.dataset.pluginCss = CSS_ID;
		tag.textContent = css;
		document.head.appendChild(tag);
	}
}
//#endregion
//#region src/client/i18n.ts
/**
* dsh-get-balance —— 浏览器半边：语言与文案（中英双语，跟随主界面语言）。
*/
function resolveLang() {
	if (typeof document !== "undefined") {
		const host = document.documentElement.lang || navigator.language || "zh-CN";
		return /^zh/i.test(host) ? "zh" : "en";
	}
	return "zh";
}
const LANG = resolveLang();
const COPY = {
	zh: {
		balanceBtn: "余额",
		btnPeak: "高峰时段",
		btnOffPeak: "空闲时段 半价",
		tipPeak: "当前为高峰时段 {price}计费",
		tipOffPeak: "当前为空闲时段 {price}计费",
		tipFullPrice: "全价",
		tipHalfPrice: "半价",
		headerBtnPrefix: "当前会话",
		headerBreakdownTitle: "当前会话 · 各 Provider",
		timingBtn: "定时更新",
		timingTitle: "定时更新配置",
		timingHint: "每隔设定秒数自动刷新余额与费用（含顶部按钮与弹框）。",
		timingSeconds: "间隔（秒）",
		timingStart: "启动",
		timingStop: "停止",
		timingActive: "已开启：每 {n} 秒自动刷新",
		timingInvalid: "请输入 1–86400 之间的秒数",
		updatePill: "更新",
		updateTip: "发现新版本 v{latest}，当前 v{current}，点击更新",
		updateConfirmTitle: "更新插件",
		updateConfirmText: "发现新版本 v{latest}（当前 v{current}），确认执行以下命令更新插件？",
		updateConfirmBtn: "确认更新",
		updateLogTitle: "插件更新日志",
		updateRunning: "正在更新…",
		updateSuccess: "更新完成（退出码 0），请刷新页面使新版本生效",
		updateFailed: "更新失败（退出码 {code}）",
		updateLogStartFailed: "启动更新失败",
		updateDuration: "耗时 {s} 秒",
		updateNoOutput: "（暂无输出）",
		updateBgHint: "关闭弹框后更新仍在后台继续，可随时重新打开日志查看进度",
		updateRestartHint: "更新完成后请重启 dsh 服务使新版本生效",
		liveStatus: "实时刷新中",
		copy: "复制",
		copied: "已复制",
		modalTitle: "DeepSeek 余额与费用",
		tabBalance: "余额",
		tabCost: "费用",
		tabPrices: "价格设置",
		refresh: "刷新",
		close: "关闭",
		save: "保存",
		saved: "已保存",
		saveFailed: "保存失败",
		cancel: "取消",
		add: "添加",
		delete: "删除",
		noProviders: "未发现 DeepSeek 服务商。请在 dsh 设置中配置 llm-pi-ai / llm-deepseek 段，或在下方附加 API Key。",
		sourcePiAi: "pi-ai 路由",
		sourceDeepseek: "官方路由",
		sourceExtra: "附加 Key",
		sharedAccountTitle: "与 {n} 共用同一 API Key（同一账号，余额相同）",
		noCredential: "未配置凭据",
		balanceTotal: "总余额",
		balanceGranted: "赠送余额",
		toppedOut: "已用完",
		summaryTodayCost: "今日消耗",
		summaryBalance: "余额",
		extraKeysTitle: "附加 API Key",
		extraKeysHint: "手动添加不在 dsh providers 配置中的 key（仅用于余额查询，明文保存在 $DSH_HOME/dsh-get-balance.json）",
		addKeyBtn: "附加 API Key",
		keyLabel: "备注",
		keyLabelPlaceholder: "选填，如「测试账号」",
		keyInput: "API Key",
		keyInputPlaceholder: "sk-…",
		keyRequired: "请填写 API Key",
		costLastTurn: "最近一次提问",
		costSession: "本会话",
		costTodayProject: "今日·本项目",
		costTodayAll: "今日·全部",
		costTier: "当前生效价格档",
		costTotal: "合计",
		costColToken: "token",
		costColCategory: "分类",
		costColUncached: "输入·未命中",
		costColCacheRead: "输入·命中",
		tokensOutput: "输出",
		costHint: "金额仅对官方 Key（api.deepseek.com）按价格档计费；各 API Key 的 token 用量分别统计数量（不区分官方与否）。宿主缓存 60 秒；今日两项扫描 ~/.dsh/sessions 日志。已配置但无用量/未配置凭据的 provider 亦逐组列出（用量为 0、金额 —）。",
		hitRate: "命中率",
		costEstAmount: "预估费用",
		chipOfficial: "官方",
		chipNonOfficial: "非官方",
		notBilled: "不计费",
		pricesHint: "单价单位为每百万 tokens；每档分别设置高峰与空闲两套单价；匹配优先级：精确模型 id > 前缀 > * 通配兜底。修改后保存即生效。",
		priceName: "名称",
		priceMatch: "模型匹配",
		priceCurrency: "货币",
		priceInput: "输入",
		priceCacheRead: "缓存命中",
		priceCacheWrite: "缓存写入",
		priceOps: "操作",
		priceModel: "模型版本",
		pricePeriodPeak: "高峰时段",
		pricePeriodOffPeak: "空闲时段",
		priceInputHit: "百万tokens输入\n（缓存命中）",
		priceInputMiss: "百万tokens输入\n（缓存未命中）",
		priceOutput: "百万tokens输出",
		windowTitle: "时段配置",
		weekendHalfPrice: "周六日半价",
		weekendHint: "勾选后，周六/周日整天按空闲时段单价计费（从高峰窗口中排除）",
		windowHint: "高峰时段窗口（其余时间为空闲时段），格式 HH:MM，按下方时区偏移解释。官方默认：北京时间 9:00–12:00、14:00–18:00。",
		windowStart: "开始",
		windowEnd: "结束",
		addWindow: "新增高峰时段",
		windowInvalid: "时段须为 HH:MM 且开始早于结束",
		tzOffset: "时区偏移",
		tzOffsetInvalid: "时区偏移须为数字",
		tzZero: "零时区",
		tzEast: "东{n}区",
		tzWest: "西{n}区",
		/** 中文数字（时区名用，如「东八区」）。 */
		cnNum: [
			"零",
			"一",
			"二",
			"三",
			"四",
			"五",
			"六",
			"七",
			"八",
			"九",
			"十",
			"十一",
			"十二"
		],
		pricesSaved: "价格已保存",
		pricesEmpty: "至少保留一个价格档",
		fallbackHint: "通配档位：匹配所有未在上方列出的模型（match = *）",
		cmdNoResult: "命令未返回结果",
		errors: {
			"auth-failed": "认证失败：API Key 无效或已过期（HTTP 401/403）",
			"no-credential": "未配置凭据（apiKeyEnv 未解析到值）",
			"timeout": "请求超时",
			"network-failed": "网络请求失败",
			"http-error": "官方接口返回错误",
			"op-unknown": "未知操作",
			"params-invalid": "参数需为 JSON",
			"internal-error": "宿主内部错误",
			"forbidden": "请求被信任围栏拒绝"
		}
	},
	en: {
		balanceBtn: "Balance",
		btnPeak: "peak hours",
		btnOffPeak: "off-peak, half price",
		tipPeak: "Currently peak hours · {price} billing",
		tipOffPeak: "Currently off-peak hours · {price} billing",
		tipFullPrice: "full price",
		tipHalfPrice: "half price",
		headerBtnPrefix: "Session",
		headerBreakdownTitle: "Session by provider",
		timingBtn: "Auto",
		timingTitle: "Auto refresh",
		timingHint: "Refresh balance & cost every N seconds (header button and modal).",
		timingSeconds: "Interval (s)",
		timingStart: "Start",
		timingStop: "Stop",
		timingActive: "Active: every {n}s",
		timingInvalid: "Enter seconds between 1 and 86400",
		updatePill: "Update",
		updateTip: "New version v{latest} available (current: v{current}). Click to update",
		updateConfirmTitle: "Update plugin",
		updateConfirmText: "New version v{latest} available (current v{current}). Confirm running the following command to update the plugin?",
		updateConfirmBtn: "Update now",
		updateLogTitle: "Plugin Update Log",
		updateRunning: "Updating…",
		updateSuccess: "Update finished (exit 0). Refresh the page to apply.",
		updateFailed: "Update failed (exit code {code})",
		updateLogStartFailed: "Failed to start the update",
		updateDuration: "Elapsed {s}s",
		updateNoOutput: "(no output yet)",
		updateBgHint: "Closing this dialog keeps the update running in the background; reopen the log anytime to watch progress",
		updateRestartHint: "Restart the dsh service after the update finishes to apply the new version",
		liveStatus: "Live",
		copy: "Copy",
		copied: "Copied",
		modalTitle: "DeepSeek Balance & Cost",
		tabBalance: "Balance",
		tabCost: "Cost",
		tabPrices: "Prices",
		refresh: "Refresh",
		close: "Close",
		save: "Save",
		saved: "Saved",
		saveFailed: "Save failed",
		cancel: "Cancel",
		add: "Add",
		delete: "Delete",
		noProviders: "No DeepSeek providers found. Configure llm-pi-ai / llm-deepseek in dsh settings, or attach an API key below.",
		sourcePiAi: "pi-ai route",
		sourceDeepseek: "official route",
		sourceExtra: "extra key",
		sharedAccountTitle: "Shares API key with {n} (same account; identical balance)",
		noCredential: "No credential",
		balanceTotal: "Total",
		balanceGranted: "Granted",
		toppedOut: "used up",
		summaryTodayCost: "Today spend",
		summaryBalance: "Balance",
		extraKeysTitle: "Extra API Keys",
		extraKeysHint: "Manually attach keys not in dsh providers config (balance query only; stored as plain text in $DSH_HOME/dsh-get-balance.json)",
		addKeyBtn: "Attach API Key",
		keyLabel: "Label",
		keyLabelPlaceholder: "Optional, e.g. \"test account\"",
		keyInput: "API Key",
		keyInputPlaceholder: "sk-…",
		keyRequired: "API key is required",
		costLastTurn: "Last question",
		costSession: "This session",
		costTodayProject: "Today · project",
		costTodayAll: "Today · all",
		costTier: "Active price tier",
		costTotal: "Total",
		costColToken: "token",
		costColCategory: "Category",
		costColUncached: "Input (miss)",
		costColCacheRead: "Input (cache hit)",
		tokensOutput: "Output",
		costHint: "Only official keys (api.deepseek.com) are billed by price tier; token usage is counted per API key (official or not). Host caches 60s; today entries scan ~/.dsh/sessions logs. Configured providers without usage (or without a credential) are listed too (zero usage, — amount).",
		hitRate: "Hit rate",
		costEstAmount: "Est. cost",
		chipOfficial: "official",
		chipNonOfficial: "non-official",
		notBilled: "not billed",
		pricesHint: "Prices are per million tokens; each tier has peak and off-peak rates; match priority: exact model id > prefix > * fallback. Save to apply.",
		priceName: "Name",
		priceMatch: "Model match",
		priceCurrency: "Currency",
		priceInput: "Input",
		priceCacheRead: "Cache hit",
		priceCacheWrite: "Cache write",
		priceOps: "Actions",
		priceModel: "Model version",
		pricePeriodPeak: "Peak",
		pricePeriodOffPeak: "Off-peak",
		priceInputHit: "Input\n(cache hit)",
		priceInputMiss: "Input\n(cache miss)",
		priceOutput: "Output",
		windowTitle: "Time windows",
		weekendHalfPrice: "Weekends half price",
		weekendHint: "When checked, Saturdays and Sundays are billed at off-peak rates all day (excluded from peak windows)",
		windowHint: "Peak windows (the rest is off-peak), format HH:MM, interpreted in the timezone offset below. Official default: Beijing 9:00-12:00, 14:00-18:00.",
		windowStart: "Start",
		windowEnd: "End",
		addWindow: "Add peak window",
		windowInvalid: "Windows must be HH:MM and start before end",
		tzOffset: "Timezone offset",
		tzOffsetInvalid: "Timezone offset must be a number",
		tzZero: "UTC±0",
		tzEast: "UTC+{n}",
		tzWest: "UTC-{n}",
		pricesSaved: "Prices saved",
		pricesEmpty: "Keep at least one price tier",
		fallbackHint: "Wildcard tier: matches any model not listed above (match = *)",
		cmdNoResult: "Command returned no result",
		errors: {
			"auth-failed": "Authentication failed: invalid or expired API key (HTTP 401/403)",
			"no-credential": "No credential configured (apiKeyEnv resolved to nothing)",
			"timeout": "Request timed out",
			"network-failed": "Network request failed",
			"http-error": "Official API returned an error",
			"op-unknown": "Unknown operation",
			"params-invalid": "Parameters must be JSON",
			"internal-error": "Host internal error",
			"forbidden": "Rejected by the trust fence"
		}
	}
};
const dict = COPY[LANG] || COPY.zh;
/** 取文案并替换 {var} 占位符。 */
const t = (key, vars) => {
	let s = dict[key] !== void 0 ? dict[key] : String(key);
	if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
	return s;
};
/** 宿主错误通过 code 映射为本地化文本，未知错误回退原文。 */
const tErr = (res, fallback) => {
	if (res && res.code) {
		const local = dict.errors[res.code];
		if (local !== void 0) {
			const zh = LANG === "zh";
			if (res.code === "network-failed" || res.code === "timeout" || res.code === "http-error") {
				const detail = res.error ? String(res.error).trim() : "";
				return local + (detail ? (zh ? "：" : ": ") + detail : "");
			}
			return local;
		}
	}
	return res && res.error || fallback || "";
};
/** 中文数字（时区名用，如「东八区」）；zh 词典缺失或越界时回退阿拉伯数字。 */
function zhNumeral(index) {
	const list = dict.cnNum;
	return list !== void 0 && index >= 0 && index < list.length ? list[index] : String(index);
}
/** 金额格式化（保留合理小数位）。 */
const fmtAmount = (amount) => {
	if (amount === void 0 || !Number.isFinite(amount)) return "—";
	if (amount === 0) return "0";
	if (amount < .001) return amount.toExponential(2);
	if (amount < 1) return amount.toFixed(4);
	return amount.toFixed(2);
};
/** 常见货币代码 → 符号（余额前缀展示）；未收录的代码回退为代码本身（无代码时为空）。 */
const CURRENCY_SYMBOLS = {
	CNY: "¥",
	USD: "$",
	EUR: "€",
	GBP: "£",
	JPY: "¥",
	HKD: "HK$",
	KRW: "₩",
	INR: "₹",
	RUB: "₽",
	AUD: "A$",
	CAD: "C$",
	SGD: "S$",
	CHF: "Fr.",
	TWD: "NT$"
};
/** 货币代码 → 展示符号（CNY → ¥；未收录回退代码本身；空代码返回空串）。 */
function currencySymbol(code) {
	const c = (code || "").trim().toUpperCase();
	return c !== "" ? CURRENCY_SYMBOLS[c] ?? c : "";
}
/** 紧凑 token 单位（降序）：K=1e3 / M=1e6 / B=1e9 / T=1e12 / P=1e15。 */
const TOKEN_UNITS = [
	{
		div: 0x38d7ea4c68000,
		suffix: "P"
	},
	{
		div: 0xe8d4a51000,
		suffix: "T"
	},
	{
		div: 1e9,
		suffix: "B"
	},
	{
		div: 1e6,
		suffix: "M"
	},
	{
		div: 1e3,
		suffix: "K"
	}
];
/** token 数量紧凑格式化：1234567 → 1.23M，减小长数字占位（最多 3 位有效数字）。 */
const fmtTokens = (n) => {
	if (n === void 0 || !Number.isFinite(n)) return "0";
	const v = Math.round(n);
	const abs = Math.abs(v);
	if (abs < 1e3) return String(v);
	/** 缩放后的数值保留最多 3 位有效数字并去掉尾随 0。 */
	const scale = (div) => {
		const scaled = v / div;
		const intDigits = Math.max(1, Math.floor(Math.log10(Math.abs(scaled))) + 1);
		let s = scaled.toFixed(Math.min(2, Math.max(0, 3 - intDigits)));
		if (s.includes(".")) s = s.replace(/\.?0+$/, "");
		return s;
	};
	for (let i = 0; i < TOKEN_UNITS.length; i++) {
		const unit = TOKEN_UNITS[i];
		if (abs >= unit.div) {
			let s = scale(unit.div);
			let j = i;
			while (Math.abs(Number(s)) >= 1e3 && j > 0) {
				j -= 1;
				s = scale(TOKEN_UNITS[j].div);
			}
			return s + TOKEN_UNITS[j].suffix;
		}
	}
	return String(v);
};
//#endregion
//#region src/client/rpc.ts
/**
* dsh-get-balance —— 浏览器半边：与宿主通信。
*
* 默认走宿主 webServer 注册的带信任围栏的 HTTP 路由 /dsh-balance/api
* （fetch POST JSON → { ok, value } 信封），请求不进入对话命令通道，因此不会在
* 页面产生 command 节点（空状态行 / {"ok":true,...} 调试卡片）。
*
* 老宿主（未注册该路由，如 headless 组合）自动回退到 commands.execute 命令通道，
* 仅作兼容，不影响新宿主上的行为。
*/
/**
* 尝试经 HTTP 路由执行一次 op。
* @returns 路由可用并返回有效载荷时返回 RunResult；否则返回 null（调用方回退命令通道）。
*/
async function runHttp(sessionId, op) {
	try {
		const response = await fetch("/dsh-balance/api", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(Object.assign({ sessionId: sessionId || "" }, op))
		});
		if (!response.ok) return null;
		const parsed = await response.json().catch(() => null);
		if (parsed === null || parsed.ok !== true || parsed.value === void 0) return null;
		const value = parsed.value;
		return value !== null && typeof value === "object" ? value : {
			ok: false,
			error: String(value)
		};
	} catch {
		return null;
	}
}
function makeRun(ctx) {
	return async function run(sessionId, op) {
		const viaHttp = await runHttp(sessionId, op);
		if (viaHttp !== null) return viaHttp;
		try {
			const execution = await ctx.remote.commands.execute(sessionId || "", "/dsh-balance " + JSON.stringify(op));
			const value = execution && execution.ok === true ? execution.value : void 0;
			const text = value && value.result && typeof value.result.text === "string" ? value.result.text : null;
			if (text === null || text.length === 0) return {
				ok: false,
				error: t("cmdNoResult")
			};
			try {
				return JSON.parse(text);
			} catch {
				return {
					ok: false,
					error: text.slice(0, 200)
				};
			}
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e)
			};
		}
	};
}
//#endregion
//#region src/client/store.ts
/**
* dsh-get-balance —— 浏览器半边：统一「余额」弹框开关（footer 入口 ↔ overlay 弹框共享）。
*/
function createStore() {
	return {
		value: null,
		listeners: [],
		emit() {
			for (let i = 0; i < this.listeners.length; i++) this.listeners[i]();
		},
		subscribe(l) {
			this.listeners.push(l);
			return () => {
				const i = this.listeners.indexOf(l);
				if (i >= 0) this.listeners.splice(i, 1);
			};
		},
		open(value) {
			this.value = value;
			this.emit();
		},
		close() {
			this.value = null;
			this.emit();
		}
	};
}
function useStoreValue(target) {
	const [v, setV] = (0, react.useState)(target.value);
	(0, react.useEffect)(() => target.subscribe(() => setV(target.value)), []);
	return v;
}
/** 统一「余额」弹框的打开状态（footer 入口 open，overlay 弹框消费）。 */
function makeBalanceModalStore() {
	const store = createStore();
	const autoStore = createStore();
	const tickStore = createStore();
	const priceTickStore = createStore();
	const balanceTickStore = createStore();
	const updateStore = createStore();
	const updateUiStore = createStore();
	autoStore.value = 0;
	tickStore.value = 0;
	priceTickStore.value = 0;
	balanceTickStore.value = 0;
	updateUiStore.value = "none";
	const useOpen = () => {
		const [v, setV] = (0, react.useState)(!!store.value);
		(0, react.useEffect)(() => store.subscribe(() => setV(!!store.value)), []);
		return v;
	};
	const useAutoSeconds = () => {
		return useStoreValue(autoStore) ?? 0;
	};
	const useTick = () => {
		return useStoreValue(tickStore) ?? 0;
	};
	const bumpTick = () => {
		tickStore.value = (tickStore.value ?? 0) + 1;
		tickStore.emit();
	};
	const usePriceTick = () => {
		return useStoreValue(priceTickStore) ?? 0;
	};
	const bumpPriceTick = () => {
		priceTickStore.value = (priceTickStore.value ?? 0) + 1;
		priceTickStore.emit();
	};
	const useBalanceTick = () => {
		return useStoreValue(balanceTickStore) ?? 0;
	};
	const bumpBalanceTick = () => {
		balanceTickStore.value = (balanceTickStore.value ?? 0) + 1;
		balanceTickStore.emit();
	};
	const setUpdate = (info) => {
		updateStore.value = info;
		updateStore.emit();
	};
	const useUpdateUi = () => {
		return useStoreValue(updateUiStore) ?? "none";
	};
	return {
		store,
		useOpen,
		autoStore,
		useAutoSeconds,
		tickStore,
		useTick,
		bumpTick,
		priceTickStore,
		usePriceTick,
		bumpPriceTick,
		balanceTickStore,
		useBalanceTick,
		bumpBalanceTick,
		setUpdate,
		useUpdate: () => useStoreValue(updateStore),
		openUpdateConfirm: () => {
			updateUiStore.value = "confirm";
			updateUiStore.emit();
		},
		openUpdateLog: () => {
			updateUiStore.value = "log";
			updateUiStore.emit();
		},
		closeUpdateUi: () => {
			updateUiStore.value = "none";
			updateUiStore.emit();
		},
		useUpdateUi
	};
}
//#endregion
//#region src/client/components/NumberRoller.tsx
/**
* dsh-get-balance —— 数字「上下轮播」动画（odometer 风格）。
*
* 每位数字一列：列内是 0-9 纵向条带（重复 3 份，中间份为基准展示位，
* 两侧供 9↔0 环绕滚动），值变化时列沿最短路径上下滚动到新位
* （增大向上滚、减小向下滚）；非数字字符（小数点、K/M/B/T/P 后缀等）静态展示。
* 按「距右端距离」作为列 key 做右对齐映射：位数增减时数字列保持原位不漂移，
* 只在最左侧增删列（新列直接出现，不做滚动），小数点与后缀列相对右端固定。
* 首次展示直接显示目标值（无滚动）。
*/
/** 列内条带：0-9 重复 3 份。 */
const DIGIT_CELLS = Array.from("0123456789".repeat(3));
/** 从 from 滚到 to 的最短步数（-5..4）：正数向上滚，负数向下滚。 */
function shortestStep(from, to) {
	return ((to - from + 5) % 10 + 10) % 10 - 5;
}
/** 单个数字列：条带按当前位平移；首次挂载静态显示，之后沿最短路径滚动。 */
function RollDigit({ digit }) {
	const prevRef = (0, react.useRef)(digit);
	const mountedRef = (0, react.useRef)(false);
	let index = 10 + digit;
	if (mountedRef.current) {
		const prev = prevRef.current;
		if (prev !== digit) index = 10 + prev + shortestStep(prev, digit);
	}
	(0, react.useEffect)(() => {
		prevRef.current = digit;
		mountedRef.current = true;
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: "dshb-roll-col" + (mountedRef.current ? "" : " dshb-roll-col-static"),
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "dshb-roll-strip",
			style: { transform: `translateY(${-index}em)` },
			children: DIGIT_CELLS.map((d, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dshb-roll-cell",
				children: d
			}, i))
		})
	});
}
/**
* 上下轮播数字：把展示文本拆成逐列字符，按「距右端距离」key 复用列实例，
* 数字列滚动、非数字列静态。
*/
function NumberRoller({ value, format, fallback = "--", className }) {
	const display = value === null ? fallback : format(value);
	const n = display.length;
	const cells = [];
	for (let p = 0; p < n; p++) {
		const ch = display[p];
		const key = "r" + (n - 1 - p);
		if (ch >= "0" && ch <= "9") cells.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RollDigit, { digit: ch.charCodeAt(0) - 48 }, key));
		else cells.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "dshb-roll-char",
			children: ch
		}, key));
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: "dshb-roller" + (className !== void 0 ? " " + className : ""),
		children: cells
	});
}
"" + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2.5\" y=\"6\" width=\"19\" height=\"13.5\" rx=\"2.5\"/><path d=\"M2.5 10h19\"/><circle cx=\"16.5\" cy=\"14.75\" r=\"1.4\" fill=\"#fff\" stroke=\"none\"/><path d=\"M6.5 6 8 3.5h8L17.5 6\"/></svg>");
/** footer 入口按钮图标：钱包双色 PNG（同源绝对路径，由宿主路由提供）。 */
const BALANCE_LOGO_PNG = "/plugins/dsh-get-balance/assets/wallet-money-duotone-128x128.png";
//#endregion
//#region src/client/components/FooterButton.tsx
/**
* dsh-get-balance —— 侧边栏底部入口（sidebar.footer.action）：
* 常驻的「余额」按钮（footer.action 区），点击打开统一弹框
* （余额 / 费用 / 价格设置 三个 tab）。
*
* 右侧文案横排显示：「余额 ￥110.00 | ￥99.50 · 时段小圆点」——余额靠右对齐
* （货币符号前缀、数字绿色），**每个服务商（账号）一段**，以 | 分隔；
* 取不到余额的账号（未配置 key / 查询失败）以**红色 --** 占位（悬停显示原因）。
* 时段文案收敛为小圆点（高峰红 / 空闲绿），悬停使用宿主的
* Tooltip（@deepseek-ai/dsh-client-ui-primitives，运行时从宿主 seed 表解析）
* 气泡提示完整信息「当前为高峰时段 全价计费」/「当前为空闲时段 半价计费」，
* 其中价词着色（高峰「全价」红 / 空闲「半价」绿，与圆点同色）。
* 时段判定与宿主一致（时区偏移 + 高峰窗口 + 周六日半价，按当前时间），
* 每 60 秒刷新；弹框内保存价格成功或关闭弹框后立即刷新。
*
* 更新胶囊：宿主 updateCheck op（npm registry keywords:dsh-get-balance 最新版
* vs 被安装根目录 package.json 版本）判定 hasUpdate=true 时，在按钮**最右侧**
* 以小尺寸胶囊显示【更新】（琥珀色、圆角 999px），悬停原生 title 提示
* 「发现新版本 v{latest}，当前 v{current}」。胶囊外包一层等宽、撑满按钮整高
* 的父盒子（.dshb-update-zone）作点击热区：stopPropagation 阻断事件穿透（不会
* 误开余额弹框），点击打开「确认更新」弹框 → 确认后打开更新日志大弹框
* （dsh plugin --profile web update 的详细执行日志）。窄栏（仅图标圆形按钮）
* 时以绝对定位小圆点徽标叠在按钮右上角。
*/
/** 解析 'HH:MM' 为当日分钟数；非法返回 undefined（与宿主 cost.ts 同规则）。 */
function parseClock(value) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
	if (m === null) return void 0;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (h < 0 || h > 23 || min < 0 || min > 59) return void 0;
	return h * 60 + min;
}
/** 判定一个时刻是否处于高峰时段（与宿主 isPeakTime 同逻辑，含周六日半价）。 */
function isPeakNow(config, nowMs) {
	const offset = typeof config.timezoneOffsetMinutes === "number" ? config.timezoneOffsetMinutes : 480;
	const local = new Date(nowMs + offset * 6e4);
	if (config.weekendOffPeak === true) {
		const day = local.getUTCDay();
		if (day === 0 || day === 6) return false;
	}
	const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
	for (const window of config.peakWindows ?? []) {
		const start = parseClock(window.start);
		const end = parseClock(window.end);
		if (start === void 0 || end === void 0) continue;
		if (start <= end) {
			if (minutes >= start && minutes < end) return true;
		} else if (minutes >= start || minutes < end) return true;
	}
	return false;
}
/** 时段气泡纯文本（aria-label / 窄栏按钮 title 用）：{price} 占位替换为价词文本。 */
function tipPlain(peak) {
	const word = peak ? t("tipFullPrice") : t("tipHalfPrice");
	return t(peak ? "tipPeak" : "tipOffPeak").split("{price}").join(word);
}
/**
* 时段气泡富文本（宿主 Tooltip 渲染）：{price} 处插入彩色价词
* （高峰「全价」红 / 空闲「半价」绿，与圆点同色）。宿主 Tooltip 的 label
* 类型仅声明为 string，但其运行时直接渲染 ReactNode，这里以函数形式 +
* 类型收窄注入彩色片段（宿主运行时行为不变，无需改宿主）。
*/
function tipRich(peak) {
	const [before, after] = t(peak ? "tipPeak" : "tipOffPeak").split("{price}");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: "dshb-tip",
		children: [
			before,
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
				className: peak ? "dshb-tip-full" : "dshb-tip-half",
				children: peak ? t("tipFullPrice") : t("tipHalfPrice")
			}),
			after
		]
	});
}
function FooterButton({ onOpen, reportSession, wide = false, useSessions, run, useOpen, usePriceTick, useBalanceTick, useUpdate, onUpdateClick }) {
	const currentSessionId = useSessions ? useSessions((s) => s && s.current) : null;
	if (reportSession && currentSessionId) reportSession(currentSessionId);
	const open = useOpen();
	const priceTick = usePriceTick?.() ?? 0;
	const balanceTick = useBalanceTick?.() ?? 0;
	const update = useUpdate?.() ?? null;
	const [peak, setPeak] = (0, react.useState)(null);
	const [bals, setBals] = (0, react.useState)(null);
	const btnRef = (0, react.useRef)(null);
	const zoneRef = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		const btn = btnRef.current;
		if (btn === null) return;
		if (wide && update !== null && update.hasUpdate && zoneRef.current !== null) btn.style.paddingRight = zoneRef.current.offsetWidth + 6 + "px";
		else btn.style.paddingRight = "";
	}, [update, wide]);
	const refresh = (0, react.useCallback)(async (forceBalance = false) => {
		try {
			const config = (await run("", { op: "pricesGet" })).config;
			if (config !== void 0) setPeak(isPeakNow(config, Date.now()));
		} catch {}
		try {
			const balances = (await run("", {
				op: "balance",
				refresh: forceBalance
			})).balances;
			if (Array.isArray(balances)) setBals(balances.map((b) => {
				const info = b.ok === true ? b.balance_infos?.[0] : void 0;
				return {
					ok: b.ok === true && info !== void 0,
					total: info?.total_balance ?? "",
					currency: info?.currency ?? "",
					code: b.code,
					error: b.error
				};
			}));
		} catch {}
	}, [run]);
	(0, react.useEffect)(() => {
		refresh();
		const id = setInterval(() => {
			refresh();
		}, 6e4);
		return () => clearInterval(id);
	}, [refresh]);
	(0, react.useEffect)(() => {
		if (!open) refresh();
	}, [open, refresh]);
	(0, react.useEffect)(() => {
		if (priceTick > 0) refresh();
	}, [priceTick, refresh]);
	(0, react.useEffect)(() => {
		if (balanceTick > 0) refresh(true);
	}, [balanceTick, refresh]);
	const periodTip = peak === null ? "" : tipPlain(peak);
	const periodGroup = peak === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: "dshb-footer-word",
		children: t("balanceBtn")
	}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
		label: (() => tipRich(peak)),
		side: "top",
		delayMs: 300,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			className: "dshb-footer-word-group",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dshb-footer-word",
				children: t("balanceBtn")
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dshb-period-dot " + (peak ? "dshb-period-dot-peak" : "dshb-period-dot-off"),
				"aria-label": periodTip
			})]
		})
	});
	const balText = bals === null || bals.length === 0 ? "" : bals.map((seg) => seg.ok ? currencySymbol(seg.currency) + seg.total : "--").join(" | ");
	const fullLabel = t("balanceBtn") + (balText !== "" ? " " + balText : "") + (periodTip !== "" ? " " + periodTip : "");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dshb-footer-group" + (wide ? "" : " dshb-footer-rail-group"),
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			ref: btnRef,
			type: "button",
			className: "dshb-footer-btn" + (wide ? "" : " dshb-footer-btn-rail"),
			title: wide ? void 0 : fullLabel,
			"aria-label": fullLabel,
			onClick: onOpen,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src: BALANCE_LOGO_PNG,
					alt: "",
					className: "dshb-footer-logo"
				}),
				wide ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dshb-footer-label",
					children: [periodGroup, bals !== null && bals.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshb-footer-balance",
						children: bals.map((seg, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [i > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshb-footer-balance-sep",
							"aria-hidden": "true",
							children: "|"
						}) : null, seg.ok ? (() => {
							const sym = currencySymbol(seg.currency);
							const n = parseFloat(seg.total);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dshb-footer-balance-seg",
								children: [sym !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshb-footer-cur",
									children: sym
								}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NumberRoller, {
									value: Number.isFinite(n) ? n : null,
									format: (v) => v.toFixed(2),
									fallback: "--",
									className: "dshb-footer-balance-num"
								})]
							});
						})() : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshb-footer-balance-seg dshb-footer-balance-err",
							title: tErr({
								code: seg.code,
								error: seg.error
							}, t("noCredential")),
							children: "--"
						})] }, i))
					}) : null]
				}) : null,
				update !== null && update.hasUpdate ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					ref: zoneRef,
					className: "dshb-update-zone",
					title: t("updateTip", {
						latest: update.latest,
						current: update.current
					}),
					"aria-label": t("updateTip", {
						latest: update.latest,
						current: update.current
					}),
					onClick: (e) => {
						e.stopPropagation();
						onUpdateClick?.();
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshb-update-pill" + (wide ? "" : " dshb-update-pill-dot"),
						children: wide ? t("updatePill") : ""
					})
				}) : null
			]
		})
	});
}
//#endregion
//#region src/client/components/HeaderButton.tsx
/**
* dsh-get-balance —— 会话头部工具区按钮（conversation.session.header.utilities）：
* 【当前会话 xxM | ≈¥xx】—— 实时显示当前会话的 token 总量（紧凑缩写，绿色）与
* 预估费用（≈ 在前、货币符号 ¥ 在后，与金额同绿）。文案空格固定为
* 「前缀 1.87M | ≈¥0.2935」（前缀与 token 之间一个空格、| 两侧空格）。
* 点击按钮立即刷新一次；启用「定时更新」后按设定间隔自动刷新。
* 会话可能中途切换 provider：按钮展示的是**合并统计结果**，**悬停**按钮
* 弹出气泡弹框，逐 provider 列出当前会话统计（`ds-self 268K | ≈¥0.41`），
* 鼠标移出按钮/气泡区域后自动收起。
* 额外监听宿主会话快照（会话级插槽标准套件 useSession 注入）：每次 AI 请求
* 完成（assistant/message 事件落盘，快照中新增一个更高 seq 的 assistant 节点）
* 即重算 token 与预估费用 —— 不是流式逐 token 更新，而是每次请求完成更新一次
* （一轮含多次请求时逐次更新）。余额刷新按请求走的接口区分：该请求走 DeepSeek
* 官方接口（api.deepseek.com，cost op 的 lastRequestOfficial=true）才广播
* bumpBalanceTick 让 footer 强制刷新余额；非官方接口只更新 token 与预估费用。
*/
/** 四桶 token 总数。 */
function totalTokensOf(b) {
	return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
}
/** 快照中 assistant 消息节点的最大事件 seq；没有任何 assistant 消息时为 0。
*  assistant/message 事件在会话日志中按序追加，seq 单调递增；窗口截断只会
*  丢弃最早的节点，最大 seq 不受影响，因此是「请求完成」的稳定信号。 */
function maxAssistantSeqOf(nodes) {
	if (!Array.isArray(nodes)) return 0;
	let max = 0;
	for (const node of nodes) if (node && node.kind === "assistant" && typeof node.seq === "number" && node.seq > max) max = node.seq;
	return max;
}
function HeaderButton({ sessionId, run, useTick, usePriceTick, useSession, bumpBalanceTick }) {
	const tick = useTick();
	const priceTick = usePriceTick?.() ?? 0;
	const [tokens, setTokens] = (0, react.useState)(null);
	const [amount, setAmount] = (0, react.useState)(null);
	const [byKey, setByKey] = (0, react.useState)(null);
	const [popoverOpen, setPopoverOpen] = (0, react.useState)(false);
	const [popoverPos, setPopoverPos] = (0, react.useState)(null);
	const btnRef = (0, react.useRef)(null);
	const [providerLabels, setProviderLabels] = (0, react.useState)(null);
	const assistantSeq = useSession ? useSession((s) => maxAssistantSeqOf(s.nodes)) : 0;
	const prevSessionId = (0, react.useRef)(null);
	const maxAssistantSeq = (0, react.useRef)(null);
	/**
	* 刷新 token 与预估费用（cost op）。gateBalance=true 时（请求完成路径）：
	* 仅当最近一次完成的请求走 DeepSeek 官方接口（lastRequestOfficial=true）才
	* 广播 bumpBalanceTick —— 非官方接口的请求不触发余额查询。
	*/
	const refresh = (0, react.useCallback)(async (gateBalance = false) => {
		try {
			const cost = (await run(sessionId, {
				op: "cost",
				sessionId
			})).cost;
			const session = cost?.session;
			if (session === void 0) return;
			if (session.amount !== void 0) setAmount(session.amount);
			if (session.buckets !== void 0) setTokens(totalTokensOf(session.buckets));
			if (Array.isArray(session.byKey)) setByKey(session.byKey);
			if (gateBalance && cost?.lastRequestOfficial === true) bumpBalanceTick?.();
		} catch {}
	}, [
		run,
		sessionId,
		bumpBalanceTick
	]);
	const labelOf = (route) => providerLabels?.[route] ?? route;
	const loadProviderLabels = (0, react.useCallback)(async () => {
		if (providerLabels !== null) return;
		try {
			const providers = (await run("", { op: "providers" })).providers;
			if (!Array.isArray(providers)) return;
			const map = {};
			for (const p of providers) {
				const route = p.id.replace(/^(pi-ai|llm-deepseek|extra):/, "");
				if (route.length > 0 && p.label.length > 0) map[route] = p.label;
				if (p.label.length > 0) map[p.label] = p.label;
			}
			setProviderLabels(map);
		} catch {}
	}, [run, providerLabels]);
	(0, react.useEffect)(() => {
		loadProviderLabels();
	}, [loadProviderLabels]);
	(0, react.useEffect)(() => {
		refresh();
	}, [
		refresh,
		tick,
		priceTick
	]);
	(0, react.useEffect)(() => {
		if (prevSessionId.current !== sessionId) {
			prevSessionId.current = sessionId;
			maxAssistantSeq.current = null;
		}
	}, [sessionId]);
	(0, react.useEffect)(() => {
		if (useSession === void 0) return;
		if (maxAssistantSeq.current === null) {
			maxAssistantSeq.current = assistantSeq;
			return;
		}
		if (assistantSeq > maxAssistantSeq.current) {
			maxAssistantSeq.current = assistantSeq;
			refresh(true);
		}
	}, [
		useSession,
		assistantSeq,
		refresh
	]);
	const tokensText = tokens === null ? "--" : fmtTokens(tokens);
	const amountText = amount === null ? "--" : fmtAmount(amount);
	const title = t("headerBtnPrefix") + " " + tokensText + " | ≈¥" + amountText;
	const hoverRef = (0, react.useRef)(false);
	const closeTimerRef = (0, react.useRef)(null);
	const clearCloseTimer = () => {
		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	};
	const openPopover = () => {
		hoverRef.current = true;
		clearCloseTimer();
		refresh();
		const el = btnRef.current;
		if (el) {
			const r = el.getBoundingClientRect();
			setPopoverPos({
				top: r.bottom + 6,
				left: Math.max(8, r.right - 260)
			});
		}
		setPopoverOpen(true);
	};
	const scheduleClose = () => {
		hoverRef.current = false;
		if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
		closeTimerRef.current = window.setTimeout(() => {
			closeTimerRef.current = null;
			if (!hoverRef.current) setPopoverOpen(false);
		}, 150);
	};
	(0, react.useEffect)(() => () => {
		if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
	}, []);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: "dshb-header-wrap",
		onMouseEnter: openPopover,
		onMouseLeave: scheduleClose,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			ref: btnRef,
			type: "button",
			className: "dshb-header-btn",
			title,
			"aria-label": title,
			"aria-expanded": popoverOpen,
			onClick: () => void refresh(),
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("headerBtnPrefix") }),
				" ",
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(NumberRoller, {
					value: tokens,
					format: fmtTokens,
					fallback: "--",
					className: "dshb-header-tokens"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dshb-header-sep",
					children: "|"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dshb-header-amount",
					children: ["≈¥", /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NumberRoller, {
						value: amount,
						format: fmtAmount,
						fallback: "--",
						className: "dshb-header-amount-num"
					})]
				})
			]
		}), popoverOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dshb-header-bd",
			role: "dialog",
			"aria-label": t("headerBreakdownTitle"),
			style: popoverPos !== null ? {
				top: popoverPos.top,
				left: popoverPos.left
			} : void 0,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshb-header-bd-title",
				children: t("headerBreakdownTitle")
			}), byKey === null || byKey.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshb-header-bd-empty",
				children: "—"
			}) : byKey.map((k) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshb-header-bd-row",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshb-header-bd-name",
						title: k.provider,
						children: labelOf(k.provider)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshb-header-bd-tokens",
						children: fmtTokens(totalTokensOf(k.buckets))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshb-header-bd-sep",
						children: "|"
					}),
					k.official ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dshb-header-bd-amount",
						children: [
							"≈",
							currencySymbol(k.currency),
							fmtAmount(k.amount)
						]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshb-header-bd-amount dshb-header-bd-nobill",
						children: t("notBilled")
					})
				]
			}, k.provider))]
		}) : null]
	});
}
//#endregion
//#region src/client/components/BalanceModal.tsx
/**
* dsh-get-balance —— 统一「余额」弹框（余额 / 费用 / 价格设置 三 tab）。
*
* 所有余额相关的显示与设置都收敛在此弹框：
* 1. 余额：DeepSeek 服务商列表（来源标签、脱敏 key、总/赠送余额），
*    每行独立状态；底部「附加 API Key」管理不在 providers 配置中的 key；
* 2. 费用：表格 —— 行为 API Key（token 列合并四行）× 类别
*    （最近一次提问 / 本会话 / 今日·本项目 / 今日·全部），
*    列为 未命中输入 / 缓存命中输入 / 输出 / 命中率 / 预估费用，首组为合计；
* 3. 价格设置：价格档行内编辑 + 增删。
*/
const sourceChipKey = {
	"llm-pi-ai": "sourcePiAi",
	"llm-deepseek": "sourceDeepseek",
	"extra": "sourceExtra"
};
/**
* 会话事件中的 provider 路由是否命中某个（可能折叠的）服务商条目：
* 命中本行 id / label，或命中本行 sharedWith 中任一条目的 id / label。
* 折叠后（同一账号一行）费用统计仍能按任意共享路由匹配到该行。
*/
function providerMatches(p, route) {
	if (p.id === "pi-ai:" + route || p.id === "llm-deepseek:" + route || p.id === route || p.label === route) return true;
	return (p.sharedWith ?? []).some((s) => s.id === "pi-ai:" + route || s.id === "llm-deepseek:" + route || s.id === route || s.label === route);
}
/** 严格对齐官方价格表：仅三组指标（输入-缓存命中 / 输入-缓存未命中 / 输出）。 */
const METRIC_GROUPS = [
	{
		labelKey: "priceInputHit",
		field: "cacheRead"
	},
	{
		labelKey: "priceInputMiss",
		field: "input"
	},
	{
		labelKey: "priceOutput",
		field: "output"
	}
];
/** 费用表格的四个统计类别（行）：最近一次提问 / 本会话 / 今日·本项目 / 今日·全部。 */
const COST_ROWS = [
	{
		labelKey: "costLastTurn",
		pick: (c) => c.lastTurn
	},
	{
		labelKey: "costSession",
		pick: (c) => c.session
	},
	{
		labelKey: "costTodayProject",
		pick: (c) => c.todayProject
	},
	{
		labelKey: "costTodayAll",
		pick: (c) => c.todayAll
	}
];
/** 全零四桶（某类别无该 Key 用量时展示用）。 */
const ZERO_BUCKETS = {
	uncachedInput: 0,
	cacheRead: 0,
	cacheWrite: 0,
	output: 0
};
/** 四桶 token 总数。 */
function bucketsSum(b) {
	return b.uncachedInput + b.cacheRead + b.cacheWrite + b.output;
}
/**
* 缓存命中率（%）：缓存命中 token 占全部输入侧 token
* （未命中 + 命中 + 写入）的比例；无输入时返回 null。
*/
function cacheHitRate(b) {
	const inputSide = b.uncachedInput + b.cacheRead + b.cacheWrite;
	if (inputSide <= 0) return null;
	return b.cacheRead / inputSide * 100;
}
/** 命中率文案：97.3%（一位小数，整数省略小数位）；无输入时为 —。 */
function fmtRate(rate) {
	if (rate === null) return "—";
	const s = rate.toFixed(1);
	return (s.endsWith(".0") ? s.slice(0, -2) : s) + "%";
}
/** 把 UTC 偏移小时数格式化为时区名（zh：零时区 / 东八区 / 西五区；en：UTC±0 / UTC+8 / UTC-5）。 */
function formatTimezone(offsetHours) {
	const h = Math.round(offsetHours);
	return t(h === 0 ? "tzZero" : h > 0 ? "tzEast" : "tzWest", { n: zhNumeral(Math.abs(h)) });
}
function BalanceModal({ run, useOpen, close, getSession, useTick, useAutoSeconds, setAutoSeconds, bumpPriceTick }) {
	const open = useOpen();
	const tick = useTick();
	const autoSeconds = useAutoSeconds();
	const [tab, setTab] = (0, react.useState)("balance");
	const [timingOpen, setTimingOpen] = (0, react.useState)(false);
	const [timingInput, setTimingInput] = (0, react.useState)("");
	const [timingErr, setTimingErr] = (0, react.useState)("");
	const [providers, setProviders] = (0, react.useState)(null);
	const [balances, setBalances] = (0, react.useState)({});
	const [balLoading, setBalLoading] = (0, react.useState)(false);
	const [balError, setBalError] = (0, react.useState)("");
	const [keys, setKeys] = (0, react.useState)([]);
	const [keyFormOpen, setKeyFormOpen] = (0, react.useState)(false);
	const [keyLabel, setKeyLabel] = (0, react.useState)("");
	const [keyValue, setKeyValue] = (0, react.useState)("");
	const [keyErr, setKeyErr] = (0, react.useState)("");
	const [cost, setCost] = (0, react.useState)(null);
	const [costLoading, setCostLoading] = (0, react.useState)(false);
	const [prices, setPrices] = (0, react.useState)(null);
	const [windowCfg, setWindowCfg] = (0, react.useState)({
		timezoneOffsetMinutes: 480,
		peakWindows: [],
		weekendOffPeak: false
	});
	const [priceMsg, setPriceMsg] = (0, react.useState)("");
	/** 余额查询：providers 与 balances 一并回填。 */
	const loadBalances = (0, react.useCallback)(async (refresh) => {
		setBalLoading(true);
		setBalError("");
		try {
			const provRes = await run(getSession(), { op: "providers" });
			if (provRes.ok && Array.isArray(provRes.providers)) setProviders(provRes.providers);
			const res = await run(getSession(), {
				op: "balance",
				refresh
			});
			if (res.ok && Array.isArray(res.balances)) {
				const map = {};
				for (const b of res.balances) map[b.providerId] = b;
				setBalances(map);
			} else setBalError(tErr(res, t("saveFailed")));
		} finally {
			setBalLoading(false);
		}
	}, [run, getSession]);
	const loadKeys = (0, react.useCallback)(async () => {
		const res = await run(getSession(), { op: "keysGet" });
		if (res.ok && Array.isArray(res.keys)) setKeys(res.keys);
	}, [run, getSession]);
	const loadCost = (0, react.useCallback)(async () => {
		setCostLoading(true);
		try {
			const res = await run(getSession(), {
				op: "cost",
				sessionId: getSession()
			});
			if (res.ok && res.cost !== void 0) setCost(res.cost);
		} finally {
			setCostLoading(false);
		}
	}, [run, getSession]);
	const loadPrices = (0, react.useCallback)(async () => {
		const res = await run(getSession(), { op: "pricesGet" });
		if (res.ok) {
			const config = res.config;
			if (Array.isArray(config?.tiers)) setPrices(config.tiers);
			if (config !== void 0) setWindowCfg({
				timezoneOffsetMinutes: typeof config.timezoneOffsetMinutes === "number" ? config.timezoneOffsetMinutes : 480,
				peakWindows: Array.isArray(config.peakWindows) ? config.peakWindows : [],
				weekendOffPeak: config.weekendOffPeak === true
			});
		}
	}, [run, getSession]);
	(0, react.useEffect)(() => {
		if (!open) return;
		loadBalances(false);
		loadKeys();
		loadCost();
		loadPrices();
	}, [
		open,
		tab,
		loadBalances,
		loadKeys,
		loadCost,
		loadPrices
	]);
	(0, react.useEffect)(() => {
		if (!open || tick <= 0) return;
		loadBalances(false);
		loadCost();
	}, [
		tick,
		open,
		loadBalances,
		loadCost
	]);
	const saveAutoSeconds = async (seconds) => {
		try {
			const res = await run("", {
				op: "autoRefreshSave",
				seconds
			});
			if (res.ok && typeof res.seconds === "number") {
				setAutoSeconds(res.seconds);
				setTimingErr("");
				return true;
			}
			setTimingErr(tErr(res, t("saveFailed")));
			return false;
		} catch {
			setTimingErr(tErr(null, t("saveFailed")));
			return false;
		}
	};
	const openTimingDialog = () => {
		setTimingInput(autoSeconds > 0 ? String(autoSeconds) : "60");
		setTimingErr("");
		setTimingOpen(true);
	};
	if (!open) return null;
	const saveKeys = async (next) => {
		const res = await run(getSession(), {
			op: "keysSave",
			keys: next
		});
		if (res.ok) {
			await loadKeys();
			loadBalances(true);
		} else setKeyErr(tErr(res, t("saveFailed")));
	};
	const submitKey = () => {
		const value = keyValue.trim();
		if (value.length === 0) {
			setKeyErr(t("keyRequired"));
			return;
		}
		setKeyErr("");
		setKeyFormOpen(false);
		setKeyValue("");
		setKeyLabel("");
		saveKeys([...keys.map((k) => ({
			id: k.id,
			label: k.label,
			apiKey: ""
		})), {
			label: keyLabel.trim(),
			apiKey: value
		}]);
	};
	const removeKey = (id) => {
		saveKeys(keys.filter((k) => k.id !== id).map((k) => ({
			id: k.id,
			label: k.label,
			apiKey: ""
		})));
	};
	/** 更新某档某个时段的单项单价。 */
	const updateRate = (index, period, field, value) => {
		setPrices((prev) => {
			if (prev === null) return prev;
			const next = prev.slice();
			const tier = next[index];
			next[index] = {
				...tier,
				[period]: {
					...tier[period],
					[field]: value
				}
			};
			return next;
		});
	};
	const savePrices = async (list, windowCfgNext) => {
		if (list.length === 0) {
			setPriceMsg(t("pricesEmpty"));
			return;
		}
		const cfg = windowCfgNext ?? windowCfg;
		const res = await run(getSession(), {
			op: "pricesSave",
			config: {
				tiers: list,
				timezoneOffsetMinutes: cfg.timezoneOffsetMinutes,
				peakWindows: cfg.peakWindows,
				weekendOffPeak: cfg.weekendOffPeak
			}
		});
		if (res.ok) {
			const config = res.config;
			if (Array.isArray(config?.tiers)) setPrices(config.tiers);
			if (config !== void 0) setWindowCfg({
				timezoneOffsetMinutes: typeof config.timezoneOffsetMinutes === "number" ? config.timezoneOffsetMinutes : 480,
				peakWindows: Array.isArray(config.peakWindows) ? config.peakWindows : [],
				weekendOffPeak: config.weekendOffPeak === true
			});
			setPriceMsg(t("pricesSaved"));
			bumpPriceTick();
			loadCost();
		} else setPriceMsg(tErr(res, t("saveFailed")));
	};
	const balanceOf = (id) => balances[id];
	/**
	* 单个服务商条目（API key）的今日消耗：从 cost.todayAll.byKey 按
	* 服务商路由匹配（pi-ai:<route> / llm-deepseek:<route> / label / 共享路由）。
	* 无用量时返回 undefined，展示为 ≈0.00 CNY。
	*/
	const todayCostOf = (p) => {
		return (cost?.todayAll?.byKey ?? []).find((k) => providerMatches(p, k.provider));
	};
	const renderBalanceTab = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
		providers === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dshb-spinner" }) : providers.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dshb-empty",
			children: t("noProviders")
		}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dshb-prov-list",
			children: providers.map((p) => {
				const b = balanceOf(p.id);
				const infos = b?.ok ? b.balance_infos ?? [] : [];
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-prov",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshb-prov-main",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshb-prov-name-row",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshb-prov-name",
									children: p.label
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshb-chip" + (p.source === "extra" ? " dshb-chip-brand" : ""),
									children: t(sourceChipKey[p.source])
								}),
								(p.sharedWith ?? []).map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshb-chip",
									title: t("sharedAccountTitle", { n: s.label !== "" ? s.label : s.id }),
									children: t(sourceChipKey[s.source])
								}, s.id)),
								!p.hasKey ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dshb-chip",
									title: p.keySource !== void 0 ? "source: " + p.keySource : void 0,
									children: [t("noCredential"), p.apiKeyEnv !== void 0 ? " · " + p.apiKeyEnv : ""]
								}) : null
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshb-prov-meta",
							children: [p.baseUrl, p.apiKeyMasked ? ` · ${p.apiKeyMasked}` : ""]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshb-prov-side",
						children: b === void 0 ? balLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshb-spinner",
							style: { margin: "4px 0 4px auto" }
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshb-prov-sub",
							children: "—"
						}) : b.ok ? infos.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshb-prov-sub",
							children: "—"
						}) : infos.map((info, i) => {
							const kc = todayCostOf(p);
							const kcCurrency = kc !== void 0 && kc.currency !== "" ? kc.currency : "CNY";
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshb-prov-costline",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("summaryTodayCost") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dshb-balance-num",
										children: [
											"≈",
											fmtAmount(kc?.amount ?? 0),
											" ",
											kcCurrency
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshb-balance-sep",
										children: "|"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("summaryBalance") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dshb-balance-num",
										children: [
											info.total_balance,
											" ",
											info.currency
										]
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshb-prov-sub" + (info.topped_out ? " dshb-topped" : ""),
								children: [
									t("balanceGranted"),
									" ",
									info.granted_balance,
									info.topped_out ? ` · ${t("toppedOut")}` : ""
								]
							})] }, i);
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshb-prov-err",
							children: tErr(b)
						})
					})]
				}, p.id);
			})
		}),
		balError !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "dshb-err",
			children: balError
		}) : null,
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dshb-keys",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshb-keys-title",
					children: t("extraKeysTitle")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dshb-hint",
					children: t("extraKeysHint")
				}),
				keys.map((k) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-key-row",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshb-chip",
							children: k.label !== "" ? k.label : t("sourceExtra")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshb-key-mask",
							children: k.apiKeyMasked
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshb-btn dshb-btn-small dshb-btn-danger",
							onClick: () => removeKey(k.id),
							children: t("delete")
						})
					]
				}, k.id)),
				keyFormOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-key-form",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dshb-input",
							value: keyLabel,
							placeholder: t("keyLabelPlaceholder"),
							"aria-label": t("keyLabel"),
							onChange: (e) => setKeyLabel(e.target.value)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dshb-input",
							value: keyValue,
							placeholder: t("keyInputPlaceholder"),
							"aria-label": t("keyInput"),
							onChange: (e) => setKeyValue(e.target.value)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshb-btn dshb-btn-small dshb-btn-primary",
							onClick: submitKey,
							children: t("add")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshb-btn dshb-btn-small",
							onClick: () => {
								setKeyFormOpen(false);
								setKeyErr("");
							},
							children: t("cancel")
						})
					]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dshb-btn dshb-btn-small",
					onClick: () => setKeyFormOpen(true),
					children: ["+ ", t("addKeyBtn")]
				}),
				keyErr !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dshb-err",
					children: keyErr
				}) : null
			]
		})
	] });
	/** 服务商路由 key → 展示信息（label + 脱敏 key + 来源）；用余额 tab 已加载的 providers 列表匹配（含折叠的共享路由）。 */
	const providerMeta = (provider) => {
		const hit = (providers ?? []).find((p) => providerMatches(p, provider));
		if (hit !== void 0) return {
			label: hit.label !== "" ? hit.label : provider,
			...hit.apiKeyMasked !== void 0 && hit.apiKeyMasked !== "" ? { masked: hit.apiKeyMasked } : {},
			source: hit.source
		};
		return { label: provider };
	};
	/** 某类别下某 API Key 的用量条目（无则 undefined）。 */
	const keyEntryOf = (entry, provider) => entry?.byKey.find((k) => k.provider === provider);
	/** 官方判定：优先按配置的 baseURL 域名（与宿主同规则，别名路由如 ds-self 也算官方）；
	*  未在配置中的路由回退到用量分组的官方标志。 */
	const officialOf = (route) => {
		const hit = (providers ?? []).find((p) => providerMatches(p, route));
		if (hit !== void 0) try {
			return new URL(hit.baseUrl).hostname.toLowerCase() === "api.deepseek.com";
		} catch {
			return false;
		}
		if (cost === null) return false;
		return COST_ROWS.some((rowDef) => keyEntryOf(rowDef.pick(cost), route)?.official === true);
	};
	/** 表格一行的数值单元格：分类 + 未命中输入 / 缓存命中输入 / 输出 / 命中率 / 预估费用。 */
	const costRowCells = (catLabel, buckets, amount) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
			className: "dshb-cost-cat",
			children: catLabel
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
			className: "dshb-cost-num",
			children: fmtTokens(buckets.uncachedInput)
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
			className: "dshb-cost-num",
			children: fmtTokens(buckets.cacheRead)
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
			className: "dshb-cost-num",
			children: fmtTokens(buckets.output)
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
			className: "dshb-cost-num",
			children: fmtRate(cacheHitRate(buckets))
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
			className: "dshb-cost-num dshb-cost-amount-cell",
			children: amount
		})
	] });
	const renderCostTab = () => {
		if (cost === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dshb-spinner" });
		const sums = /* @__PURE__ */ new Map();
		for (const rowDef of COST_ROWS) for (const k of rowDef.pick(cost)?.byKey ?? []) sums.set(k.provider, (sums.get(k.provider) ?? 0) + bucketsSum(k.buckets));
		const providerList = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
		const listed = new Set(providerList);
		for (const p of providers ?? []) {
			const route = p.id.replace(/^(pi-ai|llm-deepseek|extra):/, "");
			if (listed.has(route)) continue;
			if ([...listed].some((r) => providerMatches(p, r))) continue;
			listed.add(route);
			providerList.push(route);
		}
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dshb-hint",
				children: t("costHint")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshb-price-scroll",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
					className: "dshb-table dshb-cost-table",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("costColToken") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("costColCategory") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
							className: "dshb-cost-num",
							children: t("costColUncached")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
							className: "dshb-cost-num",
							children: t("costColCacheRead")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
							className: "dshb-cost-num",
							children: t("tokensOutput")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
							className: "dshb-cost-num",
							children: t("hitRate")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
							className: "dshb-cost-num",
							children: t("costEstAmount")
						})
					] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tbody", { children: [COST_ROWS.map((rowDef, ri) => {
						const entry = rowDef.pick(cost);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
							className: "dshb-cost-total",
							children: [ri === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
								className: "dshb-cost-key",
								rowSpan: COST_ROWS.length,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dshb-cost-key-name",
									children: t("costTotal")
								})
							}) : null, costRowCells(t(rowDef.labelKey), entry?.buckets ?? ZERO_BUCKETS, entry !== void 0 ? "≈" + fmtAmount(entry.amount) + " " + entry.currency : "—")]
						}, "total-" + rowDef.labelKey);
					}), providerList.map((p) => {
						const meta = providerMeta(p);
						const official = officialOf(p);
						return COST_ROWS.map((rowDef, ri) => {
							const kc = keyEntryOf(rowDef.pick(cost), p);
							const amount = kc === void 0 ? "—" : kc.official ? "≈" + fmtAmount(kc.amount) + " " + kc.currency : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshb-chip",
								children: t("notBilled")
							});
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [ri === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
								className: "dshb-cost-key",
								rowSpan: COST_ROWS.length,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dshb-cost-key-name-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshb-cost-key-name",
										title: p,
										children: meta.label
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshb-chip" + (official ? " dshb-chip-brand" : ""),
										children: official ? t("chipOfficial") : t("chipNonOfficial")
									})]
								}), meta.masked !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dshb-cost-key-token",
									title: p,
									children: meta.masked
								}) : null]
							}) : null, costRowCells(t(rowDef.labelKey), kc?.buckets ?? ZERO_BUCKETS, amount)] }, p + "-" + rowDef.labelKey);
						});
					})] })]
				})
			}),
			cost.sessionTier !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshb-cost-tier",
				children: [
					t("costTier"),
					"：",
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: cost.sessionTier })
				]
			}) : null
		] });
	};
	const renderPricesTab = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "dshb-hint",
		children: t("pricesHint")
	}), prices === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dshb-spinner" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dshb-window-box",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshb-window-head",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dshb-window-title",
					children: t("windowTitle")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dshb-weekend",
					title: t("weekendHint"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: windowCfg.weekendOffPeak,
						"aria-label": t("weekendHalfPrice"),
						onChange: (e) => setWindowCfg({
							...windowCfg,
							weekendOffPeak: e.target.checked
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("weekendHalfPrice") })]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dshb-hint",
				children: t("windowHint")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshb-window-list",
				children: windowCfg.peakWindows.map((w, wi) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-window-row",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dshb-input dshb-cur",
							value: w.start,
							"aria-label": t("windowStart"),
							placeholder: "09:00",
							onChange: (e) => {
								const next = windowCfg.peakWindows.map((x, j) => j === wi ? {
									...x,
									start: e.target.value
								} : x);
								setWindowCfg({
									...windowCfg,
									peakWindows: next
								});
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "–" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dshb-input dshb-cur",
							value: w.end,
							"aria-label": t("windowEnd"),
							placeholder: "12:00",
							onChange: (e) => {
								const next = windowCfg.peakWindows.map((x, j) => j === wi ? {
									...x,
									end: e.target.value
								} : x);
								setWindowCfg({
									...windowCfg,
									peakWindows: next
								});
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshb-btn dshb-btn-small dshb-btn-danger dshb-window-del",
							onClick: () => setWindowCfg({
								...windowCfg,
								peakWindows: windowCfg.peakWindows.filter((_, j) => j !== wi)
							}),
							children: t("delete")
						})
					]
				}, wi))
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshb-window-actions",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dshb-btn dshb-btn-small",
					onClick: () => setWindowCfg({
						...windowCfg,
						peakWindows: [...windowCfg.peakWindows, {
							start: "09:00",
							end: "12:00"
						}]
					}),
					children: ["+ ", t("addWindow")]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dshb-window-tz",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tzOffset") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dshb-range",
							type: "range",
							min: -12,
							max: 12,
							step: 1,
							value: Math.round(windowCfg.timezoneOffsetMinutes / 60),
							"aria-label": t("tzOffset"),
							onChange: (e) => setWindowCfg({
								...windowCfg,
								timezoneOffsetMinutes: Number(e.target.value) * 60
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
							className: "dshb-window-tz-label",
							children: formatTimezone(windowCfg.timezoneOffsetMinutes / 60)
						})
					]
				})]
			})
		]
	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dshb-price-scroll",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
			className: "dshb-table dshb-price-table",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
				className: "dshb-price-corner",
				colSpan: 2,
				children: t("priceModel")
			}), prices.map((tier, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
				className: "dshb-price-head-cell",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dshb-price-model-name",
					title: tier.match === "*" ? t("fallbackHint") : void 0,
					children: tier.name || tier.match
				})
			}, tier.id))] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: METRIC_GROUPS.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
					rowSpan: 2,
					className: "dshb-price-metric",
					children: t(group.labelKey)
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					className: "dshb-price-period dshb-period-off",
					children: t("pricePeriodOffPeak")
				}),
				prices.map((tier, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					className: "dshb-price-cell",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: "dshb-input dshb-num",
						type: "number",
						step: "any",
						min: 0,
						value: tier.offPeak[group.field],
						"aria-label": t(group.labelKey) + " · " + t("pricePeriodOffPeak"),
						onChange: (e) => updateRate(i, "offPeak", group.field, Number(e.target.value) || 0)
					})
				}, tier.id))
			] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
				className: "dshb-price-period dshb-period-peak",
				children: t("pricePeriodPeak")
			}), prices.map((tier, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
				className: "dshb-price-cell",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					className: "dshb-input dshb-num",
					type: "number",
					step: "any",
					min: 0,
					value: tier.peak[group.field],
					"aria-label": t(group.labelKey) + " · " + t("pricePeriodPeak"),
					onChange: (e) => updateRate(i, "peak", group.field, Number(e.target.value) || 0)
				})
			}, tier.id))] })] }, group.field)) })]
		})
	})] })] });
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dshb-backdrop",
		onClick: (e) => {
			if (e.target === e.currentTarget) close();
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dshb-modal",
			role: "dialog",
			"aria-modal": "true",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-modal-header",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshb-modal-title",
							children: t("modalTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshb-tabs",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshb-tab" + (tab === "balance" ? " dshb-tab-active" : ""),
									onClick: () => setTab("balance"),
									children: t("tabBalance")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshb-tab" + (tab === "cost" ? " dshb-tab-active" : ""),
									onClick: () => setTab("cost"),
									children: t("tabCost")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshb-tab" + (tab === "prices" ? " dshb-tab-active" : ""),
									onClick: () => setTab("prices"),
									children: t("tabPrices")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshb-head-ops",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "dshb-btn dshb-btn-small",
									onClick: openTimingDialog,
									children: [t("timingBtn"), autoSeconds > 0 ? "·" + autoSeconds + "s" : ""]
								}),
								tab === "balance" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshb-btn dshb-btn-small",
									disabled: balLoading,
									onClick: () => void loadBalances(true),
									children: t("refresh")
								}) : null,
								tab === "cost" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshb-btn dshb-btn-small",
									disabled: costLoading,
									onClick: () => void loadCost(),
									children: t("refresh")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshb-close",
									"aria-label": t("close"),
									onClick: close,
									children: "✕"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-modal-body",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshb-pane" + (tab === "balance" ? "" : " dshb-pane-off"),
							children: renderBalanceTab()
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshb-pane" + (tab === "cost" ? "" : " dshb-pane-off"),
							children: renderCostTab()
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshb-pane" + (tab === "prices" ? "" : " dshb-pane-off"),
							children: renderPricesTab()
						})
					]
				}),
				tab === "prices" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-modal-footer",
					children: [priceMsg !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshb-msg " + (priceMsg === t("pricesSaved") ? "dshb-ok" : "dshb-err"),
						children: priceMsg
					}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshb-btn dshb-btn-small dshb-btn-primary",
						disabled: prices === null,
						onClick: () => {
							if (prices !== null) savePrices(prices);
						},
						children: t("save")
					})]
				}) : null
			]
		}), timingOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dshb-timing-backdrop",
			onClick: (e) => {
				if (e.target === e.currentTarget) setTimingOpen(false);
			},
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshb-timing-dialog",
				role: "dialog",
				"aria-modal": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshb-timing-title",
						children: t("timingTitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshb-hint",
						children: t("timingHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dshb-timing-field",
						children: [t("timingSeconds"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dshb-input",
							type: "number",
							min: 1,
							max: 86400,
							value: timingInput,
							placeholder: "60",
							disabled: autoSeconds > 0,
							onChange: (e) => setTimingInput(e.target.value)
						})]
					}),
					autoSeconds > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshb-timing-active",
						children: t("timingActive", { n: String(autoSeconds) })
					}) : null,
					timingErr !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshb-err",
						children: timingErr
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshb-timing-actions",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshb-btn dshb-btn-small dshb-btn-primary",
								disabled: autoSeconds > 0,
								onClick: () => {
									const n = Number(String(timingInput).trim());
									if (!Number.isFinite(n) || n <= 0 || n > 86400) {
										setTimingErr(t("timingInvalid"));
										return;
									}
									saveAutoSeconds(Math.round(n)).then((ok) => {
										if (!ok) return;
										loadBalances(false);
										loadCost();
									});
								},
								children: t("timingStart")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshb-btn dshb-btn-small",
								disabled: autoSeconds <= 0,
								onClick: () => {
									saveAutoSeconds(0);
								},
								children: t("timingStop")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshb-btn dshb-btn-small",
								onClick: () => setTimingOpen(false),
								children: t("close")
							})
						]
					})
				]
			})
		}) : null]
	});
}
//#endregion
//#region src/client/ansi.ts
/**
* dsh-get-balance —— 更新日志 ANSI 控制序列 → 带样式的 HTML。
* 与 dsh-jenkins 的 ansi.ts 同方案：
* 仅处理 SGR 序列（\x1b[...m，颜色 / 加粗），其余 CSI 控制序列（清屏/光标移动等）剔除，
* 避免日志中残留乱码字符。
*/
/** SGR（Select Graphic Rendition）序列：\x1b[...m */
const ANSI_SGR_RE = /\x1b\[([0-9;]*)m/g;
/** 非 SGR 的 CSI 控制序列（如 \x1b[K 清行、\x1b[?25l 隐藏光标等），渲染时剔除 */
const ANSI_OTHER_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
/** 亮色主题下调色板（与终端默认一致，30-37 / 90-97 前景色）。 */
const FG_COLORS = {
	30: "#abb2bf",
	31: "#e06c75",
	32: "#98c379",
	33: "#e5c07b",
	34: "#61afef",
	35: "#c678dd",
	36: "#56b6c2",
	37: "#d7dae0",
	90: "#5c6370",
	91: "#ff7b86",
	92: "#b5e890",
	93: "#ffd68a",
	94: "#79c0ff",
	95: "#d2a8ff",
	96: "#7ce8ff",
	97: "#ffffff"
};
function escapeHtml$1(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function applySgrCodes(codes, state) {
	for (const code of codes) if (code === 0) {
		state.bold = false;
		state.color = "";
	} else if (code === 1) state.bold = true;
	else if (code === 22) state.bold = false;
	else if (code === 39) state.color = "";
	else if (FG_COLORS[code]) state.color = FG_COLORS[code];
}
/**
* 将 ANSI 文本转为带样式的 HTML 片段（不含外层容器）。
* 先处理 \r 覆盖行（进度条/动态刷新日志），再按 SGR 序列切分渲染；
* 无序列时结果等价于转义后的纯文本，可安全用于 dangerouslySetInnerHTML。
*/
function ansiToHtml(text) {
	const normalized = text.replace(/[^\n]*\r/g, "");
	const state = {
		bold: false,
		color: ""
	};
	const parts = [];
	let lastIndex = 0;
	ANSI_SGR_RE.lastIndex = 0;
	const pushStyled = (chunk) => {
		const clean = chunk.replace(ANSI_OTHER_RE, "");
		if (!clean) return;
		const escaped = escapeHtml$1(clean);
		const styles = [];
		if (state.bold) styles.push("font-weight:700");
		if (state.color) styles.push("color:" + state.color);
		parts.push(styles.length ? `<span style="${styles.join(";")}">${escaped}</span>` : escaped);
	};
	let match;
	while ((match = ANSI_SGR_RE.exec(normalized)) !== null) {
		pushStyled(normalized.slice(lastIndex, match.index));
		lastIndex = match.index + match[0].length;
		const codes = match[1].split(";").filter(Boolean).map((c) => Number(c));
		applySgrCodes(codes.length === 0 ? [0] : codes, state);
	}
	pushStyled(normalized.slice(lastIndex));
	return parts.join("");
}
//#endregion
//#region src/client/components/ModalPortal.tsx
function ModalPortal({ backdropClass, modalClass, onBackdropClose, children }) {
	return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dshb-backdrop" + (backdropClass ? " " + backdropClass : ""),
		onClick: onBackdropClose ? (e) => {
			e.stopPropagation();
			onBackdropClose();
		} : void 0,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dshb-modal" + (modalClass ? " " + modalClass : ""),
			onClick: (e) => e.stopPropagation(),
			children
		})
	}), document.body);
}
//#endregion
//#region src/client/components/UpdateDialogs.tsx
/**
* dsh-get-balance —— 浏览器半边：插件「更新」交互（确认弹框 → 日志大弹框）。
* 样式对齐 dsh-jenkins 的 PluginUpdateModal（玻璃拟态蒙版 + 终端式日志面板）：
*
* 点击 footer 按钮最右侧的「更新」胶囊（.dshb-update-zone 热区）→ 确认弹框
* （展示新版本 / 当前版本与将要执行的 dsh CLI 更新命令）→ 点击「确认更新」→
* 打开**大日志弹框**：宿主后台执行 `dsh plugin --profile web update dsh-get-balance`，
* 本组件每 600ms 轮询 pluginUpdateStatus op 拉取累计输出与运行状态
* （running / done / exitCode），以深色终端面板实时展示详细日志（ANSI 渲染、
* 自动跟随底部）；结束后成功/失败着色提示，成功后触发一次 updateCheck 重查
* （宿主已使版本缓存失效），让「更新」胶囊消失。
*
* 弹框信息完整版：确认弹框带命令块；日志弹框标题下展示执行命令 + 实时标记，
* 状态行（含实时耗时）+ 终端日志（ANSI）+ 复制按钮 + 完成提示（重启生效）+
* 后台继续提示。
*/
const LOG_POLL_MS = 600;
/** 展示给用户的更新命令（与宿主 plugin-update.ts 的 spawn 参数一致）。 */
const UPDATE_COMMAND = "dsh plugin --profile web update dsh-get-balance";
/** 状态行文案与着色：running=转圈，成功=绿，失败=红。 */
function statusView(status) {
	if (status === null || status.running) return {
		text: t("updateRunning"),
		cls: ""
	};
	if (status.done && status.exitCode === 0) return {
		text: t("updateSuccess"),
		cls: "dshb-update-status-ok"
	};
	const code = status.exitCode === null ? "?" : String(status.exitCode);
	return {
		text: t("updateFailed", { code }) + (status.error ? (LANG === "zh" ? "：" : ": ") + status.error : ""),
		cls: "dshb-update-status-err"
	};
}
/** 极简 HTML 转义（占位文案经转义后插入 pre）。 */
function escapeHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
/** 耗时（秒）：运行中取 当前时间-启动；结束后取 结束-启动；无启动时刻返回 null。 */
function elapsedSeconds(status) {
	const startedAt = status?.startedAt;
	if (startedAt === void 0 || startedAt === null) return null;
	const end = status?.finishedAt ?? Date.now();
	return Math.max(0, Math.round((end - startedAt) / 1e3));
}
/** 更新交互弹框：按 store 的 UI 状态渲染确认弹框或日志大弹框（none 时不渲染）。 */
function UpdateDialogs({ run, useUpdate, useUi, closeUi, onConfirm, recheck }) {
	const ui = useUi();
	const update = useUpdate();
	if (ui === "confirm") {
		const tip = update !== null ? t("updateConfirmText", {
			latest: update.latest,
			current: update.current
		}) : "";
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ModalPortal, {
			backdropClass: "dshb-confirm-backdrop",
			modalClass: "dshb-modal-sm",
			onBackdropClose: closeUi,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-modal-header",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshb-modal-title",
						children: t("updateConfirmTitle")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshb-close",
						"aria-label": t("close"),
						onClick: closeUi,
						children: "✕"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-modal-body",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: tip }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: "dshb-code dshb-update-cmd",
						children: UPDATE_COMMAND
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-modal-footer",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshb-btn",
						onClick: closeUi,
						children: t("cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshb-btn dshb-btn-primary",
						onClick: onConfirm,
						children: t("updateConfirmBtn")
					})]
				})
			]
		});
	}
	if (ui === "log") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UpdateLogDialog, {
		run,
		onClose: closeUi,
		recheck
	});
	return null;
}
/** 日志大弹框：标题（+实时标记）+ 执行命令副标题 + 状态行 / 终端日志 / 完成提示 + 复制 / 关闭。 */
function UpdateLogDialog({ run, onClose, recheck }) {
	const [status, setStatus] = (0, react.useState)(null);
	const [startError, setStartError] = (0, react.useState)("");
	const [copied, setCopied] = (0, react.useState)(false);
	const logRef = (0, react.useRef)(null);
	const recheckedRef = (0, react.useRef)(false);
	const lastLenRef = (0, react.useRef)(-1);
	const output = status?.output ?? "";
	const running = status === null || status.running;
	(0, react.useEffect)(() => {
		let cancelled = false;
		let stopped = false;
		run("", { op: "pluginUpdateStart" }).then((res) => {
			if (cancelled) return;
			if (!res || !res.ok) {
				setStartError(tErr(res, t("updateLogStartFailed")));
				stopped = true;
			}
		}).catch(() => {});
		const poll = async () => {
			if (stopped) return;
			try {
				const res = await run("", { op: "pluginUpdateStatus" });
				if (cancelled) return;
				const st = res.status;
				if (st === void 0 || typeof st !== "object") return;
				setStatus(st);
				if (st.done && st.exitCode === 0 && !recheckedRef.current) {
					recheckedRef.current = true;
					recheck();
				}
			} catch {}
		};
		poll();
		const id = setInterval(() => {
			poll();
		}, LOG_POLL_MS);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [run, recheck]);
	(0, react.useEffect)(() => {
		const el = logRef.current;
		if (el === null) return;
		if (running) el.scrollTop = el.scrollHeight;
		else if (output.length !== lastLenRef.current) {
			el.scrollTop = el.scrollHeight;
			lastLenRef.current = output.length;
		}
	}, [output, running]);
	const st = statusView(status);
	const html = (0, react.useMemo)(() => {
		if (output.length === 0) return escapeHtml(t("updateNoOutput"));
		return ansiToHtml(output);
	}, [output]);
	const copy = (0, react.useCallback)(async () => {
		try {
			await navigator.clipboard.writeText(output);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {}
	}, [output]);
	const doneOk = !!(status && status.done && status.exitCode === 0);
	const elapsed = elapsedSeconds(status);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ModalPortal, {
		backdropClass: "dshb-confirm-backdrop",
		modalClass: "dshb-modal-log",
		onBackdropClose: onClose,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshb-modal-header",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshb-modal-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshb-modal-title",
						children: [t("updateLogTitle"), running && !startError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshb-log-live-tag",
							children: t("liveStatus")
						}) : null]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshb-modal-sub dshb-update-cmd-sub",
						children: UPDATE_COMMAND
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dshb-close",
					"aria-label": t("close"),
					onClick: onClose,
					children: "✕"
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshb-modal-body",
				children: startError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshb-empty",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshb-err",
						children: startError
					})
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshb-update-status" + (st.cls !== "" ? " " + st.cls : ""),
						children: [
							running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshb-spinner-inline",
								"aria-hidden": "true"
							}) : null,
							st.text,
							elapsed !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshb-update-duration",
								children: t("updateDuration", { s: elapsed })
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						ref: logRef,
						className: "dshb-update-log",
						"aria-label": t("updateLogTitle"),
						dangerouslySetInnerHTML: { __html: html }
					}),
					running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshb-hint",
						children: t("updateBgHint")
					}) : null
				] })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshb-modal-footer",
				children: [
					doneOk ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshb-update-hint",
						children: t("updateRestartHint")
					}) : null,
					output.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshb-btn dshb-btn-small",
						onClick: () => void copy(),
						children: copied ? t("copied") : t("copy")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshb-btn dshb-btn-small",
						onClick: onClose,
						children: t("close")
					})
				]
			})
		]
	});
}
//#endregion
//#region src/client/plugin.tsx
/**
* dsh-get-balance —— 浏览器半边插件主体（slots 注册）。
*
* 本文件不包含 __ModuleLoader__ 包装：构建为单文件 CJS 后由 tsdown 的
* banner/footer 包装成宿主工厂格式。外部依赖（react 等）在打包时 external，
* 运行时经 factory 的 require 解析到宿主模块表（seed）。
*
* 入口结构（统一弹框）：
* - sidebar.footer.action：常驻「余额」按钮（固定 order: 30，排在插槽
*   靠前位置），点击打开统一弹框；检测到新版本时最右侧显示「更新」胶囊，
*   点击胶囊 → 确认弹框 → 日志大弹框（dsh plugin --profile web update 执行日志）；
* - shell.overlay（dsh-balance-modal）：统一弹框，三个 tab —— 余额 / 费用 /
*   价格设置，所有余额相关的显示与设置都收敛在此；
* - shell.overlay（dsh-balance-update）：更新确认弹框 / 更新日志大弹框。
*/
/** 侧边栏 footer 插槽 key 与本插件入口 id。 */
const FOOTER_SLOT = "sidebar.footer.action";
const FOOTER_ENTRY_ID = "dsh-get-balance";
function createPlugin() {
	return {
		name: "dsh-get-balance",
		inject: [
			"slots",
			"remote",
			"remote.commands",
			"timer"
		],
		apply(ctx) {
			const run = makeRun(ctx);
			const { store: modalStore, useOpen, autoStore, tickStore, bumpTick, useTick, useAutoSeconds, usePriceTick, bumpPriceTick, useBalanceTick, bumpBalanceTick, setUpdate, useUpdate, openUpdateConfirm, openUpdateLog, closeUpdateUi, useUpdateUi } = makeBalanceModalStore();
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			injectStyles();
			run("", { op: "autoRefreshGet" }).then((res) => {
				if (typeof res.seconds === "number") {
					autoStore.value = res.seconds;
					autoStore.emit();
				}
			}).catch(() => {});
			const recheckUpdate = () => {
				run("", { op: "updateCheck" }).then((res) => {
					const raw = res.update;
					if (raw !== null && typeof raw === "object" && typeof raw.hasUpdate === "boolean") setUpdate({
						current: String(raw.current ?? ""),
						latest: String(raw.latest ?? ""),
						hasUpdate: raw.hasUpdate === true
					});
				}).catch(() => {});
			};
			recheckUpdate();
			let lastAutoAt = Date.now();
			setInterval(() => {
				const seconds = autoStore.value ?? 0;
				if (seconds <= 0) return;
				if (Date.now() - lastAutoAt >= seconds * 1e3) {
					lastAutoAt = Date.now();
					bumpTick();
				}
			}, 1e3);
			const sessionRef = { current: "" };
			const getSession = () => sessionRef.current;
			try {
				slots.inject("conversation.chat.commandview", () => slots.register({
					name: "conversation.chat.commandview",
					key: "dsh-balance",
					priority: 0
				}, () => null));
			} catch {}
			slots.inject(FOOTER_SLOT, () => slots.register({
				name: FOOTER_SLOT,
				id: FOOTER_ENTRY_ID,
				order: 30
			}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FooterButton, {
				onOpen: () => modalStore.open(true),
				reportSession: (s) => {
					if (s) sessionRef.current = s;
				},
				wide: props.wide,
				useSessions: props.useSessions,
				run,
				useOpen,
				usePriceTick,
				useBalanceTick,
				useUpdate,
				onUpdateClick: openUpdateConfirm
			})));
			slots.inject("conversation.session.header.utilities", () => slots.register({
				name: "conversation.session.header.utilities",
				id: "dsh-balance-header",
				order: 100
			}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeaderButton, {
				sessionId: String(props.sessionId ?? ""),
				run,
				useTick,
				usePriceTick,
				useSession: props.useSession,
				bumpBalanceTick
			})));
			slots.inject("shell.overlay", () => slots.register({
				name: "shell.overlay",
				id: "dsh-balance-modal"
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BalanceModal, {
				run,
				useOpen,
				close: () => modalStore.close(),
				getSession,
				useTick,
				useAutoSeconds,
				bumpPriceTick,
				setAutoSeconds: (seconds) => {
					autoStore.value = seconds;
					autoStore.emit();
					lastAutoAt = Date.now();
				}
			})));
			slots.inject("shell.overlay", () => slots.register({
				name: "shell.overlay",
				id: "dsh-balance-update"
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UpdateDialogs, {
				run,
				useUpdate,
				useUi: useUpdateUi,
				closeUi: closeUpdateUi,
				onConfirm: () => {
					closeUpdateUi();
					openUpdateLog();
				},
				recheck: recheckUpdate
			})));
		}
	};
}
//#endregion
//#region src/client/index.ts
/**
* dsh-get-balance —— 浏览器半边入口（tsdown 打包）。
*
* 本文件为纯 ESM 模块，直接导出插件形状 { name, inject, apply }；
* window.__ModuleLoader__.load 工厂包装由 tsdown 的 banner/intro/footer
* 在构建时生成（见 tsdown.config.ts）。外部依赖（react /
* react/jsx-runtime / @deepseek-ai/dsh-client-ui-primitives）构建时保持
* external，运行时经 factory 的 require 解析宿主模块表（seed）。
*/
const plugin = createPlugin();
const name = plugin.name;
const inject = plugin.inject;
const apply = plugin.apply;
//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;

return module.exports; } });
//# sourceMappingURL=client.js.map