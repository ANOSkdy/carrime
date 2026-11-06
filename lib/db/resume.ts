import { randomUUID } from 'crypto';
import { z } from 'zod';
import { query, queryBatch, type SqlStatement } from '@/lib/db/postgres';
import { sendResumeStep5Notification } from '@/lib/email/resume-notification';
import { ResumePatchSchema, ResumeSchema } from '@/lib/validation/schemas';

type BaseResume = z.infer<typeof ResumeSchema>;
type ResumePatchPayload = z.infer<typeof ResumePatchSchema>;

export type Resume = BaseResume & {
  id?: string;
  createdTime?: string;
  profilePhoto?: string;
  profilePhotoUrl?: string | null;
  created_at?: string;
  updated_at?: string;
  step5_completed_at?: string | null;
  admin_notified_at?: string | null;
  admin_notification_error?: string | null;
  step5_completed?: boolean;
};

type ResumeUpdateFields = Partial<Omit<Resume, 'id' | 'createdTime'>>;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toNullableUuid = (value: unknown) => {
  if (typeof value !== 'string') return null;
  return isUuid(value) ? value : null;
};

const toNullableSmallint = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
};

const toPaddedMonth = (value: number) => String(value).padStart(2, '0');
const toPaddedDay = (value: number) => String(value).padStart(2, '0');

const buildDate = (year?: number | null, month?: number | null, day = 1): string | null => {
  if (!year || !month) return null;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return `${year}-${toPaddedMonth(month)}-${toPaddedDay(day)}`;
};

const parseDateParts = (value: unknown): { year: number; month: number; day: number } | null => {
  if (typeof value !== 'string') return null;
  const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  return { year, month, day };
};

const mapDbResume = (row: Record<string, unknown>): Resume => {
  const dobParts = parseDateParts(row.dob) ?? {
    year: Number(row.dob_year) || 1990,
    month: Number(row.dob_month) || 1,
    day: Number(row.dob_day) || 1,
  };

  const baseResume = ResumeSchema.parse({
    user_id: typeof row.user_id === 'string' ? row.user_id : '00000000-0000-0000-0000-000000000000',
    resume_id: row.resume_id,
    title: row.title,
    last_name_kanji: row.last_name_kanji,
    first_name_kanji: row.first_name_kanji,
    last_name_kana: row.last_name_kana,
    first_name_kana: row.first_name_kana,
    dob_year: dobParts.year,
    dob_month: dobParts.month,
    dob_day: dobParts.day,
    gender: row.gender,
    email: row.email,
    postal_code: row.postal_code,
    address_prefecture: row.address_prefecture,
    address_city: row.address_city,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    phone_number: row.phone_number,
    contactAddress: row.contact_address,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    dependents_count: row.dependents_count,
    has_spouse: row.has_spouse ?? false,
    spouse_is_dependent: row.spouse_is_dependent ?? false,
    job_change_count: row.job_change_count,
    current_status: row.current_status,
    desired_joining_date: row.desired_joining_date,
    transferable_skills: row.transferable_skills,
    self_pr: row.self_pr,
    summary: row.summary,
    desired_occupations: row.desired_occupations,
    desired_industries: row.desired_industries,
    desired_locations: row.desired_locations,
    licenses_qualifications: row.licenses_qualifications,
  });

  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    ...baseResume,
    user_id: typeof row.user_id === 'string' ? row.user_id : baseResume.user_id,
    profilePhotoUrl: typeof row.profile_photo_url === 'string' ? row.profile_photo_url : null,
    profilePhoto: typeof row.profile_photo_url === 'string' ? row.profile_photo_url : undefined,
    createdTime: typeof row.created_at === 'string' ? row.created_at : undefined,
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    step5_completed_at: typeof row.step5_completed_at === 'string' ? row.step5_completed_at : null,
    admin_notified_at: typeof row.admin_notified_at === 'string' ? row.admin_notified_at : null,
    admin_notification_error:
      typeof row.admin_notification_error === 'string' ? row.admin_notification_error : null,
    step5_completed: row.step5_completed_at != null,
  };
};

