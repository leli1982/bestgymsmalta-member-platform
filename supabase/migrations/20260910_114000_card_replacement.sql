-- Standalone lost/stolen/damaged card replacement.
-- This transaction changes only the member's card credential and compatibility
-- member_number. It does not renew or alter membership dates/status.

create or replace function public.bgm_replace_member_card(
  p_member_id uuid,
  p_new_barcode text,
  p_reason text,
  p_system_user_id uuid,
  p_context_gym_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_barcode text := btrim(coalesce(p_new_barcode, ''));
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_old_barcode text;
  v_current_card public.bgm_member_card_credentials%rowtype;
  v_old_credential public.bgm_member_card_credentials%rowtype;
  v_new_card_id uuid;
begin
  if p_member_id is null then
    raise exception 'Member is required.';
  end if;
  if v_new_barcode = '' then
    raise exception 'New card barcode is required.';
  end if;
  if v_reason not in ('lost', 'stolen', 'damaged', 'other') then
    raise exception 'A valid replacement reason is required.';
  end if;
  if p_system_user_id is null then
    raise exception 'System user is required.';
  end if;
  if nullif(btrim(coalesce(p_context_gym_id, '')), '') is null then
    raise exception 'Gym context is required.';
  end if;

  perform 1 from public.bgm_system_users
  where id = p_system_user_id and active = true;
  if not found then
    raise exception 'System user is not active.';
  end if;

  perform 1 from public.bgm_gyms
  where id = p_context_gym_id and status = 'active';
  if not found then
    raise exception 'Active gym context was not found.';
  end if;

  select member_number
  into v_old_barcode
  from public.bgm_members
  where id = p_member_id
  for update;

  if not found then
    raise exception 'Member was not found.';
  end if;

  if nullif(btrim(coalesce(v_old_barcode, '')), '') is not null
    and v_old_barcode = v_new_barcode then
    raise exception 'Scan a different unused card for replacement.';
  end if;

  if exists (
    select 1 from public.bgm_member_card_credentials
    where barcode_value = v_new_barcode
  ) then
    raise exception 'That card barcode has already been issued or reserved and cannot be reused.';
  end if;

  select *
  into v_current_card
  from public.bgm_member_card_credentials
  where member_id = p_member_id and status = 'active'
  for update;

  if found then
    update public.bgm_member_card_credentials
    set status = 'retired',
        retired_at = now(),
        retired_reason = 'issue_new_card:' || v_reason,
        updated_at = now()
    where id = v_current_card.id and status = 'active';
    v_old_barcode := v_current_card.barcode_value;
  elsif nullif(btrim(coalesce(v_old_barcode, '')), '') is not null then
    -- Legacy members may not yet have credential rows. Preserve the old issued
    -- compatibility barcode as retired history so it can never be reassigned.
    select *
    into v_old_credential
    from public.bgm_member_card_credentials
    where barcode_value = v_old_barcode
    for update;

    if found then
      if v_old_credential.member_id is distinct from p_member_id
        or v_old_credential.status <> 'retired' then
        raise exception 'Current compatibility card conflicts with credential history.';
      end if;
    else
      insert into public.bgm_member_card_credentials (
        barcode_value,
        member_id,
        application_member_id,
        status,
        reserved_at,
        activated_at,
        retired_at,
        retired_reason,
        created_by_system_user_id,
        updated_at
      ) values (
        v_old_barcode,
        p_member_id,
        null,
        'retired',
        now(),
        now(),
        now(),
        'issue_new_card:' || v_reason,
        p_system_user_id,
        now()
      );
    end if;
  end if;

  insert into public.bgm_member_card_credentials (
    barcode_value,
    member_id,
    application_member_id,
    status,
    reserved_at,
    activated_at,
    created_by_system_user_id,
    updated_at
  ) values (
    v_new_barcode,
    p_member_id,
    null,
    'active',
    now(),
    now(),
    p_system_user_id,
    now()
  ) returning id into v_new_card_id;

  update public.bgm_members
  set member_number = v_new_barcode,
      updated_at = now()
  where id = p_member_id;

  insert into public.bgm_audit_log (
    system_user_id,
    context_gym_id,
    staff_name,
    action_key,
    entity_type,
    entity_id,
    member_id,
    before_data,
    after_data
  ) values (
    p_system_user_id,
    p_context_gym_id,
    null,
    'membership.card.replace',
    'member',
    p_member_id::text,
    p_member_id,
    jsonb_build_object('barcode', v_old_barcode),
    jsonb_build_object(
      'barcode', v_new_barcode,
      'reason', v_reason,
      'credentialId', v_new_card_id
    )
  );

  return jsonb_build_object(
    'memberId', p_member_id,
    'oldBarcode', v_old_barcode,
    'newBarcode', v_new_barcode,
    'reason', v_reason,
    'credentialId', v_new_card_id
  );
end;
$$;

revoke all on function public.bgm_replace_member_card(uuid, text, text, uuid, text) from public;
revoke all on function public.bgm_replace_member_card(uuid, text, text, uuid, text) from anon;
revoke all on function public.bgm_replace_member_card(uuid, text, text, uuid, text) from authenticated;
grant execute on function public.bgm_replace_member_card(uuid, text, text, uuid, text) to service_role;
