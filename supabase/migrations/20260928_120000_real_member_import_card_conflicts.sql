-- Authoritative 22-column AllCustomers3 import. The source pkCustomer is a
-- legacy identifier; Scan3 is a physical card claim and may be shared.
alter table public.bgm_members add column if not exists country text;
alter table public.bgm_members
  add column if not exists real_import_batch_id uuid,
  add column if not exists real_import_row_number integer;
create unique index if not exists bgm_members_real_import_origin_uq
  on public.bgm_members(real_import_batch_id, real_import_row_number)
  where real_import_batch_id is not null;

-- Historical pkCustomer must never change as a side effect of card assignment.
drop trigger if exists bgm_sync_pkcustomer_from_active_card_trigger
  on public.bgm_member_card_credentials;
comment on column public.bgm_members.legacy_pk_customer is
  'Original source pkCustomer, nonunique and independent of physical Scan3/card assignment.';

create table if not exists public.bgm_real_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  source_sha256 text not null unique,
  source_sheet text not null,
  source_rows integer not null,
  exact_duplicate_skips integer not null,
  expired_redundant_skips integer not null,
  rejected_rows integer not null,
  planned_members integer not null,
  duplicate_pk_values integer not null,
  duplicate_scan3_values integer not null,
  active_conflict_values integer not null,
  imported_members integer not null default 0,
  status text not null default 'loading' check (status in ('loading','complete','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.bgm_real_import_rows (
  batch_id uuid not null references public.bgm_real_import_batches(id),
  row_number integer not null,
  source_data jsonb not null,
  action text not null check (action in ('import','exact_duplicate','expired_redundant','rejected')),
  duplicate_of_row integer,
  reason text,
  member_id uuid references public.bgm_members(id),
  primary key(batch_id,row_number)
);
create index if not exists bgm_real_import_rows_member_idx
  on public.bgm_real_import_rows(member_id) where member_id is not null;

create table if not exists public.bgm_legacy_card_claims (
  member_id uuid primary key references public.bgm_members(id) on delete restrict,
  scan3 text not null,
  assignment_status text not null default 'active'
    check (assignment_status in ('active','removed')),
  import_batch_id uuid references public.bgm_real_import_batches(id),
  source_row_number integer,
  updated_at timestamptz not null default now()
);
create index if not exists bgm_legacy_card_claims_scan3_idx
  on public.bgm_legacy_card_claims(scan3) where assignment_status='active';

create table if not exists public.bgm_card_conflict_reviews (
  id uuid primary key default gen_random_uuid(),
  scan3 text not null,
  gym_id text references public.bgm_gyms(id),
  requested_by_system_user_id uuid not null references public.bgm_system_users(id),
  requested_at timestamptz not null default now(),
  status text not null default 'unresolved' check (status in ('unresolved','resolved')),
  resolved_by_system_user_id uuid references public.bgm_system_users(id),
  resolved_at timestamptz,
  resolution_note text
);
create unique index if not exists bgm_card_conflict_one_open_per_scan3
  on public.bgm_card_conflict_reviews(scan3) where status='unresolved';
create table if not exists public.bgm_card_conflict_flags (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.bgm_card_conflict_reviews(id),
  scan3 text not null,
  gym_id text references public.bgm_gyms(id),
  system_user_id uuid not null references public.bgm_system_users(id),
  scan_id uuid references public.bgm_access_scans(id),
  member_ids uuid[] not null,
  flagged_at timestamptz not null default now()
);

alter table public.bgm_real_import_batches enable row level security;
alter table public.bgm_real_import_rows enable row level security;
alter table public.bgm_legacy_card_claims enable row level security;
alter table public.bgm_card_conflict_reviews enable row level security;
alter table public.bgm_card_conflict_flags enable row level security;
revoke all on public.bgm_real_import_batches, public.bgm_real_import_rows,
  public.bgm_legacy_card_claims, public.bgm_card_conflict_reviews,
  public.bgm_card_conflict_flags from anon, authenticated;

create or replace view public.bgm_active_card_conflicts as
select c.scan3, array_agg(m.id order by m.member_number) as member_ids,
       count(*)::integer as member_count
from public.bgm_legacy_card_claims c
join public.bgm_members m on m.id=c.member_id
where c.assignment_status='active' and m.status='active'
  and m.membership_expiry >= (now() at time zone 'Europe/Malta')::date
  and (m.cancellation_effective_date is null or
       m.cancellation_effective_date > (now() at time zone 'Europe/Malta')::date)
group by c.scan3 having count(*) > 1;
revoke all on public.bgm_active_card_conflicts from anon, authenticated;
