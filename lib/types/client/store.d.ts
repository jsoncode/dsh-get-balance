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
}
/** 统一「余额」弹框的打开状态（footer 入口 open，overlay 弹框消费）。 */
export declare function makeBalanceModalStore(): BalanceModalStore;
export {};
//# sourceMappingURL=store.d.ts.map