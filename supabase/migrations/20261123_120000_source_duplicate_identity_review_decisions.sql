-- Review decisions ONLY. Does not change member identities, physical cards,
-- membership history, access decisions or existing Card Conflict Review flags.
-- Source duplicate keys/counts are tracked in versioned server code; this
-- table stores only subsequent human decisions made by authenticated Super Admin.
create table if not exists public.bgm_source_duplicate_review_decisions (
  legacy_pk_customer text primary key,
  status text not null check (status in ('pending','reviewed')),
  resolution_note text not null default '',
  reviewed_by_system_user_id uuid references public.bgm_system_users(id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint bgm_source_duplicate_pk_normalized check (
    legacy_pk_customer = lower(btrim(legacy_pk_customer))
    and legacy_pk_customer <> ''
  ),
  constraint bgm_source_duplicate_note_reviewed check (
    status <> 'reviewed'
    or (length(btrim(resolution_note)) > 0 and reviewed_at is not null)
  )
);

alter table public.bgm_source_duplicate_review_decisions enable row level security;
revoke all on public.bgm_source_duplicate_review_decisions from public, anon, authenticated;
grant select, insert, update on public.bgm_source_duplicate_review_decisions to service_role;
comment on table public.bgm_source_duplicate_review_decisions is
  'Manual identity-review decisions for repeated legacy pkCustomer values in the latest authorized source import. Does not resolve or alter physical Scan3 card collisions.';
