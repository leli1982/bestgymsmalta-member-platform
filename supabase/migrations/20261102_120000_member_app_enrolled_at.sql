alter table public.bgm_members
  add column if not exists app_enrolled_at timestamptz;

comment on column public.bgm_members.app_enrolled_at is
  'Timestamp of the member first activating the BGM member app. Null for legacy app enrollments created before activation tracking was introduced.';
