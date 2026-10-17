'use client';

import { ViewTransition } from 'react';

/** ステップ切替時に、進む/戻るに応じたスライド+フェードを適用する */
export function StepTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ 'nav-forward': 'step-enter-forward', 'nav-back': 'step-enter-back', default: 'none' }}
      exit={{ 'nav-forward': 'step-exit-forward', 'nav-back': 'step-exit-back', default: 'none' }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
