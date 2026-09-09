import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * dsh-get-balance —— 「在菜单中显示」滑动开关行（偏好源 showInMenuStore）。
 *
 * 两处渲染同一组件、同一偏好源：宿主「设置 → 账户余额 · Token 调用量」分区页
 * 顶部，以及插件弹框「价格设置」tab 顶部。关闭后宿主侧栏 footerAction 的入口
 * 按钮渲染 null（FooterButton 订阅同一个 store，无需刷新页面）。
 */
import { useSyncExternalStore } from 'react';
import { t } from "../i18n.js";
import { showInMenuStore } from "../prefs.js";
export function ShowInMenuToggle() {
    // 第三个参数（getServerSnapshot）供 SSR / 静态渲染测试使用；浏览器行为不变。
    const on = useSyncExternalStore(showInMenuStore.subscribe, showInMenuStore.getSnapshot, showInMenuStore.getSnapshot);
    return (_jsxs("div", { className: "dshb-pref", children: [_jsxs("div", { className: "dshb-pref-text", children: [_jsx("div", { className: "dshb-pref-label", children: t('showInMenu') }), _jsx("div", { className: "dshb-pref-desc", children: t('showInMenuDesc') })] }), _jsx("button", { type: "button", role: "switch", "aria-checked": on, "aria-label": t('showInMenu'), className: 'dshb-switch' + (on ? ' dshb-switch-on' : ''), onClick: () => { showInMenuStore.set(!on); }, children: _jsx("span", { className: "dshb-switch-thumb" }) })] }));
}
