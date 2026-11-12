-- TEST-only Super Admin revocation with immediate encrypted-template erasure.
-- Applies only to SecuGen HU20 TEST credentials; no Production modification.
CREATE OR REPLACE FUNCTION public.bgm_hu20_test_revoke_biometric(
  p_biometric_id uuid,
  p_actor_system_user_id uuid
)
RETURNS TABLE(biometric_id uuid, employee_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE
  v_bio public.bgm_staff_biometrics%ROWTYPE;
BEGIN
  SELECT * INTO v_bio FROM public.bgm_staff_biometrics
  WHERE id=p_biometric_id AND adapter_key='secugen-hu20-ansi378-v1' FOR UPDATE;
  IF NOT FOUND OR v_bio.active <> true OR v_bio.status <> 'enrolled' THEN
    RAISE EXCEPTION 'HU20 biometric not active' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.bgm_system_users
    WHERE id=p_actor_system_user_id AND active=true AND
    (is_super_admin=true OR role='super_admin')) THEN
    RAISE EXCEPTION 'Super Admin actor invalid' USING ERRCODE='P0001';
  END IF;
  UPDATE public.bgm_staff_biometrics
    SET active=false, status='revoked', revoked_at=now(),
        encrypted_template=NULL, template_reference='revoked:'||id::text
    WHERE id=v_bio.id;
  INSERT INTO public.bgm_audit_log
    (system_user_id,action_key,entity_type,entity_id,after_data)
  VALUES
    (p_actor_system_user_id,'staff.hu20.biometric.revoked.test',
     'staff_biometric',v_bio.id::text,
     pg_catalog.jsonb_build_object('employeeId',v_bio.employee_id,
      'biometricId',v_bio.id,'encryptedTemplateErased',true,'testOnly',true));
  RETURN QUERY SELECT v_bio.id,v_bio.employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_hu20_test_revoke_biometric(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_test_revoke_biometric(uuid,uuid)
  TO service_role;
