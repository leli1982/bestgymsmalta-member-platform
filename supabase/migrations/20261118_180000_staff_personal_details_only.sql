-- Staff-only personal/contact corrections. No membership, billing, card or DOB
-- column is updated. Apply only through the normal reviewed migration rollout.
-- Uses service_role RPC with independent database-side active staff verification.
CREATE OR REPLACE FUNCTION public.bgm_staff_update_member_personal_details(
  p_system_user_id uuid,
  p_member_id uuid,
  p_expected_updated_at timestamptz,
  p_profile jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor public.bgm_system_users%ROWTYPE;
  v_before public.bgm_members%ROWTYPE;
  v_after public.bgm_members%ROWTYPE;
  v_keys text[] := ARRAY[
    'firstName','lastName','idNumber','addressLine1','addressLine2',
    'town','postcode','country','mobile','phone','telephoneNo1',
    'telephoneNo2','email','nextOfKin'
  ];
  v_old jsonb;
  v_new jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.bgm_system_users
    WHERE id = p_system_user_id AND active = true;
  IF NOT FOUND
     OR v_actor.is_super_admin IS TRUE
     OR coalesce(v_actor.role, '') <> 'gym_staff'
     OR v_actor.gym_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.bgm_gyms g
       WHERE g.id = v_actor.gym_id AND g.status = 'active'
     ) THEN
    RAISE EXCEPTION 'Active gym staff access required.' USING ERRCODE = 'P0001';
  END IF;

  IF p_member_id IS NULL OR p_expected_updated_at IS NULL
     OR p_profile IS NULL OR jsonb_typeof(p_profile) <> 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(p_profile)) <> array_length(v_keys, 1)
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_profile) AS k(key)
       WHERE NOT (k.key = ANY(v_keys))
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_each(p_profile) AS field(key,value)
       WHERE jsonb_typeof(field.value) <> 'string'
     ) THEN
    RAISE EXCEPTION 'Only approved personal and contact details may be edited.' USING ERRCODE = 'P0001';
  END IF;

  IF nullif(btrim(p_profile->>'firstName'), '') IS NULL
     OR nullif(btrim(p_profile->>'lastName'), '') IS NULL
     OR length(btrim(p_profile->>'firstName')) > 100
     OR length(btrim(p_profile->>'lastName')) > 100 THEN
    RAISE EXCEPTION 'Enter a first name and surname (up to 100 characters each).' USING ERRCODE = 'P0001';
  END IF;
  IF length(coalesce(p_profile->>'email', '')) > 254
     OR (nullif(btrim(p_profile->>'email'), '') IS NOT NULL
       AND btrim(p_profile->>'email') !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(p_profile) AS field(key,value)
    WHERE length(field.value) > 500) THEN
    RAISE EXCEPTION 'A personal-detail field exceeds 500 characters.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_before FROM public.bgm_members
    WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR v_before.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This member cannot be edited here.' USING ERRCODE = 'P0001';
  END IF;
  IF v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Member details changed elsewhere. Reload and review before saving.' USING ERRCODE = 'P0001';
  END IF;

  v_old := jsonb_build_object(
    'firstName',v_before.first_name,'lastName',v_before.last_name,
    'idNumber',v_before.id_number,'addressLine1',v_before.address_line_1,
    'addressLine2',v_before.address_line_2,'town',v_before.town,
    'postcode',v_before.postcode,'country',v_before.country,
    'mobile',v_before.mobile,'phone',v_before.phone,
    'telephoneNo1',v_before.telephone_no_1,'telephoneNo2',v_before.telephone_no_2,
    'email',v_before.email,'nextOfKin',v_before.next_of_kin
  );

  UPDATE public.bgm_members SET
    first_name = btrim(p_profile->>'firstName'),
    last_name = btrim(p_profile->>'lastName'),
    full_name = btrim(p_profile->>'firstName') || ' ' || btrim(p_profile->>'lastName'),
    id_number = nullif(btrim(p_profile->>'idNumber'),''),
    address_line_1 = nullif(btrim(p_profile->>'addressLine1'),''),
    address_line_2 = nullif(btrim(p_profile->>'addressLine2'),''),
    town = nullif(btrim(p_profile->>'town'),''),
    postcode = nullif(btrim(p_profile->>'postcode'),''),
    country = nullif(btrim(p_profile->>'country'),''),
    mobile = nullif(btrim(p_profile->>'mobile'),''),
    phone = nullif(btrim(p_profile->>'phone'),''),
    telephone_no_1 = nullif(btrim(p_profile->>'telephoneNo1'),''),
    telephone_no_2 = nullif(btrim(p_profile->>'telephoneNo2'),''),
    email = nullif(lower(btrim(p_profile->>'email')),''),
    next_of_kin = nullif(btrim(p_profile->>'nextOfKin'),''),
    updated_at = clock_timestamp()
  WHERE id = p_member_id
  RETURNING * INTO v_after;

  v_new := jsonb_build_object(
    'firstName',v_after.first_name,'lastName',v_after.last_name,
    'idNumber',v_after.id_number,'addressLine1',v_after.address_line_1,
    'addressLine2',v_after.address_line_2,'town',v_after.town,
    'postcode',v_after.postcode,'country',v_after.country,
    'mobile',v_after.mobile,'phone',v_after.phone,
    'telephoneNo1',v_after.telephone_no_1,'telephoneNo2',v_after.telephone_no_2,
    'email',v_after.email,'nextOfKin',v_after.next_of_kin
  );
  IF v_old IS DISTINCT FROM v_new THEN
    INSERT INTO public.bgm_audit_log(
      system_user_id,context_gym_id,staff_name,action_key,entity_type,
      entity_id,member_id,before_data,after_data
    ) VALUES (
      v_actor.id,v_actor.gym_id,v_actor.display_name,'member.profile.staff_update',
      'member',p_member_id::text,p_member_id,v_old,v_new
    );
  END IF;
  RETURN jsonb_build_object('id',v_after.id,'updatedAt',v_after.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.bgm_staff_update_member_personal_details(uuid,uuid,timestamptz,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_staff_update_member_personal_details(uuid,uuid,timestamptz,jsonb)
  TO service_role;
