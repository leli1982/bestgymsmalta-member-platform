-- Atomic staff correction of a pending membership application.
-- Authored in Git first. Apply only at the controlled Supabase migration checkpoint.

create or replace function public.bgm_correct_membership_application(
  p_application_id uuid,
  p_system_user_id uuid,
  p_membership_type text,
  p_duration_key text,
  p_start_date date,
  p_expiry_date date,
  p_participants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_system_user record;
  v_expected_count integer;
  v_database_count integer;
  v_payload_count integer;
  v_payload_ids uuid[];
  v_database_ids uuid[];
  v_participant jsonb;
  v_participant_id uuid;
  v_before_participants jsonb;
  v_after_participants jsonb;
  v_before_data jsonb;
  v_after_data jsonb;
begin
  if p_system_user_id is null then
    raise exception 'Correcting system user is required.';
  end if;

  select id, gym_id, is_super_admin, active
  into v_system_user
  from public.bgm_system_users
  where id = p_system_user_id
    and active = true;

  if not found then
    raise exception 'Correcting system user is not active.';
  end if;

  select *
  into v_application
  from public.bgm_membership_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Membership application was not found.';
  end if;

  if v_application.status not in ('submitted', 'awaiting_payment') then
    raise exception 'Membership application is no longer editable.';
  end if;

  if not v_system_user.is_super_admin
    and v_system_user.gym_id is distinct from v_application.enrollment_gym_id then
    raise exception 'This application belongs to another gym.';
  end if;

  if p_membership_type not in ('single', 'couples', 'student') then
    raise exception 'Select a valid membership type.';
  end if;

  if p_duration_key not in ('1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year') then
    raise exception 'Select a valid membership duration.';
  end if;

  if p_start_date is null or p_expiry_date is null then
    raise exception 'Membership start and expiry dates are required.';
  end if;

  if p_expiry_date < p_start_date then
    raise exception 'Membership expiry date cannot be before the start date.';
  end if;

  if p_participants is null or jsonb_typeof(p_participants) <> 'array' then
    raise exception 'Participants must be supplied as an array.';
  end if;

  v_expected_count := case when p_membership_type = 'couples' then 2 else 1 end;
  v_payload_count := jsonb_array_length(p_participants);

  select count(*),
         coalesce(array_agg(id order by participant_order), '{}'::uuid[])
  into v_database_count, v_database_ids
  from public.bgm_membership_application_members
  where application_id = p_application_id;

  if v_database_count <> v_expected_count or v_payload_count <> v_expected_count then
    raise exception 'Membership type and participant count do not match.';
  end if;

  select coalesce(array_agg((item->>'id')::uuid order by (item->>'participantOrder')::integer), '{}'::uuid[])
  into v_payload_ids
  from jsonb_array_elements(p_participants) item;

  if v_payload_ids is distinct from v_database_ids then
    raise exception 'Application participant identities cannot be changed.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'participantOrder', member.participant_order,
        'firstName', member.first_name,
        'lastName', member.last_name,
        'addressLine1', member.address_line_1,
        'addressLine2', member.address_line_2,
        'postcode', member.postcode,
        'idNumber', member.id_number,
        'dateOfBirth', member.date_of_birth,
        'phone', member.phone,
        'email', member.email,
        'nextOfKin', member.next_of_kin
      ) order by member.participant_order
    ),
    '[]'::jsonb
  )
  into v_before_participants
  from public.bgm_membership_application_members member
  where member.application_id = p_application_id;

  v_before_data := jsonb_build_object(
    'membershipType', v_application.membership_type,
    'durationKey', v_application.duration_key,
    'startDate', v_application.start_date,
    'expiryDate', v_application.expiry_date,
    'participants', v_before_participants
  );

  update public.bgm_membership_applications
  set membership_type = p_membership_type,
      duration_key = p_duration_key,
      start_date = p_start_date,
      expiry_date = p_expiry_date,
      reviewed_by_system_user_id = p_system_user_id,
      updated_at = now()
  where id = p_application_id;

  for v_participant in
    select item
    from jsonb_array_elements(p_participants) item
  loop
    v_participant_id := (v_participant->>'id')::uuid;

    if nullif(btrim(v_participant->>'firstName'), '') is null
      or nullif(btrim(v_participant->>'lastName'), '') is null then
      raise exception 'Participant first name and surname are required.';
    end if;

    update public.bgm_membership_application_members
    set first_name = btrim(v_participant->>'firstName'),
        last_name = btrim(v_participant->>'lastName'),
        address_line_1 = nullif(btrim(coalesce(v_participant->>'addressLine1', '')), ''),
        address_line_2 = nullif(btrim(coalesce(v_participant->>'addressLine2', '')), ''),
        postcode = nullif(btrim(coalesce(v_participant->>'postcode', '')), ''),
        id_number = nullif(btrim(coalesce(v_participant->>'idNumber', '')), ''),
        date_of_birth = nullif(v_participant->>'dateOfBirth', '')::date,
        phone = nullif(btrim(coalesce(v_participant->>'phone', '')), ''),
        email = nullif(lower(btrim(coalesce(v_participant->>'email', ''))), ''),
        next_of_kin = nullif(btrim(coalesce(v_participant->>'nextOfKin', '')), ''),
        updated_at = now()
    where id = v_participant_id
      and application_id = p_application_id;

    if not found then
      raise exception 'Application participant was not found.';
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'participantOrder', member.participant_order,
        'firstName', member.first_name,
        'lastName', member.last_name,
        'addressLine1', member.address_line_1,
        'addressLine2', member.address_line_2,
        'postcode', member.postcode,
        'idNumber', member.id_number,
        'dateOfBirth', member.date_of_birth,
        'phone', member.phone,
        'email', member.email,
        'nextOfKin', member.next_of_kin
      ) order by member.participant_order
    ),
    '[]'::jsonb
  )
  into v_after_participants
  from public.bgm_membership_application_members member
  where member.application_id = p_application_id;

  v_after_data := jsonb_build_object(
    'membershipType', p_membership_type,
    'durationKey', p_duration_key,
    'startDate', p_start_date,
    'expiryDate', p_expiry_date,
    'participants', v_after_participants
  );

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
    p_system_user_id,
    v_application.enrollment_gym_id,
    null,
    'membership.application.correct',
    'membership_application',
    p_application_id::text,
    v_before_data,
    v_after_data
  );

  return jsonb_build_object(
    'applicationId', p_application_id,
    'updatedAt', now(),
    'before', v_before_data,
    'after', v_after_data
  );
end;
$$;

revoke all on function public.bgm_correct_membership_application(uuid, uuid, text, text, date, date, jsonb) from public;
revoke all on function public.bgm_correct_membership_application(uuid, uuid, text, text, date, date, jsonb) from anon;
revoke all on function public.bgm_correct_membership_application(uuid, uuid, text, text, date, date, jsonb) from authenticated;
grant execute on function public.bgm_correct_membership_application(uuid, uuid, text, text, date, date, jsonb) to service_role;
