'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { crmAuthClient } from '@/lib/crm/auth-client';
import { authErrorMessage } from '@/lib/crm/auth-error';

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const result = await crmAuthClient.signIn.email({
        email: String(form.get('email') ?? '').trim(),
        password: String(form.get('password') ?? ''),
        rememberMe: false,
      });
      if (result.error) {
        setError(authErrorMessage(result.error, 'ログインできませんでした。メールアドレスとパスワードを確認してください。'));
        setPending(false);
        return;
      }
      window.location.replace('/crm');
    } catch {
      setError('通信に失敗しました。時間をおいて再度お試しください。');
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={pending}>
      <div>
        <label htmlFor="crm-email" className="mb-1 block text-sm font-medium">メールアドレス</label>
        <input id="crm-email" name="email" type="email" autoComplete="username" required maxLength={254} className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2" />
      </div>
      <div>
        <label htmlFor="crm-password" className="mb-1 block text-sm font-medium">パスワード</label>
        <input id="crm-password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2" />
      </div>
      {error ? <p role="alert" className="break-words text-sm text-red-600">{error}</p> : null}
      <Button type="submit" isLoading={pending}>ログイン</Button>
    </form>
  );
}
