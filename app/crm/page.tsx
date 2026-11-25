import Link from 'next/link';
import { CrmShell as AppShell } from '@/components/crm/CrmShell';
import { requireCrmAdmin } from '@/lib/crm/session';
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

export default async function CrmPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  await requireCrmAdmin();
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
        <div className="lx-fade mt-4 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-sm">
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
      <div className="lx space-y-3 py-4">
        <form
          className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3"
          method="get"
        >
          <label htmlFor="crm-q" className="shrink-0 text-[11px] font-medium tracking-[0.2em] text-gray-500">
            検索
          </label>
          <div className="flex flex-1 gap-2">
            <input
              id="crm-q"
              type="text"
              name="q"
              defaultValue={q}
              placeholder="氏名・メールで検索"
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input type="hidden" name="pageSize" value={pageSize} />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              検索
            </button>
          </div>
          <span className="lx-num shrink-0 text-xs text-gray-500 sm:pl-1">
            <span className="text-base font-semibold text-gray-900">{data.length}</span> 件を表示
          </span>
        </form>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {data.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">該当する応募者が見つかりませんでした。</div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 md:hidden">
                {data.map((item, index) => {
                  const href = { pathname: `/crm/${item.resume_id}`, query: { from: returnTo } };
                  return (
                    <Link
                      key={item.resume_id}
                      href={href}
                      className="lx-card lx-fade block px-3 py-2.5 text-sm transition hover:bg-blue-50/40"
                      style={stagger(index, 10)}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate">
                          <span className="font-medium tracking-[0.04em] text-gray-900">{item.nameKanji}</span>
                          {item.furigana ? (
                            <span className="ml-2 text-xs text-gray-500">{item.furigana}</span>
                          ) : null}
                        </p>
                        <span className="shrink-0 font-mono lx-num text-[11px] font-semibold text-blue-600">
                          {item.resume_id}
                        </span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        <p className="col-span-2 truncate">{item.contactEmail || dash}</p>
                        <p className="lx-num truncate">{item.contactPhone || dash}</p>
                        <p className="truncate text-right">
                          {item.currentStatus || dash}
                          <span className="mx-1 text-gray-300">/</span>
                          <span className="text-gray-500">{item.addressCity || dash}</span>
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-gray-200 text-[13px]">
                  <thead className="bg-gray-50 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2">ID</th>
                      <th className="whitespace-nowrap px-3 py-2">氏名</th>
                      <th className="whitespace-nowrap px-3 py-2">フリガナ</th>
                      <th className="whitespace-nowrap px-3 py-2">メール</th>
                      <th className="whitespace-nowrap px-3 py-2">電話</th>
                      <th className="whitespace-nowrap px-3 py-2">現在</th>
                      <th className="whitespace-nowrap px-3 py-2">住所</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.map((item, index) => {
                      const href = { pathname: `/crm/${item.resume_id}`, query: { from: returnTo } };
                      return (
                        <tr key={item.resume_id} className="lx-row lx-fade hover:bg-blue-50/40" style={stagger(index, 10)}>
                          <td className="whitespace-nowrap p-0 text-xs font-semibold text-gray-700">
                            <Link href={href} className="block px-3 py-1.5 font-mono lx-num text-blue-600 hover:text-blue-700">
                              {item.resume_id}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap p-0 text-gray-900">
                            <Link href={href} className="block px-3 py-1.5 font-medium tracking-[0.04em]">
                              {item.nameKanji}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap p-0 text-gray-700">
                            <Link href={href} className="block px-3 py-1.5">
                              {item.furigana || dash}
                            </Link>
                          </td>
                          <td className="p-0 text-gray-700">
                            <Link
                              href={href}
                              className="block max-w-[18rem] truncate px-3 py-1.5"
                              title={item.contactEmail || undefined}
                            >
                              {item.contactEmail || dash}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap p-0 text-gray-700">
                            <Link href={href} className="block px-3 py-1.5 lx-num">
                              {item.contactPhone || dash}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap p-0 text-gray-700">
                            <Link href={href} className="block px-3 py-1.5">
                              {item.currentStatus || dash}
                            </Link>
                          </td>
                          <td className="p-0 text-gray-500">
                            <Link
                              href={href}
                              className="block max-w-[14rem] truncate px-3 py-1.5"
                              title={item.addressCity || undefined}
                            >
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

        <nav aria-label="ページ送り" className="flex items-center justify-end gap-2">
          {hasPrev ? (
            <Link
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50/40 hover:text-blue-700"
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
            <span className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-400">← 前へ</span>
          )}
          {nextStack ? (
            <Link
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50/40 hover:text-blue-700"
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
            <span className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-400">次へ →</span>
          )}
        </nav>
      </div>
    </AppShell>
  );
}