export function mapStoredResume(record: Record<string, unknown>): Resume {
  return mapDbResume(record);
}


export function mapResumeToDbFields(fields: ResumeUpdateFields): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};

  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (key === 'contactAddress') mapped.contact_address = value;
    else if (key === 'contactPhone') mapped.contact_phone = value;
    else if (key === 'contactEmail') mapped.contact_email = value;
    else if (key === 'profilePhotoUrl') mapped.profile_photo_url = value;
    else if (key === 'profilePhoto') {
      if (typeof value === 'string') mapped.profile_photo_url = value;
    } else {
      mapped[key] = value;
    }
  });

  return mapped;
}


const desiredConditionMap = [
    ['desired_occupations', 'occupation'],
    ['desired_industries', 'industry'],
    ['desired_locations', 'location'],
    ['licenses_qualifications', 'license'],
  ] as const;

const groupDesiredConditions = (rows: Array<{ condition_type: string; label: string }>) => {
  return Object.fromEntries(desiredConditionMap.map(([key, type]) => [
    key, rows.filter((row) => row.condition_type === type).map((row) => row.label),
  ]));
};

// The parent UPSERT/UPDATE locks the resume until this HTTP batch commits.
// Separate statements then see preceding committed replacements at READ COMMITTED.
async function saveWithDesiredConditions(base: SqlStatement, resumeId: string, payload: ResumeUpdateFields) {
  const supplied = desiredConditionMap.filter(([key]) => Array.isArray(payload[key]));
  if (!supplied.length) {
    return (await query<Record<string, unknown>>(base.query, base.params)).rows[0];
  }
  const entries = supplied.flatMap(([key, condition_type]) =>
    (payload[key] as string[]).flatMap((label, sort_order) =>
      label.trim() ? [{ condition_type, label: label.trim(), sort_order }] : []));
  const results = await queryBatch<Record<string, unknown>>([
    base,
    {
      query: `delete from resume_desired_conditions
        where resume_id = (select id from resume_drafts where resume_id = $1)
          and condition_type in (select jsonb_array_elements_text($2::jsonb))`,
      params: [resumeId, JSON.stringify(supplied.map(([, type]) => type))],
    },
    {
      query: `insert into resume_desired_conditions (resume_id, condition_type, label, sort_order)
        select r.id, item.condition_type, item.label, item.sort_order
        from resume_drafts r cross join jsonb_to_recordset($2::jsonb)
          as item(condition_type text, label text, sort_order int)
        where r.resume_id = $1`,
      params: [resumeId, JSON.stringify(entries)],
    },
    {
      query: `select condition_type, label from resume_desired_conditions
        where resume_id = (select id from resume_drafts where resume_id = $1)
        order by condition_type, sort_order, id`,
      params: [resumeId],
    },
  ]);
  const row = results[0].rows[0];
  return row && { ...row, ...groupDesiredConditions(results[3].rows as Array<{ condition_type: string; label: string }>) };
};

