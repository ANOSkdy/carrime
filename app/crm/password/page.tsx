import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { getCrmSession } from '@/lib/crm/session';
import { getCrmAccess } from '@/lib/crm/access';
import { CrmNavigation } from '@/components/crm/CrmNavigation';
import { PasswordForm } from './PasswordForm';

export default async function CrmPasswordPage() {
  const session = await getCrmSession();
  const access = getCrmAccess(session);
  if (access === 'anonymous' || access === 'forbidden') redirect('/crm/login');
  const initial = access === 'password-change';
  return (
    <AppShell title="CRM / パスワード変更" footer={<CrmNavigation />}>
      <section className="mx-auto my-10 max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{initial ? '初期パスワードを変更してください' : 'パスワード変更'}</h1>
        <p className="mt-2 text-sm text-gray-600">{initial ? 'CRMを利用する前に、新しいパスワードを設定してください。' : '新しいパスワードに変更すると、他のログインセッションは終了します。'}</p>
        <PasswordForm />
        {!initial ? <Link href="/crm" className="mt-5 block text-sm text-blue-700 underline">CRMへ戻る</Link> : null}
      </section>
    </AppShell>
  );
}
