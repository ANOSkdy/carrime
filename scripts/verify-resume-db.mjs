// Optional local integration verification. Install @electric-sql/pglite outside
// the app and point CARRIME_PGLITE_MODULE to its dist/index.js (see perf report).
// No external database, credentials, mail, or production data is used.
import '../tests/helpers/register-ts.mjs';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  return next(specifier, context);
} });
const { PGlite } = await import(process.env.CARRIME_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec((await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')).replace('create extension if not exists pgcrypto;', ''));
// Already present in the deployed DB; no migration is performed by this PR.
await db.exec('alter table resume_drafts add column admin_notified_at timestamptz, add column admin_notification_error text');
process.env.DATABASE_URL_UNPOOLED = 'postgresql://local:fixture@localhost/test';
delete process.env.NEON_SQL_HTTP_URL;
const requests = [];
let injectFailure = false;
globalThis.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  requests.push(body);
  const run = async conn => {
    const results = [];
    for (const stmt of body.queries || [body]) {
      if (injectFailure && stmt.query.startsWith('insert into resume_desired_conditions')) throw new Error('private provider detail');
      results.push(await conn.query(stmt.query, stmt.params));
    }
    return body.queries ? { results } : results[0];
  };
  try { return Response.json(body.queries ? await db.transaction(run) : await run(db)); }
  catch { return Response.json({ message: 'private provider detail' }, { status: 400 }); }
};
const model = await import('../lib/db/resume.ts');
const { ResumeSchema, ResumePatchSchema } = await import('../lib/validation/schemas.ts');
const counts = {};
async function once(name, run) {
  const before = requests.length;
  const result = await run();
  counts[name] = requests.length - before;
  assert.equal(counts[name], 1, `${name} must make one DB HTTP request`);
  return result;
}
const resumeId = 'res_local_performance_fixture';
const profile = { resume_id: resumeId, user_id: 'usr_fixture', last_name_kanji: '検証', first_name_kanji: '専用', dob_year: 1990, dob_month: 1, dob_day: 2 };
const created = await once('createProfile', () => model.saveResumeDraft(ResumeSchema.parse(profile)));
await once('patchText', () => model.patchResumeDraft(ResumePatchSchema.parse({ resume_id: resumeId, self_pr: 'existing PR', summary: 'existing summary', current_status: '就業中' })));
const updated = await once('resaveProfile', () => model.saveResumeDraft(ResumeSchema.parse({ ...profile, first_name_kanji: '変更' })));
assert.equal(updated.self_pr, 'existing PR');
assert.equal(updated.summary, 'existing summary');
assert.equal(updated.current_status, '就業中');
assert.equal(updated.first_name_kanji, '変更');
const desired = { desired_occupations: [' 営業 ', '事務', '開発'], desired_industries: ['IT', '製造'], desired_locations: ['東京', '大阪'], licenses_qualifications: ['資格A', '資格B'] };
await once('patchNineConditions', () => model.patchResumeDraft(ResumePatchSchema.parse({ resume_id: resumeId, ...desired })));
const partial = await once('replaceOneCategory', () => model.patchResumeDraft(ResumePatchSchema.parse({ resume_id: resumeId, desired_occupations: ['経理'] })));
assert.deepEqual(partial.desired_occupations, ['経理']);
assert.deepEqual(partial.desired_industries, ['IT', '製造']);
const cleared = await once('clearOneCategory', () => model.patchResumeDraft(ResumePatchSchema.parse({ resume_id: resumeId, licenses_qualifications: [] })));
assert.deepEqual(cleared.licenses_qualifications, []);
assert.deepEqual(cleared.desired_locations, ['東京', '大阪']);
injectFailure = true;
await assert.rejects(model.patchResumeDraft(ResumePatchSchema.parse({ resume_id: resumeId, summary: 'MUST ROLLBACK', desired_occupations: ['MUST ROLLBACK'] })), /Postgres request failed/);
injectFailure = false;
const afterFailure = await model.getResumeBundle(resumeId);
assert.equal(afterFailure.resume.summary, 'existing summary');
assert.deepEqual(afterFailure.resume.desired_occupations, ['経理']);
const educationId = await once('createEducation', () => model.createEducation({ resume_id: resumeId, school_name: '検証校', start_year: 2008, start_month: 4, end_year: 2012, end_month: 3 }));
const workId = await once('createWork', () => model.createWork({ resume_id: created.id, company_name: '検証社', start_year: 2012, start_month: 4, is_current: true, description: 'fixture description' }));
const bundle = await once('getBundle', () => model.getResumeBundle(resumeId));
assert.equal(bundle.educations[0].id, educationId);
assert.equal(bundle.educations[0].start_year, 2008);
assert.equal(bundle.works[0].id, workId);
assert.equal(bundle.works[0].end_year, null);
assert.equal(bundle.works[0].description, 'fixture description');
assert.deepEqual(bundle.resume.desired_industries, ['IT', '製造']);
assert.ok(!Object.hasOwn(bundle.educations[0], 'sort_order'));
assert.deepEqual(await once('getEducation', () => model.getResumeEducations(created.id)), bundle.educations);
assert.deepEqual(await once('getWork', () => model.getResumeWorks(resumeId)), bundle.works);
const profileOnly = await once('getProfile', () => model.getResumeProfile(resumeId));
assert.equal(profileOnly.resume.first_name_kanji, '変更');
assert.equal(profileOnly.resume.self_pr, undefined);
assert.equal(profileOnly.resume.summary, undefined);
const selfPrOnly = await once('getSelfPr', () => model.getResumeSelfPr(created.id));
assert.deepEqual(selfPrOnly, { resume: { resume_id: resumeId, self_pr: 'existing PR' } });
const listed = await model.listResumes({ pageSize: 10 });
assert.equal(listed.data[0].nameKanji, '検証 変更');
await once('profilePhoto', () => model.updateResumeFields(created.id, { profilePhotoUrl: 'https://example.test/fixture.png' }));
assert.equal((await model.getResumeBundle(resumeId)).resume.profilePhotoUrl, 'https://example.test/fixture.png');
assert.equal(await model.getResumeBundle('res_missing'), null);
await assert.rejects(model.patchResumeDraft({ resume_id: 'res_missing', desired_locations: ['東京'] }), /not found/);
await model.deleteEducation(educationId);
await model.deleteWork(workId);
assert.deepEqual(await model.getResumeEducations(resumeId), []);
assert.deepEqual(await model.getResumeWorks(resumeId), []);
assert.ok(requests.every(body => !['BEGIN', 'COMMIT'].includes(body.query)));
await db.close();
console.log(JSON.stringify({ passed: true, databaseRequests: counts, rollback: true, partialUpdate: true, legacyBundleShape: true }));