export async function saveResumeDraft(payload: z.infer<typeof ResumeSchema>) {
  const values = mapResumeToDbFields(payload);
  const resumeId =
    typeof payload.resume_id === 'string' && payload.resume_id.trim()
      ? payload.resume_id.trim()
      : `res_${Date.now()}`;
  const dob = buildDate(payload.dob_year, payload.dob_month, payload.dob_day);

  const result = await saveWithDesiredConditions({
    query: `insert into resume_drafts (
        resume_id, user_id, title, status,
        last_name_kanji, first_name_kanji, last_name_kana, first_name_kana,
        dob, gender, email, phone_number,
        postal_code, address_prefecture, address_city, address_line1, address_line2,
        contact_address, contact_phone, contact_email,
        dependents_count, has_spouse, spouse_is_dependent,
        job_change_count, current_status, desired_joining_date,
        transferable_skills, self_pr, summary, profile_photo_url, updated_at
      ) values (
        $1, $2, $3, coalesce($4, 'draft'),
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23,
        $24, $25, $26,
        $27, $28, $29, $30, now()
      )
      on conflict (resume_id)
      do update set
        user_id = excluded.user_id,
        title = excluded.title,
        last_name_kanji = excluded.last_name_kanji,
        first_name_kanji = excluded.first_name_kanji,
        last_name_kana = excluded.last_name_kana,
        first_name_kana = excluded.first_name_kana,
        dob = excluded.dob,
        gender = excluded.gender,
        email = excluded.email,
        phone_number = excluded.phone_number,
        postal_code = excluded.postal_code,
        address_prefecture = excluded.address_prefecture,
        address_city = excluded.address_city,
        address_line1 = excluded.address_line1,
        address_line2 = excluded.address_line2,
        contact_address = excluded.contact_address,
        contact_phone = excluded.contact_phone,
        contact_email = excluded.contact_email,
        dependents_count = excluded.dependents_count,
        has_spouse = excluded.has_spouse,
        spouse_is_dependent = excluded.spouse_is_dependent,
        ${['job_change_count', 'current_status', 'desired_joining_date', 'transferable_skills', 'self_pr', 'summary']
          .map((column) => `${column} = case when $31::jsonb ? '${column}' then excluded.${column} else resume_drafts.${column} end`).join(',\n        ')},
        profile_photo_url = coalesce(excluded.profile_photo_url, resume_drafts.profile_photo_url),
        updated_at = now()
      returning *`,
    params: [
        resumeId,
        toNullableUuid(values.user_id),
        values.title ?? null,
        values.status ?? null,
        values.last_name_kanji,
        values.first_name_kanji,
        values.last_name_kana ?? null,
        values.first_name_kana ?? null,
        dob,
        values.gender ?? null,
        values.email ?? null,
        values.phone_number ?? null,
        values.postal_code ?? null,
        values.address_prefecture ?? null,
        values.address_city ?? null,
        values.address_line1 ?? null,
        values.address_line2 ?? null,
        values.contact_address ?? null,
        values.contact_phone ?? null,
        values.contact_email ?? null,
        toNullableSmallint(values.dependents_count),
        values.has_spouse ?? null,
        values.spouse_is_dependent ?? null,
        toNullableSmallint(values.job_change_count),
        values.current_status ?? null,
        values.desired_joining_date ?? null,
        values.transferable_skills ?? null,
        values.self_pr ?? null,
        values.summary ?? null,
        values.profile_photo_url ?? null,
        JSON.stringify(Object.keys(values)),
      ],
  }, resumeId, payload);
  if (!result) throw new Error('Failed to save resume');
  return mapDbResume(result);
}

