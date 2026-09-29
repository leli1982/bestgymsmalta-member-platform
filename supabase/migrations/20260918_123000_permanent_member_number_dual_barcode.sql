-- BestGymsMalta permanent member identity hardening.
-- Permanent BGM membership numbers and physical-card/pkCustomer numbers are
-- separate identifiers. Legacy manual-card numbers may be duplicated, so they
-- must never be forced into a globally unique credential during backfill.

-- Preserve any transitional non-BGM member_number as pkCustomer when that field
-- is still blank. This keeps the old/current physical-card number visible and
-- scannable without merging or deleting duplicate legacy members.
update public.bgm_members
set legacy_pk_customer = btrim(member_number),
    updated_at = now()
where (legacy_pk_customer is null or btrim(legacy_pk_customer) = '')
  and member_number is not null
  and btrim(member_number) <> ''
  and member_number !~ '^BGM[0-9]{7}$';

-- Convert every missing/transitional person identifier into the permanent BGM
-- number. The old/current card number remains separately in legacy_pk_customer
-- or bgm_member_card_credentials.
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
    -- from copying a physical CardBarcode/pkCustomer into member_number.
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
