import { GoogleGenerativeAIAbortError, GoogleGenerativeAIResponseError } from '@google/generative-ai';

export type AiStage = 'request' | 'validation' | 'configuration' | 'provider' | 'response';

export class AiError extends Error {
  code: string;
  status: number;
  retryable: boolean;
  stage: AiStage;
  upstreamStatus?: number;

  constructor(code: string, message: string, status: number, retryable: boolean, stage: AiStage, upstreamStatus?: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.stage = stage;
    this.upstreamStatus = upstreamStatus;
  }
}

export function providerError(error: unknown): AiError {
  // Only consume numeric status/name. Never expose/log the raw SDK message,
  // stack, errorDetails, response, or cause (which may include private text).
  const info = error && typeof error === 'object' ? error as { status?: unknown; name?: unknown } : {};
  const status = typeof info.status === 'number' ? info.status : undefined;
  if (status === 429) return new AiError('AI_RATE_LIMITED', 'AIへのアクセスが集中しています。少し時間をおいて再試行してください。', 429, true, 'provider', status);
  if (status === 402) return new AiError('AI_QUOTA_EXCEEDED', '現在AI生成を利用できません。時間をおいても解消しない場合はお問い合わせください。', 503, false, 'provider', status);
  if (status === 401 || status === 403) return new AiError('AI_AUTH_ERROR', 'AIとの接続設定に問題があります。管理者へお問い合わせください。', 502, false, 'provider', status);
  if (status === 404) return new AiError('AI_MODEL_ERROR', 'AIのモデル設定に問題があります。管理者へお問い合わせください。', 502, false, 'provider', status);
  if (status === 400) return new AiError('AI_REQUEST_REJECTED', 'AIが入力内容を処理できませんでした。入力を確認して再試行してください。', 502, false, 'provider', status);
  if (status === 503) return new AiError('AI_UNAVAILABLE', 'AIサービスが一時的に利用できません。少し時間をおいて再試行してください。', 503, true, 'provider', status);
  if (status === 504 || error instanceof GoogleGenerativeAIAbortError || info.name === 'AbortError' || info.name === 'TimeoutError') {
    return new AiError('AI_TIMEOUT', 'AIの応答に時間がかかっています。少し時間をおいて再試行してください。', 504, true, 'provider', status);
  }
  if (error instanceof GoogleGenerativeAIResponseError) return new AiError('AI_OUTPUT_BLOCKED', 'AIが文章を生成できませんでした。入力内容を確認して再試行してください。', 422, false, 'provider', status);
  return new AiError('AI_UPSTREAM_ERROR', 'AIとの通信に失敗しました。少し時間をおいて再試行してください。', 502, true, 'provider', status);
}
