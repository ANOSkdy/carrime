import './helpers/register-ts.mjs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  if (specifier === 'next/server') return next('next/server.js', context);
  return next(specifier, context);
} });
const api = await import('../app/api/data/resume/route.ts');
function setup(t) {
  t.mock.property(process, 'env', { ...process.env, DATABASE_URL_UNPOOLED: 'postgresql://fixture:secret@db.example.test/test' });
  const logs = [];
  for (const level of ['info', 'warn', 'error']) t.mock.method(console, level, line => logs.push(JSON.parse(line)));
  return logs;
}
test('data API rejects malformed/invalid input with zero DB calls and safe correlation logs', async t => {
  const logs = setup(t);
  const call = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not access database'); });
  for (const body of ['{', JSON.stringify({ self_pr: 'PRIVATE-INPUT' })]) {
    const response = await api.PATCH(new Request('https://www.carrime.app/api/data/resume', { method: 'PATCH', body }));
    assert.equal(response.status, 400);
    const result = await response.json();
    assert.equal(result.correlationId, response.headers.get('x-correlation-id'));
  }
  assert.equal(call.mock.callCount(), 0);
  assert.ok(logs.every(log => log.dbRequests === 0 && log.code === 'INVALID_INPUT'));
  assert.ok(!JSON.stringify(logs).includes('PRIVATE-INPUT'));
});
test('provider JSON failures and invalid stored rows are server failures, never input errors', async t => {
  const logs = setup(t);
  const call = t.mock.method(globalThis, 'fetch', async () => new Response('PRIVATE-NON-JSON', { status: 200 }));
  for (const payload of ['non-json', 'invalid-row']) {
    if (payload === 'invalid-row') call.mock.mockImplementation(async () => Response.json({ rows: [{ first_name_kanji: 'PRIVATE-STORED-NAME' }] }));
    const response = await api.GET(new Request('https://www.carrime.app/api/data/resume?id=res_fixture&view=profile'));
    assert.equal(response.status, 500);
    assert.ok(!(await response.text()).includes('PRIVATE'));
  }
  assert.ok(logs.every(log => log.dbRequests === 1 && log.code === 'DATA_REQUEST_FAILED'));
  assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
});
test('self PR view returns only requested data and logs a single DB HTTP call', async t => {
  const logs = setup(t);
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query } = JSON.parse(options.body);
    assert.match(query, /select resume_id, self_pr from/);
    assert.ok(!query.includes('resume_works'));
    return Response.json({ rows: [{ resume_id: 'res_fixture', self_pr: 'PRIVATE-SELF-PR' }] });
  });
  const response = await api.GET(new Request('https://www.carrime.app/api/data/resume?id=res_fixture&view=selfpr'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { resume: { resume_id: 'res_fixture', self_pr: 'PRIVATE-SELF-PR' } });
  assert.equal(logs[0].dbRequests, 1);
  assert.equal(logs[0].correlationId, response.headers.get('x-correlation-id'));
  assert.ok(!JSON.stringify(logs).includes('PRIVATE-SELF-PR'));
});
