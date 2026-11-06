import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getResumeBundle, getResumeProfile, getResumeSelfPr, patchResumeDraft, saveResumeDraft } from '@/lib/db/resume';
import { measureDatabaseRequests } from '@/lib/db/postgres';
import { writeApiLog } from '@/lib/observability/api-log';
import { ResumePatchSchema, ResumeSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
class InvalidInput extends Error {}
async function readBody(request: Request) {
  try { return await request.json(); }
  catch { throw new InvalidInput(); }
}

async function handle(request: Request, run: () => Promise<NextResponse>) {
  const started = Date.now();
  const correlationId = randomUUID();
  let code = 'OK';
  const { value: response, requests: dbRequests } = await measureDatabaseRequests(async () => {
    try { return await run(); }
    catch (error) {
      const invalid = error instanceof InvalidInput;
      code = invalid ? 'INVALID_INPUT' : 'DATA_REQUEST_FAILED';
      return NextResponse.json({ error: invalid ? '入力内容を確認してください。' : 'データの取得・保存に失敗しました。時間をおいて再度お試しください。', correlationId }, { status: invalid ? 400 : 500 });
    }
  });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('x-correlation-id', correlationId);
  writeApiLog({ event: 'data.completed', correlationId, route: '/api/data/resume', method: request.method,
    status: response.status, durationMs: Date.now() - started, dbRequests,
    code: response.ok ? code : code === 'OK' ? `HTTP_${response.status}` : code, stage: 'response' });
  return response;
}

export async function GET(request: Request) {
  return handle(request, async () => {
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get('id')?.trim();
    const view = searchParams.get('view') || 'bundle';
    if (!resumeId) return NextResponse.json({ error: 'Missing resumeId' }, { status: 400 });
    if (!['bundle', 'profile', 'selfpr'].includes(view)) return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
    const data = view === 'profile' ? await getResumeProfile(resumeId)
      : view === 'selfpr' ? await getResumeSelfPr(resumeId) : await getResumeBundle(resumeId);
    return data ? NextResponse.json(data) : NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  });
}

export async function POST(request: Request) {
  return handle(request, async () => {
    const parsed = ResumeSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new InvalidInput();
    const saved = await saveResumeDraft(parsed.data);
    return NextResponse.json({ success: true, record: saved });
  });
}

export async function PATCH(request: Request) {
  return handle(request, async () => {
    const parsed = ResumePatchSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new InvalidInput();
    const saved = await patchResumeDraft(parsed.data);
    return NextResponse.json({ success: true, record: saved });
  });
}
