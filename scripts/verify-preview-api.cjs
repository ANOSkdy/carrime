/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node QA script */
/* Exact Preview-only probes. No application record changes or real credentials. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = new URL(process.env.CARRIME_BROWSER_BASE_URL);
assert.ok(base.protocol === 'https:' && base.hostname.endsWith('.vercel.app'));
assert.ok(process.env.VERCEL_OIDC_TOKEN, 'Development OIDC token is required for protected Preview');

async function call(path, payload, { origin = base.origin, correlationId = randomUUID() } = {}) {
  const res = await fetch(base.origin + path, {
    method: payload === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', origin, 'x-correlation-id': correlationId,
      'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  return { res, correlationId };
}

(async () => {
  const ok = await call('/api/crm-auth/ok');
  assert.equal(ok.res.status, 200);
  const fake = { email: 'preview-check-nonexistent@example.test', password: 'Synthetic-nonexistent-account-97531' };
  const accepted = await call('/api/crm-auth/sign-in/email', fake);
  assert.equal(accepted.res.status, 401);
  assert.equal((await accepted.res.json()).code, 'INVALID_EMAIL_OR_PASSWORD');
  assert.equal(accepted.res.headers.get('x-correlation-id'), accepted.correlationId);
  const refused = await call('/api/crm-auth/sign-in/email', fake, { origin: 'https://untrusted.example.test' });
  assert.equal(refused.res.status, 403);
  assert.equal((await refused.res.json()).code, 'INVALID_ORIGIN');
  const signout = await call('/api/crm-auth/sign-out', {});
  assert.equal(signout.res.status, 200);
  for (const cookie of signout.res.headers.getSetCookie()) {
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.doesNotMatch(cookie, /;\s*Domain=/i);
  }
  const invalid = await call('/api/ai/selfpr', { experience: '' });
  const body = await invalid.res.json();
  assert.equal(invalid.res.status, 400);
  assert.equal(body.code, 'INVALID_INPUT');
  assert.equal(body.correlationId, invalid.correlationId);
  const client = await call('/api/telemetry/ai', { route: '/api/ai/selfpr', code: body.code, status: 400, correlationId: body.correlationId });
  assert.equal(client.res.status, 204);
  const clientOnlyId = randomUUID();
  assert.equal((await call('/api/telemetry/ai', { route: '/api/ai/selfpr', code: 'CLIENT_NETWORK_ERROR', correlationId: clientOnlyId })).res.status, 204);
  const rejectExtra = await call('/api/telemetry/ai', { route: '/api/ai/selfpr', code: 'CLIENT_NETWORK_ERROR', correlationId: randomUUID(), input: 'Synthetic input must not be accepted' });
  assert.equal(rejectExtra.res.status, 400);
  if (process.env.CARRIME_LIVE_RELATED_AI === '1') {
    const synthetic = '架空の検証データです。事務職として資料作成、問い合わせ対応、業務手順の標準化を担当しました。';
    for (const kind of ['summary', 'experience']) {
      const generated = await call(`/api/ai/${kind}`, { [kind === 'summary' ? 'career_text' : 'experience_text']: synthetic });
      const value = await generated.res.json();
      assert.equal(generated.res.status, 200);
      assert.ok(typeof value.result === 'string' && value.result.length > 0);
      console.log(JSON.stringify({ route: `/api/ai/${kind}`, status: 200, correlationId: value.correlationId, generatedCharacters: value.result.length }));
    }
  }
  console.log(JSON.stringify({ authOriginAccepted: true, untrustedOriginRejected: true,
    hostOnlySecureCookieAttributes: true, serverAndClientCorrelationId: body.correlationId, clientOnlyCorrelationId: clientOnlyId,
    authCorrelationId: refused.correlationId, invalidAiStatus: invalid.res.status,
    telemetryStatus: client.res.status, unknownTelemetryFieldsRejected: true }));
})().catch((error) => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
