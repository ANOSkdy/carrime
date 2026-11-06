import { CORRELATION_HEADER, isCorrelationId, newCorrelationId } from '../observability/correlation';
import { AI_ROUTES } from './contracts';

export type AiRoute = typeof AI_ROUTES[number];
export type ClientFailure = {
  code: string;
  message: string;
  correlationId: string;
  retryable: boolean;
  status?: number;
};

export class AiClientError extends Error implements ClientFailure {
  code: string;
  correlationId: string;
  retryable: boolean;
  status?: number;
  constructor(failure: ClientFailure) {
    super(failure.message);
    this.code = failure.code;
    this.correlationId = failure.correlationId;
    this.retryable = failure.retryable;
    this.status = failure.status;
  }
}

const httpMessage = (status: number) => status === 429
  ? 'AIへのアクセスが集中しています。少し時間をおいて再試行してください。'
  : status === 400 || status === 413 || status === 415 || status === 422
    ? '入力内容を確認して、もう一度生成してください。'
    : status === 401 || status === 403
      ? 'この環境でAI生成を利用できません。ページのURLを確認してください。'
      : 'サーバーとの通信に失敗しました。時間をおいて再試行してください。';

// Do not display arbitrary proxy/provider messages returned by another server.
const serverMessages: Record<string, string> = {
  INVALID_INPUT: '生成に必要な入力が不足しています。前の画面で入力を確認してください。',
  INVALID_REQUEST: '入力データの形式を確認してください。',
  INPUT_TOO_LARGE: '入力が長すぎます。内容を短くして再試行してください。',
  AI_NOT_CONFIGURED: 'AI生成の設定に問題があります。管理者へお問い合わせください。',
  AI_AUTH_ERROR: 'AIとの接続設定に問題があります。管理者へお問い合わせください。',
  AI_MODEL_ERROR: 'AIのモデル設定に問題があります。管理者へお問い合わせください。',
  AI_QUOTA_EXCEEDED: '現在AI生成を利用できません。時間をおいても解消しない場合はお問い合わせください。',
  AI_REQUEST_REJECTED: 'AIが入力内容を処理できませんでした。入力を確認してください。',
  AI_RATE_LIMITED: httpMessage(429),
  AI_UNAVAILABLE: 'AIサービスが一時的に利用できません。時間をおいて再試行してください。',
  AI_TIMEOUT: 'AIの応答に時間がかかっています。少し時間をおいて再試行してください。',
  AI_EMPTY_RESPONSE: 'AIから文章を取得できませんでした。再試行してください。',
  AI_OUTPUT_BLOCKED: 'AIが文章を生成できませんでした。入力内容を確認してください。',
  AI_UPSTREAM_ERROR: 'AIとの通信に失敗しました。少し時間をおいて再試行してください。',
  INTERNAL_ERROR: 'サーバーでエラーが発生しました。時間をおいて再試行してください。',
};

export function reportClientFailure(route: AiRoute, failure: ClientFailure): void {
  // Best effort, no recursive reporting/retries. No prompt, input, URL, stack,
  // exception message, cookie, or user agent is sent to the collector.
  if (typeof window === 'undefined') return;
  void fetch('/api/telemetry/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ route, correlationId: failure.correlationId, code: failure.code, status: failure.status }),
  }).catch(() => {});
}

export async function requestAi(route: AiRoute, payload: unknown): Promise<string> {
  let correlationId = newCorrelationId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  let status: number | undefined;
  try {
    let response: Response;
    try {
      response = await fetch(route, {
        method: 'POST', headers: { 'Content-Type': 'application/json', [CORRELATION_HEADER]: correlationId },
        body: JSON.stringify(payload), signal: controller.signal,
      });
    } catch {
      throw new AiClientError({ code: controller.signal.aborted ? 'CLIENT_TIMEOUT' : 'CLIENT_NETWORK_ERROR',
        message: controller.signal.aborted ? '通信がタイムアウトしました。少し時間をおいて再試行してください。' : '通信できませんでした。インターネット接続を確認して再試行してください。',
        correlationId, retryable: true });
    }
    status = response.status;
    const headerId = response.headers.get(CORRELATION_HEADER);
    if (isCorrelationId(headerId)) correlationId = headerId;
    let data: unknown;
    let responseText: string;
    try { responseText = await response.text(); }
    catch {
      throw new AiClientError({ code: controller.signal.aborted ? 'CLIENT_TIMEOUT' : 'CLIENT_NETWORK_ERROR',
        message: '応答の受信中に通信が途切れました。接続を確認して再試行してください。', correlationId, status, retryable: true });
    }
    try { data = JSON.parse(responseText); }
    catch {
      throw new AiClientError({ code: 'CLIENT_NON_JSON_RESPONSE',
        message: response.ok ? 'サーバーの応答を読み取れませんでした。再試行してください。' : `${httpMessage(status)}（応答形式エラー）`,
        correlationId, status, retryable: response.ok || status === 429 || status >= 500 });
    }
    const body = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
    if (isCorrelationId(body.correlationId)) correlationId = body.correlationId;
    if (!response.ok) {
      const code = typeof body.code === 'string' && Object.hasOwn(serverMessages, body.code) ? body.code : 'CLIENT_HTTP_ERROR';
      throw new AiClientError({ code, message: serverMessages[code] || httpMessage(status), correlationId, status,
        retryable: typeof body.retryable === 'boolean' && code !== 'CLIENT_HTTP_ERROR' ? body.retryable : status === 429 || status >= 500 });
    }
    if (typeof body.result !== 'string' || !body.result.trim()) {
      throw new AiClientError({ code: 'CLIENT_INVALID_RESPONSE', message: 'AIの生成結果を読み取れませんでした。再試行してください。', correlationId, status, retryable: true });
    }
    return body.result;
  } catch (error) {
    const failure = error instanceof AiClientError ? error : new AiClientError({ code: 'CLIENT_INVALID_RESPONSE', message: 'AIの応答を処理できませんでした。再試行してください。', correlationId, status, retryable: true });
    reportClientFailure(route, failure);
    throw failure;
  } finally {
    clearTimeout(timer);
  }
}
