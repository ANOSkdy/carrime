alter table resume_drafts
  add column if not exists step5_completed_at timestamptz;
