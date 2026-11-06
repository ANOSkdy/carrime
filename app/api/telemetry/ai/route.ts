import { readJsonBody } from '@/lib/http/read-json';
import { writeApiLog } from '@/lib/observability/api-log';
import { isCorrelationId } from '@/lib/observability/correlation';
import { AI_ROUTES } from '@/lib/ai/contracts';

export const runtime = 'nodejs';
const allowedCodes = new Set([
  'CLIENT_NETWORK_ERROR', 'CLIENT_TIMEOUT', 'CLIENT_NON_JSON_RESPONSE', 'CLIENT_INVALID_RESPONSE', 'CLIENT_HTTP_ERROR',
  'CLIENT_STORAGE_ERROR', 'INVALID_INPUT', 'INVALID_REQUEST', 'INPUT_TOO_LARGE', 'AI_NOT_CONFIGURED', 'AI_AUTH_ERROR',
  'AI_MODEL_ERROR', 'AI_QUOTA_EXCEEDED', 'AI_REQUEST_REJECTED', 'AI_RATE_LIMITED', 'AI_UNAVAILABLE', 'AI_TIMEOUT',
  'AI_EMPTY_RESPONSE', 'AI_OUTPUT_BLOCKED', 'AI_UPSTREAM_ERROR', 'INTERNAL_ERROR',
]);

export async function POST(request: Request) {
  // No CORS and no body/URL echo. Browser reports are untrusted diagnostic hints,
  // separate from authoritative API events. Reject cross-site form submissions.
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return new Response(null, { status: 403 });
  }
  try {
    const body = await readJsonBody(request, 1024);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return new Response(null, { status: 400 });
    const row = body as Record<string, unknown>;
    const { route, code, correlationId, status } = row;
    if (Object.keys(row).some((key) => !['route', 'code', 'correlationId', 'status'].includes(key)) ||
      !AI_ROUTES.includes(route as typeof AI_ROUTES[number]) || typeof code !== 'string' || !allowedCodes.has(code) ||
      !isCorrelationId(correlationId) || (status !== undefined && (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599))) {
      return new Response(null, { status: 400 });
    }
    writeApiLog({ event: 'client.ai_failed', correlationId, route: route as string, method: 'POST',
      status: typeof status === 'number' ? status : 0, durationMs: 0, code,
      stage: code === 'CLIENT_STORAGE_ERROR' ? 'storage' : code === 'CLIENT_NETWORK_ERROR' || code === 'CLIENT_TIMEOUT' ? 'network'
        : code === 'INVALID_INPUT' && status === undefined ? 'validation' : 'response' });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
