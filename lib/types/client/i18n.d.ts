/**
 * dsh-get-balance —— 浏览器半边：语言与文案（中英双语，跟随主界面语言）。
 */
export declare const LANG: "zh" | "en";
/** 取文案并替换 {var} 占位符。 */
export declare const t: (key: string, vars?: Record<string, string | number>) => string;
/** 宿主错误通过 code 映射为本地化文本，未知错误回退原文。 */
export declare const tErr: (res: {
    code?: string;
    error?: string;
} | null | undefined, fallback?: string) => string;
/** 中文数字（时区名用，如「东八区」）；zh 词典缺失或越界时回退阿拉伯数字。 */
export declare function zhNumeral(index: number): string;
/** 金额格式化（保留合理小数位）。 */
export declare const fmtAmount: (amount: number | undefined) => string;
/** 货币代码 → 展示符号（CNY → ¥；未收录回退代码本身；空代码返回空串）。 */
export declare function currencySymbol(code: string): string;
/** token 数量紧凑格式化：1234567 → 1.23M，减小长数字占位（最多 3 位有效数字）。 */
export declare const fmtTokens: (n: number | undefined) => string;
//# sourceMappingURL=i18n.d.ts.map