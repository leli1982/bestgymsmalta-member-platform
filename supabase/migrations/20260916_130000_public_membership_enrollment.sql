-- Public/tablet enrollment foundation.
-- This migration extends the existing pending-application workflow; it does not activate people.

alter table public.bgm_gyms
  add column if not exists public_enrollment_slug text;

update public.bgm_gyms
set public_enrollment_slug = case id
  when 'bgm-birkirkara' then 'birkirkara'
  when 'bgm-birzebbuga' then 'birzebbuga'
  when 'bgm-build' then 'build'
  when 'bgm-kirkop' then 'kirkop'
  when 'bgm-marsa' then 'marsa'
  when 'bgm-neptunes' then 'neptunes'
  when 'bgm-pembroke' then 'pembroke'
  when 'bgm-sliema' then 'sliema'
  when 'bgm-talqroqq' then 'talqroqq'
  when 'bgm-birgu' then 'birgu'
  when 'bgm-marsascala' then 'marsascala'
  else public_enrollment_slug
end
where public_enrollment_slug is null
  and id in (
    'bgm-birkirkara',
    'bgm-birzebbuga',
    'bgm-build',
    'bgm-kirkop',
    'bgm-marsa',
    'bgm-neptunes',
    'bgm-pembroke',
    'bgm-sliema',
    'bgm-talqroqq',
    'bgm-birgu',
    'bgm-marsascala'
  );

create unique index if not exists bgm_gyms_public_enrollment_slug_unique_idx
  on public.bgm_gyms (lower(public_enrollment_slug))
  where public_enrollment_slug is not null;

alter table public.bgm_gyms
  drop constraint if exists bgm_gyms_public_enrollment_slug_format_check;
