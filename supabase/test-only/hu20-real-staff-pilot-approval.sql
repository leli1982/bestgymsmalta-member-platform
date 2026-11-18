-- ISOLATED HU20 TEST PROJECT ONLY: vlvyqdjhzdcxatilbdiv
-- DO NOT apply to Production. No biometric templates are read or collected by this feature.
-- Administrative approval != employee notice/consent. Native fingerprint capture
-- remains disabled for real staff until an independently reviewed implementation.
CREATE TABLE IF NOT EXISTS public.bgm_hu20_real_staff_pilot_approvals (
  employee_id uuid PRIMARY KEY REFERENCES public.bgm_staff_employees(id) ON DELETE RESTRICT,
  approved boolean NOT NULL DEFAULT false,
  updated_by_system_user_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bgm_hu20_real_staff_pilot_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bgm_hu20_real_staff_pilot_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bgm_hu20_real_staff_pilot_approvals TO service_role;
CREATE OR REPLACE FUNCTION public.bgm_hu20_test_set_real_staff_pilot_approval(
  p_employee_id uuid, p_approved boolean, p_actor_system_user_id uuid
)
RETURNS TABLE (result_employee_id uuid, result_approved boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_employee record;
BEGIN
  IF p_employee_id IS NULL OR p_approved IS NULL OR p_actor_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid HU20 TEST approval request' USING ERRCODE='P0001';
  END IF;
  SELECT e.id, e.id_number, e.active, e.home_gym_id, g.status AS gym_status
  INTO v_employee
  FROM public.bgm_staff_employees e
  LEFT JOIN public.bgm_gyms g ON g.id=e.home_gym_id
  WHERE e.id=p_employee_id
  FOR UPDATE OF e;
  IF NOT FOUND OR v_employee.id_number LIKE 'HU20-TEST-%' THEN
    RAISE EXCEPTION 'Must select a genuine staff record in TEST' USING ERRCODE='P0001';
  END IF;
  IF p_approved AND (NOT v_employee.active OR v_employee.gym_status IS DISTINCT FROM 'active') THEN
    RAISE EXCEPTION 'Employee and home gym must be active' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.bgm_hu20_real_staff_pilot_approvals
   (employee_id,approved,updated_by_system_user_id,updated_at)
  VALUES (p_employee_id,p_approved,p_actor_system_user_id,now())
  ON CONFLICT(employee_id) DO UPDATE SET approved=EXCLUDED.approved,
    updated_by_system_user_id=EXCLUDED.updated_by_system_user_id,
    updated_at=now();
  INSERT INTO public.bgm_audit_log
    (system_user_id,action_key,entity_type,entity_id,after_data)
  VALUES (p_actor_system_user_id,'staff.hu20.real_pilot.approval.changed.test',
    'staff_employee',p_employee_id::text,
    pg_catalog.jsonb_build_object('approved',p_approved,'testOnly',true,
      'noFingerprintCapture',true));
  RETURN QUERY SELECT p_employee_id,p_approved;
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_hu20_test_set_real_staff_pilot_approval(uuid,boolean,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_test_set_real_staff_pilot_approval(uuid,boolean,uuid)
  TO service_role;
