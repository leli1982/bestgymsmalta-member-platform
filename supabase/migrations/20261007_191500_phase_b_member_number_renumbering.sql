-- Phase B: replace fixed-width permanent BGM numbers with BGM1000-up identities.
-- This migration is intentionally atomic: any failed invariant aborts every change.
-- Member UUID remains the canonical identity. pkCustomer, Scan3/card credentials,
-- photos, membership status/expiry and membership ownership are not renumbered.

lock table public.bgm_members in share row exclusive mode;
lock table public.bgm_member_number_state in row exclusive mode;

-- Fail closed if the pre-Phase-B identity state is not the expected seven-digit format.
do $phase_b_preflight$
declare
  v_member_count bigint;
begin
  perform last_issued
  from public.bgm_member_number_state
  where id = 1
  for update;

  if not found then
    raise exception 'Phase B allocator preflight failed: member-number state row is missing';
  end if;

  select count(*) into v_member_count from public.bgm_members;
  if v_member_count = 0 then
    raise exception 'Phase B member count preflight failed: no members found';
  end if;

  if exists (
    select 1
    from public.bgm_members
    where member_number is null
       or member_number !~ '^BGM[0-9]{7}$'
  ) then
    raise exception 'Phase B old-format preflight failed: member numbers are not uniformly seven-digit BGM values';
  end if;

  if exists (
    select member_number
    from public.bgm_members
    group by member_number
    having count(*) > 1
  ) then
    raise exception 'Phase B duplicate preflight failed: current member numbers are not unique';
  end if;

  if exists (
    select 1
    from public.bgm_member_import_rows
    where resolved_membership_number ~ '^BGM[0-9]{7}$'
      and matched_member_id is null
  ) then
    raise exception 'Phase B old-format import snapshot preflight failed: resolved BGM number has no member UUID';
  end if;

  if exists (
    select 1
    from public.bgm_member_import_rows
    where membership_number ~ '^BGM[0-9]{7}$'
      and matched_member_id is null
  ) then
    raise exception 'Phase B old-format source membership snapshot preflight failed: BGM number has no member UUID';
  end if;

  if exists (
    select 1
    from public.bgm_member_import_review_items
    where member_number ~ '^BGM[0-9]{7}$'
      and member_id is null
  ) then
    raise exception 'Phase B old-format review snapshot preflight failed: BGM number has no member UUID';
  end if;
end
$phase_b_preflight$;

create temporary table phase_b_member_number_map on commit drop as
with ranked as (
  select
    id as member_id,
    member_number as old_member_number,
    row_number() over (
      order by
        substring(member_number from '^BGM([0-9]{7})$')::bigint asc,
        id asc
    )::bigint as rank
  from public.bgm_members
)
select
  member_id,
  old_member_number,
  'BGM' || (999 + rank)::text as new_member_number,
  rank
from ranked;

alter table phase_b_member_number_map
  add primary key (member_id);

create unique index phase_b_member_number_map_new_number_key
  on phase_b_member_number_map (new_member_number);

do $phase_b_map_checks$
declare
  v_member_count bigint;
  v_map_count bigint;
  v_min_rank bigint;
  v_max_rank bigint;
begin
  select count(*) into v_member_count from public.bgm_members;
  select count(*), min(rank), max(rank)
    into v_map_count, v_min_rank, v_max_rank
  from phase_b_member_number_map;

  if v_map_count <> v_member_count then
    raise exception 'Phase B member count mismatch: mapping has %, members have %', v_map_count, v_member_count;
  end if;

  if v_min_rank <> 1 or v_max_rank <> v_map_count then
    raise exception 'Phase B continuity check failed before renumbering';
  end if;

  if exists (
    select new_member_number
    from phase_b_member_number_map
    group by new_member_number
    having count(*) > 1
  ) then
    raise exception 'Phase B duplicate new-number mapping detected';
  end if;

  if exists (
    select 1
    from phase_b_member_number_map
    where new_member_number !~ '^BGM[1-9][0-9]{3,}$'
  ) then
    raise exception 'Phase B mapping produced an invalid canonical member number';
  end if;
end
$phase_b_map_checks$;

-- One-time controlled identity rewrite. The immutability guard is restored below.
drop trigger if exists bgm_enforce_permanent_member_number_trigger
  on public.bgm_members;

