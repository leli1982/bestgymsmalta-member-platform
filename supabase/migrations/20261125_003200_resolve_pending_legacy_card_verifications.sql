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
 v_claim_ids uuid[];
 v_pending_ids uuid[];
 v_expected uuid[];
 v_today date := (now() at time zone 'Europe/Malta')::date;
 v_member public.bgm_members%rowtype;
 v_result text;
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
   public.bgm_nfc_cards, public.bgm_pending_legacy_card_verifications in share row exclusive mode;
 if exists(select 1 from public.bgm_member_card_credentials where upper(barcode_value)=v_code)
    or exists(select 1 from public.bgm_nfc_cards where upper(card_uid)=v_code) then
   raise exception 'Existing modern or NFC credential requires Super Admin review.';
 end if;
 select array_agg(member_id order by member_id) into v_claim_ids
   from public.bgm_legacy_card_claims where scan3=v_code and assignment_status='active';
 select array_agg(p.member_id order by p.member_id) into v_pending_ids
 from public.bgm_pending_legacy_card_verifications p join public.bgm_members m on m.id=p.member_id
 where p.scan3=v_code and p.status='pending' and m.archived_at is null and m.status<>'archived';
 select array_agg(distinct x order by x) into v_ids from unnest(coalesce(v_claim_ids,'{}'::uuid[])||coalesce(v_pending_ids,'{}'::uuid[])) x;
 select array_agg(distinct x order by x) into v_expected from unnest(p_expected_ids) x;
 if (coalesce(cardinality(v_claim_ids),0)<2 and coalesce(cardinality(v_pending_ids),0)=0) or v_ids is distinct from v_expected
    or not (p_member_id=any(v_ids)) then
   raise exception 'Card claims changed. Rescan before confirming.';
 end if;
 select * into v_member from public.bgm_members where id=p_member_id for update;
 if not found or v_member.archived_at is not null or v_member.status='archived'
 then raise exception 'Member unavailable.'; end if;
 -- Identity resolution is independent of access eligibility.
 v_result := case
   when v_member.cancellation_effective_date<=v_today then 'inactive'
   when v_member.membership_expiry<v_today then 'expired'
   when v_member.status<>'active' or v_member.membership_expiry is null then 'inactive'
   when (case when v_member.pending_access_scope is not null and v_member.pending_access_effective_date<=v_today then v_member.pending_access_scope else v_member.access_scope end)<>'network'
    and (case when v_member.pending_access_scope is not null and v_member.pending_access_effective_date<=v_today then v_member.pending_access_gym_id else v_member.access_gym_id end) is distinct from s.gym_id then 'restricted_gym'
   else 'granted' end;
 if not exists(select 1 from public.bgm_gyms where id=s.gym_id and status='active') then raise exception 'Gym unavailable.'; end if;
 -- A pending source record may receive a card only if no credential history exists for that member.
 if not (p_member_id=any(coalesce(v_claim_ids,'{}'::uuid[]))) then
   if not(p_member_id=any(coalesce(v_pending_ids,'{}'::uuid[]))) then raise exception 'Not an eligible source candidate.'; end if;
   if exists(select 1 from public.bgm_legacy_card_claims where member_id=p_member_id)
      or exists(select 1 from public.bgm_member_card_credentials where member_id=p_member_id)
      or exists(select 1 from public.bgm_nfc_cards where member_id=p_member_id)
      or exists(select 1 from public.bgm_legacy_card_claims where scan3=v_code and assignment_status='removed')
      or exists(select 1 from public.bgm_members where upper(member_number)=v_code)
      or exists(select 1 from public.bgm_legacy_card_claims where v_code~'^[0-9]+
 update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now()
 where scan3=v_code and assignment_status='active' and member_id<>p_member_id;
 update public.bgm_pending_legacy_card_verifications set status=case when member_id=p_member_id then 'verified' else 'not_owner' end,
 resolved_at=now(),resolved_by_system_user_id=p_staff_id where scan3=v_code and status='pending';
 insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values(p_staff_id,s.gym_id,'member.card.shared_legacy_staff_verified','member',p_member_id::text,p_member_id,
   jsonb_build_object('scan3',v_code,'candidateIds',v_ids,'pendingIds',v_pending_ids,'sourceScanId',p_scan_id),
   jsonb_build_object('verifiedOwner',p_member_id,'removedClaimIds',array_remove(v_ids,p_member_id),'sourceScanId',p_scan_id));
 update public.bgm_card_conflict_reviews set status='resolved',resolved_by_system_user_id=p_staff_id,
   resolved_at=now(),resolution_note='Staff verified the person and resolved competing legacy card claims.'
 where scan3=v_code and status='unresolved';
 update public.bgm_access_scans set result=v_result,member_id=p_member_id,
 membership_expiry_snapshot=v_member.membership_expiry,photo_required_warning=(v_member.official_photo_path is null)
 where id=p_scan_id;
 return jsonb_build_object('resolved',true,'memberId',p_member_id,'result',v_result);
end;
$$;
revoke all on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) to service_role;
 and scan3~'^[0-9]+
 update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now()
 where scan3=v_code and assignment_status='active' and member_id<>p_member_id;
 insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values(p_staff_id,s.gym_id,'member.card.shared_legacy_staff_verified','member',p_member_id::text,p_member_id,
   jsonb_build_object('scan3',v_code,'candidateIds',v_ids,'sourceScanId',p_scan_id),
   jsonb_build_object('verifiedOwner',p_member_id,'removedClaimIds',array_remove(v_ids,p_member_id),'sourceScanId',p_scan_id));
 update public.bgm_card_conflict_reviews set status='resolved',resolved_by_system_user_id=p_staff_id,
   resolved_at=now(),resolution_note='Staff verified the person and resolved competing legacy card claims.'
 where scan3=v_code and status='unresolved';
 update public.bgm_access_scans set result=v_result,member_id=p_member_id,
 membership_expiry_snapshot=v_member.membership_expiry,photo_required_warning=(v_member.official_photo_path is null)
 where id=p_scan_id;
 return jsonb_build_object('resolved',true,'memberId',p_member_id,'result',v_result);
