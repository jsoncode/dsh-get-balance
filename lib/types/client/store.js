/**
 * dsh-get-balance —— 浏览器半边：统一「余额」弹框开关（footer 入口 ↔ overlay 弹框共享）。
 */
import { useEffect, useState } from 'react';
function createStore() {
    const store = {
        value: null,
        listeners: [],
        emit() { for (let i = 0; i < this.listeners.length; i++)
            this.listeners[i](); },
        subscribe(l) { this.listeners.push(l); return () => { const i = this.listeners.indexOf(l); if (i >= 0)
            this.listeners.splice(i, 1); }; },
        open(value) { this.value = value; this.emit(); },
        close() { this.value = null; this.emit(); },
    };
    return store;
}
function useStoreValue(target) {
    const [v, setV] = useState(target.value);
    useEffect(() => target.subscribe(() => setV(target.value)), []);
    return v;
}
/** 统一「余额」弹框的打开状态（footer 入口 open，overlay 弹框消费）。 */
export function makeBalanceModalStore() {
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
    updateUiStore.value = 'none';
    const useOpen = () => {
        const [v, setV] = useState(!!store.value);
        useEffect(() => store.subscribe(() => setV(!!store.value)), []);
        return v;
    };
    const useAutoSeconds = () => {
        const v = useStoreValue(autoStore);
        return v ?? 0;
    };
    const useTick = () => {
        const v = useStoreValue(tickStore);
        return v ?? 0;
    };
    const bumpTick = () => {
        tickStore.value = (tickStore.value ?? 0) + 1;
        tickStore.emit();
    };
    const usePriceTick = () => {
        const v = useStoreValue(priceTickStore);
        return v ?? 0;
    };
    const bumpPriceTick = () => {
        priceTickStore.value = (priceTickStore.value ?? 0) + 1;
        priceTickStore.emit();
    };
    const useBalanceTick = () => {
        const v = useStoreValue(balanceTickStore);
        return v ?? 0;
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
        const v = useStoreValue(updateUiStore);
        return v ?? 'none';
    };
    return {
        store, useOpen, autoStore, useAutoSeconds, tickStore, useTick, bumpTick,
        priceTickStore, usePriceTick, bumpPriceTick, balanceTickStore, useBalanceTick, bumpBalanceTick,
        setUpdate,
        useUpdate: () => useStoreValue(updateStore),
        openUpdateConfirm: () => { updateUiStore.value = 'confirm'; updateUiStore.emit(); },
        openUpdateLog: () => { updateUiStore.value = 'log'; updateUiStore.emit(); },
        closeUpdateUi: () => { updateUiStore.value = 'none'; updateUiStore.emit(); },
        useUpdateUi,
    };
}
