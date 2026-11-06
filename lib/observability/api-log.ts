export type ApiLogEvent = {
  event: 'api.completed' | 'client.ai_failed' | 'crm.auth_completed';
  correlationId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  code: string;
  stage: 'request' | 'validation' | 'configuration' | 'provider' | 'response' | 'network' | 'storage' | 'auth';
  upstreamStatus?: number;
};

export function writeApiLog(event: ApiLogEvent) {
  // Explicit projection: never spread request bodies, errors, headers, or SDK
  // responses here. Exception messages can contain prompts or credentials.
  const row = {
    timestamp: new Date().toISOString(),
    event: event.event,
    correlationId: event.correlationId,
    route: event.route,
    method: event.method,
    status: event.status,
    durationMs: Math.max(0, Math.round(event.durationMs)),
    code: event.code,
    stage: event.stage,
    upstreamStatus: event.upstreamStatus,
    environment: process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  };
  const line = JSON.stringify(row);
  if (event.status >= 500) console.error(line);
  else if (event.status >= 400 || event.event === 'client.ai_failed') console.warn(line);
  else console.info(line);
}
