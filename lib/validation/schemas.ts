import { z } from 'zod';

// 基本情報 + ステップ2以降 + AI生成テキスト
const optionalString = (max: number) =>
  z
    .union([z.string().max(max), z.literal('')])
    .optional()
    .nullable()
    .transform((value) => (value === '' || value == null ? undefined : value))
    .optional()
    .nullable();

const optionalEmail = z
  .union([z.string().email().max(254), z.literal('')])
  .optional()
  .nullable()
    .transform((value) => (value === '' || value == null ? undefined : value))
    .optional()
    .nullable();

const optionalInt = z
  .union([z.number(), z.string(), z.literal('')])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === '' || value == null) return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  })
  .optional()
  .nullable();

const optionalDependentsCount = z
  .union([z.string(), z.number(), z.literal('')])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === '' || value == null) return undefined;
    return String(value);
  })
  .optional()
  .nullable();

export const ResumeSchema = z.object({
  // 必須系
  user_id: z.string().min(1, "User ID is required"),
  resume_id: z.string().optional(), // 更新時に必要
  title: optionalString(200),
  
  // Step 1
  last_name_kanji: z.string().min(1, "姓を入力してください"),
  first_name_kanji: z.string().min(1, "名を入力してください"),
  last_name_kana: optionalString(100),
  first_name_kana: optionalString(100),
  dob_year: z.number().min(1900).max(new Date().getFullYear()),
  dob_month: z.number().min(1).max(12),
  dob_day: z.number().min(1).max(31),
  gender: optionalString(20),
  email: optionalString(254),
  postal_code: optionalString(20),
  address_prefecture: optionalString(100),
  address_city: optionalString(200),
  address_line1: optionalString(200),
  address_line2: optionalString(200),
  phone_number: optionalString(50),
  contactAddress: optionalString(200),
  contactPhone: optionalString(50),
  contactEmail: optionalEmail,
  dependents_count: optionalDependentsCount,
  has_spouse: z.boolean().optional(),
  spouse_is_dependent: z.boolean().optional(),

  // Step 2: 状況
  job_change_count: optionalInt,
  current_status: optionalString(100),
  desired_joining_date: optionalString(100),

  // Step 5: 希望条件
  desired_occupations: z.array(z.string()).optional(),
  desired_industries: z.array(z.string()).optional(),
  desired_locations: z.array(z.string()).optional(),
  licenses_qualifications: z.array(z.string()).optional(),

  // Step 3+ : AI生成の活かせる経験・知識
  transferable_skills: optionalString(10000),

  // ★追加: AI生成テキスト (ここがないと保存時に消されてしまう)
  self_pr: optionalString(10000),
  summary: optionalString(10000),
});


export const ResumePatchSchema = ResumeSchema.partial().extend({
  resume_id: z.string().min(1, "resume_id is required"),
  step5_complete: z.boolean().optional(),
});

// 学歴
export const EducationSchema = z.object({
  resume_id: z.string().min(1),
  school_name: z.string().min(1, "学校名を入力してください"),
  department: z.string().optional(),
  degree: z.string().optional(),
  start_year: z.number().min(1900),
  start_month: z.number().min(1).max(12),
  end_year: z.number().optional(),
  end_month: z.number().optional(),
  is_current: z.boolean().optional(),
});

// 職歴
export const WorkSchema = z.object({
  resume_id: z.string().min(1),
  company_name: z.string().min(1, "企業名を入力してください"),
  department: z.string().optional(),
  position: z.string().optional(),
  start_year: z.number().min(1900),
  start_month: z.number().min(1).max(12),
  end_year: z.number().optional(),
  end_month: z.number().optional(),
  is_current: z.boolean().optional(),
  description: z.string().optional(),
});
