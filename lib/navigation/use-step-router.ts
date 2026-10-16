'use client';

import { startTransition, addTransitionType } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const stepOf = (path: string | null | undefined) => {
  const n = parseInt(path?.split('/').pop() ?? '', 10);
  return Number.isNaN(n) ? null : n;
};

/**
 * useRouter の push / back を、進む・戻るの方向を View Transition に伝える形で包む。
 * 呼び出し側は useRouter と同じ書き方で使える。
 */
export function useStepRouter() {
  const router = useRouter();
  const pathname = usePathname();

  const withType = (type: 'nav-forward' | 'nav-back', action: () => void) => {
    startTransition(() => {
      addTransitionType(type);
      action();
    });
  };

  return {
    push: (href: string) => {
      const from = stepOf(pathname);
      const to = stepOf(href);
      const isBack = from !== null && to !== null && to < from;
      withType(isBack ? 'nav-back' : 'nav-forward', () => router.push(href));
    },
    back: () => withType('nav-back', () => router.back()),
    refresh: () => router.refresh(),
  };
}
