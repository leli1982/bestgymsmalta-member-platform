-- C4 Google Wallet membership passes.
-- Additive server-managed projection metadata only. Google/network work stays in Next.js.

create table if not exists public.bgm_google_wallet_passes (
  member_id uuid primary key references public.bgm_members(id) on delete cascade,
  object_id text not null unique,
  class_id text not null,
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','failed')),
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bgm_google_wallet_passes enable row level security;

-- The Wallet mapping is server-managed. Member and staff clients never access it directly.
revoke all on table public.bgm_google_wallet_passes from anon, authenticated;
grant select, insert, update, delete on table public.bgm_google_wallet_passes to service_role;

create or replace function public.bgm_mark_google_wallet_member_pending()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.bgm_google_wallet_passes
  set sync_status = 'pending',
      last_error = null,
      updated_at = now()
  where member_id = new.id;

  return new;
end;
$$;

revoke all on function public.bgm_mark_google_wallet_member_pending() from public, anon, authenticated;
grant execute on function public.bgm_mark_google_wallet_member_pending() to service_role;

drop trigger if exists bgm_google_wallet_member_pending on public.bgm_members;
create trigger bgm_google_wallet_member_pending
after update of
  member_number,
  full_name,
  first_name,
  last_name,
  status,
  membership_expiry,
  cancellation_effective_date,
  archived_at
on public.bgm_members
for each row
execute function public.bgm_mark_google_wallet_member_pending();

create or replace function public.bgm_mark_google_wallet_card_pending()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.member_id is not null then
    update public.bgm_google_wallet_passes
    set sync_status = 'pending',
        last_error = null,
        updated_at = now()
    where member_id = old.member_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.member_id is not null then
    update public.bgm_google_wallet_passes
    set sync_status = 'pending',
        last_error = null,
        updated_at = now()
    where member_id = new.member_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.bgm_mark_google_wallet_card_pending() from public, anon, authenticated;
grant execute on function public.bgm_mark_google_wallet_card_pending() to service_role;

drop trigger if exists bgm_google_wallet_card_pending on public.bgm_member_card_credentials;
create trigger bgm_google_wallet_card_pending
after insert or update or delete on public.bgm_member_card_credentials
for each row
execute function public.bgm_mark_google_wallet_card_pending();