alter table public.bgm_members
  drop constraint if exists bgm_members_permanent_member_number_format_check;

update public.bgm_members m
set member_number = x.new_member_number
from phase_b_member_number_map x
where m.id = x.member_id;

-- Preserve import provenance while replacing obsolete BGM snapshots by linked UUID.
update public.bgm_member_import_rows r
set resolved_membership_number = m.member_number
from public.bgm_members m
where r.matched_member_id = m.id
  and r.resolved_membership_number ~ '^BGM[0-9]{7}$';

update public.bgm_member_import_rows r
set membership_number = m.member_number
from public.bgm_members m
where r.matched_member_id = m.id
  and r.membership_number ~ '^BGM[0-9]{7}$';

update public.bgm_member_import_review_items r
set member_number = m.member_number
from public.bgm_members m
where r.member_id = m.id
  and r.member_number ~ '^BGM[0-9]{7}$';

-- Clean-launch reset of development/test activity only. Keep member/source master data.
-- Restrictive children are deleted before their referenced test-history rows.
delete from public.bgm_card_conflict_flags;
delete from public.bgm_access_scans;
delete from public.bgm_card_conflict_reviews;
delete from public.bgm_member_checkins;
delete from public.bgm_audit_log;
delete from public.bgm_member_stats;
delete from public.bgm_member_notifications;
delete from public.bgm_membership_reminder_log;
delete from public.bgm_member_password_resets;
delete from public.bgm_member_push_subscriptions;

-- Remove the old artificial 9,999,999 ceiling and seed the allocator at the
-- highest newly assigned Phase B number.
alter table public.bgm_member_number_state
  drop constraint if exists bgm_member_number_state_last_issued_check;

alter table public.bgm_member_number_state
  add constraint bgm_member_number_state_last_issued_check
  check (last_issued >= 0);

