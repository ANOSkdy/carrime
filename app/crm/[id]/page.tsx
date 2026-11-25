import type React from 'react';
import { randomUUID } from 'crypto';
import Link from 'next/link';
import { CrmShell as AppShell } from '@/components/crm/CrmShell';
import { requireCrmAdmin } from '@/lib/crm/session';
import { FormSection } from '@/components/layout/FormSection';
import { getResumeBundle } from '@/lib/db/resume';
import { isValidResumeId, normalizeResumeId, normalizeReturnTo } from '@/lib/crm/resume-id';

type SearchParams = {
  from?: string;
};

const formatYm = (year?: number, month?: number) => {
  if (!year) return '';
  if (!month) return `${year}年`;
  return `${year}年${month}月`;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs leading-5 text-gray-700">{children}</span>
);

const toText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value : fallback;

const toDisplayNumber = (value: unknown, fallback: string) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;

export default async function CrmDetailPage({
  params,
  searchParams,
}: {
  params?: Record<string, unknown> | Promise<Record<string, unknown>>;
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  await requireCrmAdmin();
  const resolvedParams = params ? await Promise.resolve(params) : {};
  const paramKeys = Object.keys(resolvedParams ?? {});
  const fallbackValue =
    paramKeys.length === 1 ? (resolvedParams as Record<string, unknown>)[paramKeys[0]] : undefined;
  const rawParam =
    (resolvedParams as any)?.id ??
    (resolvedParams as any)?.resumeId ??
    (resolvedParams as any)?.resume_id ??
    (resolvedParams as any)?.slug ??
    fallbackValue;
  const rawValue = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const resumeIdInfo = normalizeResumeId(rawValue);
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : undefined;
  const returnTo = normalizeReturnTo(resolvedSearchParams?.from);

  const resumeId = resumeIdInfo.normalized;

  if (!resumeId || !isValidResumeId(resumeId)) {
    const traceId = randomUUID();
    console.warn('CRM invalid resume id', {
      traceId,
      paramKeys,
      rawType: typeof rawValue,
      isArray: Array.isArray(rawParam),
    });
    return (
      <AppShell title="CRM / 応募者詳細">
        <div className="mt-4 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-sm">
          <p>不正なIDが指定されました。</p>
          <p>resume_id (raw): {resumeIdInfo.raw ?? 'undefined'}</p>
          <p>resume_id (normalized): {resumeIdInfo.normalized ?? 'undefined'}</p>
          <p>Trace ID: {traceId}</p>
        </div>
      </AppShell>
    );
  }

  let bundle;
  try {
    bundle = await getResumeBundle(resumeId);
  } catch (error: any) {
    const correlationId = randomUUID();
    console.error('CRM resume detail error', {
      correlationId,
      message: error?.message,
      stack: error?.stack,
    });
    return (
      <AppShell title="CRM / 応募者詳細">
        <div className="mt-4 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-sm">
          データ取得中にエラーが発生しました。{error?.message ?? ''} (Trace ID: {correlationId})
        </div>
      </AppShell>
    );
  }

  if (!bundle) {
    const correlationId = randomUUID();
    console.warn('CRM resume not found', { correlationId, resumeId });
    return (
      <AppShell title="CRM / 応募者詳細">
        <div className="space-y-3 py-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
            <p>応募者が見つかりませんでした。</p>
            <p>resume_id: {resumeId}</p>
            <p>Trace ID: {correlationId}</p>
          </div>
          <Link className="lx-link text-sm font-medium text-blue-600 hover:text-blue-700" href={returnTo}>
            ← 一覧へ戻る
          </Link>
        </div>
      </AppShell>
    );
  }

  const { resume, educations, works } = bundle;
  const nameKanji = [resume.last_name_kanji, resume.first_name_kanji].filter(Boolean).join(' ');
  const updatedAt =
    (resume as { updated_at?: string; updatedAt?: string; created_at?: string }).updated_at ??
    (resume as { updatedAt?: string }).updatedAt ??
    (resume as { created_at?: string }).created_at ??
    resume.createdTime;

  const sortedEducations = [...educations].sort((a, b) => {
    const aYear = toNumber(a.start_year) ?? 0;
    const bYear = toNumber(b.start_year) ?? 0;
    if (aYear !== bYear) return aYear - bYear;
    const aMonth = toNumber(a.start_month) ?? 0;
    const bMonth = toNumber(b.start_month) ?? 0;
    return aMonth - bMonth;
  });

  const sortedWorks = [...works].sort((a, b) => {
    const aYear = toNumber(a.start_year) ?? 0;
    const bYear = toNumber(b.start_year) ?? 0;
    if (aYear !== bYear) return bYear - aYear;
    const aMonth = toNumber(a.start_month) ?? 0;
    const bMonth = toNumber(b.start_month) ?? 0;
    return bMonth - aMonth;
  });

  return (
    <AppShell title="CRM / 応募者詳細">
      <div className="lx lx-fade mx-auto max-w-5xl space-y-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50/40 hover:text-blue-700"
            href={returnTo}
          >
            ← 一覧へ戻る
          </Link>
          {updatedAt ? <p className="lx-num truncate text-xs text-gray-400">更新日: {updatedAt}</p> : null}
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <FormSection motion="none" index={0} title="プロフィール">
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <h1 className="text-xl font-semibold tracking-[0.04em] text-gray-900">{nameKanji || '未入力'}</h1>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {resume.contactEmail ?? resume.email ? (
                  <>
                    <dt className="text-xs font-semibold leading-5 text-gray-500">メール</dt>
                    <dd className="min-w-0 break-all text-gray-700">{resume.contactEmail ?? resume.email}</dd>
                  </>
                ) : null}
                {resume.contactPhone ?? resume.phone_number ? (
                  <>
                    <dt className="text-xs font-semibold leading-5 text-gray-500">電話</dt>
                    <dd className="lx-num text-gray-700">{resume.contactPhone ?? resume.phone_number}</dd>
                  </>
                ) : null}
                {resume.contactAddress ? (
                  <>
                    <dt className="text-xs font-semibold leading-5 text-gray-500">住所</dt>
                    <dd className="min-w-0 text-gray-700">{resume.contactAddress}</dd>
                  </>
                ) : null}
              </dl>
            </div>
            {resume.profilePhotoUrl ? (
              <img
                src={resume.profilePhotoUrl}
                alt={`${nameKanji}のプロフィール写真`}
                className="h-24 w-24 shrink-0 rounded-md border border-gray-200 object-cover"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {resume.current_status ? <Tag>{resume.current_status}</Tag> : null}
            {resume.desired_occupations?.map((role) => (
              <Tag key={role}>{role}</Tag>
            ))}
            {resume.desired_locations?.map((location) => (
              <Tag key={location}>{location}</Tag>
            ))}
          </div>
          </FormSection>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="space-y-8">
          <FormSection motion="none" index={1} title="就業条件">
          <div className="grid gap-x-6 gap-y-4 text-sm leading-relaxed text-gray-700 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-gray-500">転職回数</div>
              <div className="lx-num">{toDisplayNumber(resume.job_change_count, '未入力')}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-gray-500">入社希望時期</div>
              <div>{toText(resume.desired_joining_date, '未入力')}</div>
            </div>
            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-gray-500">資格・免許</div>
              {resume.licenses_qualifications && resume.licenses_qualifications.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {resume.licenses_qualifications.map((license) => (
                    <Tag key={license}>{license}</Tag>
                  ))}
                </div>
              ) : (
                <div>未入力</div>
              )}
            </div>
          </div>
          </FormSection>
          <FormSection motion="none" index={2} title="アピール">
          <div className="grid gap-x-6 gap-y-4 text-sm leading-relaxed text-gray-700 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-gray-500">活かせる経験・スキル</div>
              <p className="whitespace-pre-wrap">
                {toText(resume.transferable_skills, '未入力')}
              </p>
            </div>
            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-gray-500">自己PR</div>
              <p className="whitespace-pre-wrap">{toText(resume.self_pr, '未入力')}</p>
            </div>
            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-gray-500">要約</div>
              <p className="whitespace-pre-wrap">{toText(resume.summary, '未入力')}</p>
            </div>
          </div>
          </FormSection>
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <FormSection motion="none" index={3} title={`学歴 ${sortedEducations.length}件`}>
          <div className="space-y-2 text-sm text-gray-700">
            {sortedEducations.length === 0 ? (
              <p className="text-gray-500">学歴情報は登録されていません。</p>
            ) : (
              sortedEducations.map((edu) => {
                const start = formatYm(toNumber(edu.start_year), toNumber(edu.start_month));
                const end = edu.is_current
                  ? '在学中'
                  : formatYm(toNumber(edu.end_year), toNumber(edu.end_month));
                return (
                  <div key={edu.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="font-medium text-gray-900">
                      {toText(edu.school_name, '学校名未入力')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {toText(edu.department, '学部/学科未入力')}
                    </div>
                    <div className="lx-num text-xs text-gray-500">
                      {start || '入学時期未入力'} {end ? `〜 ${end}` : ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </FormSection>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <FormSection motion="none" index={4} title={`職歴 ${sortedWorks.length}件`}>
          <div className="space-y-2 text-sm text-gray-700">
            {sortedWorks.length === 0 ? (
              <p className="text-gray-500">職歴情報は登録されていません。</p>
            ) : (
              sortedWorks.map((work) => {
                const start = formatYm(toNumber(work.start_year), toNumber(work.start_month));
                const end = work.is_current
                  ? '在籍中'
                  : formatYm(toNumber(work.end_year), toNumber(work.end_month));
                const tags = [
                  ...(Array.isArray(work.roles) ? work.roles : []),
                  ...(Array.isArray(work.industries) ? work.industries : []),
                ];
                return (
                  <div key={work.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="font-medium text-gray-900">
                      {toText(work.company_name, '企業名未入力')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {toText(work.department, '部署未入力')} / {toText(work.position, '役職未入力')}
                    </div>
                    <div className="lx-num text-xs text-gray-500">
                      {start || '開始時期未入力'} {end ? `〜 ${end}` : ''}
                    </div>
                    {tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tags.map((tag: string) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          </FormSection>
        </section>
        </div>
      </div>
    </AppShell>
  );
}
