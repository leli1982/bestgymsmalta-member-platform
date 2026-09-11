-- BestGymsMalta preprinted physical-card credential lifecycle.
-- The permanent person identity remains bgm_members.id (UUID).
-- A scanned physical-card barcode is a replaceable credential and is never reused
-- after it has been issued and retired.

alter table public.bgm_members
  alter column member_number drop default,
  alter column member_number drop not null;

create table if not exists public.bgm_member_card_credentials (
  id uuid primary key default gen_random_uuid(),
  barcode_value text not null check (btrim(barcode_value) <> ''),
  member_id uuid references public.bgm_members(id) on delete restrict,
  application_member_id uuid references public.bgm_membership_application_members(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved', 'active', 'retired')),
  reserved_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  retired_reason text,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (barcode_value),
  constraint bgm_member_card_credentials_lifecycle_check check (
    (
      status = 'reserved'
      and application_member_id is not null
      and member_id is null
      and activated_at is null
      and retired_at is null
      and retired_reason is null
    )
    or
    (
      status = 'active'
      and member_id is not null
      and activated_at is not null
      and retired_at is null
      and retired_reason is null
    )
    or
    (
      status = 'retired'
      and member_id is not null
      and activated_at is not null
      and retired_at is not null
      and retired_reason is not null
      and btrim(retired_reason) <> ''
    )
  )
);

create unique index if not exists bgm_member_card_credentials_one_active_per_member_key
  on public.bgm_member_card_credentials (member_id)
  where status = 'active';

create unique index if not exists bgm_member_card_credentials_one_reserved_per_application_member_key
  on public.bgm_member_card_credentials (application_member_id)
  where status = 'reserved';

create index if not exists bgm_member_card_credentials_member_status_idx
  on public.bgm_member_card_credentials (member_id, status)
  where member_id is not null;

create index if not exists bgm_member_card_credentials_application_member_status_idx
  on public.bgm_member_card_credentials (application_member_id, status)
  where application_member_id is not null;

create index if not exists bgm_member_card_credentials_status_idx
  on public.bgm_member_card_credentials (status);

alter table public.bgm_member_card_credentials enable row level security;
revoke all on table public.bgm_member_card_credentials from anon, authenticated;