export async function patchResumeDraft(payload: ResumePatchPayload): Promise<Resume> {
  const { resume_id, step5_complete, ...rest } = payload;
  const values = mapResumeToDbFields(rest);

  const columns: Array<[keyof typeof values, string]> = [
    ['title', 'title'],
    ['last_name_kanji', 'last_name_kanji'],
    ['first_name_kanji', 'first_name_kanji'],
    ['last_name_kana', 'last_name_kana'],
    ['first_name_kana', 'first_name_kana'],
    ['gender', 'gender'],
    ['email', 'email'],
    ['phone_number', 'phone_number'],
    ['postal_code', 'postal_code'],
    ['address_prefecture', 'address_prefecture'],
    ['address_city', 'address_city'],
    ['address_line1', 'address_line1'],
    ['address_line2', 'address_line2'],
    ['contact_address', 'contact_address'],
    ['contact_phone', 'contact_phone'],
    ['contact_email', 'contact_email'],
    ['dependents_count', 'dependents_count'],
    ['has_spouse', 'has_spouse'],
    ['spouse_is_dependent', 'spouse_is_dependent'],
    ['job_change_count', 'job_change_count'],
    ['current_status', 'current_status'],
    ['desired_joining_date', 'desired_joining_date'],
    ['transferable_skills', 'transferable_skills'],
    ['self_pr', 'self_pr'],
    ['summary', 'summary'],
    ['profile_photo_url', 'profile_photo_url'],
  ];

  const setClauses: string[] = [];
  const params: unknown[] = [resume_id];
  let index = 2;

  for (const [valueKey, columnName] of columns) {
    const value = values[valueKey];
    if (value === undefined) continue;

    if (columnName === 'job_change_count' || columnName === 'dependents_count') {
      params.push(toNullableSmallint(value));
    } else {
      params.push(value);
    }

    setClauses.push(`${columnName} = $${index}`);
    index += 1;
  }

  const dob = buildDate(payload.dob_year ?? null, payload.dob_month ?? null, payload.dob_day ?? 1);
  const hasDobPatch =
    payload.dob_year !== undefined || payload.dob_month !== undefined || payload.dob_day !== undefined;
  if (hasDobPatch) {
    params.push(dob);
    setClauses.push(`dob = $${index}`);
    index += 1;
  }

  if (step5_complete) {
    setClauses.push('step5_completed_at = coalesce(step5_completed_at, now())');
  }

  setClauses.push('updated_at = now()');
  const result = await saveWithDesiredConditions({
    query: `update resume_drafts set ${setClauses.join(', ')} where resume_id = $1 returning *`,
    params,
  }, resume_id, rest);
  if (!result) throw new Error('Resume not found for patch');
  const shouldSendStep5Notification = step5_complete === true && result.admin_notified_at == null;

  if (shouldSendStep5Notification) {
    const correlationId = randomUUID();

    try {
      await sendResumeStep5Notification(resume_id);
      await query(
        `update resume_drafts
         set admin_notified_at = coalesce(admin_notified_at, now()),
             admin_notification_error = null,
             updated_at = now()
         where resume_id = $1`,
        [resume_id]
      );
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : 'Error';
      const message = error instanceof Error ? error.message : 'Unknown Resend notification error';
      const safeError = `${name}: ${message}`.replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 500);

      console.error('Step5 Resend notification error', { correlationId, resumeId: resume_id, message: safeError });

      await query(
        `update resume_drafts
         set admin_notification_error = $2,
             updated_at = now()
         where resume_id = $1
           and admin_notified_at is null`,
        [resume_id, safeError]
      );
    }
  }

  return mapDbResume(result);
}

export async function updateResumeFields(resumeIdentifier: string, fields: ResumeUpdateFields): Promise<Resume> {
  const values = mapResumeToDbFields(fields);
  const profileUrl =
    typeof values.profile_photo_url === 'string'
      ? values.profile_photo_url
      : Array.isArray(fields.profilePhoto)
        ? ((fields.profilePhoto[0] as { url?: string } | undefined)?.url ?? null)
        : null;

  const where = isUuid(resumeIdentifier) ? 'id = $1' : 'resume_id = $1';

  const { rows } = await query<Record<string, unknown>>(
    `update resume_drafts
     set profile_photo_url = coalesce($2, profile_photo_url),
         updated_at = now()
     where ${where}
     returning *`,
    [resumeIdentifier, profileUrl]
  );

  const row = rows[0];
  if (!row) {
    throw new Error('Resume not found for profile photo update');
  }

  return mapDbResume(row);
}

export type ResumeListItem = {
  resume_id: string;
  nameKanji: string;
  furigana: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  currentStatus?: string | null;
  addressCity?: string | null;
};

type ResumeListParams = {
  pageSize: number;
  cursor?: string | null;
  q?: string | null;
  sort?: 'updated_at' | 'created_at';
};

export type ResumeBundle = {
  resume: Resume;
  educations: Array<{ id: string; [key: string]: unknown }>;
  works: Array<{ id: string; [key: string]: unknown }>;
};

