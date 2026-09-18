-- BestGymsMalta permanent member identity hardening.
-- Permanent BGM membership numbers and physical card barcodes are separate identifiers.
-- Legacy transitional member_number values are preserved as card credentials only
-- when the member has no credential history, then every member receives BGM000000x.

do $$
begin
  if exists (
    select 1
    from public.bgm_members
    where member_number is not null
      and btrim(member_number) <> ''
      and member_number !~ '^BGM[0-9]{7}$'
    group by btrim(member_number)
    having count(*) > 1
  ) then
    raise exception 'Duplicate transitional member/card numbers exist. Resolve them before permanent-number backfill.';
  end if;

  if exists (
    select 1
    from public.bgm_members m
    join public.bgm_member_card_credentials c
      on c.barcode_value = btrim(m.member_number)
     and c.member_id is distinct from m.id
    where m.member_number is not null
      and btrim(m.member_number) <> ''
      and m.member_number !~ '^BGM[0-9]{7}$'
  ) then
    raise exception 'A transitional member number is already owned by another card credential.';
  end if;
end;
$$;

-- Preserve the old/preprinted physical card when an older transitional member
-- has no card-credential history yet. Never replace an already-managed card.
insert into public.bgm_member_card_credentials (
  barcode_value,
  member_id,
  application_member_id,
  status,
  reserved_at,
  activated_at,
  created_by_system_user_id,
  updated_at
)
select
  btrim(m.member_number),
  m.id,
  null,
  'active',
  now(),
  now(),
  null,
  now()
from public.bgm_members m
where m.member_number is not null
  and btrim(m.member_number) <> ''
  and m.member_number !~ '^BGM[0-9]{7}$'
  and not exists (
    select 1
    from public.bgm_member_card_credentials c
    where c.member_id = m.id
  )
  and not exists (
    select 1
    from public.bgm_member_card_credentials c
    where c.barcode_value = btrim(m.member_number)
  );

-- Convert every missing/transitional person identifier into the permanent BGM
-- number. The physical barcode remains in bgm_member_card_credentials.
update public.bgm_members
set member_number = public.bgm_next_member_number(),
    updated_at = now()
where member_number is null
   or btrim(member_number) = ''
   or member_number !~ '^BGM[0-9]{7}$';

create unique index if not exists bgm_members_permanent_member_number_key
  on public.bgm_members (member_number);

alter table public.bgm_members
  alter column member_number set default public.bgm_next_member_number(),
  alter column member_number set not null;

alter table public.bgm_members
  drop constraint if exists bgm_members_permanent_member_number_format_check;

alter table public.bgm_members
  add constraint bgm_members_permanent_member_number_format_check
  check (member_number ~ '^BGM[0-9]{7}$');

create or replace function public.bgm_enforce_permanent_member_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.member_number ~ '^BGM[0-9]{7}$'
     and new.member_number is distinct from old.member_number then
    -- Lifetime BGM identity is immutable. This also prevents older import code
    -- from copying a physical CardBarcode back into member_number.
    new.member_number := old.member_number;
  elsif new.member_number is null
     or btrim(new.member_number) = ''
     or new.member_number !~ '^BGM[0-9]{7}$' then
    new.member_number := public.bgm_next_member_number();
  end if;

  return new;
end;
$$;

drop trigger if exists bgm_enforce_permanent_member_number_trigger
  on public.bgm_members;

create trigger bgm_enforce_permanent_member_number_trigger
before insert or update of member_number
on public.bgm_members
for each row
execute function public.bgm_enforce_permanent_member_number();

revoke all on function public.bgm_enforce_permanent_member_number() from public;
revoke all on function public.bgm_enforce_permanent_member_number() from anon;
revoke all on function public.bgm_enforce_permanent_member_number() from authenticated;
grant execute on function public.bgm_enforce_permanent_member_number() to service_role;
