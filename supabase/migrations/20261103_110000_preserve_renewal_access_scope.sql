-- Renewal applications inherit the existing member's effective access scope by default.
-- This protects older clients and keeps Couples renewals atomic. Staff may deliberately
-- change the application later through the generic access-scope endpoint before activation.

create or replace function public.bgm_default_renewal_application_access()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_member public.bgm_members%rowtype;
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_scope text;
  v_gym_id text;
  v_existing_count integer;
  v_catalog_id uuid;
  v_amount integer;
  v_currency text;
begin
  if new.existing_member_id is null then
    return new;
  end if;

  select * into v_application
  from public.bgm_membership_applications
  where id = new.application_id
  for update;

  if not found or v_application.application_kind <> 'renewal' then
    return new;
  end if;

  select * into v_member
  from public.bgm_members
  where id = new.existing_member_id;
  if not found then
    raise exception 'Existing renewal member was not found.';
  end if;

  if v_member.pending_access_scope is not null
    and v_member.pending_access_effective_date is not null
    and v_member.pending_access_effective_date <= v_today then
    v_scope := v_member.pending_access_scope;
    v_gym_id := v_member.pending_access_gym_id;
  else
    v_scope := coalesce(v_member.access_scope, 'network');
    v_gym_id := v_member.access_gym_id;
  end if;

  if v_scope = 'neptunes_only' then
    v_scope := 'single_gym';
    v_gym_id := coalesce(v_gym_id, 'bgm-neptunes');
  end if;
  if v_scope not in ('network', 'single_gym') then
    v_scope := 'network';
    v_gym_id := null;
  end if;
  if v_scope = 'network' then
    v_gym_id := null;
  end if;

  select count(*) into v_existing_count
  from public.bgm_membership_application_members
  where application_id = new.application_id
    and existing_member_id is not null
    and id <> new.id;

  if v_existing_count > 0 then
    if v_application.access_scope is distinct from v_scope
      or v_application.access_gym_id is distinct from v_gym_id then
      raise exception 'Couples renewal members must have the same current access scope.';
    end if;
    return new;
  end if;

  select c.id, e.amount_cents, e.currency
  into v_catalog_id, v_amount, v_currency
  from public.bgm_membership_price_catalog_versions c
  join public.bgm_membership_price_entries e
    on e.catalog_version_id = c.id
   and e.membership_type = v_application.membership_type
   and e.duration_key = v_application.duration_key
  where c.status = 'published'
    and c.access_scope = v_scope
    and c.gym_id is not distinct from v_gym_id
    and e.is_active = true
  order by c.version_no desc
  limit 1;

  if v_catalog_id is null or v_amount is null then
    raise exception 'Published renewal price is not available for the member access scope.';
  end if;

  update public.bgm_membership_applications
  set access_scope = v_scope,
      access_gym_id = v_gym_id,
      base_price_cents = v_amount,
      currency = coalesce(v_currency, 'EUR'),
      price_catalog_version_id = v_catalog_id,
      discount_code_id = null,
      discount_code_snapshot = null,
      discount_percentage_snapshot = null,
      discount_amount_cents = 0,
      final_amount_cents = v_amount,
      updated_at = now()
  where id = new.application_id;

  return new;
end;
$$;

drop trigger if exists bgm_default_renewal_application_access_trigger
  on public.bgm_membership_application_members;
create trigger bgm_default_renewal_application_access_trigger
after insert on public.bgm_membership_application_members
for each row execute function public.bgm_default_renewal_application_access();

revoke all on function public.bgm_default_renewal_application_access() from public, anon, authenticated;
grant execute on function public.bgm_default_renewal_application_access() to service_role;
