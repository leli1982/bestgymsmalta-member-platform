-- BestGymsMalta official member photo provenance.
-- Storage objects remain private; this table records the lifecycle/audit metadata
-- while bgm_members.official_photo_path and the pending application participant
-- official_photo_path remain the current-photo pointers.

create table if not exists public.bgm_member_official_photos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.bgm_members(id) on delete restrict,
  application_member_id uuid references public.bgm_membership_application_members(id) on delete cascade,
  object_path text not null check (btrim(object_path) <> ''),
  source text not null check (source in ('legacy_import', 'new_membership', 'renewal', 'reception_capture')),
  captured_at timestamptz not null default now(),
  system_user_id uuid references public.bgm_system_users(id) on delete set null,
  gym_id text references public.bgm_gyms(id) on update cascade on delete set null,
  staff_name text,
  created_at timestamptz not null default now(),
  unique (object_path),
  constraint bgm_member_official_photos_exactly_one_target_check check (
    (member_id is not null and application_member_id is null)
    or
    (member_id is null and application_member_id is not null)
  ),
  constraint bgm_member_official_photos_staff_name_check check (
    staff_name is null or btrim(staff_name) <> ''
  )
);

create index if not exists bgm_member_official_photos_member_captured_idx
  on public.bgm_member_official_photos (member_id, captured_at desc)
  where member_id is not null;

create index if not exists bgm_member_official_photos_application_member_captured_idx
  on public.bgm_member_official_photos (application_member_id, captured_at desc)
  where application_member_id is not null;

create index if not exists bgm_member_official_photos_source_idx
  on public.bgm_member_official_photos (source);

alter table public.bgm_member_official_photos enable row level security;
revoke all on table public.bgm_member_official_photos from anon, authenticated;
