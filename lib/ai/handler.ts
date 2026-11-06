import { generateContent } from './gemini';
import { AiError } from './errors';
import { buildAiPrompt } from './prompts';
import type { AiKind } from './contracts';
import { BodyReadError, readJsonBody } from '../http/read-json';
import { CORRELATION_HEADER, requestCorrelationId } from '../observability/correlation';
import { writeApiLog } from '../observability/api-log';

export async function handleAiRequest(request: Request, kind: AiKind, generate = generateContent): Promise<Response> {
  const start = performance.now();
  const correlationId = requestCorrelationId(request);
  const route = `/api/ai/${kind}`;
  let stage: 'request' | 'validation' | 'provider' | 'response' = 'request';
  const headers = { [CORRELATION_HEADER]: correlationId, 'Cache-Control': 'no-store' };
  try {
    const body = await readJsonBody(request, 200_000);
    stage = 'validation';
    const prompt = buildAiPrompt(kind, body);
    stage = 'provider';
    const result = await generate(prompt);
    stage = 'response';
    if (typeof result !== 'string' || !result.trim()) throw new AiError('AI_EMPTY_RESPONSE', 'AIから文章を取得できませんでした。再試行してください。', 502, true, 'response');
    writeApiLog({ event: 'api.completed', correlationId, route, method: 'POST', status: 200, durationMs: performance.now() - start, code: 'OK', stage, upstreamStatus: 200 });
    return Response.json({ result, correlationId }, { headers });
  } catch (error) {
    const failure = error instanceof AiError ? error : error instanceof BodyReadError
      ? new AiError(error.status === 413 ? 'INPUT_TOO_LARGE' : 'INVALID_REQUEST', error.status === 413 ? '入力が長すぎます。内容を短くして再試行してください。' : '入力データの形式を確認してください。', error.status, false, 'request')
      : new AiError('INTERNAL_ERROR', 'サーバーでエラーが発生しました。時間をおいて再試行してください。', 500, true, stage);
    writeApiLog({ event: 'api.completed', correlationId, route, method: 'POST', status: failure.status, durationMs: performance.now() - start, code: failure.code, stage: failure.stage, upstreamStatus: failure.upstreamStatus });
    return Response.json({
      // Keep the existing string error field for older deployed clients.
      error: failure.message, code: failure.code, message: failure.message, correlationId, retryable: failure.retryable,
    }, { status: failure.status, headers: { ...headers, ...(failure.status === 429 ? { 'Retry-After': '30' } : {}) } });
  }
}
