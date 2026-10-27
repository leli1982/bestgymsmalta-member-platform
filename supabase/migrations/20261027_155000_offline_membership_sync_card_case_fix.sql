-- Preserve the exact physical-card credential characters during offline staging.
-- Scanner terminators/whitespace are trimmed by the API; case is not rewritten.

create or replace function public.bgm_stage_offline_membership_application(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_submission_id uuid := nullif(btrim(coalesce(p_payload->>'clientSubmissionId', '')), '')::uuid;
  v_application_id uuid := v_client_submission_id;
  v_application public.bgm_membership_applications%rowtype;
  v_system_user_id uuid := nullif(btrim(coalesce(p_payload->>'systemUserId', '')), '')::uuid;
  v_system_user record;
  v_gym_id text := btrim(coalesce(p_payload->>'gymId', ''));
  v_staff_name text := btrim(coalesce(p_payload->>'staffName', ''));
  v_membership_type text := lower(btrim(coalesce(p_payload->>'membershipType', '')));
  v_duration_key text := lower(btrim(coalesce(p_payload->>'durationKey', '')));
  v_sold_at timestamptz := nullif(btrim(coalesce(p_payload->>'soldAt', '')), '')::timestamptz;
  v_sold_on_malta date := nullif(btrim(coalesce(p_payload->>'soldOnMalta', '')), '')::date;
  v_expiry_date date := nullif(btrim(coalesce(p_payload->>'expiryDate', '')), '')::date;
  v_base_price_cents integer := (p_payload->>'basePriceCents')::integer;
  v_price_catalog_version_id uuid := nullif(btrim(coalesce(p_payload->>'priceCatalogVersionId', '')), '')::uuid;
  v_gym_rules_version_id uuid := nullif(btrim(coalesce(p_payload->>'gymRulesVersionId', '')), '')::uuid;
  v_privacy_version_id uuid := nullif(btrim(coalesce(p_payload->>'privacyVersionId', '')), '')::uuid;
  v_health_version_id uuid := nullif(btrim(coalesce(p_payload->>'healthVersionId', '')), '')::uuid;
  v_declaration_snapshot jsonb := coalesce(p_payload->'declarationSnapshot', '{}'::jsonb);
  v_participants jsonb := p_payload->'participants';
  v_cards jsonb := coalesce(p_payload->'pendingCardValues', '[]'::jsonb);
  v_reserve_cards boolean := coalesce((p_payload->>'reserveCards')::boolean, false);
  v_participant jsonb;
  v_participant_id uuid;
  v_participant_ids jsonb := '[]'::jsonb;
  v_order integer := 0;
  v_expected_count integer;
  v_card_value text;
  v_existing_card record;
begin
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'Offline membership payload must be an object.'; end if;
  if v_client_submission_id is null then raise exception 'Client submission ID is required.'; end if;
  if v_system_user_id is null then raise exception 'System user is required.'; end if;
  if v_gym_id = '' then raise exception 'Enrollment gym is required.'; end if;
  if v_staff_name = '' then raise exception 'Staff name is required.'; end if;
  if v_sold_at is null or v_sold_on_malta is null or v_expiry_date is null then raise exception 'Offline sale date snapshot is required.'; end if;
  if v_expiry_date < v_sold_on_malta then raise exception 'Offline membership expiry date is invalid.'; end if;
  if v_membership_type not in ('single','student','couples') then raise exception 'Unsupported membership type.'; end if;
  if v_duration_key not in ('1_session','1_week','2_weeks','1_month','3_months','6_months','1_year') then raise exception 'Unsupported membership duration.'; end if;
  if v_base_price_cents is null or v_base_price_cents < 0 then raise exception 'Offline price snapshot is invalid.'; end if;
  if v_price_catalog_version_id is null or v_gym_rules_version_id is null or v_privacy_version_id is null or v_health_version_id is null then raise exception 'Verified historical configuration IDs are required.'; end if;
  if jsonb_typeof(v_participants) <> 'array' then raise exception 'Offline participants are required.'; end if;

  v_expected_count := case when v_membership_type='couples' then 2 else 1 end;
  if jsonb_array_length(v_participants) <> v_expected_count then raise exception 'Membership type and participant count do not match.'; end if;
  if v_reserve_cards and (jsonb_typeof(v_cards) <> 'array' or jsonb_array_length(v_cards) <> v_expected_count) then raise exception 'One physical card is required per participant.'; end if;

  select id, gym_id, is_super_admin, active
    into v_system_user
  from public.bgm_system_users
  where id=v_system_user_id and active=true;
  if not found then raise exception 'Syncing system user is not active.'; end if;
  if not v_system_user.is_super_admin and v_system_user.gym_id is distinct from v_gym_id then raise exception 'This offline sale belongs to another gym.'; end if;
  if not exists(select 1 from public.bgm_gyms where id=v_gym_id and status='active') then raise exception 'Offline enrollment gym is not active.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_client_submission_id::text, 0));

  select * into v_application
  from public.bgm_membership_applications
  where id=v_application_id
  for update;

  if found then
    if v_application.application_source <> 'offline_staff' then raise exception 'Client submission ID is already used by another application.'; end if;
    select coalesce(jsonb_agg(id order by participant_order), '[]'::jsonb)
      into v_participant_ids
    from public.bgm_membership_application_members
    where application_id=v_application_id;
    insert into public.bgm_audit_log(system_user_id,context_gym_id,staff_name,action_key,entity_type,entity_id,after_data)
    values(v_system_user_id,v_gym_id,v_staff_name,'membership.offline_sync.attempt','membership_application',v_application_id::text,
      jsonb_build_object('clientSubmissionId',v_client_submission_id,'existingApplication',true,'status',v_application.status));
    return jsonb_build_object('applicationId',v_application_id,'applicationReference',v_application.application_reference,'status',v_application.status,'participantIds',v_participant_ids,'idempotent',true);
  end if;

  insert into public.bgm_membership_applications(
    id, application_reference, membership_type, duration_key, enrollment_gym_id, staff_name,
    application_kind, start_date, expiry_date, status, submitted_by_system_user_id, submitted_at,
    application_source, submitted_on_malta, base_price_cents, currency, price_catalog_version_id,
    gym_rules_version_id, privacy_version_id, health_version_id, declaration_snapshot,
    document_readiness_ack_at, created_at, updated_at
  ) values (
    v_application_id,
    'BGMAPP-' || upper(replace(v_application_id::text,'-','')),
    v_membership_type, v_duration_key, v_gym_id, v_staff_name,
    'new', v_sold_on_malta, v_expiry_date, 'submitted', v_system_user_id, v_sold_at,
    'offline_staff', v_sold_on_malta, v_base_price_cents, 'EUR', v_price_catalog_version_id,
    v_gym_rules_version_id, v_privacy_version_id, v_health_version_id, v_declaration_snapshot,
    v_sold_at, v_sold_at, now()
  );

  for v_participant in select value from jsonb_array_elements(v_participants)
  loop
    v_order := v_order + 1;
    v_participant_id := md5(v_client_submission_id::text || ':' || v_order::text)::uuid;
    v_participant_ids := v_participant_ids || jsonb_build_array(v_participant_id);

    insert into public.bgm_membership_application_members(
      id,application_id,participant_order,first_name,last_name,address_line_1,address_line_2,town,postcode,
      id_number,date_of_birth,phone,email,next_of_kin,official_photo_path,existing_member_id,
      guardian_name,guardian_id_number,guardian_relationship,guardian_phone,guardian_email,guardian_address,
      under_18_at_submission,identity_match_state,matched_member_id,duplicate_contact_warning,
      gym_rules_accepted_at,privacy_accepted_at,health_accepted_at,created_at,updated_at
    ) values (
      v_participant_id,v_application_id,v_order,
      btrim(coalesce(v_participant->>'firstName','')),
      btrim(coalesce(v_participant->>'lastName','')),
      nullif(btrim(coalesce(v_participant->>'addressLine1','')),''),
      nullif(btrim(coalesce(v_participant->>'addressLine2','')),''),
      nullif(btrim(coalesce(v_participant->>'town','')),''),
      nullif(btrim(coalesce(v_participant->>'postcode','')),''),
      nullif(btrim(coalesce(v_participant->>'idNumber','')),''),
      nullif(v_participant->>'dateOfBirth','')::date,
      nullif(btrim(coalesce(v_participant->>'phone','')),''),
      nullif(lower(btrim(coalesce(v_participant->>'email',''))),''),
      nullif(btrim(coalesce(v_participant->>'nextOfKin','')),''),
      null,
      null,
      nullif(btrim(coalesce(v_participant->>'guardianName','')),''),
      nullif(btrim(coalesce(v_participant->>'guardianIdNumber','')),''),
      nullif(btrim(coalesce(v_participant->>'guardianRelationship','')),''),
      nullif(btrim(coalesce(v_participant->>'guardianPhone','')),''),
      nullif(lower(btrim(coalesce(v_participant->>'guardianEmail',''))),''),
      nullif(btrim(coalesce(v_participant->>'guardianAddress','')),''),
      coalesce((v_participant->>'under18AtSubmission')::boolean,false),
      btrim(coalesce(v_participant->>'identityMatchState','clear')),
      nullif(btrim(coalesce(v_participant->>'matchedMemberId','')),'')::uuid,
      coalesce((v_participant->>'duplicateContactWarning')::boolean,false),
      case when coalesce((v_participant->>'gymRulesAccepted')::boolean,false) then v_sold_at else null end,
      case when coalesce((v_participant->>'privacyAccepted')::boolean,false) then v_sold_at else null end,
      case when coalesce((v_participant->>'healthAccepted')::boolean,false) then v_sold_at else null end,
      v_sold_at,now()
    );

    if v_reserve_cards then
      v_card_value := btrim(v_cards->>(v_order-1));
      if v_card_value = '' then raise exception 'Physical card cannot be blank.'; end if;
      select id,application_member_id,status into v_existing_card
      from public.bgm_member_card_credentials
      where barcode_value=v_card_value
      for update;
      if found then
        if v_existing_card.application_member_id is distinct from v_participant_id or v_existing_card.status <> 'reserved' then
          raise exception 'Physical card % is already assigned.', v_card_value;
        end if;
      else
        insert into public.bgm_member_card_credentials(
          barcode_value,member_id,application_member_id,status,reserved_at,created_by_system_user_id,updated_at
        ) values (v_card_value,null,v_participant_id,'reserved',v_sold_at,v_system_user_id,now());
      end if;
    end if;
  end loop;

  insert into public.bgm_audit_log(system_user_id,context_gym_id,staff_name,action_key,entity_type,entity_id,after_data)
  values(v_system_user_id,v_gym_id,v_staff_name,'membership.application.submit','membership_application',v_application_id::text,
    jsonb_build_object('clientSubmissionId',v_client_submission_id,'applicationSource','offline_staff','membershipType',v_membership_type,'durationKey',v_duration_key,'startDate',v_sold_on_malta,'expiryDate',v_expiry_date,'basePriceCents',v_base_price_cents,'participantIds',v_participant_ids));

  insert into public.bgm_audit_log(system_user_id,context_gym_id,staff_name,action_key,entity_type,entity_id,after_data)
  values(v_system_user_id,v_gym_id,v_staff_name,'membership.offline_sync.attempt','membership_application',v_application_id::text,
    jsonb_build_object('clientSubmissionId',v_client_submission_id,'existingApplication',false,'status','submitted'));

  return jsonb_build_object('applicationId',v_application_id,'applicationReference','BGMAPP-' || upper(replace(v_application_id::text,'-','')),'status','submitted','participantIds',v_participant_ids,'idempotent',false);
end;
$$;

revoke all on function public.bgm_stage_offline_membership_application(jsonb) from public, anon, authenticated;
grant execute on function public.bgm_stage_offline_membership_application(jsonb) to service_role;
