import 'server-only';

import { Resend } from 'resend';

const getRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const describeProviderError = (error: unknown): string => {
  if (!error || typeof error !== 'object') return 'Unknown Resend error';

  const providerError = error as { name?: unknown; message?: unknown; statusCode?: unknown };
  const name = typeof providerError.name === 'string' ? providerError.name : 'ResendError';
  const statusCode =
    typeof providerError.statusCode === 'number' || typeof providerError.statusCode === 'string'
      ? ` status=${providerError.statusCode}`
      : '';
  const message = typeof providerError.message === 'string' ? providerError.message : 'Email delivery failed';
  return `${name}${statusCode}: ${message}`;
};

export async function sendResumeStep5Notification(resumeId: string): Promise<void> {
  const apiKey = getRequiredEnv('RESEND_API_KEY');
  const from = getRequiredEnv('RESEND_FROM');
  const to = getRequiredEnv('RESEND_ADMIN_TO');
  const appBaseUrl = getRequiredEnv('APP_BASE_URL').replace(/\/+$/, '');
  const cc = process.env.RESEND_ADMIN_CC?.trim() || undefined;
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send(
    {
      from,
      to,
      ...(cc ? { cc } : {}),
      subject: '新たな履歴書が作成されました。',
      text: `Carrimeにてユーザーが履歴書を作成しました。\n\n以下リンクより詳細を確認できます。\n\n${appBaseUrl}/crm`,
    },
    { idempotencyKey: `resume-step5:${resumeId}` }
  );

  if (error) {
    throw new Error(describeProviderError(error));
  }
  if (!data?.id || typeof data.id !== 'string') {
    throw new Error('Resend response did not include a valid email ID');
  }
}
