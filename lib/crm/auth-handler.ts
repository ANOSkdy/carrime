import { CORRELATION_HEADER, requestCorrelationId } from '../observability/correlation';
import { writeApiLog } from '../observability/api-log';

const loggedPaths = new Set(['sign-in/email', 'sign-out', 'get-session', 'change-password', 'ok']);
const loggedCodes = new Set(['INVALID_ORIGIN', 'INVALID_EMAIL_OR_PASSWORD', 'UNAUTHORIZED', 'TOO_MANY_REQUESTS', 'VALIDATION_ERROR']);

export async function handleCrmAuthRequest(request: Request, handle: () => Promise<Response>) {
  const start = performance.now();
  const correlationId = requestCorrelationId(request);
  const suffix = new URL(request.url).pathname.replace(/^\/api\/crm-auth\//, '');
  const route = `/api/crm-auth/${loggedPaths.has(suffix) ? suffix : 'other'}`;
  let response: Response;
  let code = 'OK';
  try {
    response = await handle();
    if (response.status >= 400) {
      code = 'AUTH_REJECTED';
      let responseCode = code;
      try {
        const body = await response.clone().json();
        // Better Auth callers may depend on codes beyond the logged subset.
        if (typeof body.code === 'string' && /^[A-Z_]{1,80}$/.test(body.code)) responseCode = body.code;
        if (loggedCodes.has(body.code)) code = body.code;
      } catch { /* Never log response text. */ }
      if (response.status >= 500) { code = 'AUTH_INTERNAL_ERROR'; responseCode = code; }
      const message = response.status >= 500 ? '認証処理でエラーが発生しました。管理者へお問い合わせください。'
        : responseCode === 'INVALID_ORIGIN' ? 'アクセス先のURLと認証設定が一致していません。管理者へお問い合わせください。'
          : response.status === 429 ? '試行回数が多すぎます。時間をおいて再試行してください。' : '認証に失敗しました。入力内容を確認してください。';
      response = Response.json({ code: responseCode, message, correlationId }, { status: response.status, headers: response.headers });
    }
  } catch {
    code = 'AUTH_INTERNAL_ERROR';
    response = Response.json({ code, message: '認証処理でエラーが発生しました。管理者へお問い合わせください。', correlationId }, { status: 500 });
  }
  writeApiLog({ event: 'crm.auth_completed', correlationId, route, method: request.method === 'GET' ? 'GET' : 'POST',
    status: response.status, durationMs: performance.now() - start, code, stage: 'auth' });
  response.headers.set(CORRELATION_HEADER, correlationId);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
