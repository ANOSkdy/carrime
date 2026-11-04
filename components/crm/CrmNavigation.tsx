'use client';

import Link from 'next/link';
import { useState } from 'react';
import { crmAuthClient } from '@/lib/crm/auth-client';

export function CrmNavigation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const signOut = async () => {
    setPending(true);
    setError('');
    try {
      const result = await crmAuthClient.signOut();
      if (result.error) throw new Error('Sign out failed');
      window.location.replace('/crm/login');
    } catch {
      setError('ログアウトできませんでした。再度お試しください。');
      setPending(false);
    }
  };

  return (
    <nav aria-label="CRMアカウント" className="space-y-2">
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="flex items-center justify-between gap-4 text-sm">
        <Link href="/crm/password" className="rounded px-2 py-2 text-blue-700 underline focus-visible:outline-2">パスワード変更</Link>
        <button type="button" onClick={signOut} disabled={pending} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 font-medium disabled:opacity-50">
          {pending ? 'ログアウト中…' : 'ログアウト'}
        </button>
      </div>
    </nav>
  );
}
