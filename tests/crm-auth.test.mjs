import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createCrmAuth } from '../lib/crm/auth-config.ts';
import { getCrmAccess } from '../lib/crm/access.ts';
import { resolveCrmAuthOrigins, CANONICAL_ORIGIN } from '../lib/crm/auth-origins.ts';

const baseURL = 'https://crm.example.test';
const initialPassword = 'Only-for-memory-tests-42';
const newPassword = 'Changed-in-memory-tests-84';

async function fixture({ role = 'admin', rateLimitEnabled = false, baseURL: fixtureBase = baseURL, trustedOrigins = [fixtureBase] } = {}) {
  const db = {
    crm_auth_user: [], crm_auth_account: [], crm_auth_session: [],
    crm_auth_verification: [], crm_auth_rate_limit: [],
  };
  const auth = createCrmAuth({
    database: memoryAdapter(db), secret: randomUUID() + randomUUID(), baseURL: fixtureBase,
    trustedOrigins, secureCookies: true, rateLimitEnabled,
  });
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser({
    email: `crm-${randomUUID()}@example.test`, name: 'Memory test user', emailVerified: true,
    role, mustChangePassword: true,
  });
  await ctx.internalAdapter.createAccount({
    userId: user.id, accountId: user.id, providerId: 'credential',
    password: await ctx.password.hash(initialPassword),
  });
  const call = (path, body, cookie, origin = fixtureBase) => auth.handler(new Request(`${fixtureBase}/api/crm-auth${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': '192.0.2.7', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }));
  return { auth, db, user, call };
}

const cookieFrom = (response) => response.headers.getSetCookie()
  .filter((value) => value.startsWith('__Secure-carrime-crm.session_token='))
  .map((value) => value.split(';')[0]).join('; ');

test('CRM rejects anonymous/non-admin sessions and requires an explicit password change', () => {
  assert.equal(getCrmAccess(null), 'anonymous');
  assert.equal(getCrmAccess({ user: { role: 'user', mustChangePassword: false } }), 'forbidden');
  assert.equal(getCrmAccess({ user: { role: 'admin' } }), 'password-change');
  assert.equal(getCrmAccess({ user: { role: 'admin', mustChangePassword: true } }), 'password-change');
  assert.equal(getCrmAccess({ user: { role: 'admin', mustChangePassword: false } }), 'allowed');
});

test('CRM public registration is disabled, including forged admin fields', async () => {
  const { call, db } = await fixture();
  const response = await call('/sign-up/email', { email: 'outsider@example.test', name: 'Outsider', password: initialPassword, role: 'admin', mustChangePassword: false });
  assert.ok(response.status >= 400 && response.status < 500);
  assert.equal(db.crm_auth_user.length, 1);
});

test('CRM password change rotates sessions, clears the first-login requirement and invalidates the old password', async () => {
  const { call, user } = await fixture();
  const wrong = await call('/sign-in/email', { email: user.email, password: 'Wrong-memory-password-22' });
  assert.equal(wrong.status, 401);
  assert.equal(cookieFrom(wrong), '');

  const login = await call('/sign-in/email', { email: user.email, password: initialPassword });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  assert.ok(cookie);
  const attributes = login.headers.getSetCookie().find((value) => value.startsWith('__Secure-carrime-crm.session_token='));
  assert.match(attributes, /httponly/i);
  assert.match(attributes, /secure/i);
  assert.match(attributes, /samesite=lax/i);
  assert.doesNotMatch(attributes, /;\s*domain=/i);
  const before = await (await call('/get-session', null, cookie)).json();
  assert.equal(getCrmAccess(before), 'password-change');

  const wrongCurrent = await call('/change-password', { currentPassword: 'Wrong-memory-password-22', newPassword, revokeOtherSessions: true }, cookie);
  assert.ok(wrongCurrent.status >= 400);
  assert.equal(getCrmAccess(await (await call('/get-session', null, cookie)).json()), 'password-change');

  const unchanged = await call('/change-password', { currentPassword: initialPassword, newPassword: initialPassword, revokeOtherSessions: true }, cookie);
  assert.equal(unchanged.status, 400);
  assert.equal(getCrmAccess(await (await call('/get-session', null, cookie)).json()), 'password-change');

  const forged = await call('/update-user', { mustChangePassword: false }, cookie);
  assert.ok(forged.status < 500);
  assert.equal(getCrmAccess(await (await call('/get-session', null, cookie)).json()), 'password-change');

  const changed = await call('/change-password', { currentPassword: initialPassword, newPassword, revokeOtherSessions: true }, cookie);
  assert.equal(changed.status, 200);
  const currentCookie = cookieFrom(changed);
  assert.ok(currentCookie);
  assert.equal(await (await call('/get-session', null, cookie)).json(), null);
  const current = await (await call('/get-session', null, currentCookie)).json();
  assert.equal(getCrmAccess(current), 'allowed');

  assert.equal((await call('/sign-in/email', { email: user.email, password: initialPassword })).status, 401);
  assert.equal((await call('/sign-in/email', { email: user.email, password: newPassword })).status, 200);
  assert.equal((await call('/sign-out', {}, currentCookie)).status, 200);
  assert.equal(await (await call('/get-session', null, currentCookie)).json(), null);
});

test('CRM refuses cross-origin credential requests', async () => {
  const { call, user } = await fixture();
  const response = await call('/sign-in/email', { email: user.email, password: initialPassword }, undefined, 'https://untrusted.example.test');
  assert.equal(response.status, 403);
  assert.equal(cookieFrom(response), '');
});

test('CRM login attempts are limited using persistent adapter storage', async () => {
  const { call, user, db } = await fixture({ rateLimitEnabled: true });
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await call('/sign-in/email', { email: user.email, password: 'Wrong-memory-password-22' })).status, 401);
  }
  const response = await call('/sign-in/email', { email: user.email, password: initialPassword });
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('x-retry-after')) > 0);
  assert.ok(db.crm_auth_rate_limit.length > 0);
});

test('CRM users cannot grant themselves the admin role', async () => {
  const { call, user } = await fixture({ role: 'user' });
  const login = await call('/sign-in/email', { email: user.email, password: initialPassword });
  const cookie = cookieFrom(login);
  assert.ok(cookie);
  await call('/update-user', { role: 'admin', mustChangePassword: false }, cookie);
  const session = await (await call('/get-session', null, cookie)).json();
  assert.equal(getCrmAccess(session), 'forbidden');
  assert.equal(session.user.role, 'user');
});

test('canonical domain supports sign-in/session/sign-out while unapproved origins remain rejected', async () => {
  const config = resolveCrmAuthOrigins({ NODE_ENV: 'production', VERCEL_ENV: 'production', CRM_AUTH_URL: `${CANONICAL_ORIGIN}/` });
  assert.deepEqual(config.trustedOrigins, [CANONICAL_ORIGIN]);
  const { call, user } = await fixture(config);
  const login = await call('/sign-in/email', { email: user.email, password: initialPassword });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  assert.ok(cookie);
  const attributes = login.headers.getSetCookie().find((value) => value.startsWith('__Secure-carrime-crm.session_token='));
  assert.match(attributes, /HttpOnly/i);
  assert.match(attributes, /Secure/i);
  assert.match(attributes, /SameSite=Lax/i);
  assert.doesNotMatch(attributes, /;\s*Domain=/i);
  assert.equal(getCrmAccess(await (await call('/get-session', null, cookie)).json()), 'password-change');
  for (const origin of ['https://carrime.app', 'https://carrime.vercel.app', 'https://untrusted.example.test']) {
    assert.equal((await call('/sign-in/email', { email: user.email, password: initialPassword }, undefined, origin)).status, 403);
  }
  assert.equal((await call('/sign-out', {}, cookie)).status, 200);
  assert.equal(await (await call('/get-session', null, cookie)).json(), null);
});

test('preview origin configuration never inherits production/legacy domains or a wildcard', async () => {
  const config = resolveCrmAuthOrigins({ NODE_ENV: 'production', VERCEL_ENV: 'preview', CRM_AUTH_URL: CANONICAL_ORIGIN,
    VERCEL_URL: 'carrime-deployment.example.test', VERCEL_BRANCH_URL: 'carrime-branch.example.test' });
  assert.deepEqual(config.trustedOrigins, ['https://carrime-deployment.example.test', 'https://carrime-branch.example.test']);
  const { call, user } = await fixture(config);
  const payload = { email: user.email, password: initialPassword };
  assert.equal((await call('/sign-in/email', payload)).status, 200);
  assert.equal((await call('/sign-in/email', payload, undefined, 'https://carrime-branch.example.test')).status, 200);
  assert.equal((await call('/sign-in/email', payload, undefined, CANONICAL_ORIGIN)).status, 403);
  assert.throws(() => resolveCrmAuthOrigins({ VERCEL_ENV: 'preview' }));
  assert.throws(() => resolveCrmAuthOrigins({ VERCEL_ENV: 'production', CRM_AUTH_URL: 'https://carrime.vercel.app' }));
});

test('an old auth base URL reproduces the new-domain origin failure independently of AI routes', async () => {
  const { call, user } = await fixture({ baseURL: 'https://carrime.vercel.app' });
  const res = await call('/sign-in/email', { email: user.email, password: initialPassword }, undefined, CANONICAL_ORIGIN);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'INVALID_ORIGIN');
});
