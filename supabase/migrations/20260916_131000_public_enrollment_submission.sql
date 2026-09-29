-- Secure public/tablet enrollment submission.
-- Replaces the draft public-application RPC so the server can pre-generate storage paths,
-- while the database remains authoritative for price, declarations, identity state,
-- contact warnings, under-18 status, and the pending-application transaction.

create or replace function public.bgm_has_membership_contact_match(
  p_phone text,
  p_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bgm_members m
    where (
      regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') <> ''
      and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g')
        = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
    )
    or (
      lower(btrim(coalesce(p_email, ''))) <> ''
      and lower(btrim(coalesce(m.email, ''))) = lower(btrim(coalesce(p_email, '')))
    )
  );
$$;

revoke all on function public.bgm_has_membership_contact_match(text, text)
  from public, anon, authenticated;
grant execute on function public.bgm_has_membership_contact_match(text, text)
  to service_role;

create or replace function public.bgm_create_public_membership_application(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
  v_gym_id text;
  v_application_source text;
  v_membership_type text;
  v_duration_key text;
  v_participants jsonb;
  v_participant jsonb;
  v_participant_count integer;
  v_expected_count integer;
  v_order integer := 0;
  v_participant_id uuid;
  v_official_photo_path text;
  v_expected_photo_prefix text;
  v_reference text;
  v_start_date date;
  v_expiry_date date;
  v_base_price_cents integer;
  v_price_catalog_version_id uuid;
  v_gym_rules public.bgm_membership_declaration_versions%rowtype;
  v_privacy public.bgm_membership_declaration_versions%rowtype;
  v_health public.bgm_membership_declaration_versions%rowtype;
  v_guardian public.bgm_membership_declaration_versions%rowtype;
  v_declaration_snapshot jsonb;
  v_ack_at timestamptz := now();
  v_identity jsonb;
  v_identity_match_state text;
  v_matched_member_id uuid;
  v_duplicate_contact_warning boolean;
  v_date_of_birth date;
  v_under_18 boolean;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Enrollment payload must be an object.';
  end if;

  v_application_id := nullif(btrim(coalesce(p_payload->>'applicationId', '')), '')::uuid;
  v_gym_id := btrim(coalesce(p_payload->>'enrollmentGymId', ''));
  v_application_source := btrim(coalesce(p_payload->>'applicationSource', ''));
  v_membership_type := btrim(coalesce(p_payload->>'membershipType', ''));
  v_duration_key := btrim(coalesce(p_payload->>'durationKey', ''));
  v_participants := p_payload->'participants';

  if v_application_id is null then
    raise exception 'applicationId is required.';
  end if;

  if v_application_source <> 'tablet' then
    raise exception 'This operation accepts tablet applications only.';
  end if;

  if coalesce((p_payload->>'documentReadinessAcknowledged')::boolean, false) is not true then
    raise exception 'Document readiness acknowledgement is required.';
  end if;

  if not exists (
    select 1
    from public.bgm_gyms g
    where g.id = v_gym_id
      and g.status = 'active'
      and g.public_enrollment_slug is not null
  ) then
    raise exception 'Active enrollment gym not found.';
  end if;

  if v_membership_type not in ('single', 'student', 'couples') then
    raise exception 'Unsupported membership type.';
  end if;

  if v_duration_key not in ('1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year') then
    raise exception 'Unsupported membership duration.';
  end if;

  if jsonb_typeof(v_participants) <> 'array' then
    raise exception 'Participants are required.';
  end if;

  v_participant_count := jsonb_array_length(v_participants);
  v_expected_count := case when v_membership_type = 'couples' then 2 else 1 end;
  if v_participant_count <> v_expected_count then
    raise exception 'Participant count does not match membership type.';
  end if;

  select c.id, e.amount_cents
  into v_price_catalog_version_id, v_base_price_cents
  from public.bgm_membership_price_catalog_versions c
  join public.bgm_membership_price_entries e
    on e.catalog_version_id = c.id
  where c.status = 'published'
    and e.membership_type = v_membership_type
    and e.duration_key = v_duration_key
  order by c.version_no desc
  limit 1;

  if v_price_catalog_version_id is null or v_base_price_cents is null then
    raise exception 'Published membership price is not available.';
  end if;

  select * into v_gym_rules
  from public.bgm_membership_declaration_versions
  where content_key = 'gym_rules' and status = 'published'
  order by version_no desc
  limit 1;

  select * into v_privacy
  from public.bgm_membership_declaration_versions
  where content_key = 'privacy' and status = 'published'
  order by version_no desc
  limit 1;

  select * into v_health
  from public.bgm_membership_declaration_versions
  where content_key = 'health' and status = 'published'
  order by version_no desc
  limit 1;

  select * into v_guardian
  from public.bgm_membership_declaration_versions
  where content_key = 'guardian' and status = 'published'
  order by version_no desc
  limit 1;

  if v_gym_rules.id is null or v_privacy.id is null or v_health.id is null then
    raise exception 'Required published declarations are not available.';
  end if;

  v_start_date := (now() at time zone 'Europe/Malta')::date;
  v_expiry_date := case v_duration_key
    when '1_week' then v_start_date + 7
    when '2_weeks' then v_start_date + 14
    when '1_month' then (
      date_trunc('month', v_start_date)::date
      + interval '1 month'
      + ((extract(day from v_start_date)::integer - 1) * interval '1 day')
    )::date
    when '3_months' then (
      date_trunc('month', v_start_date)::date
      + interval '3 months'
      + ((extract(day from v_start_date)::integer - 1) * interval '1 day')
    )::date
    when '6_months' then (
      date_trunc('month', v_start_date)::date
      + interval '6 months'
      + ((extract(day from v_start_date)::integer - 1) * interval '1 day')
    )::date
    when '1_year' then (
      date_trunc('month', v_start_date)::date
      + interval '1 year'
      + ((extract(day from v_start_date)::integer - 1) * interval '1 day')
    )::date
  end;

  v_declaration_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'gymRules', jsonb_build_object(
      'id', v_gym_rules.id,
      'versionNo', v_gym_rules.version_no,
      'body', v_gym_rules.body,
      'contentSha256', v_gym_rules.content_sha256
    ),
    'privacy', jsonb_build_object(
      'id', v_privacy.id,
      'versionNo', v_privacy.version_no,
      'body', v_privacy.body,
      'contentSha256', v_privacy.content_sha256
    ),
    'health', jsonb_build_object(
      'id', v_health.id,
      'versionNo', v_health.version_no,
      'body', v_health.body,
      'contentSha256', v_health.content_sha256
    ),
    'guardian', case
      when v_guardian.id is null then null
      else jsonb_build_object(
        'id', v_guardian.id,
        'versionNo', v_guardian.version_no,
        'body', v_guardian.body,
        'contentSha256', v_guardian.content_sha256
      )
    end
  ));

  v_reference := 'BGMAPP-' || upper(replace(v_application_id::text, '-', ''));

  insert into public.bgm_membership_applications (
    id,
    application_reference,
    membership_type,
    duration_key,
    enrollment_gym_id,
    staff_name,
    application_kind,
    start_date,
    expiry_date,
    status,
    submitted_by_system_user_id,
    submitted_at,
    application_source,
    submitted_on_malta,
    base_price_cents,
    currency,
    price_catalog_version_id,
    gym_rules_version_id,
    privacy_version_id,
    health_version_id,
    declaration_snapshot,
    document_readiness_ack_at
  ) values (
    v_application_id,
    v_reference,
    v_membership_type,
    v_duration_key,
    v_gym_id,
    null,
    'new',
    v_start_date,
    v_expiry_date,
    'submitted',
    null,
    now(),
    'tablet',
    v_start_date,
    v_base_price_cents,
    'EUR',
    v_price_catalog_version_id,
    v_gym_rules.id,
    v_privacy.id,
    v_health.id,
    v_declaration_snapshot,
    v_ack_at
  );

  for v_participant in
    select value from jsonb_array_elements(v_participants)
  loop
    v_order := v_order + 1;
    v_participant_id := nullif(btrim(coalesce(v_participant->>'participantId', '')), '')::uuid;
    v_official_photo_path := btrim(coalesce(v_participant->>'officialPhotoPath', ''));

    if v_participant_id is null then
      raise exception 'participantId is required.';
    end if;

    v_expected_photo_prefix :=
      'applications/' || v_application_id::text || '/' || v_participant_id::text || '/';

    if v_official_photo_path = ''
       or left(v_official_photo_path, length(v_expected_photo_prefix)) <> v_expected_photo_prefix
       or right(lower(v_official_photo_path), 5) <> '.webp' then
      raise exception 'officialPhotoPath is invalid.';
    end if;

    if btrim(coalesce(v_participant->>'firstName', '')) = ''
       or btrim(coalesce(v_participant->>'lastName', '')) = ''
       or btrim(coalesce(v_participant->>'idNumber', '')) = ''
       or btrim(coalesce(v_participant->>'dateOfBirth', '')) = ''
       or btrim(coalesce(v_participant->>'addressLine1', '')) = ''
       or btrim(coalesce(v_participant->>'town', '')) = ''
       or btrim(coalesce(v_participant->>'phone', '')) = ''
       or btrim(coalesce(v_participant->>'email', '')) = ''
       or btrim(coalesce(v_participant->>'nextOfKin', '')) = '' then
      raise exception 'Required participant details are missing.';
    end if;

    if coalesce((v_participant->>'gymRulesAccepted')::boolean, false) is not true
       or coalesce((v_participant->>'privacyAccepted')::boolean, false) is not true
       or coalesce((v_participant->>'healthAccepted')::boolean, false) is not true then
      raise exception 'Each participant must accept the required declarations.';
    end if;

    v_date_of_birth := nullif(v_participant->>'dateOfBirth', '')::date;
    if v_date_of_birth > v_start_date then
      raise exception 'Date of birth cannot be after submission date.';
    end if;

    v_under_18 := (
      (
        extract(year from v_start_date)::integer
        - extract(year from v_date_of_birth)::integer
        - case
            when to_char(v_start_date, 'MMDD') < to_char(v_date_of_birth, 'MMDD') then 1
            else 0
          end
      ) < 18
    );

    if v_under_18 then
      if v_guardian.id is null then
        raise exception 'Published guardian declaration is required for an under-18 application.';
      end if;

      if btrim(coalesce(v_participant->>'guardianName', '')) = ''
         or btrim(coalesce(v_participant->>'guardianIdNumber', '')) = ''
         or btrim(coalesce(v_participant->>'guardianRelationship', '')) = ''
         or btrim(coalesce(v_participant->>'guardianPhone', '')) = ''
         or btrim(coalesce(v_participant->>'guardianEmail', '')) = ''
         or btrim(coalesce(v_participant->>'guardianAddress', '')) = '' then
        raise exception 'Complete guardian details are required for an under-18 application.';
      end if;
    end if;

    v_identity := public.bgm_classify_membership_identity(v_participant->>'idNumber');
    v_identity_match_state := coalesce(v_identity->>'state', 'clear');
    v_matched_member_id := nullif(v_identity->>'matchedMemberId', '')::uuid;

    if v_identity_match_state not in ('clear', 'active', 'expired_inactive') then
      raise exception 'Identity classification failed.';
    end if;
    if v_identity_match_state = 'active' then
      raise exception 'An active membership already exists for this identity.';
    end if;

    v_duplicate_contact_warning := public.bgm_has_membership_contact_match(
      v_participant->>'phone',
      v_participant->>'email'
    );

    insert into public.bgm_membership_application_members (
      id,
      application_id,
      participant_order,
      first_name,
      last_name,
      address_line_1,
      address_line_2,
      town,
      postcode,
      id_number,
      date_of_birth,
      phone,
      email,
      next_of_kin,
      official_photo_path,
      existing_member_id,
      guardian_name,
      guardian_id_number,
      guardian_relationship,
      guardian_phone,
      guardian_email,
      guardian_address,
      under_18_at_submission,
      identity_match_state,
      matched_member_id,
      duplicate_contact_warning,
      gym_rules_accepted_at,
      privacy_accepted_at,
      health_accepted_at
    ) values (
      v_participant_id,
      v_application_id,
      v_order,
      btrim(v_participant->>'firstName'),
      btrim(v_participant->>'lastName'),
      btrim(v_participant->>'addressLine1'),
      nullif(btrim(coalesce(v_participant->>'addressLine2', '')), ''),
      btrim(v_participant->>'town'),
      nullif(btrim(coalesce(v_participant->>'postcode', '')), ''),
      btrim(v_participant->>'idNumber'),
      v_date_of_birth,
      btrim(v_participant->>'phone'),
      lower(btrim(v_participant->>'email')),
      btrim(v_participant->>'nextOfKin'),
      v_official_photo_path,
      case
        when v_identity_match_state = 'expired_inactive' then v_matched_member_id
        else null
      end,
      nullif(btrim(coalesce(v_participant->>'guardianName', '')), ''),
      nullif(btrim(coalesce(v_participant->>'guardianIdNumber', '')), ''),
      nullif(btrim(coalesce(v_participant->>'guardianRelationship', '')), ''),
      nullif(btrim(coalesce(v_participant->>'guardianPhone', '')), ''),
      nullif(lower(btrim(coalesce(v_participant->>'guardianEmail', ''))), ''),
      nullif(btrim(coalesce(v_participant->>'guardianAddress', '')), ''),
      v_under_18,
      v_identity_match_state,
      v_matched_member_id,
      v_duplicate_contact_warning,
      v_ack_at,
      v_ack_at,
      v_ack_at
    );

    insert into public.bgm_member_official_photos (
      member_id,
      application_member_id,
      object_path,
      source,
      system_user_id,
      gym_id,
      staff_name
    ) values (
      null,
      v_participant_id,
      v_official_photo_path,
      'new_membership',
      null,
      v_gym_id,
      null
    );
  end loop;

  insert into public.bgm_audit_log (
    system_user_id,
    context_gym_id,
    staff_name,
    action_key,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    null,
    v_gym_id,
    null,
    'membership.application.public_submitted',
    'membership_application',
    v_application_id::text,
    null,
    jsonb_build_object(
      'reference', v_reference,
      'applicationSource', 'tablet',
      'membershipType', v_membership_type,
      'durationKey', v_duration_key,
      'participantCount', v_participant_count,
      'basePriceCents', v_base_price_cents,
      'priceCatalogVersionId', v_price_catalog_version_id,
      'submittedOnMalta', v_start_date
    )
  );

  return jsonb_build_object(
    'ok', true,
    'applicationId', v_application_id,
    'reference', v_reference,
    'status', 'submitted',
    'submittedOnMalta', v_start_date,
    'startDate', v_start_date,
    'expiryDate', v_expiry_date,
    'basePriceCents', v_base_price_cents,
    'currency', 'EUR'
  );
end;
$$;

revoke all on function public.bgm_create_public_membership_application(jsonb)
  from public, anon, authenticated;
grant execute on function public.bgm_create_public_membership_application(jsonb)
  to service_role;
