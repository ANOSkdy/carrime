import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { listResumes } from '@/lib/db/resume';
import { getCrmSessionFromHeaders } from '@/lib/crm/session';
import { getCrmAccess } from '@/lib/crm/access';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const runtime = 'nodejs';

const parsePageSize = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  if (parsed < 1) return 1;
  if (parsed > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return Math.floor(parsed);
};

export async function GET(request: Request) {
  const access = getCrmAccess(await getCrmSessionFromHeaders(request.headers));
  if (access === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (access !== 'allowed') return NextResponse.json({ error: access === 'password-change' ? 'PASSWORD_CHANGE_REQUIRED' : 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const pageSize = parsePageSize(searchParams.get('pageSize'));
  const cursor = searchParams.get('cursor');
  const q = searchParams.get('q');
  const sortParam = searchParams.get('sort');
  const sort = sortParam === 'created_at' ? 'created_at' : 'updated_at';

  try {
    const result = await listResumes({
      pageSize,
      cursor,
      q,
      sort,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const correlationId = randomUUID();
    console.error('CRM resumes list error', { correlationId, error });
    return NextResponse.json({ error: 'データ取得に失敗しました。時間をおいて再度お試しください。', correlationId }, { status: 500 });
  }
}