export async function listResumes({
  pageSize,
  cursor,
  q,
  sort = 'updated_at',
}: ResumeListParams): Promise<{
  data: ResumeListItem[];
  nextCursor: string | null;
  pageSize: number;
}> {
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const offset = Number(cursor ?? '0');
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
  const sortField = sort === 'created_at' ? 'created_at' : 'updated_at';

  const params: unknown[] = [safePageSize + 1, safeOffset];
  const whereSql = q?.trim()
    ? `where concat_ws(' ',
      coalesce(last_name_kanji, ''),
      coalesce(first_name_kanji, ''),
      coalesce(contact_email, ''),
      coalesce(email, ''),
      coalesce(contact_phone, ''),
      coalesce(phone_number, '')
    ) ilike $3`
    : '';

  if (q?.trim()) params.push(`%${q.trim()}%`);

  const { rows } = await query<Record<string, unknown>>(
    `select resume_id, last_name_kanji, first_name_kanji, last_name_kana, first_name_kana,
       contact_email, email, contact_phone, phone_number, current_status, address_city
     from resume_drafts
     ${whereSql}
     order by ${sortField} desc nulls last, resume_id asc
     limit $1 offset $2`,
    params
  );

  const hasNext = rows.length > safePageSize;
  const slice = hasNext ? rows.slice(0, safePageSize) : rows;

  return {
    data: slice.map((row) => {
      const resume = mapDbResume(row);
      return {
        resume_id: resume.resume_id || String(row.resume_id || ''),
        nameKanji: [resume.last_name_kanji, resume.first_name_kanji].filter(Boolean).join(' ').trim(),
        furigana: [resume.last_name_kana, resume.first_name_kana].filter(Boolean).join(' ').trim(),
        contactEmail: resume.contactEmail ?? resume.email ?? null,
        contactPhone: resume.contactPhone ?? resume.phone_number ?? null,
        currentStatus: resume.current_status ?? null,
        addressCity: resume.address_city ?? null,
      };
    }),
    nextCursor: hasNext ? String(safeOffset + safePageSize) : null,
    pageSize: safePageSize,
  };
}

const identifierWhere = (resumeId: string, alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  return isUuid(resumeId)
    ? `(${prefix}id = $1::uuid or ${prefix}resume_id = $1::text)`
    : `${prefix}resume_id = $1`;
};

const educationColumns = `id, school_name, department, degree,
  extract(year from start_date)::int as start_year,
  extract(month from start_date)::int as start_month,
  extract(year from end_date)::int as end_year,
  extract(month from end_date)::int as end_month, is_current`;
const workColumns = `id, company_name, department, position,
  extract(year from start_date)::int as start_year,
  extract(month from start_date)::int as start_month,
  extract(year from end_date)::int as end_year,
  extract(month from end_date)::int as end_month, is_current, description`;

// These views deliberately avoid loading histories, generated text or photos
// on screens that only need a profile or the saved self PR.
export async function getResumeProfile(resumeId: string) {
  const { rows } = await query<Record<string, unknown>>(
    `select resume_id, last_name_kanji, first_name_kanji, last_name_kana, first_name_kana,
       dob, gender, postal_code, address_prefecture, address_city, address_line1, address_line2,
       phone_number, email, contact_address, contact_phone, contact_email,
       dependents_count, has_spouse, spouse_is_dependent
     from resume_drafts where ${identifierWhere(resumeId)} limit 1`, [resumeId]);
  return rows[0] ? { resume: mapDbResume(rows[0]) } : null;
}

export async function getResumeSelfPr(resumeId: string) {
  const { rows } = await query<{ resume_id: string; self_pr: string | null }>(
    `select resume_id, self_pr from resume_drafts where ${identifierWhere(resumeId)} limit 1`, [resumeId]);
  return rows[0] ? { resume: rows[0] } : null;
}

export async function getResumeBundle(resumeId: string): Promise<ResumeBundle | null> {
  if (typeof resumeId !== 'string' || !resumeId.trim()) return null;

  const trimmedResumeId = resumeId.trim();
  const { rows } = await query<Record<string, unknown>>(
    `select r.*,
      coalesce((select jsonb_agg(to_jsonb(c) order by c.condition_type, c.sort_order, c.id)
        from resume_desired_conditions c where c.resume_id = r.id), '[]'::jsonb) as desired,
      coalesce((select jsonb_agg(to_jsonb(e) - 'sort_order' - 'start_date'
          order by e.sort_order, e.start_date nulls last, e.id)
        from (select ${educationColumns}, sort_order, start_date
          from resume_educations where resume_id = r.id) e), '[]'::jsonb) as educations,
      coalesce((select jsonb_agg(to_jsonb(w) - 'sort_order' - 'start_date'
          order by w.sort_order, w.start_date nulls last, w.id)
        from (select ${workColumns}, sort_order, start_date
          from resume_works where resume_id = r.id) w), '[]'::jsonb) as works
     from resume_drafts r where ${identifierWhere(trimmedResumeId, 'r')} limit 1`, [trimmedResumeId]);
  const resumeRow = rows[0];
  if (!resumeRow) return null;

  return {
    resume: mapDbResume({ ...resumeRow, ...groupDesiredConditions(resumeRow.desired as Array<{ condition_type: string; label: string }>) }),
    educations: resumeRow.educations as ResumeBundle['educations'],
    works: resumeRow.works as ResumeBundle['works'],
  };
}

