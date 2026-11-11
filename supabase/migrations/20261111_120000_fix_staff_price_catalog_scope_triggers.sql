
-- Fix mixed network / Single Gym price catalog lookups in legacy staff registration triggers.
-- IMPORTANT: Does not edit or reprice existing applications or members.
-- Each new price is validated against the currently PUBLISHED catalog for its exact scope + gym.

create or replace function public.bgm_guard_new_membership_application_price()
returns trigger language plpgsql set search_path = '' as $function$
declare
  v_catalog_id uuid;
  v_amount_cents integer;
  v_active boolean;
  v_currency text;
begin
  if new.application_kind not in ('new', 'renewal') then return new; end if;

  if new.access_scope not in ('network','single_gym')
     or (new.access_scope = 'network' and new.access_gym_id is not null)
     or (new.access_scope = 'single_gym' and new.access_gym_id is null) then
    raise exception 'Membership access scope and gym are invalid.';
  end if;

  select c.id,e.amount_cents,e.is_active,e.currency
  into v_catalog_id,v_amount_cents,v_active,v_currency
  from public.bgm_membership_price_catalog_versions c
  join public.bgm_membership_price_entries e on e.catalog_version_id=c.id
  where c.status='published'
    and c.access_scope=new.access_scope
    and c.gym_id is not distinct from new.access_gym_id
    and e.membership_type=new.membership_type
    and e.duration_key=new.duration_key
  order by c.version_no desc limit 1;

  if v_catalog_id is null or v_active is not true or v_amount_cents <= 0 or v_currency <> 'EUR' then
    raise exception 'This membership type and duration is not currently available.';
  end if;
  if new.price_catalog_version_id is null and new.base_price_cents is null then
    new.price_catalog_version_id := v_catalog_id;
    new.base_price_cents := v_amount_cents;
    new.currency := v_currency;
  elsif new.price_catalog_version_id is distinct from v_catalog_id
     or new.base_price_cents is distinct from v_amount_cents
     or new.currency is distinct from v_currency then
    raise exception 'Submitted membership price does not match the current published rate.';
  end if;
  return new;
end
$function$;

create or replace function public.bgm_enforce_membership_application_price_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  v_catalog_id uuid;
  v_amount_cents integer;
  v_currency text;
begin
  if tg_op='UPDATE'
    and new.membership_type is not distinct from old.membership_type
    and new.duration_key is not distinct from old.duration_key
    and new.access_scope is not distinct from old.access_scope
    and new.access_gym_id is not distinct from old.access_gym_id then
    -- Preserve the captured rate on edits that do not change the selected product.
    new.base_price_cents := old.base_price_cents;
    new.price_catalog_version_id := old.price_catalog_version_id;
    new.currency := old.currency;
    return new;
  end if;

  if new.access_scope not in ('network','single_gym')
     or (new.access_scope = 'network' and new.access_gym_id is not null)
     or (new.access_scope = 'single_gym' and new.access_gym_id is null) then
    raise exception 'Membership access scope and gym are invalid.';
  end if;

  select c.id,e.amount_cents,e.currency
  into v_catalog_id,v_amount_cents,v_currency
  from public.bgm_membership_price_catalog_versions c
  join public.bgm_membership_price_entries e on e.catalog_version_id=c.id
  where c.status='published'
    and c.access_scope=new.access_scope
    and c.gym_id is not distinct from new.access_gym_id
    and e.membership_type=new.membership_type
    and e.duration_key=new.duration_key
    and e.is_active is true
  order by c.version_no desc limit 1;

  if v_catalog_id is null or v_amount_cents is null or v_amount_cents <= 0 or v_currency <> 'EUR' then
    raise exception 'Published membership rate was not found for the selected access scope.';
  end if;

  new.base_price_cents := v_amount_cents;
  new.price_catalog_version_id := v_catalog_id;
  new.currency := v_currency;
  new.discount_code_id := null;
  new.discount_code_snapshot := null;
  new.discount_percentage_snapshot := null;
  new.discount_amount_cents := 0;
  new.final_amount_cents := v_amount_cents;
  return new;
end
$function$;

-- Keep both functions private to the server-side database role.
revoke all on function public.bgm_guard_new_membership_application_price() from public,anon,authenticated;
revoke all on function public.bgm_enforce_membership_application_price_snapshot() from public,anon,authenticated;
