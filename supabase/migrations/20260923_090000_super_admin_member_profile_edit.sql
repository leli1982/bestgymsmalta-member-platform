-- Super Admin-only, atomic personal profile edit. Never changes permanent identity,
-- legacy pkCustomer, credential assignment, membership, visit or payment records.
create or replace function public.bgm_super_admin_update_member_profile(
  p_system_user_id uuid,
  p_member_id uuid,
  p_expected_updated_at timestamptz,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.bgm_members%rowtype;
  v_after public.bgm_members%rowtype;
  v_keys text[] := array[
    'firstName', 'lastName', 'email', 'mobile', 'dateOfBirth', 'idNumber',
    'addressLine1', 'addressLine2', 'town', 'postcode', 'nextOfKin'
  ];
  v_old jsonb;
  v_new jsonb;
begin
  if not exists (
    select 1 from public.bgm_system_users
    where id = p_system_user_id and active = true and is_super_admin = true
  ) then
    raise exception 'Super Admin access required.';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object'
    or (select count(*) from jsonb_object_keys(p_profile)) <> array_length(v_keys, 1)
    or exists (select 1 from jsonb_object_keys(p_profile) as k(key)
               where not (k.key = any(v_keys)))
    or exists (select 1 from jsonb_each(p_profile) as f(key, value)
               where jsonb_typeof(f.value) not in ('string', 'null')) then
    raise exception 'Invalid member profile fields.';
  end if;
  if p_expected_updated_at is null then
    raise exception 'Reload this member before saving changes.';
  end if;
  select * into v_before from public.bgm_members where id = p_member_id for update;
  if not found then raise exception 'Member not found.'; end if;
  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'This member changed since you opened the editor. Reload before saving.';
  end if;
  if nullif(btrim(p_profile->>'firstName'), '') is null
     or nullif(btrim(p_profile->>'lastName'), '') is null
     or length(btrim(p_profile->>'firstName')) > 100
     or length(btrim(p_profile->>'lastName')) > 100 then
    raise exception 'Enter a first and last name (100 characters maximum each).';
  end if;
  if length(coalesce(p_profile->>'email', '')) > 254
    or (nullif(btrim(p_profile->>'email'), '') is not null
        and btrim(p_profile->>'email') !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
    raise exception 'Enter a valid email address.';
  end if;
  if exists (select 1 from jsonb_each_text(p_profile) as f(key, value)
    where length(coalesce(f.value, '')) > 500) then
    raise exception 'A member profile field is too long.';
  end if;
  if nullif(p_profile->>'dateOfBirth', '') is not null then
    if p_profile->>'dateOfBirth' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}
      raise exception 'Enter a valid date of birth.';
    end if;
    if (p_profile->>'dateOfBirth')::date > (now() at time zone 'Europe/Malta')::date then
      raise exception 'Date of birth cannot be in the future.';
    end if;
  end if;
  v_old := jsonb_build_object(
    'firstName', v_before.first_name, 'lastName', v_before.last_name,
    'email', v_before.email, 'mobile', v_before.mobile,
    'dateOfBirth', v_before.date_of_birth, 'idNumber', v_before.id_number,
    'addressLine1', v_before.address_line_1, 'addressLine2', v_before.address_line_2,
    'town', v_before.town, 'postcode', v_before.postcode, 'nextOfKin', v_before.next_of_kin
  );
  update public.bgm_members
  set first_name = btrim(p_profile->>'firstName'),
      last_name = btrim(p_profile->>'lastName'),
      full_name = btrim(p_profile->>'firstName') || ' ' || btrim(p_profile->>'lastName'),
      email = nullif(lower(btrim(p_profile->>'email')), ''),
      mobile = nullif(btrim(p_profile->>'mobile'), ''),
      date_of_birth = nullif(p_profile->>'dateOfBirth', '')::date,
      id_number = nullif(btrim(p_profile->>'idNumber'), ''),
      address_line_1 = nullif(btrim(p_profile->>'addressLine1'), ''),
      address_line_2 = nullif(btrim(p_profile->>'addressLine2'), ''),
      town = nullif(btrim(p_profile->>'town'), ''),
      postcode = nullif(btrim(p_profile->>'postcode'), ''),
      next_of_kin = nullif(btrim(p_profile->>'nextOfKin'), ''),
      updated_at = clock_timestamp()
  where id = p_member_id
  returning * into v_after;
  v_new := jsonb_build_object(
    'firstName', v_after.first_name, 'lastName', v_after.last_name,
    'email', v_after.email, 'mobile', v_after.mobile,
    'dateOfBirth', v_after.date_of_birth, 'idNumber', v_after.id_number,
    'addressLine1', v_after.address_line_1, 'addressLine2', v_after.address_line_2,
    'town', v_after.town, 'postcode', v_after.postcode, 'nextOfKin', v_after.next_of_kin
  );
  if v_old is distinct from v_new then
    insert into public.bgm_audit_log (
      system_user_id, context_gym_id, action_key, entity_type, entity_id, member_id,
      before_data, after_data
    ) values (
      p_system_user_id, v_before.enrollment_gym_id,
      'member.profile.update', 'member', p_member_id::text, p_member_id, v_old, v_new
    );
  end if;
  return jsonb_build_object('id', v_after.id, 'updatedAt', v_after.updated_at);
end;
$$;

revoke all on function public.bgm_super_admin_update_member_profile(uuid, uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.bgm_super_admin_update_member_profile(uuid, uuid, timestamptz, jsonb)
  to service_role;
 then
      raise exception 'Enter a valid date of birth.';
    end if;
    if (p_profile->>'dateOfBirth')::date > (now() at time zone 'Europe/Malta')::date then
      raise exception 'Date of birth cannot be in the future.';
    end if;
  end if;
  v_old := jsonb_build_object(
    'firstName', v_before.first_name, 'lastName', v_before.last_name,
    'email', v_before.email, 'mobile', v_before.mobile,
    'dateOfBirth', v_before.date_of_birth, 'idNumber', v_before.id_number,
    'addressLine1', v_before.address_line_1, 'addressLine2', v_before.address_line_2,
    'town', v_before.town, 'postcode', v_before.postcode, 'nextOfKin', v_before.next_of_kin
  );
  update public.bgm_members
  set first_name = btrim(p_profile->>'firstName'),
      last_name = btrim(p_profile->>'lastName'),
      full_name = btrim(p_profile->>'firstName') || ' ' || btrim(p_profile->>'lastName'),
      email = nullif(lower(btrim(p_profile->>'email')), ''),
      mobile = nullif(btrim(p_profile->>'mobile'), ''),
      date_of_birth = nullif(p_profile->>'dateOfBirth', '')::date,
      id_number = nullif(btrim(p_profile->>'idNumber'), ''),
      address_line_1 = nullif(btrim(p_profile->>'addressLine1'), ''),
      address_line_2 = nullif(btrim(p_profile->>'addressLine2'), ''),
      town = nullif(btrim(p_profile->>'town'), ''),
      postcode = nullif(btrim(p_profile->>'postcode'), ''),
      next_of_kin = nullif(btrim(p_profile->>'nextOfKin'), ''),
      updated_at = clock_timestamp()
  where id = p_member_id
  returning * into v_after;
  v_new := jsonb_build_object(
    'firstName', v_after.first_name, 'lastName', v_after.last_name,
    'email', v_after.email, 'mobile', v_after.mobile,
    'dateOfBirth', v_after.date_of_birth, 'idNumber', v_after.id_number,
    'addressLine1', v_after.address_line_1, 'addressLine2', v_after.address_line_2,
    'town', v_after.town, 'postcode', v_after.postcode, 'nextOfKin', v_after.next_of_kin
  );
  if v_old is distinct from v_new then
    insert into public.bgm_audit_log (
      system_user_id, context_gym_id, action_key, entity_type, entity_id, member_id,
      before_data, after_data
    ) values (
      p_system_user_id, v_before.enrollment_gym_id,
      'member.profile.update', 'member', p_member_id::text, p_member_id, v_old, v_new
    );
  end if;
  return jsonb_build_object('id', v_after.id, 'updatedAt', v_after.updated_at);
end;
$$;

revoke all on function public.bgm_super_admin_update_member_profile(uuid, uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.bgm_super_admin_update_member_profile(uuid, uuid, timestamptz, jsonb)
  to service_role;
