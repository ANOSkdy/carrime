import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { listResumes } from '@/lib/db/resume';

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
  const token = process.env.CRM_ACCESS_TOKEN;
  if (token) {
    const provided = request.headers.get('x-crm-token');
    if (!provided || provided !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

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
