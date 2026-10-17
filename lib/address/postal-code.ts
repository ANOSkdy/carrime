const FULLWIDTH_DIGITS = /[０-９]/g;

/** 全角数字・ハイフン類を除去し、半角数字のみにする */
export const normalizePostalCode = (value: string): string =>
  value
    .replace(FULLWIDTH_DIGITS, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '');

export const isCompletePostalCode = (value: string): boolean => normalizePostalCode(value).length === 7;