end;
$$;
revoke all on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) to service_role;
 and scan3<>v_code and ltrim(scan3,'0')=ltrim(v_code,'0'))
      or exists(select 1 from public.bgm_member_card_credentials where v_code~'^[0-9]+
 update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now()
 where scan3=v_code and assignment_status='active' and member_id<>p_member_id;
 insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values(p_staff_id,s.gym_id,'member.card.shared_legacy_staff_verified','member',p_member_id::text,p_member_id,
   jsonb_build_object('scan3',v_code,'candidateIds',v_ids,'sourceScanId',p_scan_id),
   jsonb_build_object('verifiedOwner',p_member_id,'removedClaimIds',array_remove(v_ids,p_member_id),'sourceScanId',p_scan_id));
 update public.bgm_card_conflict_reviews set status='resolved',resolved_by_system_user_id=p_staff_id,
   resolved_at=now(),resolution_note='Staff verified the person and resolved competing legacy card claims.'
 where scan3=v_code and status='unresolved';
 update public.bgm_access_scans set result=v_result,member_id=p_member_id,
 membership_expiry_snapshot=v_member.membership_expiry,photo_required_warning=(v_member.official_photo_path is null)
 where id=p_scan_id;
 return jsonb_build_object('resolved',true,'memberId',p_member_id,'result',v_result);
end;
$$;
revoke all on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) to service_role;
 and barcode_value~'^[0-9]+
 update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now()
 where scan3=v_code and assignment_status='active' and member_id<>p_member_id;
 insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values(p_staff_id,s.gym_id,'member.card.shared_legacy_staff_verified','member',p_member_id::text,p_member_id,
   jsonb_build_object('scan3',v_code,'candidateIds',v_ids,'sourceScanId',p_scan_id),
   jsonb_build_object('verifiedOwner',p_member_id,'removedClaimIds',array_remove(v_ids,p_member_id),'sourceScanId',p_scan_id));
 update public.bgm_card_conflict_reviews set status='resolved',resolved_by_system_user_id=p_staff_id,
   resolved_at=now(),resolution_note='Staff verified the person and resolved competing legacy card claims.'
 where scan3=v_code and status='unresolved';
 update public.bgm_access_scans set result=v_result,member_id=p_member_id,
 membership_expiry_snapshot=v_member.membership_expiry,photo_required_warning=(v_member.official_photo_path is null)
 where id=p_scan_id;
 return jsonb_build_object('resolved',true,'memberId',p_member_id,'result',v_result);
