import './helpers/register-ts.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { handleCrmAuthRequest } = await import('../lib/crm/auth-handler.ts');

test('auth logging tracks rejection code/correlation while keeping cookies, inputs and errors private', async (t) => {
  const logs = [];
  t.mock.method(console, 'warn', (line) => logs.push(JSON.parse(line)));
  t.mock.method(console, 'error', (line) => logs.push(JSON.parse(line)));
  const req = new Request('https://www.carrime.app/api/crm-auth/sign-in/email', { method: 'POST' });
  const res = await handleCrmAuthRequest(req, async () => Response.json({ code: 'INVALID_ORIGIN', message: 'PRIVATE-DATA' }, { status: 403 }));
  assert.equal(res.status, 403);
  assert.equal(logs[0].code, 'INVALID_ORIGIN');
  assert.equal(res.headers.get('x-correlation-id'), logs[0].correlationId);
  assert.ok(!JSON.stringify(logs).includes('PRIVATE-DATA'));
  const failed = await handleCrmAuthRequest(req, async () => { throw new Error('PRIVATE-DATA'); });
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes('PRIVATE-DATA'));
  assert.ok(!JSON.stringify(logs).includes('PRIVATE-DATA'));
});
