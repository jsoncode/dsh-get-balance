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
/**
 * 坐标轴紧凑简写：1234 → 1.2K，2345678 → 2.3M，0.05 → 0.05（小数保留合理精度）。
 * 与 fmtTokens 一样处理四舍五入进位（999.99B → 1T），适用于金额/Token 两类轴。
 */
export declare const fmtCompact: (n: number | undefined) => string;
//# sourceMappingURL=i18n.d.ts.map