alter table public.bgm_gyms
  add constraint bgm_gyms_public_enrollment_slug_format_check
  check (
    public_enrollment_slug is null
    or public_enrollment_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

alter table public.bgm_membership_applications
  alter column staff_name drop not null,
  add column if not exists application_source text not null default 'staff',
  add column if not exists submitted_on_malta date,
  add column if not exists base_price_cents integer,
  add column if not exists currency text not null default 'EUR',
  add column if not exists price_catalog_version_id uuid references public.bgm_membership_price_catalog_versions(id) on delete restrict,
  add column if not exists gym_rules_version_id uuid references public.bgm_membership_declaration_versions(id) on delete restrict,
  add column if not exists privacy_version_id uuid references public.bgm_membership_declaration_versions(id) on delete restrict,
  add column if not exists health_version_id uuid references public.bgm_membership_declaration_versions(id) on delete restrict,
  add column if not exists declaration_snapshot jsonb,
  add column if not exists document_readiness_ack_at timestamptz;

alter table public.bgm_membership_applications
  drop constraint if exists bgm_membership_applications_source_check;
alter table public.bgm_membership_applications
  add constraint bgm_membership_applications_source_check
  check (application_source in ('staff', 'tablet', 'offline_staff'));

alter table public.bgm_membership_applications
  drop constraint if exists bgm_membership_applications_base_price_check;
alter table public.bgm_membership_applications
  add constraint bgm_membership_applications_base_price_check
  check (base_price_cents is null or base_price_cents >= 0);

alter table public.bgm_membership_applications
  drop constraint if exists bgm_membership_applications_currency_check;
alter table public.bgm_membership_applications
  add constraint bgm_membership_applications_currency_check
  check (currency = 'EUR');

alter table public.bgm_membership_application_members
  add column if not exists town text,
  add column if not exists guardian_name text,
  add column if not exists guardian_id_number text,
  add column if not exists guardian_relationship text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_email text,
  add column if not exists guardian_address text,
  add column if not exists under_18_at_submission boolean not null default false,
  add column if not exists identity_match_state text not null default 'clear',
  add column if not exists matched_member_id uuid references public.bgm_members(id) on delete set null,
  add column if not exists duplicate_contact_warning jsonb,
  add column if not exists gym_rules_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists health_accepted_at timestamptz;

alter table public.bgm_membership_application_members
  drop constraint if exists bgm_membership_application_members_identity_match_check;
alter table public.bgm_membership_application_members
  add constraint bgm_membership_application_members_identity_match_check
  check (identity_match_state in ('clear', 'active', 'expired_inactive'));

create table if not exists public.bgm_public_enrollment_rate_buckets (
  rate_key_hash text not null check (btrim(rate_key_hash) <> ''),
  enrollment_gym_id text not null references public.bgm_gyms(id) on delete cascade,
  window_start timestamptz not null,
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_attempt_at timestamptz not null default now(),
  primary key (rate_key_hash, enrollment_gym_id, window_start)
);

alter table public.bgm_public_enrollment_rate_buckets enable row level security;
revoke all on table public.bgm_public_enrollment_rate_buckets from anon, authenticated;
grant select, insert, update, delete on table public.bgm_public_enrollment_rate_buckets to service_role;

create or replace function public.bgm_create_public_membership_application(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id text := btrim(coalesce(p_payload->>'enrollmentGymId', ''));
  v_application_source text := btrim(coalesce(p_payload->>'applicationSource', 'tablet'));
  v_membership_type text := btrim(coalesce(p_payload->>'membershipType', ''));
  v_duration_key text := btrim(coalesce(p_payload->>'durationKey', ''));
  v_participants jsonb := p_payload->'participants';
  v_participant jsonb;
  v_participant_count integer;
  v_expected_count integer;
  v_order integer := 0;
  v_identity_match_state text;
  v_matched_member_id uuid;
  v_application_id uuid;
  v_reference text;
  v_start_date date;
  v_expiry_date date;
  v_base_price_cents integer;
  v_price_catalog_version_id uuid;
  v_gym_rules public.bgm_membership_declaration_versions%rowtype;
  v_privacy public.bgm_membership_declaration_versions%rowtype;
  v_health public.bgm_membership_declaration_versions%rowtype;
  v_declaration_snapshot jsonb;
  v_ack_at timestamptz := now();
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Enrollment payload must be an object.';
  end if;

  if v_application_source <> 'tablet' then
    raise exception 'This operation accepts tablet applications only.';
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
  if v_membership_type = 'couples' then
    v_expected_count := 2;
  else
    v_expected_count := 1;
  end if;

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
  limit 1;

  if v_price_catalog_version_id is null or v_base_price_cents is null then
    raise exception 'Published membership price is not available.';
  end if;

  select * into v_gym_rules
  from public.bgm_membership_declaration_versions
  where content_key = 'gym_rules' and status = 'published'
  limit 1;

  select * into v_privacy
  from public.bgm_membership_declaration_versions
  where content_key = 'privacy' and status = 'published'
  limit 1;

  select * into v_health
  from public.bgm_membership_declaration_versions
  where content_key = 'health' and status = 'published'
  limit 1;

  if v_gym_rules.id is null or v_privacy.id is null or v_health.id is null then
    raise exception 'Required published declarations are not available.';
  end if;

  for v_participant in select value from jsonb_array_elements(v_participants)
  loop
    v_identity_match_state := btrim(coalesce(v_participant->>'identityMatchState', 'clear'));
    if v_identity_match_state not in ('clear', 'active', 'expired_inactive') then
      raise exception 'Invalid identity_match_state.';
    end if;
    if v_identity_match_state = 'active' then
      raise exception 'An active membership already exists for this identity.';
    end if;
    if btrim(coalesce(v_participant->>'firstName', '')) = ''
       or btrim(coalesce(v_participant->>'lastName', '')) = ''
       or btrim(coalesce(v_participant->>'idNumber', '')) = ''
       or btrim(coalesce(v_participant->>'dateOfBirth', '')) = '' then
      raise exception 'Required participant identity details are missing.';
    end if;
    if coalesce((v_participant->>'gymRulesAccepted')::boolean, false) is not true
       or coalesce((v_participant->>'privacyAccepted')::boolean, false) is not true
       or coalesce((v_participant->>'healthAccepted')::boolean, false) is not true then
      raise exception 'Each participant must accept the required declarations.';
    end if;
  end loop;

  v_start_date := (now() at time zone 'Europe/Malta')::date;
  v_expiry_date := case v_duration_key
    when '1_week' then v_start_date + 7
    when '2_weeks' then v_start_date + 14
    when '1_month' then (v_start_date + interval '1 month')::date
    when '3_months' then (v_start_date + interval '3 months')::date
    when '6_months' then (v_start_date + interval '6 months')::date
    when '1_year' then (v_start_date + interval '1 year')::date
  end;

  v_declaration_snapshot := jsonb_build_object(
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
    )
  );

  v_reference := 'BGMAPP-' || upper(replace(gen_random_uuid()::text, '-', ''));

  insert into public.bgm_membership_applications (
    reference,
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
    v_application_source,
    v_start_date,
    v_base_price_cents,
    'EUR',
    v_price_catalog_version_id,
    v_gym_rules.id,
    v_privacy.id,
    v_health.id,
    v_declaration_snapshot,
    v_ack_at
  )
  returning id into v_application_id;

  for v_participant in select value from jsonb_array_elements(v_participants)
  loop
    v_order := v_order + 1;
    v_identity_match_state := btrim(coalesce(v_participant->>'identityMatchState', 'clear'));
    v_matched_member_id := nullif(btrim(coalesce(v_participant->>'matchedMemberId', '')), '')::uuid;

    if v_identity_match_state = 'expired_inactive' and v_matched_member_id is null then
      raise exception 'Matched existing identity is required for an expired or inactive match.';
    end if;

    insert into public.bgm_membership_application_members (
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
      v_application_id,
      v_order,
      btrim(v_participant->>'firstName'),
      btrim(v_participant->>'lastName'),
      nullif(btrim(coalesce(v_participant->>'addressLine1', '')), ''),
      nullif(btrim(coalesce(v_participant->>'addressLine2', '')), ''),
      nullif(btrim(coalesce(v_participant->>'town', '')), ''),
      nullif(btrim(coalesce(v_participant->>'postcode', '')), ''),
      btrim(v_participant->>'idNumber'),
      nullif(v_participant->>'dateOfBirth', '')::date,
      nullif(btrim(coalesce(v_participant->>'phone', '')), ''),
      nullif(lower(btrim(coalesce(v_participant->>'email', ''))), ''),
      nullif(btrim(coalesce(v_participant->>'nextOfKin', '')), ''),
      nullif(btrim(coalesce(v_participant->>'officialPhotoPath', '')), ''),
      null,
      nullif(btrim(coalesce(v_participant->>'guardianName', '')), ''),
      nullif(btrim(coalesce(v_participant->>'guardianIdNumber', '')), ''),
      nullif(btrim(coalesce(v_participant->>'guardianRelationship', '')), ''),
      nullif(btrim(coalesce(v_participant->>'guardianPhone', '')), ''),
      nullif(lower(btrim(coalesce(v_participant->>'guardianEmail', ''))), ''),
      nullif(btrim(coalesce(v_participant->>'guardianAddress', '')), ''),
      coalesce((v_participant->>'under18AtSubmission')::boolean, false),
      v_identity_match_state,
      v_matched_member_id,
      case
        when jsonb_typeof(v_participant->'duplicateContactWarning') = 'object'
          then v_participant->'duplicateContactWarning'
        else null
      end,
      v_ack_at,
      v_ack_at,
      v_ack_at
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
      'applicationSource', v_application_source,
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

revoke all on function public.bgm_create_public_membership_application(jsonb) from public;
revoke all on function public.bgm_create_public_membership_application(jsonb) from anon;
revoke all on function public.bgm_create_public_membership_application(jsonb) from authenticated;
grant execute on function public.bgm_create_public_membership_application(jsonb) to service_role;
