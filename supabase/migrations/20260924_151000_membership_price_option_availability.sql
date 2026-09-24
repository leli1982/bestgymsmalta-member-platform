-- One availability flag per versioned membership price. Only draft catalog entries
-- may be edited; published/retired catalogs retain their original prices and flags.
alter table public.bgm_membership_price_entries
  add column if not exists is_active boolean not null default true;

-- Bring existing drafts into line with the initial BGM offering without touching
-- published catalogs. Re-enable options from the Super Admin editor in a new draft.
update public.bgm_membership_price_entries e
set is_active = false
from public.bgm_membership_price_catalog_versions c
where c.id = e.catalog_version_id
  and c.status = 'draft'
  and (
    (e.membership_type = 'student' and e.duration_key = '2_weeks')
    or (e.membership_type = 'couples' and e.duration_key in ('1_week','2_weeks','1_month'))
    or e.amount_cents = 0
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bgm_membership_price_entries'::regclass
      and conname = 'bgm_active_membership_price_positive'
  ) then
    alter table public.bgm_membership_price_entries
      add constraint bgm_active_membership_price_positive
      check (not is_active or amount_cents > 0);
  end if;
end;
$$;

create or replace function public.bgm_assert_membership_price_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total integer;
  v_enabled_types integer;
begin
  if old.status = 'draft' and new.status = 'published' then
    select count(*), count(distinct membership_type) filter (where is_active)
      into v_total, v_enabled_types
    from public.bgm_membership_price_entries
    where catalog_version_id = new.id;
    if v_total <> 18 or v_enabled_types <> 3 then
      raise exception 'Each membership type must have an enabled duration in a complete 18-entry price catalog.';
    end if;
    if exists (
      select 1 from public.bgm_membership_price_entries e
      where e.catalog_version_id = new.id and e.is_active and e.amount_cents <= 0
    ) then
      raise exception 'Enabled membership durations require a positive price.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bgm_membership_assert_price_publication on public.bgm_membership_price_catalog_versions;
create trigger bgm_membership_assert_price_publication
before update of status on public.bgm_membership_price_catalog_versions
for each row execute function public.bgm_assert_membership_price_publication();

revoke all on function public.bgm_assert_membership_price_publication() from public, anon, authenticated;

-- Safeguard every new membership application, including direct/legacy staff paths.
-- Capture the current published price and catalog ID once, at submission time.
-- Never modify older membership applications, invoices or payment rows.
create or replace function public.bgm_guard_new_membership_application_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_catalog_id uuid;
  v_amount_cents integer;
  v_active boolean;
begin
  if new.application_kind not in ('new', 'renewal') then
    return new;
  end if;

  select c.id, e.amount_cents, e.is_active
    into v_catalog_id, v_amount_cents, v_active
  from public.bgm_membership_price_catalog_versions c
  join public.bgm_membership_price_entries e on e.catalog_version_id = c.id
  where c.status = 'published'
    and e.membership_type = new.membership_type
    and e.duration_key = new.duration_key
  limit 1;

  if v_catalog_id is null or v_active is not true or v_amount_cents <= 0 then
    raise exception 'This membership type and duration is not currently available.';
  end if;

  if new.price_catalog_version_id is null and new.base_price_cents is null then
    new.price_catalog_version_id := v_catalog_id;
    new.base_price_cents := v_amount_cents;
    new.currency := 'EUR';
  elsif new.price_catalog_version_id is distinct from v_catalog_id
     or new.base_price_cents is distinct from v_amount_cents then
    raise exception 'Submitted membership price does not match the current published rate.';
  end if;
  return new;
end;
$$;

drop trigger if exists bgm_guard_new_membership_application_price
  on public.bgm_membership_applications;
create trigger bgm_guard_new_membership_application_price
before insert on public.bgm_membership_applications
for each row execute function public.bgm_guard_new_membership_application_price();

revoke all on function public.bgm_guard_new_membership_application_price() from public, anon, authenticated;
