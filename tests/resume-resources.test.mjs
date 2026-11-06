import './helpers/register-ts.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { cachedResumeResource, invalidateResumeCache } = await import('../lib/storage/resume-cache.ts');
const { loadResumeResource, mutateResumeResource } = await import('../lib/storage/resume-resource.ts');
const { saveResume, waitForResumeSaves, hasPendingResumeSave, retryPendingResumeSave } = await import('../lib/storage/resume-save.ts');
globalThis.window = undefined;
globalThis.localStorage = undefined;

const tick = () => new Promise(resolve => setImmediate(resolve));
function browser(t) {
  const storage = new Map();
  t.mock.property(globalThis, 'window', {});
  t.mock.property(globalThis, 'localStorage', {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  });
  return storage;
}

test('private cache deduplicates, expires, isolates resumes and never caches failures', async t => {
  browser(t);
  const id = 'cache-test';
  let requests = 0;
  const load = async () => ({ version: ++requests });
  const [a, b] = await Promise.all([cachedResumeResource(id, 'profile', load), cachedResumeResource(id, 'profile', load)]);
  assert.deepEqual(a, b);
  assert.equal(requests, 1);
  await cachedResumeResource('another-resume', 'profile', load);
  assert.equal(requests, 2);
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 31_000);
  await cachedResumeResource(id, 'profile', load);
  assert.equal(requests, 3);
  await assert.rejects(cachedResumeResource(id, 'failure', async () => { throw new Error('offline'); }));
  assert.equal(await cachedResumeResource(id, 'failure', async () => 'recovered'), 'recovered');
});

test('invalidation prevents an older in-flight response from restoring stale cache', async t => {
  browser(t);
  let release;
  const old = cachedResumeResource('race-cache', 'bundle', () => new Promise(resolve => { release = resolve; }));
  await tick();
  invalidateResumeCache('race-cache');
  const fresh = await cachedResumeResource('race-cache', 'bundle', async () => 'new');
  release('old');
  await old;
  assert.equal(fresh, 'new');
  assert.equal(await cachedResumeResource('race-cache', 'bundle', async () => 'unexpected'), 'new');
});

test('server execution bypasses private browser cache', async t => {
  t.mock.property(globalThis, 'window', undefined);
  let requests = 0;
  await cachedResumeResource('ssr', 'profile', async () => ++requests);
  await cachedResumeResource('ssr', 'profile', async () => ++requests);
  assert.equal(requests, 2);
});

test('POST and PATCH serialize and next-screen GET waits for both writes', async t => {
  browser(t);
  const calls = [];
  const releases = [];
  t.mock.method(globalThis, 'fetch', (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (options.method) return new Promise(resolve => releases.push(() => resolve(Response.json({ success: true }))));
    return Promise.resolve(Response.json({ resume: { self_pr: 'saved' } }));
  });
  const first = saveResume('POST', { resume_id: 'ordered', first_name_kanji: 'fixture' });
  const second = saveResume('PATCH', { resume_id: 'ordered', self_pr: 'saved' });
  const read = loadResumeResource('ordered', 'selfpr');
  await tick();
  assert.deepEqual(calls.map(c => c.method), ['POST']);
  releases.shift()();
  await tick();
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PATCH']);
  releases.shift()();
  await Promise.all([first, second]);
  assert.equal((await read).resume.self_pr, 'saved');
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PATCH', 'GET']);
  assert.match(calls[2].url, /view=selfpr/);
  assert.equal(hasPendingResumeSave('ordered'), false);
});

test('failed writes preserve ALL pending operations, block stale reads and retry in order', async t => {
  const storage = browser(t);
  const calls = [];
  let offline = true;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.push(options.method);
    return Response.json({}, { status: offline ? 503 : 200 });
  });
  const outcomes = await Promise.allSettled([
    saveResume('POST', { resume_id: 'retry', first_name_kanji: 'fixture' }),
    saveResume('PATCH', { resume_id: 'retry', current_status: 'fixture' }),
  ]);
  assert.deepEqual(outcomes.map(o => o.status), ['rejected', 'rejected']);
  assert.equal(JSON.parse(storage.get('carrime_resume_pending_save')).operations.length, 2);
  await assert.rejects(waitForResumeSaves('retry'), /PENDING/);
  await assert.rejects(loadResumeResource('retry', 'profile'), /PENDING/);
  assert.deepEqual(calls, ['POST']);
  offline = false;
  assert.equal(await retryPendingResumeSave('retry'), true);
  assert.deepEqual(calls, ['POST', 'POST', 'PATCH']);
  assert.equal(storage.has('carrime_resume_pending_save'), false);
});

test('former pending format is retried before new saves; resolving callbacks can enqueue', async t => {
  const storage = browser(t);
  storage.set('aidesu_resume_pending_save', JSON.stringify({ resumeId: 'legacy', method: 'POST', payload: { resume_id: 'legacy' }, updatedAt: 1 }));
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.push(options.method);
    return Response.json({ success: true });
  });
  await saveResume('PATCH', { resume_id: 'legacy', self_pr: 'new' });
  await saveResume('PATCH', { resume_id: 'legacy', summary: 'first' })
    .then(() => saveResume('PATCH', { resume_id: 'legacy', summary: 'second' }));
  await waitForResumeSaves('legacy');
  assert.deepEqual(calls, ['POST', 'PATCH', 'PATCH', 'PATCH']);
  assert.equal(hasPendingResumeSave(), false);
});

test('successful saves and failed child mutations both invalidate cached views', async t => {
  browser(t);
  let gets = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options = {}) => options.method
    ? Response.json({}, { status: options.method === 'DELETE' ? 500 : 200 })
    : Response.json({ resume: { self_pr: String(++gets) } }));
  assert.equal((await loadResumeResource('invalidate', 'selfpr')).resume.self_pr, '1');
  await saveResume('PATCH', { resume_id: 'invalidate', self_pr: 'updated' });
  assert.equal((await loadResumeResource('invalidate', 'selfpr')).resume.self_pr, '2');
  await assert.rejects(mutateResumeResource('invalidate', '/api/data/work?id=fixture', { method: 'DELETE' }));
  assert.equal((await loadResumeResource('invalidate', 'selfpr')).resume.self_pr, '3');
});

test('photo uploads preserve caller-owned HTTP error handling while invalidating cache', async t => {
  browser(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'FILE_TOO_LARGE' }, { status: 413 }));
  await cachedResumeResource('photo-error', 'bundle', async () => 'old-photo');
  const response = await mutateResumeResource('photo-error', '/api/data/resume/profile-photo', { method: 'POST' }, { allowErrorResponse: true });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, 'FILE_TOO_LARGE');
  assert.equal(await cachedResumeResource('photo-error', 'bundle', async () => 'refreshed-photo'), 'refreshed-photo');
});
