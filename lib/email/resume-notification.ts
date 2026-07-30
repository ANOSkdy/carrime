import 'server-only';

import { Resend } from 'resend';

const getRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export async function sendResumeStep5Notification(resumeId: string): Promise<void> {
  const resend = new Resend(getRequiredEnv('RESEND_API_KEY'));
  const from = getRequiredEnv('RESEND_FROM');
  const to = getRequiredEnv('RESEND_ADMIN_TO');
  const cc = process.env.RESEND_ADMIN_CC?.trim() || undefined;
  const appBaseUrl = getRequiredEnv('APP_BASE_URL').replace(/\/+$/, '');

  const { error } = await resend.emails.send(
    {
      from,
      to,
      ...(cc ? { cc } : {}),
      subject: '新たな履歴書が作成されました。',
      text: [
        'Carrimeにてユーザーが履歴書を作成しました。',
        '以下リンクより詳細を確認できます。',
        `${appBaseUrl}/crm`,
      ].join('\n'),
    },
    { idempotencyKey: `resume-step5:${resumeId}` }
  );

  if (error) {
    throw new Error(`Resend notification failed (${error.name})`);
  }
}
