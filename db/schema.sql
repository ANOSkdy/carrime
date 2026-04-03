create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text,
  auth_provider text not null default 'anonymous',
  auth_subject text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resume_drafts (
  id uuid primary key default gen_random_uuid(),
  resume_id text not null unique,
  user_id uuid references users(id) on delete set null,
  title text,
  status text not null default 'draft',
  last_name_kanji text not null,
  first_name_kanji text not null,
  last_name_kana text,
  first_name_kana text,
  dob date,
  gender text,
  email text,
  phone_number text,
  postal_code text,
  address_prefecture text,
  address_city text,
  address_line1 text,
  address_line2 text,
  contact_address text,
  contact_phone text,
  contact_email text,
  has_separate_contact boolean not null default false,
  dependents_count text,
  has_spouse boolean,
  spouse_is_dependent boolean,
  job_change_count int,
  current_status text,
  desired_joining_date text,
  transferable_skills text,
  self_pr text,
  summary text,
  profile_photo_url text,
  step5_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resume_desired_conditions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resume_drafts(id) on delete cascade,
  condition_type text not null,
  label text not null,
  sort_order int not null default 0
);

create table if not exists resume_educations (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resume_drafts(id) on delete cascade,
  sort_order int not null default 0,
  school_name text not null,
  department text,
  degree text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resume_works (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resume_drafts(id) on delete cascade,
  sort_order int not null default 0,
  company_name text not null,
  department text,
  position text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lookup_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table if not exists lookup_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references lookup_categories(id) on delete cascade,
  code text,
  label text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  unique(category_id, label)
);

create index if not exists idx_resume_drafts_resume_id on resume_drafts(resume_id);
create index if not exists idx_resume_drafts_updated_at on resume_drafts(updated_at desc);
create index if not exists idx_resume_educations_resume_id_sort on resume_educations(resume_id, sort_order);
create index if not exists idx_resume_works_resume_id_sort on resume_works(resume_id, sort_order);
create index if not exists idx_resume_desired_conditions_resume_type_sort on resume_desired_conditions(resume_id, condition_type, sort_order);
create index if not exists idx_lookup_items_category_display_order on lookup_items(category_id, display_order);
