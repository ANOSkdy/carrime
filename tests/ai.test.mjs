import './helpers/register-ts.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { handleAiRequest } = await import('../lib/ai/handler.ts');
const { requestAi, AiClientError } = await import('../lib/ai/client.ts');
const { generateContent } = await import('../lib/ai/gemini.ts');
const { newCorrelationId, isCorrelationId } = await import('../lib/observability/correlation.ts');
const { POST: collect } = await import('../app/api/telemetry/ai/route.ts');
const { loadAiInputs } = await import('../lib/storage/ai-inputs.ts');

const privateMarker = 'PRIVATE-INPUT-DO-NOT-LOG-97531';
const route = '/api/ai/selfpr';
const request = (body, id = newCorrelationId()) => new Request(`https://www.carrime.app${route}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-correlation-id': id }, body: JSON.stringify(body),
});
function captureLogs(t) {
  const rows = [];
  for (const level of ['info', 'warn', 'error']) t.mock.method(console, level, (line) => rows.push(JSON.parse(line)));
  return rows;
}

test('AI success retains result compatibility, returns the correlation ID and logs only metadata', async (t) => {
  const logs = captureLogs(t);
  const id = newCorrelationId();
  const res = await handleAiRequest(request({ experience: privateMarker, strengths: ['改善'] }, id), 'selfpr', async (prompt) => {
    assert.ok(prompt.includes(privateMarker));
    return '架空の生成結果';
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { result: '架空の生成結果', correlationId: id });
  assert.equal(res.headers.get('x-correlation-id'), id);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(logs[0].correlationId, id);
  assert.equal(logs[0].upstreamStatus, 200);
  assert.ok(logs[0].durationMs >= 0);
  assert.ok(!JSON.stringify(logs).includes(privateMarker));
});

test('AI rejects invalid/empty/wrong-type JSON and oversized requests without calling the provider', async (t) => {
  captureLogs(t);
  const generate = t.mock.fn();
  for (const body of [{}, [], null, { experience: 42 }, { experience: ' ' }, { experience: 'test', strengths: [42] }]) {
    const res = await handleAiRequest(request(body), 'selfpr', generate);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'INVALID_INPUT');
  }
  const malformed = new Request('https://www.carrime.app'+route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal((await handleAiRequest(malformed, 'selfpr', generate)).status, 400);
  assert.equal((await handleAiRequest(request({ experience: 'x'.repeat(200_001) }), 'selfpr', generate)).status, 413);
  assert.equal(generate.mock.callCount(), 0);
});

test('unhandled exceptions are 500 and neither responses nor logs expose exception messages', async (t) => {
  const logs = captureLogs(t);
  const res = await handleAiRequest(request({ experience: privateMarker }), 'selfpr', async () => { throw new Error(privateMarker); });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.code, 'INTERNAL_ERROR');
  assert.ok(isCorrelationId(body.correlationId));
  assert.ok(!JSON.stringify([body, logs]).includes(privateMarker));
});

test('actual Gemini SDK error statuses map to safe responses, with one generation attempt only', async (t) => {
  const logs = captureLogs(t);
  process.env.GEMINI_API_KEY = 'synthetic-in-memory-test-only';
  process.env.GEMINI_MODEL = 'test-model';
  const cases = [
    [400, 502, 'AI_REQUEST_REJECTED'], [401, 502, 'AI_AUTH_ERROR'], [403, 502, 'AI_AUTH_ERROR'],
    [404, 502, 'AI_MODEL_ERROR'], [402, 503, 'AI_QUOTA_EXCEEDED'], [429, 429, 'AI_RATE_LIMITED'],
    [500, 502, 'AI_UPSTREAM_ERROR'], [502, 502, 'AI_UPSTREAM_ERROR'], [503, 503, 'AI_UNAVAILABLE'], [504, 504, 'AI_TIMEOUT'],
  ];
  let calls = 0;
  for (const [upstream, expected, code] of cases) {
    t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ error: { message: privateMarker, details: [{ secret: privateMarker }] } }, { status: upstream }); });
    const res = await handleAiRequest(request({ experience: privateMarker }), 'selfpr');
    const body = await res.json();
    assert.equal(res.status, expected);
    assert.equal(body.code, code);
    assert.equal(logs.at(-1).upstreamStatus, upstream);
    assert.ok(!JSON.stringify([body, logs]).includes(privateMarker));
  }
  assert.equal(calls, cases.length);
});

test('missing Gemini configuration, empty/blocked outputs and transport failures stay distinguishable', async (t) => {
  captureLogs(t);
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(generateContent(privateMarker), { code: 'AI_NOT_CONFIGURED', stage: 'configuration' });
  process.env.GEMINI_API_KEY = oldKey || 'synthetic-in-memory-test-only';
  process.env.GEMINI_MODEL = 'test-model';
  t.mock.method(globalThis, 'fetch', async () => Response.json({ candidates: [] }));
  await assert.rejects(generateContent(privateMarker), { code: 'AI_EMPTY_RESPONSE' });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }));
  await assert.rejects(generateContent(privateMarker), { code: 'AI_OUTPUT_BLOCKED' });
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError(privateMarker); });
  await assert.rejects(generateContent(privateMarker), { code: 'AI_UPSTREAM_ERROR' });
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException(privateMarker, 'AbortError'); });
  await assert.rejects(generateContent(privateMarker), { code: 'AI_TIMEOUT' });
});

test('client checks 400/429/500/502/503, parses non-JSON separately and never displays unsafe server messages', async (t) => {
  for (const status of [400, 429, 500, 502, 503]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: privateMarker }, { status }));
    await assert.rejects(requestAi(route, {}), (e) => e instanceof AiClientError && e.status === status && e.code === 'CLIENT_HTTP_ERROR' && !e.message.includes(privateMarker));
    t.mock.method(globalThis, 'fetch', async () => new Response('<html>proxy error</html>', { status }));
    await assert.rejects(requestAi(route, {}), (e) => e.code === 'CLIENT_NON_JSON_RESPONSE' && e.status === status);
  }
  for (const payload of [null, [], {}, { result: 42 }, { result: '' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
    await assert.rejects(requestAi(route, {}), { code: 'CLIENT_INVALID_RESPONSE' });
  }
});

test('client network failure can be retried explicitly without mutating the supplied input', async (t) => {
  const payload = Object.freeze({ experience: privateMarker });
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError(privateMarker); });
  await assert.rejects(requestAi(route, payload), { code: 'CLIENT_NETWORK_ERROR', retryable: true });
  let id;
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    id = options.headers['x-correlation-id'];
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json({ result: '再試行成功', correlationId: id });
  });
  assert.equal(await requestAi(route, payload), '再試行成功');
  assert.ok(isCorrelationId(id));
  assert.equal(payload.experience, privateMarker);
});

test('client timeout and interrupted response body remain network failures rather than JSON failures', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async (_, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Synthetic timeout', 'AbortError')));
  }));
  const pending = requestAi(route, {});
  const checked = assert.rejects(pending, { code: 'CLIENT_TIMEOUT', retryable: true });
  t.mock.timers.tick(55_001);
  await checked;
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { controller.error(new TypeError(privateMarker)); },
  })));
  await assert.rejects(requestAi(route, {}), { code: 'CLIENT_NETWORK_ERROR', retryable: true });
});

test('untrusted incoming correlation text is replaced without appearing in logs', async (t) => {
  const logs = captureLogs(t);
  const res = await handleAiRequest(request({ experience: 'test' }, privateMarker), 'selfpr', async () => 'synthetic');
  const body = await res.json();
  assert.ok(isCorrelationId(body.correlationId));
  assert.ok(!JSON.stringify(logs).includes(privateMarker));
});

test('telemetry validates origin, bounded schema and IDs; stores client and server events separately', async (t) => {
  const logs = captureLogs(t);
  const id = newCorrelationId();
  const body = { route, code: 'CLIENT_NETWORK_ERROR', correlationId: id };
  const report = (value, origin = 'https://www.carrime.app') => new Request('https://www.carrime.app/api/telemetry/ai', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(value),
  });
  assert.equal((await collect(report(body))).status, 204);
  assert.equal(logs[0].event, 'client.ai_failed');
  assert.equal(logs[0].stage, 'network');
  assert.equal(logs[0].correlationId, id);
  assert.equal((await collect(report(body, 'https://untrusted.example.test'))).status, 403);
  for (const value of [{ ...body, input: privateMarker }, { ...body, code: privateMarker }, { ...body, route: privateMarker }, { ...body, correlationId: privateMarker }]) {
    assert.equal((await collect(report(value))).status, 400);
  }
  assert.equal(logs.length, 1);
  assert.ok(!JSON.stringify(logs).includes(privateMarker));
});

test('stored inputs and legacy keys survive failed/corrupt reads without deletion', (t) => {
  const map = new Map();
  const storage = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage; });
  assert.equal(loadAiInputs().status, 'missing');
  map.set('aidesu_ai_inputs', JSON.stringify({ pr_summary: '強み', episode: privateMarker }));
  assert.equal(loadAiInputs().status, 'ready');
  assert.ok(map.has('aidesu_ai_inputs'));
  map.set('carrime_ai_inputs', '{');
  assert.equal(loadAiInputs().status, 'invalid');
  assert.equal(map.get('carrime_ai_inputs'), '{');
});
