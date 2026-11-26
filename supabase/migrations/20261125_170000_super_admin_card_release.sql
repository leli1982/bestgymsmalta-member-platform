-- Isolated Super Admin card management. Never delete historical credentials.
create or replace function public.bgm_card_release_lookup(p_system_user_id uuid, p_barcode text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  code text := upper(btrim(coalesce(p_barcode,'')));
  credentials jsonb;
  claims jsonb;
  aliases jsonb;
  previous jsonb;
  blocked text;
  state text;
  active_claims integer;
begin
  if not exists(select 1 from public.bgm_system_users where id=p_system_user_id and active and (is_super_admin or role='super_admin')) then
    raise exception 'Super Admin access required.' using errcode='42501';
  end if;
  if code='' or length(code)>128 or code like 'RETIRED-%' then
    raise exception 'Invalid physical card number.' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'barcode',c.barcode_value,'status',c.status,
    'memberId',c.member_id,'memberNumber',m.member_number,'fullName',m.full_name,
    'applicationMemberId',c.application_member_id,'updatedAt',c.updated_at) order by c.id),'[]'::jsonb)
    into credentials from public.bgm_member_card_credentials c left join public.bgm_members m on m.id=c.member_id
    where upper(c.barcode_value)=code;
  select coalesce(jsonb_agg(jsonb_build_object('memberId',c.member_id,'memberNumber',m.member_number,
    'fullName',m.full_name,'status',c.assignment_status,'updatedAt',c.updated_at) order by c.member_id),'[]'::jsonb),
    count(*) filter(where c.assignment_status='active')
    into claims,active_claims from public.bgm_legacy_card_claims c join public.bgm_members m on m.id=c.member_id
    where upper(c.scan3)=code;
  select coalesce(jsonb_agg(jsonb_build_object('memberId',m.id,'memberNumber',m.member_number,
    'fullName',m.full_name,'permanentNumber',upper(m.member_number)=code) order by m.id),'[]'::jsonb)
    into aliases from public.bgm_members m
    where upper(m.member_number)=code or upper(m.legacy_pk_customer)=code;
  select jsonb_build_object('memberId',a.member_id,'memberNumber',m.member_number,'fullName',m.full_name,
    'releasedAt',a.created_at,'barcode',a.before_data->>'barcode') into previous
    from public.bgm_audit_log a left join public.bgm_members m on m.id=a.member_id
    where a.action_key='membership.card.release' and upper(a.before_data->>'barcode')=code
    order by a.created_at desc limit 1;
  state := case when jsonb_array_length(credentials)>0 then credentials->0->>'status'
    when active_claims>0 then 'active' else 'available' end;
  if exists(select 1 from public.bgm_member_card_credentials where upper(barcode_value)=code and status='reserved') then
    state := 'reserved'; blocked := 'Reserved for a membership application. Complete or cancel the application through the existing workflow.';
  elsif jsonb_array_length(credentials)>1 or active_claims>1 or (jsonb_array_length(credentials)>0 and active_claims>0) then
    state := 'conflict'; blocked := 'Multiple card records or active legacy claims exist. Use the existing Card Conflict Review.';
  elsif exists(select 1 from public.bgm_pending_legacy_card_verifications where upper(scan3)=code and status='pending')
    or exists(select 1 from public.bgm_card_conflict_reviews where upper(scan3)=code and status='unresolved') then
    state := 'conflict'; blocked := 'A pending card verification or conflict review must be resolved first.';
  elsif exists(select 1 from public.bgm_nfc_cards where upper(card_uid)=code) then
    state := 'conflict'; blocked := 'An NFC credential uses this number. Review it separately.';
  elsif jsonb_array_length(aliases)>0 then
    -- The scanner can fall back to permanent or legacy customer numbers.
    -- Never release these aliases without a separate, reviewed remediation.
    state := 'conflict'; blocked := 'This number also matches a member customer identifier. Release is blocked to preserve member identity and prevent scanner fallback.';
  end if;
  return jsonb_build_object('barcode',code,'status',state,'credentials',credentials,'legacyClaims',claims,
    'aliases',aliases,'previousMember',previous,'blockedReason',blocked,
    'canRelease',blocked is null and state in ('active','retired'));
end;
$$;

create or replace function public.bgm_release_physical_card(
  p_system_user_id uuid,p_barcode text,p_expected jsonb,p_reason text,p_confirmed boolean,p_confirm_active boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_state jsonb;
  code text := upper(btrim(coalesce(p_barcode,'')));
  reason text := btrim(coalesce(p_reason,''));
  card public.bgm_member_card_credentials%rowtype;
  claim public.bgm_legacy_card_claims%rowtype;
  owner_id uuid;
  archive_code text;
  original_code text;
  after_state jsonb;
begin
  if not exists(select 1 from public.bgm_system_users where id=p_system_user_id and active and (is_super_admin or role='super_admin') for share) then
    raise exception 'Super Admin access required.' using errcode='42501';
  end if;
  if p_confirmed is distinct from true or length(reason) not between 1 and 500 or p_expected is null then
    raise exception 'Confirmation and a reason (1–500 characters) are required.' using errcode='22023';
  end if;
  -- Use the existing conflict resolver's lock order. Fail immediately if a writer is busy.
  lock table public.bgm_legacy_card_claims,public.bgm_member_card_credentials,
    public.bgm_nfc_cards,public.bgm_pending_legacy_card_verifications,
    public.bgm_card_conflict_reviews,public.bgm_members in share row exclusive mode nowait;
  current_state := public.bgm_card_release_lookup(p_system_user_id,code);
  if current_state is distinct from p_expected then
    raise exception 'Card details changed. Search again before confirming.' using errcode='40001';
  end if;
  if (current_state->>'canRelease')::boolean is distinct from true then
    raise exception 'Card cannot be released: %',coalesce(current_state->>'blockedReason','already available') using errcode='22023';
  end if;
  if current_state->>'status'='active' and p_confirm_active is distinct from true then
    raise exception 'Additional active card confirmation required.' using errcode='22023';
  end if;
  select * into card from public.bgm_member_card_credentials where upper(barcode_value)=code;
  if found then
    owner_id:=card.member_id; original_code:=card.barcode_value;
    archive_code:='RETIRED-'||card.barcode_value||'-'||card.id::text;
    update public.bgm_member_card_credentials set barcode_value=archive_code,status='retired',
      retired_at=coalesce(retired_at,now()),retired_reason=coalesce(retired_reason,'super_admin_release:'||reason),updated_at=now()
      where id=card.id;
  else
    select * into strict claim from public.bgm_legacy_card_claims where upper(scan3)=code and assignment_status='active';
    owner_id:=claim.member_id; original_code:=claim.scan3;
    update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now() where member_id=owner_id;
  end if;
  insert into public.bgm_audit_log(system_user_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
    values(p_system_user_id,'membership.card.release','member',owner_id::text,owner_id,
      current_state||jsonb_build_object('barcode',original_code),
      jsonb_build_object('reason',reason,'originalBarcode',original_code,'archivedBarcode',archive_code,'released',true));
  after_state:=public.bgm_card_release_lookup(p_system_user_id,code);
  if after_state->>'status'<>'available' then
    raise exception 'Card did not become available. No changes saved.' using errcode='40001';
  end if;
  return after_state;
end;
$$;

revoke all on function public.bgm_card_release_lookup(uuid,text) from public,anon,authenticated;
revoke all on function public.bgm_release_physical_card(uuid,text,jsonb,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.bgm_card_release_lookup(uuid,text) to service_role;
grant execute on function public.bgm_release_physical_card(uuid,text,jsonb,text,boolean,boolean) to service_role;
