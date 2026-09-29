-- Update the publication guard for the 21-entry membership price matrix.

create or replace function public.bgm_assert_membership_price_publication()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_total integer;
  v_enabled_types integer;
begin
  if old.status = 'draft' and new.status = 'published' then
    select count(*), count(distinct membership_type) filter (where is_active)
      into v_total, v_enabled_types
    from public.bgm_membership_price_entries
    where catalog_version_id = new.id;

    if v_total <> 21 or v_enabled_types <> 3 then
      raise exception 'Each membership type must have an enabled duration in a complete 21-entry price catalog.';
    end if;

    if exists (
      select 1
      from public.bgm_membership_price_entries e
      where e.catalog_version_id = new.id
        and e.is_active
        and e.amount_cents <= 0
    ) then
      raise exception 'Enabled membership durations require a positive price.';
    end if;
  end if;
  return new;
end;
$function$;
