-- Deploy via a tracked migration only after staging validation.
-- Existing modern / NFC credentials are never modified.
create or replace function public.bgm_staff_resolve_shared_legacy_card(
 p_scan_id uuid, p_staff_id uuid, p_member_id uuid, p_expected_ids uuid[]
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
 s public.bgm_access_scans%rowtype;
 v_code text;
 v_ids uuid[];
 v_expected uuid[];
 v_today date := (now() at time zone 'Europe/Malta')::date;
 v_member public.bgm_members%rowtype;
begin
 select * into s from public.bgm_access_scans where id=p_scan_id for update;
 if not found or s.system_user_id<>p_staff_id or s.credential_type<>'barcode'
    or s.result<>'ambiguous_card' or s.scanned_at<now()-interval '10 minutes'
    or s.scanned_at>now()+interval '30 seconds' then
   raise exception 'Scan is stale or unavailable.';
 end if;
 if not exists(select 1 from public.bgm_system_users where id=p_staff_id and active) then
   raise exception 'Staff access unavailable.';
 end if;
 v_code := upper(btrim(s.credential_value));
 if v_code='' then raise exception 'Invalid card.'; end if;
 -- Serialize with concurrent legacy, modern and NFC writes; short transaction.
 lock table public.bgm_legacy_card_claims, public.bgm_member_card_credentials,
   public.bgm_nfc_cards in share row exclusive mode;
 if exists(select 1 from public.bgm_member_card_credentials where upper(barcode_value)=v_code)
    or exists(select 1 from public.bgm_nfc_cards where upper(card_uid)=v_code) then
   raise exception 'Existing modern or NFC credential requires Super Admin review.';
 end if;
 select array_agg(member_id order by member_id) into v_ids
   from public.bgm_legacy_card_claims where scan3=v_code and assignment_status='active';
 select array_agg(distinct x order by x) into v_expected from unnest(p_expected_ids) x;
 if coalesce(cardinality(v_ids),0)<2 or v_ids is distinct from v_expected
    or not (p_member_id=any(v_ids)) then
   raise exception 'Card claims changed. Rescan before confirming.';
 end if;
 select * into v_member from public.bgm_members where id=p_member_id for update;
 if not found or v_member.archived_at is not null or v_member.status<>'active'
   or v_member.membership_expiry is null or v_member.membership_expiry<v_today
   or (v_member.cancellation_effective_date is not null and v_member.cancellation_effective_date<=v_today)
 then raise exception 'Member does not have a current membership.'; end if;
 if (case when v_member.pending_access_effective_date<=v_today then v_member.pending_access_scope else v_member.access_scope end)<>'network'
   and (case when v_member.pending_access_effective_date<=v_today then v_member.pending_access_gym_id else v_member.access_gym_id end) is distinct from s.gym_id
 then raise exception 'Membership does not allow access at this gym.'; end if;
 if not exists(select 1 from public.bgm_gyms where id=s.gym_id and status='active') then raise exception 'Gym unavailable.'; end if;
 -- Only deactivate competing unverified claims for this precise Scan3.
 update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now()
 where scan3=v_code and assignment_status='active' and member_id<>p_member_id;
 insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values(p_staff_id,s.gym_id,'member.card.shared_legacy_staff_verified','member',p_member_id::text,p_member_id,
   jsonb_build_object('scan3',v_code,'candidateIds',v_ids,'sourceScanId',p_scan_id),
   jsonb_build_object('verifiedOwner',p_member_id,'removedClaimIds',array_remove(v_ids,p_member_id),'sourceScanId',p_scan_id));
 update public.bgm_card_conflict_reviews set status='resolved',resolved_by_system_user_id=p_staff_id,
   resolved_at=now(),resolution_note='Staff verified the person and resolved competing legacy card claims.'
 where scan3=v_code and status='unresolved';
 return jsonb_build_object('resolved',true,'memberId',p_member_id);
end;
$$;
revoke all on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) to service_role;
