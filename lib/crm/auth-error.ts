import { isCorrelationId } from '../observability/correlation';

export function authErrorMessage(error: unknown, fallback: string): string {
  const row = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const message = row.code === 'INVALID_ORIGIN' ? 'アクセス先のURLと認証設定が一致していません。管理者へお問い合わせください。'
    : row.status === 429 ? '試行回数が多すぎます。しばらく待ってからお試しください。'
      : typeof row.status === 'number' && row.status >= 500 ? '認証サーバーでエラーが発生しました。時間をおいて再度お試しください。' : fallback;
  return isCorrelationId(row.correlationId) ? `${message} お問い合わせID: ${row.correlationId}` : message;
}
