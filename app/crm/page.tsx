import Link from 'next/link';
import { headers } from 'next/headers';
import { AppShell } from '@/components/layout/AppShell';
import { listResumes } from '@/lib/db/resume';
import { stagger } from '@/lib/ui/stagger';

type SearchParams = {
  q?: string | string[];
  pageSize?: string | string[];
  cursor?: string | string[];
  cursorStack?: string | string[];
};

const dash = <span className="text-gray-300">—</span>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const normalizeParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const parsePageSize = (value?: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  if (parsed < 1) return 1;
  if (parsed > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return Math.floor(parsed);
};

const buildQueryString = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const getAccessError = async () => {
  const token = process.env.CRM_ACCESS_TOKEN;
  if (!token) return null;
  const provided = (await headers()).get('x-crm-token');
  if (!provided || provided !== token) {
    return 'このページにアクセスするための認証トークンが不足しています。';
  }
  return null;
};

export default async function CrmPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const accessError = await getAccessError();
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : undefined;
  const q = normalizeParam(resolvedSearchParams?.q)?.trim() ?? '';
  const pageSize = parsePageSize(normalizeParam(resolvedSearchParams?.pageSize));
  const cursorStackParam = normalizeParam(resolvedSearchParams?.cursorStack) ?? '';
  const cursorStack = cursorStackParam.split(',').filter(Boolean);
  const cursor = normalizeParam(resolvedSearchParams?.cursor) ?? null;

  const baseQuery = buildQueryString({
    q: q || undefined,
    pageSize: String(pageSize),
    cursor: cursor || undefined,
    cursorStack: cursorStackParam || undefined,
  });
  const returnQuery = buildQueryString({
    q: q || undefined,
    pageSize: String(pageSize),
    cursor: cursor || undefined,
  });
  const returnTo = returnQuery ? `/crm${returnQuery}` : '/crm';

  if (accessError) {
    return (
      <AppShell title="CRM / 応募者一覧">
        <div className="lx-fade rounded-xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-sm">
          {accessError}
        </div>
      </AppShell>
    );
  }

  let data = [];
  let nextCursor: string | null = null;
  try {
    const result = await listResumes({
      pageSize,
      cursor,
      q: q || undefined,
      sort: 'updated_at',
    });
    data = result.data;
    nextCursor = result.nextCursor;
  } catch (error: any) {
    return (
      <AppShell title="CRM / 応募者一覧">
        <div className="lx-fade rounded-xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-sm">
          データ取得中にエラーが発生しました。{error?.message ?? ''}
        </div>
      </AppShell>
    );
  }

  const nextStack = nextCursor ? (cursor ? [...cursorStack, cursor] : cursorStack) : null;
  const prevCursor = cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : null;
  const prevStack = cursorStack.length > 0 ? cursorStack.slice(0, -1) : null;
  const hasPrev = Boolean(cursor);

  return (
    <AppShell title="CRM / 応募者一覧">
      <div className="lx space-y-4">
        <form className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" method="get">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <label className="block text-[11px] font-medium tracking-[0.2em] text-gray-500">検索</label>
              <span className="lx-num text-xs text-gray-500">
                <span className="text-base font-semibold text-gray-900">{data.length}</span> 件を表示
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="氏名・メールで検索"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input type="hidden" name="pageSize" value={pageSize} />
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                検索
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {data.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">該当する応募者が見つかりませんでした。</div>
          ) : (
            <>
              <div className="divide-y divide-gray-200 md:hidden">
                {data.map((item, index) => {
                  const href = { pathname: `/crm/${item.resume_id}`, query: { from: returnTo } };
                  return (
                    <Link
                      key={item.resume_id}
                      href={href}
                      className="lx-card lx-fade block space-y-2 p-4 text-sm transition hover:bg-blue-50/40"
                      style={stagger(index, 10)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">ID</span>
                        <span className="font-mono lx-num text-xs font-semibold text-blue-600">{item.resume_id}</span>
                      </div>
                      <div className="grid gap-2 text-sm text-gray-800">
                        <div>
                          <p className="text-xs font-semibold text-gray-500">氏名</p>
                          <p className="text-gray-900">{item.nameKanji}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">フリガナ</p>
                          <p className="text-gray-700">{item.furigana || dash}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">メール</p>
                          <p className="text-gray-700">{item.contactEmail || dash}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">電話</p>
                          <p className="text-gray-700">{item.contactPhone || dash}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">現在</p>
                          <p className="text-gray-700">{item.currentStatus || dash}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">住所</p>
                          <p className="text-gray-500">{item.addressCity || dash}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">氏名</th>
                      <th className="px-4 py-3">フリガナ</th>
                      <th className="px-4 py-3">メール</th>
                      <th className="px-4 py-3">電話</th>
                      <th className="px-4 py-3">現在</th>
                      <th className="px-4 py-3">住所</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.map((item, index) => {
                      const href = { pathname: `/crm/${item.resume_id}`, query: { from: returnTo } };
                      return (
                        <tr key={item.resume_id} className="lx-row lx-fade hover:bg-blue-50/40" style={stagger(index, 10)}>
                          <td className="p-0 text-xs font-semibold text-gray-700">
                            <Link href={href} className="block px-4 py-3.5 font-mono lx-num text-blue-600 hover:text-blue-700">
                              {item.resume_id}
                            </Link>
                          </td>
                          <td className="p-0 text-gray-900">
                            <Link href={href} className="block px-4 py-3.5 font-medium tracking-[0.04em]">
                              {item.nameKanji}
                            </Link>
                          </td>
                          <td className="p-0 text-gray-700">
                            <Link href={href} className="block px-4 py-3.5">
                              {item.furigana || dash}
                            </Link>
                          </td>
                          <td className="p-0 text-gray-700">
                            <Link href={href} className="block px-4 py-3.5">
                              {item.contactEmail || dash}
                            </Link>
                          </td>
                          <td className="p-0 text-gray-700">
                            <Link href={href} className="block px-4 py-3.5 lx-num">
                              {item.contactPhone || dash}
                            </Link>
                          </td>
                          <td className="p-0 text-gray-700">
                            <Link href={href} className="block px-4 py-3.5">
                              {item.currentStatus || dash}
                            </Link>
                          </td>
                          <td className="p-0 text-gray-500">
                            <Link href={href} className="block px-4 py-3.5">
                              {item.addressCity || dash}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          {hasPrev ? (
            <Link
              className="lx-link text-sm font-medium text-blue-600 hover:text-blue-700"
              href={buildQueryString({
                q: q || undefined,
                pageSize: String(pageSize),
                cursor: prevCursor || undefined,
                cursorStack: prevStack?.length ? prevStack.join(',') : undefined,
              })}
            >
              ← 前へ
            </Link>
          ) : (
            <span className="text-sm text-gray-400">← 前へ</span>
          )}
          {nextStack ? (
            <Link
              className="lx-link text-sm font-medium text-blue-600 hover:text-blue-700"
              href={buildQueryString({
                q: q || undefined,
                pageSize: String(pageSize),
                cursor: nextCursor ?? undefined,
                cursorStack: nextStack.join(','),
              })}
            >
              次へ →
            </Link>
          ) : (
            <span className="text-sm text-gray-400">次へ →</span>
          )}
        </div>
      </div>
    </AppShell>
  );
}
