import './helpers/register-ts.mjs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  return next(specifier, context);
} });
const { query, queryBatch, measureDatabaseRequests } = await import('../lib/db/postgres.ts');

test('batch uses one HTTP transaction with explicit isolation, and metrics stay request-local', async t => {
  t.mock.property(process, 'env', { ...process.env, DATABASE_URL_UNPOOLED: 'postgresql://fixture:secret@db.example.test/test' });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.push(options);
    const body = JSON.parse(options.body);
    await new Promise(resolve => setImmediate(resolve));
    return Response.json(body.queries ? { results: body.queries.map(() => ({ rows: [] })) } : { rows: [] });
  });
  const [a, b] = await Promise.all([
    measureDatabaseRequests(() => queryBatch([{ query: 'update fixture set value=$1', params: ['private'] }, { query: 'select 1', params: [] }])),
    measureDatabaseRequests(async () => { await query('select 1'); await query('select 2'); }),
  ]);
  assert.equal(a.requests, 1);
  assert.equal(b.requests, 2);
  assert.equal(calls[0].headers['Neon-Batch-Isolation-Level'], 'ReadCommitted');
  assert.equal(calls[0].cache, 'no-store');
  assert.equal(JSON.parse(calls[0].body).queries.length, 2);
});

test('provider response details are masked and malformed batch is rejected', async t => {
  t.mock.property(process, 'env', { ...process.env, DATABASE_URL_UNPOOLED: 'postgresql://fixture:secret@db.example.test/test' });
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('SECRET-INPUT-AND-KEY', { status: 400 }));
  await assert.rejects(query('select $1', ['private']), error => error.message === 'Postgres request failed (400)');
  fetch.mock.mockImplementation(async () => Response.json({ results: [] }));
  await assert.rejects(queryBatch([{ query: 'select 1', params: [] }]), /Invalid Postgres batch/);
});
