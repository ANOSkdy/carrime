import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CrmNavigation } from './CrmNavigation';

export function CrmShell({ title, children }: { title: string; children: ReactNode }) {
  return <AppShell title={title} footer={<CrmNavigation />}>{children}</AppShell>;
}
