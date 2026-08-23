/**
 * dsh-get-balance —— 插件 logo。
 *
 * footer 入口按钮图标（钱包双色 PNG）由宿主 node 半边经 HTTP 路由
 * /plugins/dsh-get-balance/assets/wallet-money-duotone-128x128.png 提供：
 * 宿主不会把插件包内的 assets 文件直接暴露给浏览器，因此 node 半边
 * 注册 exact 路由按包内原文件喂给浏览器（见 src/host/index.ts）。
 */
/** 内置 SVG 徽标（白色钱包线条，用于蓝色圆形底徽标）。 */
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13.5" rx="2.5"/><path d="M2.5 10h19"/><circle cx="16.5" cy="14.75" r="1.4" fill="#fff" stroke="none"/><path d="M6.5 6 8 3.5h8L17.5 6"/></svg>';
export const BALANCE_LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(SVG);
/** footer 入口按钮图标：钱包双色 PNG（同源绝对路径，由宿主路由提供）。 */
export const BALANCE_LOGO_PNG = '/plugins/dsh-get-balance/assets/wallet-money-duotone-128x128.png';
