-- Resolve only the precise scan conflict, never a different physical card.
-- Service-role-only RPC; the API additionally verifies staff permissions/gym.
create or replace function public.bgm_staff_resolve_scanner_card_conflict(
  p_scan_id uuid, p_staff_id uuid, p_member_id uuid, p_expected_ids uuid[]
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  s public.bgm_access_scans%rowtype;
  m public.bgm_members%rowtype;
  v_code text;
  v_ids uuid[];
  v_expected uuid[];
  v_legacy_ids uuid[];
  v_pending_ids uuid[];
  v_mode text;
  v_result text;
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_current text;
  v_scope text;
  v_gym text;
begin
  perform pg_catalog.set_config('lock_timeout','3000',true);
  select * into s from public.bgm_access_scans where id=p_scan_id for update;
  if not found or s.system_user_id is distinct from p_staff_id
    or s.credential_type is distinct from 'barcode' or s.lookup_kind is distinct from 'physical_card'
    or s.result is distinct from 'ambiguous_card'
    or s.scanned_at<now()-interval '10 minutes' or s.scanned_at>now()+interval '30 seconds'
  then raise exception 'Scan is stale or unavailable. Rescan.'; end if;
  if not exists(select 1 from public.bgm_system_users where id=p_staff_id and active)
    or not exists(select 1 from public.bgm_gyms where id=s.gym_id and status='active')
  then raise exception 'Staff or gym unavailable.'; end if;
  v_code := upper(btrim(s.credential_value));
  if v_code is null or v_code='' or v_code~'^(X[0-9]+){2,}$'
  then raise exception 'Invalid physical card.'; end if;
  select array_agg(distinct x order by x) into v_expected from unnest(p_expected_ids) x;
  if coalesce(cardinality(v_expected),0)<1 or not(p_member_id=any(v_expected))
  then raise exception 'Select a displayed candidate.'; end if;

  -- Same lock order as existing shared legacy resolution. No stale ownership
  -- decisions can be applied concurrently with another assignment.
  lock table public.bgm_legacy_card_claims, public.bgm_member_card_credentials,
    public.bgm_nfc_cards, public.bgm_pending_legacy_card_verifications in share row exclusive mode;
  if exists(select 1 from public.bgm_nfc_cards where upper(card_uid)=v_code)
  then raise exception 'NFC credential requires Super Admin review.'; end if;

  if exists(select 1 from public.bgm_member_card_credentials where upper(barcode_value)=v_code) then
    v_mode := 'current';
    if exists(select 1 from public.bgm_member_card_credentials where upper(barcode_value)=v_code and status='reserved')
    then raise exception 'Card reservation requires Super Admin review.'; end if;
    select array_agg(distinct member_id order by member_id) into v_ids
      from public.bgm_member_card_credentials where upper(barcode_value)=v_code and status='active';
    if coalesce(cardinality(v_ids),0)<2 or v_ids is distinct from v_expected
    then raise exception 'Current card ownership changed. Rescan.'; end if;
  else
    v_mode := 'legacy';
    -- Never promote a permanent membership ID into a new physical card.
    if exists(select 1 from public.bgm_members where upper(member_number)=v_code)
      or exists(select 1 from public.bgm_legacy_card_claims where upper(scan3)=v_code and assignment_status='removed')
    then raise exception 'Card has permanent-number or released history. Super Admin review required.'; end if;
    select array_agg(distinct c.member_id order by c.member_id) into v_legacy_ids
      from public.bgm_legacy_card_claims c join public.bgm_members a on a.id=c.member_id
      where upper(c.scan3)=v_code and c.assignment_status='active'
        and a.archived_at is null and a.status<>'archived'
        and not exists(select 1 from public.bgm_member_card_credentials p where p.member_id=c.member_id and p.status='active');
    select array_agg(distinct p.member_id order by p.member_id) into v_pending_ids
      from public.bgm_pending_legacy_card_verifications p join public.bgm_members a on a.id=p.member_id
      where p.scan3=v_code and p.status='pending' and a.archived_at is null and a.status<>'archived'
        and not exists(select 1 from public.bgm_member_card_credentials c where c.member_id=p.member_id and c.status='active');
    select array_agg(distinct x order by x) into v_ids from unnest(coalesce(v_legacy_ids,'{}'::uuid[])||coalesce(v_pending_ids,'{}'::uuid[])) x;
    if (coalesce(cardinality(v_legacy_ids),0)<2 and coalesce(cardinality(v_pending_ids),0)=0)
      or v_ids is distinct from v_expected or not(p_member_id=any(coalesce(v_ids,'{}'::uuid[])))
    then raise exception 'Legacy card candidates changed. Rescan.'; end if;
    if not(p_member_id=any(coalesce(v_legacy_ids,'{}'::uuid[]))) and (
      exists(select 1 from public.bgm_legacy_card_claims where member_id=p_member_id)
      or exists(select 1 from public.bgm_member_card_credentials where member_id=p_member_id)
      or exists(select 1 from public.bgm_nfc_cards where member_id=p_member_id)
      or exists(select 1 from public.bgm_members where id=p_member_id and app_enrolled)
    ) then raise exception 'Selected pending member has credential history. Super Admin review required.'; end if;
    if exists(select 1 from public.bgm_nfc_cards where member_id=p_member_id and status='active')
    then raise exception 'Selected member has an NFC card. Super Admin review required.'; end if;
    if v_code~'^[0-9]+$' and (
      exists(select 1 from public.bgm_legacy_card_claims where scan3~'^[0-9]+$' and scan3<>v_code and ltrim(scan3,'0')=ltrim(v_code,'0'))
      or exists(select 1 from public.bgm_member_card_credentials where barcode_value~'^[0-9]+$' and barcode_value<>v_code and ltrim(barcode_value,'0')=ltrim(v_code,'0'))
      or exists(select 1 from public.bgm_nfc_cards where card_uid~'^[0-9]+$' and card_uid<>v_code and ltrim(card_uid,'0')=ltrim(v_code,'0'))
    ) then raise exception 'Numeric card alias requires Super Admin review.'; end if;
  end if;
  if not(p_member_id=any(v_ids)) then raise exception 'Invalid candidate.'; end if;
  select * into m from public.bgm_members where id=p_member_id for update;
  if not found or m.archived_at is not null or m.status='archived'
  then raise exception 'Selected member unavailable.'; end if;

  -- Identity selection never grants access to an expired/restricted member.
  v_scope := case when m.pending_access_scope is not null and m.pending_access_effective_date<=v_today then m.pending_access_scope else m.access_scope end;
  v_gym := case when m.pending_access_scope is not null and m.pending_access_effective_date<=v_today then m.pending_access_gym_id else m.access_gym_id end;
  if v_scope='neptunes_only' then v_gym:=coalesce(v_gym,'bgm-neptunes'); end if;
  v_result := case
    when m.cancellation_effective_date<=v_today then 'inactive'
    when m.status<>'active' or m.membership_expiry is null then 'inactive'
    when m.membership_expiry<v_today then 'expired'
    when v_scope in ('single_gym','neptunes_only') and v_gym is not null and v_gym is distinct from s.gym_id then 'restricted_gym'
    else 'granted' end;

  if v_mode='current' then
    -- Keep the selected existing credential unchanged. Retire only the other
    -- case-equivalent active rows, retaining their entire history.
    select barcode_value into strict v_current from public.bgm_member_card_credentials
      where upper(barcode_value)=v_code and member_id=p_member_id and status='active';
    update public.bgm_member_card_credentials set status='retired',retired_at=now(),
      retired_reason='staff_verified_duplicate_card',updated_at=now()
      where upper(barcode_value)=v_code and status='active' and member_id<>p_member_id;
  else
    -- Promote the verified legacy card into the current card table, with all
    -- competing claims removed atomically before the imported-card guard runs.
    update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now()
      where upper(scan3)=v_code and assignment_status='active' and member_id<>p_member_id;
    insert into public.bgm_member_card_credentials(barcode_value,member_id,status,activated_at,created_by_system_user_id)
      values(v_code,p_member_id,'active',now(),p_staff_id) returning barcode_value into v_current;
    update public.bgm_pending_legacy_card_verifications set status=case when member_id=p_member_id then 'verified' else 'not_owner' end,
      resolved_at=now(),resolved_by_system_user_id=p_staff_id where scan3=v_code and status='pending';
  end if;
  insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
    values(p_staff_id,s.gym_id,'member.card.scanner_conflict_staff_verified','member',p_member_id::text,p_member_id,
    jsonb_build_object('card',v_code,'candidateIds',v_ids,'sourceScanId',s.id,'mode',v_mode),
    jsonb_build_object('verifiedOwner',p_member_id,'currentPhysicalCard',v_current,'otherCandidateIds',array_remove(v_ids,p_member_id),'sourceScanId',s.id));
  update public.bgm_card_conflict_reviews set status='resolved',resolved_by_system_user_id=p_staff_id,
    resolved_at=now(),resolution_note='Staff verified the scanned physical card owner.'
    where scan3=v_code and status='unresolved';
  update public.bgm_access_scans set result=v_result,member_id=p_member_id,
    membership_expiry_snapshot=m.membership_expiry,photo_required_warning=(m.official_photo_path is null)
    where id=s.id;
  return jsonb_build_object('resolved',true,'memberId',p_member_id,'result',v_result,'currentPhysicalCard',v_current);
end;
$$;
revoke all on function public.bgm_staff_resolve_scanner_card_conflict(uuid,uuid,uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.bgm_staff_resolve_scanner_card_conflict(uuid,uuid,uuid,uuid[]) to service_role;
