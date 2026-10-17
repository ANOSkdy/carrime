import type { CSSProperties } from 'react';

/** 時間差アニメーション用に CSS 変数 --i を返す。上限を超えた要素は同時に表示する */
export const stagger = (index: number, max = 12): CSSProperties =>
  ({ '--i': Math.min(index, max) }) as CSSProperties;
