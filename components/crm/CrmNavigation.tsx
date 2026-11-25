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
    <nav aria-label="CRMアカウント" className="space-y-1.5">
      {error ? <p role="alert" className="text-right text-sm text-red-600">{error}</p> : null}
      <div className="flex items-center justify-end gap-2 text-sm">
        <Link
          href="/crm/password"
          className="inline-flex min-h-9 items-center rounded-md px-3 text-blue-700 transition-colors hover:bg-blue-50/40 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          パスワード変更
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          className="inline-flex min-h-9 items-center rounded-md border border-gray-300 bg-white px-4 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {pending ? 'ログアウト中…' : 'ログアウト'}
        </button>
      </div>
    </nav>
  );
}
