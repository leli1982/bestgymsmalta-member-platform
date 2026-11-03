-- Activation must never accept a price catalogue from a different access scope.
-- This fails closed even if an older/tampered client misses the scope+reprice step.

create or replace function public.bgm_validate_application_access_price_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_catalog public.bgm_membership_price_catalog_versions%rowtype;
  v_price public.bgm_membership_price_entries%rowtype;
begin
  if new.status = 'activated' and old.status is distinct from new.status then
    if new.price_catalog_version_id is null then
      raise exception 'Application price catalogue is required before activation.';
    end if;

    select * into v_catalog
    from public.bgm_membership_price_catalog_versions
    where id = new.price_catalog_version_id;
    if not found or v_catalog.status not in ('published', 'retired') then
      raise exception 'Application price catalogue is invalid.';
    end if;

    if v_catalog.access_scope is distinct from new.access_scope
      or v_catalog.gym_id is distinct from new.access_gym_id then
      raise exception 'Application price catalogue does not match membership access scope.';
    end if;

    select * into v_price
    from public.bgm_membership_price_entries
    where catalog_version_id = new.price_catalog_version_id
      and membership_type = new.membership_type
      and duration_key = new.duration_key;
    if not found
      or v_price.amount_cents is distinct from new.base_price_cents
      or v_price.currency is distinct from new.currency then
      raise exception 'Application access price snapshot is invalid.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bgm_validate_application_access_price_scope_trigger
  on public.bgm_membership_applications;
create trigger bgm_validate_application_access_price_scope_trigger
before update of status on public.bgm_membership_applications
for each row execute function public.bgm_validate_application_access_price_scope();

revoke all on function public.bgm_validate_application_access_price_scope() from public, anon, authenticated;
grant execute on function public.bgm_validate_application_access_price_scope() to service_role;
