-- BestGymsMalta permanent membership identity, exchange import staging and barcode credential support.
-- Membership numbers are permanent person identifiers: BGM + exactly seven digits.

create table if not exists public.bgm_member_number_state (
  id smallint primary key check (id = 1),
  last_issued bigint not null default 0 check (last_issued between 0 and 9999999),
  updated_at timestamptz not null default now()
);

insert into public.bgm_member_number_state (id, last_issued)
values (1, 0)
on conflict (id) do nothing;

-- Observe only already-correct permanent numbers. Historical/demo numeric IDs are
-- deliberately not interpreted as permanent BGM membership numbers.
update public.bgm_member_number_state
set last_issued = greatest(
  last_issued,
  coalesce((
    select max(substring(member_number from '^BGM([0-9]{7})$')::bigint)
    from public.bgm_members
    where member_number ~ '^BGM[0-9]{7}$'
  ), 0)
),
updated_at = now()
where id = 1;

create or replace function public.bgm_next_member_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
begin
  update public.bgm_member_number_state
  set last_issued = last_issued + 1,
      updated_at = now()
  where id = 1
    and last_issued < 9999999
  returning last_issued into next_value;

  if next_value is null then
    raise exception 'BGM membership number range exhausted';
  end if;

  return 'BGM' || lpad(next_value::text, 7, '0');
end;
$$;

-- The service-role-backed server is the allocator. Do not expose direct allocation
-- to browser/database client roles.
revoke all on function public.bgm_next_member_number() from public;
revoke all on function public.bgm_next_member_number() from anon;
revoke all on function public.bgm_next_member_number() from authenticated;

alter table public.bgm_members
  alter column member_number set default public.bgm_next_member_number(),
  alter column email drop not null,
  add column if not exists legacy_gym text,
  add column if not exists legacy_pk_customer text,
  add column if not exists company_name text,
  add column if not exists town text,
  add column if not exists gender text,
  add column if not exists telephone_no_1 text,
  add column if not exists telephone_no_2 text,
  add column if not exists mobile text;

-- Legacy source data contains duplicate and blank emails. Email is contact data,
-- not a unique person key.
alter table public.bgm_members
  drop constraint if exists bgm_members_email_key;

create index if not exists bgm_members_email_lower_idx
  on public.bgm_members (lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists bgm_members_legacy_pk_idx
  on public.bgm_members (legacy_pk_customer);

create index if not exists bgm_members_legacy_gym_pk_idx
  on public.bgm_members (lower(legacy_gym), legacy_pk_customer)
  where legacy_gym is not null and legacy_pk_customer is not null;

create table if not exists public.bgm_member_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by_system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  filename text not null,
  file_format text not null check (file_format in ('xlsx', 'csv')),
  import_mode text not null check (import_mode in ('legacy_15', 'exchange_16')),
  status text not null default 'preview' check (status in ('preview', 'applied', 'cancelled', 'failed')),
  total_rows integer not null default 0,
  new_rows integer not null default 0,
  update_rows integer not null default 0,
  unchanged_rows integer not null default 0,
  conflict_rows integer not null default 0,
  invalid_rows integer not null default 0,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bgm_member_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bgm_member_import_batches(id) on delete cascade,
  row_number integer not null,
  membership_number text,
  gym text,
  pk_customer text,
  customer_name text,
  company_name text,
  address1 text,
  address2 text,
  town text,
  postcode text,
  gender text,
  telephone_no_1 text,
  telephone_no_2 text,
  mobile text,
  email text,
  expiry_date date,
  valid_yn text,
  source_fingerprint text not null,
  action text not null check (action in ('new', 'update', 'unchanged', 'conflict', 'invalid')),
  matched_member_id uuid references public.bgm_members(id) on delete set null,
  issue text,
  resolved_membership_number text,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index if not exists bgm_member_import_rows_batch_action_idx
  on public.bgm_member_import_rows (batch_id, action);

-- Generalise the access-attempt record so barcode and NFC can coexist. NFC
-- remains fully intact for possible future activation.
alter table public.bgm_access_scans
  add column if not exists credential_type text not null default 'nfc',
  add column if not exists credential_value text;

update public.bgm_access_scans
set credential_value = card_uid
where credential_value is null and card_uid is not null;

alter table public.bgm_access_scans
  alter column card_uid drop not null,
  alter column credential_value set not null;

alter table public.bgm_access_scans
  drop constraint if exists bgm_access_scans_credential_type_check;

alter table public.bgm_access_scans
  add constraint bgm_access_scans_credential_type_check
  check (credential_type in ('nfc', 'barcode'));

alter table public.bgm_access_scans
  drop constraint if exists bgm_access_scans_result_check;

alter table public.bgm_access_scans
  add constraint bgm_access_scans_result_check
  check (result in (
    'granted',
    'expired',
    'inactive',
    'unknown_card',
    'disabled_card',
    'unknown_member',
    'invalid_barcode'
  ));

alter table public.bgm_member_number_state enable row level security;
alter table public.bgm_member_import_batches enable row level security;
alter table public.bgm_member_import_rows enable row level security;

revoke all on table public.bgm_member_number_state from anon, authenticated;
revoke all on table public.bgm_member_import_batches from anon, authenticated;
revoke all on table public.bgm_member_import_rows from anon, authenticated;
