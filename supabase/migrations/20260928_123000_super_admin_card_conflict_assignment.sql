create or replace function public.bgm_super_admin_change_legacy_card(
  p_system_user_id uuid, p_member_id uuid, p_current_scan3 text,
  p_expected_updated_at timestamptz, p_action text, p_new_scan3 text,
  p_reason text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_claim public.bgm_legacy_card_claims%rowtype;
  v_new text := nullif(upper(btrim(coalesce(p_new_scan3,''))),'');
begin
  if not exists(select 1 from public.bgm_system_users
    where id=p_system_user_id and active=true and is_super_admin=true) then
    raise exception 'Super Admin access required.';
  end if;
  if p_action not in ('change_card','remove_card') or
      nullif(btrim(coalesce(p_reason,'')),'') is null or
      (p_action='change_card' and (v_new is null or v_new=p_current_scan3)) then
    raise exception 'Invalid card assignment action.';
  end if;
  select * into v_claim from public.bgm_legacy_card_claims
  where member_id=p_member_id and scan3=p_current_scan3 and assignment_status='active'
  for update;
  if not found or v_claim.updated_at is distinct from p_expected_updated_at then
    raise exception 'Card assignment changed. Reload.';
  end if;
  if p_action='change_card' then
    perform pg_advisory_xact_lock(hashtext(v_new));
    if exists(select 1 from public.bgm_legacy_card_claims
      where scan3=v_new and assignment_status='active' and member_id<>p_member_id)
      or exists(select 1 from public.bgm_member_card_credentials
        where barcode_value=v_new and status<>'retired' and member_id is distinct from p_member_id)
    then raise exception 'That card number is already assigned.'; end if;
  end if;
  update public.bgm_legacy_card_claims
  set scan3=case when p_action='change_card' then v_new else scan3 end,
      assignment_status=case when p_action='remove_card' then 'removed' else 'active' end,
      updated_at=now()
  where member_id=p_member_id;
  insert into public.bgm_audit_log
    (system_user_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
  values (p_system_user_id,'card_conflict.assignment_change','member',p_member_id::text,
    p_member_id,jsonb_build_object('scan3',v_claim.scan3,'status',v_claim.assignment_status),
    jsonb_build_object('scan3',case when p_action='change_card' then v_new else null end,
      'action',p_action,'reason',p_reason));
  return jsonb_build_object('changed',true,'memberId',p_member_id);
end;
$$;
revoke all on function public.bgm_super_admin_change_legacy_card(
  uuid,uuid,text,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.bgm_super_admin_change_legacy_card(
  uuid,uuid,text,timestamptz,text,text,text) to service_role;
