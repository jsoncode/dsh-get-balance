import { jsx as _jsx } from "react/jsx-runtime";
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
import { injectStyles } from "./styles.js";
import { makeRun } from "./rpc.js";
import { makeBalanceModalStore } from "./store.js";
import { FooterButton } from "./components/FooterButton.js";
import { HeaderButton } from "./components/HeaderButton.js";
import { BalanceModal } from "./components/BalanceModal.js";
import { UpdateDialogs } from "./components/UpdateDialogs.js";
/** 侧边栏 footer 插槽 key 与本插件入口 id。 */
const FOOTER_SLOT = 'sidebar.footer.action';
const FOOTER_ENTRY_ID = 'dsh-get-balance';
export function createPlugin() {
    return {
        name: 'dsh-get-balance',
        inject: ['slots', 'remote', 'remote.commands', 'timer'],
        apply(ctx) {
            const run = makeRun(ctx);
            const { store: modalStore, useOpen, autoStore, tickStore, bumpTick, useTick, useAutoSeconds, usePriceTick, bumpPriceTick, useBalanceTick, bumpBalanceTick, setUpdate, useUpdate, openUpdateConfirm, openUpdateLog, closeUpdateUi, useUpdateUi, } = makeBalanceModalStore();
            const slots = ctx.get('slots');
            if (slots === undefined)
                return;
            injectStyles();
            // 载入持久化的定时自动刷新间隔（秒），并驱动全局自动刷新 tick。
            void run('', { op: 'autoRefreshGet' }).then((res) => {
                if (typeof res.seconds === 'number') {
                    autoStore.value = res.seconds;
                    autoStore.emit();
                }
            }).catch(() => { });
            // 插件新版本检查：宿主以 npm registry（keywords:dsh-get-balance）最新版
            // 比对被安装根目录 package.json，hasUpdate=true 时 footer 按钮最右侧显示
            // 【更新】胶囊。宿主侧缓存 10 分钟；失败静默（不显示胶囊）。
            // recheckUpdate 在更新进程成功结束后再次调用（宿主已使版本缓存失效），
            // 用于让「更新」胶囊消失。
            const recheckUpdate = () => {
                void run('', { op: 'updateCheck' }).then((res) => {
                    const raw = res.update;
                    if (raw !== null && typeof raw === 'object' && typeof raw.hasUpdate === 'boolean') {
                        setUpdate({
                            current: String(raw.current ?? ''),
                            latest: String(raw.latest ?? ''),
                            hasUpdate: raw.hasUpdate === true,
                        });
                    }
                }).catch(() => { });
            };
            recheckUpdate();
            let lastAutoAt = Date.now();
            setInterval(() => {
                const seconds = autoStore.value ?? 0;
                if (seconds <= 0)
                    return;
                if (Date.now() - lastAutoAt >= seconds * 1000) {
                    lastAutoAt = Date.now();
                    bumpTick();
                }
            }, 1000);
            // 当前会话 id 追踪：footer 入口挂载时上报，费用查询随请求上传，
            // 供宿主读取内存 Session（最近一次提问 / 本会话费用）。
            const sessionRef = { current: '' };
            const getSession = () => sessionRef.current;
            // ─── 对话中的 dsh-balance 命令行：兜底不渲染内部 JSON 结果 ──────────
            // 浏览器半边的请求走 /dsh-balance/api HTTP 路由（rpc.ts），不进入对话
            // 命令通道。此 commandview 注册仅兜底「用户/模型在对话中显式执行
            // /dsh-balance 命令」的场景，隐藏 {"ok":true,...} 内部 JSON 卡片。
            try {
                slots.inject('conversation.chat.commandview', () => slots.register({ name: 'conversation.chat.commandview', key: 'dsh-balance', priority: 0 }, () => null));
            }
            catch { /* 插槽未声明时静默降级（通用命令卡片渲染） */ }
            // ─── 侧边栏底部入口：常驻「余额」按钮（footer.action 区）─────────
            //     一次注册，声明固定 order: 30、不订阅插槽变化：
            //     避免与其它动态排序插件形成互相触发的重注册死循环。styles.ts
            //     已把该列表容器改为纵向堆叠，多个按钮各占一行。
            slots.inject(FOOTER_SLOT, () => slots.register({ name: FOOTER_SLOT, id: FOOTER_ENTRY_ID, order: 30 }, (props) => (_jsx(FooterButton, { onOpen: () => modalStore.open(true), reportSession: (s) => { if (s)
                    sessionRef.current = s; }, wide: props.wide, useSessions: props.useSessions, run: run, useOpen: useOpen, usePriceTick: usePriceTick, useBalanceTick: useBalanceTick, useUpdate: useUpdate, onUpdateClick: openUpdateConfirm }))));
            // ─── 会话头部工具区：当前会话费用 / 余额按钮（header.utilities）────
            slots.inject('conversation.session.header.utilities', () => slots.register({ name: 'conversation.session.header.utilities', id: 'dsh-balance-header', order: 100 }, (props) => (_jsx(HeaderButton, { sessionId: String(props.sessionId ?? ''), run: run, useTick: useTick, usePriceTick: usePriceTick, useSession: props.useSession, bumpBalanceTick: bumpBalanceTick }))));
            // ─── 统一「余额」弹框（余额 / 费用 / 价格设置 三 tab）──────────────
            slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-balance-modal' }, () => (_jsx(BalanceModal, { run: run, useOpen: useOpen, close: () => modalStore.close(), getSession: getSession, useTick: useTick, useAutoSeconds: useAutoSeconds, bumpPriceTick: bumpPriceTick, setAutoSeconds: (seconds) => {
                    autoStore.value = seconds;
                    autoStore.emit();
                    lastAutoAt = Date.now();
                } }))));
            // ─── 更新确认 / 日志弹框（shell.overlay，与余额弹框并列）──────────
            // 点击「更新」胶囊 → 确认弹框（当前 vX → 最新 vY）→ 确认后打开日志
            // 大弹框：宿主后台执行 dsh plugin --profile web update dsh-get-balance，
            // 组件轮询拉取详细日志；成功后 recheckUpdate 重查版本（胶囊消失）。
            slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-balance-update' }, () => (_jsx(UpdateDialogs, { run: run, useUpdate: useUpdate, useUi: useUpdateUi, closeUi: closeUpdateUi, onConfirm: () => { closeUpdateUi(); openUpdateLog(); }, recheck: recheckUpdate }))));
        },
    };
}