export type ResumeEducationRow = {
  id: string;
  school_name: string;
  department: string | null;
  degree: string | null;
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean | null;
};

export async function getResumeEducations(resumeId: string): Promise<ResumeEducationRow[]> {
  if (typeof resumeId !== 'string' || !resumeId.trim()) return [];

  const { rows } = await query<ResumeEducationRow>(
    `select ${educationColumns}
     from resume_educations
     where resume_id = (select id from resume_drafts where ${identifierWhere(resumeId.trim())} limit 1)
     order by sort_order asc, start_date asc nulls last, id`,
    [resumeId.trim()]
  );

  return rows;
}

export type ResumeWorkRow = {
  id: string;
  company_name: string;
  department: string | null;
  position: string | null;
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean | null;
  description: string | null;
};

export async function getResumeWorks(resumeId: string): Promise<ResumeWorkRow[]> {
  if (typeof resumeId !== 'string' || !resumeId.trim()) return [];

  const { rows } = await query<ResumeWorkRow>(
    `select ${workColumns}
     from resume_works
     where resume_id = (select id from resume_drafts where ${identifierWhere(resumeId.trim())} limit 1)
     order by sort_order asc, start_date asc nulls last, id`,
    [resumeId.trim()]
  );

  return rows;
}

export async function createEducation(data: {
  resume_id: string;
  school_name: string;
  department?: string;
  degree?: string;
  start_year?: number;
  start_month?: number;
  end_year?: number;
  end_month?: number;
  is_current?: boolean;
}) {
  const startDate = buildDate(data.start_year, data.start_month);
  const endDate = data.is_current ? null : buildDate(data.end_year, data.end_month);

  const { rows } = await query<{ id: string }>(
    `insert into resume_educations (
      resume_id, school_name, department, degree,
      start_date, end_date, is_current
    ) select id,$2,$3,$4,$5,$6,$7 from resume_drafts where ${identifierWhere(data.resume_id)}
    returning id`,
    [
      data.resume_id,
      data.school_name,
      data.department ?? null,
      data.degree ?? null,
      startDate,
      endDate,
      data.is_current ?? false,
    ]
  );

  if (!rows[0]) throw new Error('Resume not found');
  return rows[0].id;
}

export async function deleteEducation(id: string) {
  await query('delete from resume_educations where id = $1', [id]);
}

export async function createWork(data: {
  resume_id: string;
  company_name: string;
  department?: string;
  position?: string;
  start_year?: number;
  start_month?: number;
  end_year?: number;
  end_month?: number;
  is_current?: boolean;
  description?: string;
}) {
  const startDate = buildDate(data.start_year, data.start_month);
  const endDate = data.is_current ? null : buildDate(data.end_year, data.end_month);

  const { rows } = await query<{ id: string }>(
    `insert into resume_works (
      resume_id, company_name, department, position,
      start_date, end_date, is_current, description
    ) select id,$2,$3,$4,$5,$6,$7,$8 from resume_drafts where ${identifierWhere(data.resume_id)}
    returning id`,
    [
      data.resume_id,
      data.company_name,
      data.department ?? null,
      data.position ?? null,
      startDate,
      endDate,
      data.is_current ?? false,
      data.description ?? null,
    ]
  );

  if (!rows[0]) throw new Error('Resume not found');
  return rows[0].id;
}

export async function deleteWork(id: string) {
  await query('delete from resume_works where id = $1', [id]);
}
