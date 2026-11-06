'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { crmAuthClient } from '@/lib/crm/auth-client';
import { authErrorMessage } from '@/lib/crm/auth-error';

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    if (newPassword !== form.get('confirmation')) { setError('新しいパスワードが一致しません。'); return; }
    if (currentPassword === newPassword) { setError('現在とは異なるパスワードを設定してください。'); return; }
    setPending(true);
    setError('');
    try {
      const result = await crmAuthClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) {
        setError(authErrorMessage(result.error, '変更できませんでした。現在のパスワードと入力内容を確認してください。'));
        setPending(false);
        return;
      }
      window.location.replace('/crm');
    } catch {
      setError('通信に失敗しました。時間をおいて再度お試しください。');
      setPending(false);
    }
  };

  const fields = [
    { name: 'currentPassword', label: '現在のパスワード', autoComplete: 'current-password', minLength: undefined },
    { name: 'newPassword', label: '新しいパスワード（12文字以上）', autoComplete: 'new-password', minLength: 12 },
    { name: 'confirmation', label: '新しいパスワード（確認）', autoComplete: 'new-password', minLength: 12 },
  ];
  return (
    <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={pending}>
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={`crm-${field.name}`} className="mb-1 block text-sm font-medium">{field.label}</label>
          <input id={`crm-${field.name}`} name={field.name} type="password" autoComplete={field.autoComplete} required minLength={field.minLength} maxLength={128} className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2" />
        </div>
      ))}
      {error ? <p role="alert" className="break-words text-sm text-red-600">{error}</p> : null}
      <Button type="submit" isLoading={pending}>パスワードを変更</Button>
    </form>
  );
}
