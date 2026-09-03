import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
 * （宿主实时重读版本），让「更新」胶囊消失。
 *
 * 弹框信息完整版：确认弹框带命令块；日志弹框标题下展示执行命令 + 实时标记，
 * 状态行（含实时耗时）+ 终端日志（ANSI）+ 复制按钮 + 完成提示（重启生效）+
 * 后台继续提示。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLang, t, tErr } from "../i18n.js";
import { ansiToHtml } from "../ansi.js";
import { ModalPortal } from "./ModalPortal.js";
const LOG_POLL_MS = 600;
/** 展示给用户的更新命令（与宿主 plugin-update.ts 的 spawn 参数一致）。 */
const UPDATE_COMMAND = 'dsh plugin --profile web update dsh-get-balance';
/** 状态行文案与着色：running=转圈，成功=绿，失败=红。 */
function statusView(status) {
    if (status === null || status.running)
        return { text: t('updateRunning'), cls: '' };
    if (status.done && status.exitCode === 0)
        return { text: t('updateSuccess'), cls: 'dshb-update-status-ok' };
    const code = status.exitCode === null ? '?' : String(status.exitCode);
    return { text: t('updateFailed', { code }) + (status.error ? (getLang() === 'zh' ? '：' : ': ') + status.error : ''), cls: 'dshb-update-status-err' };
}
/** 极简 HTML 转义（占位文案经转义后插入 pre）。 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/** 耗时（秒）：运行中取 当前时间-启动；结束后取 结束-启动；无启动时刻返回 null。 */
function elapsedSeconds(status) {
    const startedAt = status?.startedAt;
    if (startedAt === undefined || startedAt === null)
        return null;
    const end = status?.finishedAt ?? Date.now();
    return Math.max(0, Math.round((end - startedAt) / 1000));
}
/** 更新交互弹框：按 store 的 UI 状态渲染确认弹框或日志大弹框（none 时不渲染）。 */
export function UpdateDialogs({ run, useUpdate, useUi, closeUi, onConfirm, recheck }) {
    const ui = useUi();
    const update = useUpdate();
    if (ui === 'confirm') {
        const tip = update !== null
            ? t('updateConfirmText', { latest: update.latest, current: update.current })
            : '';
        return (_jsxs(ModalPortal, { backdropClass: "dshb-confirm-backdrop", modalClass: "dshb-modal-sm", onBackdropClose: closeUi, children: [_jsxs("div", { className: "dshb-modal-header", children: [_jsx("span", { className: "dshb-modal-title", children: t('updateConfirmTitle') }), _jsx("button", { type: "button", className: "dshb-close", "aria-label": t('close'), onClick: closeUi, children: "\u2715" })] }), _jsxs("div", { className: "dshb-modal-body", children: [_jsx("div", { children: tip }), _jsx("pre", { className: "dshb-code dshb-update-cmd", children: UPDATE_COMMAND })] }), _jsxs("div", { className: "dshb-modal-footer", children: [_jsx("button", { type: "button", className: "dshb-btn", onClick: closeUi, children: t('cancel') }), _jsx("button", { type: "button", className: "dshb-btn dshb-btn-primary", onClick: onConfirm, children: t('updateConfirmBtn') })] })] }));
    }
    if (ui === 'log') {
        return _jsx(UpdateLogDialog, { run: run, onClose: closeUi, recheck: recheck });
    }
    return null;
}
/** 日志大弹框：标题（+实时标记）+ 执行命令副标题 + 状态行 / 终端日志 / 完成提示 + 复制 / 关闭。 */
function UpdateLogDialog({ run, onClose, recheck }) {
    const [status, setStatus] = useState(null);
    const [startError, setStartError] = useState('');
    const [copied, setCopied] = useState(false);
    const logRef = useRef(null);
    const recheckedRef = useRef(false);
    const lastLenRef = useRef(-1);
    const output = status?.output ?? '';
    const running = status === null || status.running;
    // 轮询与启动逻辑（启动失败展示错误；成功后 recheck 让胶囊消失）
    useEffect(() => {
        let cancelled = false;
        let stopped = false;
        void run('', { op: 'pluginUpdateStart' }).then((res) => {
            if (cancelled)
                return;
            if (!res || !res.ok) {
                setStartError(tErr(res, t('updateLogStartFailed')));
                stopped = true;
            }
        }).catch(() => { });
        const poll = async () => {
            if (stopped)
                return;
            try {
                const res = await run('', { op: 'pluginUpdateStatus' });
                if (cancelled)
                    return;
                const st = res.status;
                if (st === undefined || typeof st !== 'object')
                    return;
                setStatus(st);
                // 成功结束：重查版本（宿主实时重读 package.json 版本），隐藏胶囊。
                if (st.done && st.exitCode === 0 && !recheckedRef.current) {
                    recheckedRef.current = true;
                    recheck();
                }
            }
            catch { /* 网络抖动保持上一次状态 */ }
        };
        void poll();
        const id = setInterval(() => { void poll(); }, LOG_POLL_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, [run, recheck]);
    // 自动滚底（运行中 / 结束瞬间）
    useEffect(() => {
        const el = logRef.current;
        if (el === null)
            return;
        if (running) {
            el.scrollTop = el.scrollHeight;
        }
        else if (output.length !== lastLenRef.current) {
            el.scrollTop = el.scrollHeight;
            lastLenRef.current = output.length;
        }
    }, [output, running]);
    const st = statusView(status);
    const html = useMemo(() => {
        if (output.length === 0)
            return escapeHtml(t('updateNoOutput'));
        return ansiToHtml(output);
    }, [output]);
    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
        catch { /* 剪贴板不可用时静默 */ }
    }, [output]);
    const doneOk = !!(status && status.done && status.exitCode === 0);
    const elapsed = elapsedSeconds(status);
    return (_jsxs(ModalPortal, { backdropClass: "dshb-confirm-backdrop", modalClass: "dshb-modal-log", onBackdropClose: onClose, children: [_jsxs("div", { className: "dshb-modal-header", children: [_jsxs("div", { className: "dshb-modal-head", children: [_jsxs("div", { className: "dshb-modal-title", children: [t('updateLogTitle'), running && !startError ? _jsx("span", { className: "dshb-log-live-tag", children: t('liveStatus') }) : null] }), _jsx("div", { className: "dshb-modal-sub dshb-update-cmd-sub", children: UPDATE_COMMAND })] }), _jsx("button", { type: "button", className: "dshb-close", "aria-label": t('close'), onClick: onClose, children: "\u2715" })] }), _jsx("div", { className: "dshb-modal-body", children: startError ? (_jsx("div", { className: "dshb-empty", children: _jsx("div", { className: "dshb-err", children: startError }) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: 'dshb-update-status' + (st.cls !== '' ? ' ' + st.cls : ''), children: [running ? _jsx("span", { className: "dshb-spinner-inline", "aria-hidden": "true" }) : null, st.text, elapsed !== null ? _jsx("span", { className: "dshb-update-duration", children: t('updateDuration', { s: elapsed }) }) : null] }), _jsx("pre", { ref: logRef, className: "dshb-update-log", "aria-label": t('updateLogTitle'), dangerouslySetInnerHTML: { __html: html } }), running ? _jsx("div", { className: "dshb-hint", children: t('updateBgHint') }) : null] })) }), _jsxs("div", { className: "dshb-modal-footer", children: [doneOk ? _jsx("span", { className: "dshb-update-hint", children: t('updateRestartHint') }) : null, output.length > 0 ? (_jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: () => void copy(), children: copied ? t('copied') : t('copy') })) : null, _jsx("button", { type: "button", className: "dshb-btn dshb-btn-small", onClick: onClose, children: t('close') })] })] }));
}
