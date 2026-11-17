-- TEST database ONLY: explicit Super Admin pilot authorisation for individual real staff.
-- DO NOT apply to Production. Fingerprint capture remains disabled by default.
CREATE TABLE IF NOT EXISTS public.bgm_hu20_real_staff_pilot (
  employee_id uuid PRIMARY KEY REFERENCES public.bgm_staff_employees(id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT false,
  changed_by_system_user_id uuid NOT NULL REFERENCES public.bgm_system_users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bgm_hu20_real_staff_pilot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bgm_hu20_real_staff_pilot FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bgm_hu20_real_staff_pilot TO service_role;

CREATE OR REPLACE FUNCTION public.bgm_hu20_pilot_set_employee_enabled(
  p_employee_id uuid, p_enabled boolean, p_actor_system_user_id uuid
)
RETURNS TABLE(employee_id uuid, enabled boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_employee public.bgm_staff_employees%ROWTYPE;
BEGIN
  IF p_employee_id IS NULL OR p_enabled IS NULL OR p_actor_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid HU20 pilot authorisation' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_employee FROM public.bgm_staff_employees
    WHERE id=p_employee_id FOR UPDATE;
  IF NOT FOUND OR v_employee.id_number LIKE 'HU20-TEST-%' OR
    (p_enabled AND NOT v_employee.active) THEN
    RAISE EXCEPTION 'Not an eligible active real employee' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.bgm_system_users
    WHERE id=p_actor_system_user_id AND active=true AND (is_super_admin=true OR role='super_admin')) THEN
    RAISE EXCEPTION 'Unknown administrator' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.bgm_hu20_real_staff_pilot
    (employee_id, enabled, changed_by_system_user_id, changed_at)
  VALUES (p_employee_id, p_enabled, p_actor_system_user_id, now())
  ON CONFLICT (employee_id) DO UPDATE
    SET enabled=excluded.enabled,
        changed_by_system_user_id=excluded.changed_by_system_user_id,
        changed_at=now();
  IF NOT p_enabled THEN
    -- Disable blocks future recognition, and immediately removes stored
    -- encrypted biometric material. Historical attendance records remain.
    UPDATE public.bgm_staff_biometrics
      SET active=false, status='revoked', encrypted_template=NULL, revoked_at=now(),
          template_reference='revoked:'||id::text
      WHERE employee_id=p_employee_id AND active=true AND status='enrolled';
    UPDATE public.bgm_hu20_enrollment_requests
      SET status='cancelled', cancelled_at=now()
      WHERE employee_id=p_employee_id AND status='pending';
  END IF;
  INSERT INTO public.bgm_audit_log
    (system_user_id, action_key, entity_type, entity_id, after_data)
  VALUES (p_actor_system_user_id, 'staff.hu20.pilot.employee.changed.test',
    'staff_employee',p_employee_id::text,
    pg_catalog.jsonb_build_object('enabled',p_enabled,'realStaffPilot',true,'testOnly',true));
  RETURN QUERY SELECT p_employee_id,p_enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_hu20_pilot_set_employee_enabled(uuid,boolean,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_pilot_set_employee_enabled(uuid,boolean,uuid) TO service_role;
