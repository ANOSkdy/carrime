import './helpers/register-ts.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { handleCrmAuthRequest } = await import('../lib/crm/auth-handler.ts');
const { authErrorMessage } = await import('../lib/crm/auth-error.ts');

test('auth logging tracks rejection code/correlation while keeping cookies, inputs and errors private', async (t) => {
  const logs = [];
  t.mock.method(console, 'warn', (line) => logs.push(JSON.parse(line)));
  t.mock.method(console, 'error', (line) => logs.push(JSON.parse(line)));
  const req = new Request('https://www.carrime.app/api/crm-auth/sign-in/email', { method: 'POST' });
  const res = await handleCrmAuthRequest(req, async () => Response.json({ code: 'INVALID_ORIGIN', message: 'PRIVATE-DATA' }, { status: 403 }));
  assert.equal(res.status, 403);
  assert.equal(logs[0].code, 'INVALID_ORIGIN');
  assert.equal(res.headers.get('x-correlation-id'), logs[0].correlationId);
  assert.equal((await res.json()).correlationId, logs[0].correlationId);
  assert.ok(!JSON.stringify(logs).includes('PRIVATE-DATA'));
  const failed = await handleCrmAuthRequest(req, async () => { throw new Error('PRIVATE-DATA'); });
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes('PRIVATE-DATA'));
  assert.ok(!JSON.stringify(logs).includes('PRIVATE-DATA'));
});

test('auth errors keep status/code/retry headers, mask internal 500 bodies and display safe support IDs', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  const req = new Request('https://www.carrime.app/api/crm-auth/sign-in/email', { method: 'POST' });
  const bad = await handleCrmAuthRequest(req, async () => Response.json({ code: 'SOME_INTERNAL_CODE', message: 'PRIVATE' }, { status: 500 }));
  assert.equal(bad.status, 500);
  assert.ok(!(await bad.text()).includes('PRIVATE'));
  const limited = await handleCrmAuthRequest(req, async () => Response.json({ code: 'TOO_MANY_REQUESTS', message: 'PRIVATE' }, { status: 429, headers: { 'x-retry-after': '60' } }));
  assert.equal(limited.headers.get('x-retry-after'), '60');
  const body = await limited.json();
  assert.equal(body.code, 'TOO_MANY_REQUESTS');
  const message = authErrorMessage({ ...body, status: 429 }, 'fallback');
  assert.ok(message.includes(body.correlationId));
  assert.ok(!message.includes('PRIVATE'));
  assert.match(authErrorMessage({ code: 'INVALID_ORIGIN', message: 'PRIVATE' }, 'fallback'), /URL/);
});
