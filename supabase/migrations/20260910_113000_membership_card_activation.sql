-- BestGymsMalta membership activation using preprinted physical cards.
-- New memberships require a captured official photo and one reserved card per
-- participant. The active card barcode is mirrored to member_number only for
-- compatibility; bgm_members.id remains the permanent person identity.

create or replace function public.bgm_activate_membership_application(
  p_application_id uuid,
  p_activation_staff_name text,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_participant record;
  v_card public.bgm_member_card_credentials%rowtype;
  v_membership_id uuid;
  v_member_id uuid;
  v_member_number text;
  v_member_count integer;
  v_expected_count integer;
  v_primary_member_id uuid;
  v_existing_photo_path text;
  v_affected_members jsonb := '[]'::jsonb;
begin
  if p_activation_staff_name is null or btrim(p_activation_staff_name) = '' then
    raise exception 'Activation Staff Name is required.';
  end if;

  if p_system_user_id is null then
    raise exception 'Activating system user is required.';
  end if;

  perform 1
  from public.bgm_system_users
  where id = p_system_user_id
    and active = true;

  if not found then
    raise exception 'Activating system user is not active.';
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
    raise exception 'Membership application is not awaiting activation.';
  end if;

  if v_application.start_date is null or v_application.expiry_date is null then
    raise exception 'Membership start date and expiry date are required before activation.';
  end if;

  if v_application.expiry_date < v_application.start_date then
    raise exception 'Membership expiry date cannot be before the start date.';
  end if;

  select count(*)
  into v_member_count
  from public.bgm_membership_application_members
  where application_id = p_application_id;

  v_expected_count := case
    when v_application.membership_type = 'couples' then 2
    else 1
  end;

  if v_member_count <> v_expected_count then
    raise exception 'Membership application has an invalid participant count.';
  end if;

  if v_application.application_kind = 'new' then
    if exists (
      select 1
      from public.bgm_membership_application_members
      where application_id = p_application_id
        and existing_member_id is not null
    ) then
      raise exception 'New membership applications cannot reuse an existing member identity.';
    end if;
  elsif v_application.application_kind = 'renewal' then
    if exists (
      select 1
      from public.bgm_membership_application_members
      where application_id = p_application_id
        and existing_member_id is null
    ) then
      raise exception 'Renewal applications require an existing member identity.';
    end if;
  else
    raise exception 'Membership application kind is invalid.';
  end if;

  -- Validate every participant before creating the membership row. A failure
  -- anywhere aborts the entire function and leaves card/member state unchanged.
  for v_participant in
    select *
    from public.bgm_membership_application_members
    where application_id = p_application_id
    order by participant_order
  loop
    if v_application.application_kind = 'new' then
      if nullif(btrim(v_participant.official_photo_path), '') is null then
        raise exception 'Official member photo is required before activation.';
      end if;

      select *
      into v_card
      from public.bgm_member_card_credentials
      where application_member_id = v_participant.id
        and status = 'reserved'
      for update;

      if not found then
        raise exception 'Reserved membership card is required before activation.';
      end if;
    else
      select official_photo_path
      into v_existing_photo_path
      from public.bgm_members
      where id = v_participant.existing_member_id
      for update;

      if not found then
        raise exception 'Existing renewal member was not found.';
      end if;

      if nullif(btrim(coalesce(v_participant.official_photo_path, v_existing_photo_path)), '') is null then
        raise exception 'Official member photo is required before renewal activation.';
      end if;
    end if;
  end loop;

  insert into public.bgm_memberships (
    application_id,
    membership_type,
    duration_key,
    start_date,
    expiry_date,
    enrollment_gym_id,
    status,
    activation_staff_name,
    activated_by_system_user_id,
    updated_at
  ) values (
    v_application.id,
    v_application.membership_type,
    v_application.duration_key,
    v_application.start_date,
    v_application.expiry_date,
    v_application.enrollment_gym_id,
    'active',
    btrim(p_activation_staff_name),
    p_system_user_id,
    now()
  )
  returning id into v_membership_id;

  for v_participant in
    select *
    from public.bgm_membership_application_members
    where application_id = p_application_id
    order by participant_order
  loop
    if v_application.application_kind = 'new' then
      select *
      into v_card
      from public.bgm_member_card_credentials
      where application_member_id = v_participant.id
        and status = 'reserved'
      for update;

      insert into public.bgm_members (
        member_number,
        full_name,
        first_name,
        last_name,
        email,
        phone,
        status,
        enrollment_date,
        membership_period,
        membership_expiry,
        address_line_1,
        address_line_2,
        postcode,
        id_number,
        date_of_birth,
        next_of_kin,
        enrollment_gym_id,
        official_photo_path,
        updated_at
      ) values (
        v_card.barcode_value,
        btrim(v_participant.first_name || ' ' || v_participant.last_name),
        btrim(v_participant.first_name),
        btrim(v_participant.last_name),
        nullif(lower(btrim(v_participant.email)), ''),
        nullif(btrim(v_participant.phone), ''),
        'active',
        v_application.start_date,
        v_application.duration_key,
        v_application.expiry_date,
        nullif(btrim(v_participant.address_line_1), ''),
        nullif(btrim(v_participant.address_line_2), ''),
        nullif(btrim(v_participant.postcode), ''),
        nullif(btrim(v_participant.id_number), ''),
        v_participant.date_of_birth,
        nullif(btrim(v_participant.next_of_kin), ''),
        v_application.enrollment_gym_id,
        btrim(v_participant.official_photo_path),
        now()
      )
      returning id, member_number into v_member_id, v_member_number;

      update public.bgm_member_card_credentials
      set
        member_id = v_member_id,
        application_member_id = null,
        status = 'active',
        activated_at = now(),
        updated_at = now()
      where id = v_card.id
        and status = 'reserved';

      if not found then
        raise exception 'Reserved membership card could not be activated.';
      end if;

      update public.bgm_member_official_photos
      set
        member_id = v_member_id,
        application_member_id = null
      where application_member_id = v_participant.id;
    else
      select id, member_number, official_photo_path
      into v_member_id, v_member_number, v_existing_photo_path
      from public.bgm_members
      where id = v_participant.existing_member_id
      for update;

      if not found then
        raise exception 'Existing renewal member was not found.';
      end if;

      update public.bgm_members
      set
        first_name = btrim(v_participant.first_name),
        last_name = btrim(v_participant.last_name),
        full_name = btrim(v_participant.first_name || ' ' || v_participant.last_name),
        email = coalesce(nullif(lower(btrim(v_participant.email)), ''), email),
        phone = coalesce(nullif(btrim(v_participant.phone), ''), phone),
        address_line_1 = coalesce(nullif(btrim(v_participant.address_line_1), ''), address_line_1),
        address_line_2 = coalesce(nullif(btrim(v_participant.address_line_2), ''), address_line_2),
        postcode = coalesce(nullif(btrim(v_participant.postcode), ''), postcode),
        id_number = coalesce(nullif(btrim(v_participant.id_number), ''), id_number),
        date_of_birth = coalesce(v_participant.date_of_birth, date_of_birth),
        next_of_kin = coalesce(nullif(btrim(v_participant.next_of_kin), ''), next_of_kin),
        official_photo_path = coalesce(nullif(btrim(v_participant.official_photo_path), ''), official_photo_path),
        status = 'active',
        enrollment_date = v_application.start_date,
        membership_period = v_application.duration_key,
        membership_expiry = v_application.expiry_date,
        enrollment_gym_id = v_application.enrollment_gym_id,
        updated_at = now()
      where id = v_member_id;

      update public.bgm_member_official_photos
      set
        member_id = v_member_id,
        application_member_id = null
      where application_member_id = v_participant.id;
    end if;

    insert into public.bgm_membership_members (
      membership_id,
      member_id,
      member_role
    ) values (
      v_membership_id,
      v_member_id,
      case when v_participant.participant_order = 1 then 'primary' else 'partner' end
    );

    if v_participant.participant_order = 1 then
      v_primary_member_id := v_member_id;
    end if;

    v_affected_members := v_affected_members || jsonb_build_array(
      jsonb_build_object(
        'memberId', v_member_id,
        'memberNumber', v_member_number,
        'cardBarcode', v_member_number,
        'role', case when v_participant.participant_order = 1 then 'primary' else 'partner' end
      )
    );
  end loop;

  update public.bgm_membership_applications
  set
    status = 'activated',
    reviewed_by_system_user_id = p_system_user_id,
    payment_received_at = now(),
    activated_at = now(),
    updated_at = now()
  where id = v_application.id;

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
    v_application.enrollment_gym_id,
    btrim(p_activation_staff_name),
    'membership.activate',
    'membership_application',
    v_application.id::text,
    v_primary_member_id,
    jsonb_build_object(
      'status', v_application.status,
      'applicationKind', v_application.application_kind
    ),
    jsonb_build_object(
      'status', 'activated',
      'applicationKind', v_application.application_kind,
      'membershipId', v_membership_id,
      'members', v_affected_members
    )
  );

  return jsonb_build_object(
    'applicationId', v_application.id,
    'membershipId', v_membership_id,
    'applicationKind', v_application.application_kind,
    'members', v_affected_members
  );
end;
$$;

revoke all on function public.bgm_activate_membership_application(uuid, text, uuid) from public;
revoke all on function public.bgm_activate_membership_application(uuid, text, uuid) from anon;
revoke all on function public.bgm_activate_membership_application(uuid, text, uuid) from authenticated;
grant execute on function public.bgm_activate_membership_application(uuid, text, uuid) to service_role;
