/**
 * dsh-get-balance —— 浏览器半边：统一「余额」弹框开关（footer 入口 ↔ overlay 弹框共享）。
 */
interface StoreState<T> {
    value: T | null;
    listeners: Array<() => void>;
    emit(): void;
    subscribe(l: () => void): () => void;
    open(value: T): void;
    close(): void;
}
/** 插件更新检查结果（宿主 updateCheck op 载荷）。 */
export interface UpdateInfo {
    /** 被安装根目录 package.json 的当前版本。 */
    current: string;
    /** npm registry 上的最新版本（未取到为空串）。 */
    latest: string;
    /** latest 是否比 current 更新。 */
    hasUpdate: boolean;
}
/** 插件更新进程状态（宿主 pluginUpdateStatus op 载荷）。 */
export interface UpdateStatusView {
    running: boolean;
    done: boolean;
    /** 累计输出（宿主环形缓冲尾部）。 */
    output: string;
    exitCode: number | null;
    error: string;
    /** 启动时刻（epoch ms）；展示耗时用。 */
    startedAt?: number | null;
    /** 结束时刻（epoch ms）；运行中为 null。 */
    finishedAt?: number | null;
}
/** 更新交互 UI 状态：none=未打开 confirm=确认弹框 log=日志大弹框。 */
export type UpdateUi = 'none' | 'confirm' | 'log';
export interface BalanceModalStore {
    store: StoreState<boolean>;
    useOpen(): boolean;
    /** 定时自动刷新间隔（秒，0 = 关闭）。 */
    autoStore: StoreState<number>;
    useAutoSeconds(): number;
    /** 自动刷新 tick：宿主插件侧定时器到点递增，头部按钮 / 弹框订阅后各自刷新。 */
    tickStore: StoreState<number>;
    useTick(): number;
    bumpTick(): void;
    /** 价格配置保存 tick：弹框保存成功后递增，footer/头部按钮订阅后立即刷新时段与费用。 */
    priceTickStore: StoreState<number>;
    usePriceTick(): number;
    bumpPriceTick(): void;
    /**
     * 余额刷新 tick：头部按钮确认刚完成的 AI 请求走 DeepSeek 官方接口
     * （cost op 的 lastRequestOfficial=true）后递增；footer 订阅后强制刷新余额
     * （绕过 60s 缓存）。非官方请求不递增 —— 只更新 token 与预估费用，不查余额。
     */
    balanceTickStore: StoreState<number>;
    useBalanceTick(): number;
    bumpBalanceTick(): void;
    /**
     * 「显示余额」开关（余额 tab 列表上方的滑动开关）：false 时 footer 入口与
     * 余额列表中的金额一律掩码为 **。初始 true，插件启动时经宿主 showBalanceGet
     * 水合为持久化值；弹框内切换经 setShowBalance 即时生效并持久化。
     */
    showBalanceStore: StoreState<boolean>;
    useShowBalance(): boolean;
    /**
     * 插件更新信息：插件启动时经宿主 updateCheck op 查询一次
     * （npm registry vs 安装根目录 package.json），hasUpdate=true 时
     * footer 按钮最右侧显示【更新】小胶囊。
     */
    setUpdate(info: UpdateInfo): void;
    useUpdate(): UpdateInfo | null;
    /** 更新交互 UI 状态（确认弹框 → 日志大弹框）。 */
    openUpdateConfirm(): void;
    openUpdateLog(): void;
    closeUpdateUi(): void;
    useUpdateUi(): UpdateUi;
}
/** 统一「余额」弹框的打开状态（footer 入口 open，overlay 弹框消费）。 */
export declare function makeBalanceModalStore(): BalanceModalStore;
export {};
//# sourceMappingURL=store.d.ts.map