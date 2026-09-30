-- Add Staff Name attribution to audited physical-card replacement without breaking
-- the existing five-argument RPC used by older deployments.

create or replace function public.bgm_replace_member_card(
  p_member_id uuid,
  p_new_barcode text,
  p_reason text,
  p_system_user_id uuid,
  p_context_gym_id text,
  p_staff_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_new_barcode text := btrim(coalesce(p_new_barcode, ''));
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_staff_name text := nullif(btrim(coalesce(p_staff_name, '')), '');
  v_member_number text;
  v_old_barcode text;
  v_current_card public.bgm_member_card_credentials%rowtype;
  v_new_card_id uuid;
  v_is_super_admin boolean := false;
begin
  if p_member_id is null then raise exception 'Member is required.'; end if;
  if v_new_barcode = '' then raise exception 'New card barcode is required.'; end if;
  if v_reason not in ('lost', 'stolen', 'damaged', 'other') then raise exception 'A valid replacement reason is required.'; end if;
  if p_system_user_id is null then raise exception 'System user is required.'; end if;
  if nullif(btrim(coalesce(p_context_gym_id, '')), '') is null then raise exception 'Gym context is required.'; end if;
  if length(coalesce(v_staff_name, '')) > 120 then raise exception 'Staff Name is too long.'; end if;

  select is_super_admin into v_is_super_admin
  from public.bgm_system_users
  where id = p_system_user_id and active = true;
  if not found then raise exception 'System user is not active.'; end if;
  if not v_is_super_admin and v_staff_name is null then
    raise exception 'Staff Name is required for card replacement.';
  end if;

  perform 1
  from public.bgm_gyms
  where id = p_context_gym_id and status = 'active';
  if not found then raise exception 'Active gym context was not found.'; end if;

  select member_number into v_member_number
  from public.bgm_members
  where id = p_member_id
  for update;
  if not found then raise exception 'Member was not found.'; end if;

  -- Treat letter case as the same physical credential for replacement safety.
  -- The stored barcode keeps its exact scanned characters, but a case-only
  -- variation may not be used to resurrect/reissue the same physical card.
  if exists (
    select 1
    from public.bgm_member_card_credentials
    where upper(barcode_value) = upper(v_new_barcode)
  ) then
    raise exception 'That physical card has already been issued or reserved and cannot be reused.';
  end if;

  select * into v_current_card
  from public.bgm_member_card_credentials
  where member_id = p_member_id and status = 'active'
  for update;

  if found then
    v_old_barcode := v_current_card.barcode_value;
    if upper(v_old_barcode) = upper(v_new_barcode) then
      raise exception 'Scan a different unused card for replacement.';
    end if;
    update public.bgm_member_card_credentials
    set status = 'retired',
        retired_at = now(),
        retired_reason = 'issue_new_card:' || v_reason,
        updated_at = now()
    where id = v_current_card.id and status = 'active';
  else
    v_old_barcode := null;
  end if;

  insert into public.bgm_member_card_credentials(
    barcode_value, member_id, application_member_id, status,
    reserved_at, activated_at, created_by_system_user_id, updated_at
  ) values (
    v_new_barcode, p_member_id, null, 'active',
    now(), now(), p_system_user_id, now()
  ) returning id into v_new_card_id;

  update public.bgm_members
  set updated_at = now()
  where id = p_member_id;

  insert into public.bgm_audit_log(
    system_user_id, context_gym_id, staff_name, action_key,
    entity_type, entity_id, member_id, before_data, after_data
  ) values (
    p_system_user_id, p_context_gym_id, v_staff_name,
    'membership.card.replace', 'member', p_member_id::text, p_member_id,
    jsonb_build_object('memberNumber', v_member_number, 'barcode', v_old_barcode),
    jsonb_build_object(
      'memberNumber', v_member_number,
      'barcode', v_new_barcode,
      'reason', v_reason,
      'credentialId', v_new_card_id,
      'staffName', v_staff_name
    )
  );

  return jsonb_build_object(
    'memberId', p_member_id,
    'memberNumber', v_member_number,
    'oldBarcode', v_old_barcode,
    'newBarcode', v_new_barcode,
    'reason', v_reason,
    'credentialId', v_new_card_id,
    'staffName', v_staff_name
  );
end;
$function$;

revoke all on function public.bgm_replace_member_card(uuid, text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.bgm_replace_member_card(uuid, text, text, uuid, text, text)
  to service_role;
