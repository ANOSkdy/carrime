import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getCrmSession } from '@/lib/crm/session';
import { getCrmAccess } from '@/lib/crm/access';
import { LoginForm } from './LoginForm';

export default async function CrmLoginPage() {
  const access = getCrmAccess(await getCrmSession());
  if (access === 'allowed') redirect('/crm');
  if (access === 'password-change') redirect('/crm/password');
  return (
    <AppShell title="CRM / 管理者ログイン">
      <section className="mx-auto my-10 max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">管理者ログイン</h1>
        <p className="mt-2 text-sm text-gray-600">CRMの閲覧には管理者アカウントが必要です。</p>
        <LoginForm />
      </section>
    </AppShell>
  );
}
