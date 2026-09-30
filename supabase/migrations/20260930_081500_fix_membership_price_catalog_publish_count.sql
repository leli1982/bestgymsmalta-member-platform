-- Correct Production-safe publication validation for the 21-slot membership rate matrix.
-- This explicitly replaces the function instead of relying on formatting-sensitive text replacement.

create or replace function public.bgm_publish_membership_price_catalog(
  p_catalog_version_id uuid,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_target public.bgm_membership_price_catalog_versions%rowtype;
  v_entry_count integer;
  v_old_id uuid;
begin
  select * into v_target
  from public.bgm_membership_price_catalog_versions
  where id = p_catalog_version_id
  for update;

  if not found then
    raise exception 'Membership price catalog not found.';
  end if;
  if v_target.status <> 'draft' then
    raise exception 'Only a draft membership price catalog can be published.';
  end if;
  if p_system_user_id is null then
    raise exception 'System user is required.';
  end if;

  select count(*) into v_entry_count
  from public.bgm_membership_price_entries
  where catalog_version_id = p_catalog_version_id;

  if v_entry_count <> 21 then
    raise exception 'A complete price catalog must contain exactly 21 entries.';
  end if;

  select id into v_old_id
  from public.bgm_membership_price_catalog_versions
  where status = 'published'
  for update;

  if v_old_id is not null then
    update public.bgm_membership_price_catalog_versions
    set status = 'retired'
    where id = v_old_id;
  end if;

  update public.bgm_membership_price_catalog_versions
  set status = 'published', published_at = now()
  where id = p_catalog_version_id;

  insert into public.bgm_audit_log(
    system_user_id, context_gym_id, staff_name, action_key,
    entity_type, entity_id, before_data, after_data
  ) values (
    p_system_user_id, null, null, 'membership_prices_published',
    'membership_price_catalog', p_catalog_version_id::text,
    case when v_old_id is null then null else jsonb_build_object('retiredCatalogId', v_old_id) end,
    jsonb_build_object(
      'catalogVersionId', p_catalog_version_id,
      'versionNo', v_target.version_no,
      'status', 'published'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'catalogVersionId', p_catalog_version_id,
    'versionNo', v_target.version_no
  );
end;
$function$;
