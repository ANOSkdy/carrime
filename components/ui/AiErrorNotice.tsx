import { Button } from './Button';
import type { ClientFailure } from '@/lib/ai/client';

export function AiErrorNotice({ error, onRetry, busy = false, preservesInput = true }: { error: ClientFailure | null; onRetry?: () => void; busy?: boolean; preservesInput?: boolean }) {
  if (!error) return null;
  return (
    <div role="alert" className="my-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p>{error.message}</p>
      {preservesInput && <p className="mt-1 text-xs">入力内容はそのまま保持されています。</p>}
      <p className="mt-1 break-all font-mono text-xs">お問い合わせID: {error.correlationId}</p>
      {error.retryable && onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={busy} className="mt-2 w-auto">もう一度試す</Button>
      )}
    </div>
  );
}