end;
$$;
revoke all on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) to service_role;
 and ltrim(barcode_value,'0')=ltrim(v_code,'0'))
      or exists(select 1 from public.bgm_nfc_cards where v_code~'^[0-9]+
 update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now()
 where scan3=v_code and assignment_status='active' and member_id<>p_member_id;
 insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values(p_staff_id,s.gym_id,'member.card.shared_legacy_staff_verified','member',p_member_id::text,p_member_id,
   jsonb_build_object('scan3',v_code,'candidateIds',v_ids,'sourceScanId',p_scan_id),
   jsonb_build_object('verifiedOwner',p_member_id,'removedClaimIds',array_remove(v_ids,p_member_id),'sourceScanId',p_scan_id));
 update public.bgm_card_conflict_reviews set status='resolved',resolved_by_system_user_id=p_staff_id,
   resolved_at=now(),resolution_note='Staff verified the person and resolved competing legacy card claims.'
 where scan3=v_code and status='unresolved';
 update public.bgm_access_scans set result=v_result,member_id=p_member_id,
 membership_expiry_snapshot=v_member.membership_expiry,photo_required_warning=(v_member.official_photo_path is null)
 where id=p_scan_id;
 return jsonb_build_object('resolved',true,'memberId',p_member_id,'result',v_result);
end;
$$;
revoke all on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) to service_role;
 and card_uid~'^[0-9]+
 update public.bgm_legacy_card_claims set assignment_status='removed',updated_at=now()
 where scan3=v_code and assignment_status='active' and member_id<>p_member_id;
 insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values(p_staff_id,s.gym_id,'member.card.shared_legacy_staff_verified','member',p_member_id::text,p_member_id,
   jsonb_build_object('scan3',v_code,'candidateIds',v_ids,'sourceScanId',p_scan_id),
   jsonb_build_object('verifiedOwner',p_member_id,'removedClaimIds',array_remove(v_ids,p_member_id),'sourceScanId',p_scan_id));
 update public.bgm_card_conflict_reviews set status='resolved',resolved_by_system_user_id=p_staff_id,
   resolved_at=now(),resolution_note='Staff verified the person and resolved competing legacy card claims.'
 where scan3=v_code and status='unresolved';
 update public.bgm_access_scans set result=v_result,member_id=p_member_id,
 membership_expiry_snapshot=v_member.membership_expiry,photo_required_warning=(v_member.official_photo_path is null)
 where id=p_scan_id;
 return jsonb_build_object('resolved',true,'memberId',p_member_id,'result',v_result);
end;
$$;
revoke all on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) to service_role;
 and ltrim(card_uid,'0')=ltrim(v_code,'0'))
   then raise exception 'Credential history or alias requires Super Admin review.'; end if;
   insert into public.bgm_legacy_card_claims(member_id,scan3,assignment_status,source_row_number,source_scan3)
   select p_member_id,v_code,'active',source_row_number,v_code
   from public.bgm_pending_legacy_card_verifications where scan3=v_code and member_id=p_member_id and status='pending';
 end if;
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
 update public.bgm_access_scans set result=v_result,member_id=p_member_id,
 membership_expiry_snapshot=v_member.membership_expiry,photo_required_warning=(v_member.official_photo_path is null)
 where id=p_scan_id;
 return jsonb_build_object('resolved',true,'memberId',p_member_id,'result',v_result);
end;
$$;
revoke all on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.bgm_staff_resolve_shared_legacy_card(uuid,uuid,uuid,uuid[]) to service_role;