update public.bgm_member_number_state
set last_issued = (
      select max(999 + rank)
      from phase_b_member_number_map
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
    and last_issued < 9223372036854775807
  returning last_issued into next_value;

  if next_value is null then
    raise exception 'BGM membership number range exhausted';
  end if;

  return 'BGM' || next_value::text;
end;
$$;

revoke all on function public.bgm_next_member_number() from public;
revoke all on function public.bgm_next_member_number() from anon;
revoke all on function public.bgm_next_member_number() from authenticated;
grant execute on function public.bgm_next_member_number() to service_role;

-- The legacy_22 bulk import reserves allocator blocks directly. Rewrite only its
-- bulk import allocator ceiling and assigned-number formatter, preserving all
-- matching, pkCustomer, Scan3 and import business rules exactly as they are.
do $phase_b_bulk_import$
declare
  v_definition text;
  v_rewritten text;
begin
  select pg_get_functiondef(
    'public.bgm_apply_member_import_batch(uuid,uuid)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'Phase B bulk import allocator preflight failed: bgm_apply_member_import_batch is missing';
  end if;

  if position('and last_issued + v_new_count <= 9999999' in v_definition) = 0 then
    raise exception 'Phase B bulk import allocator preflight failed: old range ceiling was not found';
  end if;

  v_rewritten := replace(
    v_definition,
    'and last_issued + v_new_count <= 9999999',
    'and last_issued <= 9223372036854775807 - v_new_count'
  );

  if position('lpad(' in lower(v_rewritten)) = 0 then
    raise exception 'Phase B bulk import allocator preflight failed: old padded formatter was not found';
  end if;

  v_definition := v_rewritten;
  v_rewritten := regexp_replace(
    v_definition,
    $pattern$'BGM'\|\|lpad\([[:space:]]*\(v_first_member_no[[:space:]]*\+[[:space:]]*row_number\(\)[[:space:]]*over\([[:space:]]*order by r\.row_number[[:space:]]*\)[[:space:]]*-[[:space:]]*1\)::text,[[:space:]]*7,[[:space:]]*'0'[[:space:]]*\)[[:space:]]*as assigned_member_number$pattern$,
    $replacement$'BGM'||(v_first_member_no + row_number() over(order by r.row_number)-1)::text as assigned_member_number$replacement$,
    'n'
  );

  if v_rewritten = v_definition then
    raise exception 'Phase B bulk import allocator preflight failed: padded assigned-number expression did not match';
  end if;

  if position('lpad(' in lower(v_rewritten)) > 0
     or position('9999999' in v_rewritten) > 0 then
    raise exception 'Phase B bulk import allocator rewrite failed: old padding or ceiling remains';
  end if;

  execute v_rewritten;
end
$phase_b_bulk_import$;

-- Canonical public identity: BGM + an unpadded integer >= 1000 and within bigint.
alter table public.bgm_members
  add constraint bgm_members_permanent_member_number_format_check
  check (
    case
      when member_number ~ '^BGM[1-9][0-9]{3,}$'
      then substring(member_number from 4)::numeric between 1000 and 9223372036854775807
      else false
    end
  );

create or replace function public.bgm_enforce_permanent_member_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.member_number is distinct from old.member_number then
    if old.member_number ~ '^BGM[1-9][0-9]{3,}$'
       and substring(old.member_number from 4)::numeric between 1000 and 9223372036854775807 then
      -- A Phase B BGM identity is lifetime-immutable after the one-time migration.
      new.member_number := old.member_number;
      return new;
    end if;
  end if;

  if new.member_number is null or btrim(new.member_number) = '' then
    new.member_number := public.bgm_next_member_number();
  elsif new.member_number !~ '^BGM[1-9][0-9]{3,}$' then
    new.member_number := public.bgm_next_member_number();
  elsif substring(new.member_number from 4)::numeric > 9223372036854775807 then
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

-- Final fail-closed invariants. Any failure rolls back the whole migration.
do $phase_b_postchecks$
declare
  v_member_count bigint;
  v_map_count bigint;
  v_min bigint;
  v_max bigint;
  v_distinct bigint;
  v_allocator bigint;
  v_import_definition text;
begin
  select count(*) into v_member_count from public.bgm_members;
  select count(*) into v_map_count from phase_b_member_number_map;

  if v_member_count <> v_map_count then
    raise exception 'Phase B member count invariant failed after renumbering';
  end if;

  if exists (
    select member_number
    from public.bgm_members
    group by member_number
    having count(*) > 1
  ) then
    raise exception 'Phase B duplicate invariant failed after renumbering';
  end if;

  if exists (
    select 1
    from public.bgm_members
    where member_number !~ '^BGM[1-9][0-9]{3,}$'
       or substring(member_number from 4)::numeric > 9223372036854775807
  ) then
    raise exception 'Phase B canonical member-number invariant failed';
  end if;

  select
    min(substring(member_number from 4)::bigint),
    max(substring(member_number from 4)::bigint),
    count(distinct substring(member_number from 4)::bigint)
  into v_min, v_max, v_distinct
  from public.bgm_members;

  if v_min <> 1000
     or v_max <> 999 + v_member_count
     or v_distinct <> v_member_count
     or (v_max - v_min + 1) <> v_member_count then
    raise exception 'Phase B continuity invariant failed';
  end if;

  select last_issued into v_allocator
  from public.bgm_member_number_state
  where id = 1;

  if v_allocator <> v_max then
    raise exception 'Phase B allocator invariant failed: expected %, found %', v_max, v_allocator;
  end if;

  if exists (
    select 1 from public.bgm_members
    where member_number ~ '^BGM[0-9]{7}$'
  ) then
    raise exception 'Phase B old-format invariant failed: old member number remains';
  end if;

  if exists (
    select 1 from public.bgm_member_import_rows
    where resolved_membership_number ~ '^BGM[0-9]{7}$'
       or membership_number ~ '^BGM[0-9]{7}$'
  ) then
    raise exception 'Phase B old-format invariant failed: old import BGM snapshot remains';
  end if;

  if exists (
    select 1 from public.bgm_member_import_review_items
    where member_number ~ '^BGM[0-9]{7}$'
  ) then
    raise exception 'Phase B old-format invariant failed: old review BGM snapshot remains';
  end if;

  select pg_get_functiondef(
    'public.bgm_apply_member_import_batch(uuid,uuid)'::regprocedure
  ) into v_import_definition;

  if position('lpad(' in lower(v_import_definition)) > 0
     or position('9999999' in v_import_definition) > 0 then
    raise exception 'Phase B bulk import allocator invariant failed';
  end if;
end
$phase_b_postchecks$;
