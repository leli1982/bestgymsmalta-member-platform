-- TEST ONLY: atomic one-time enrollment of server-encrypted ANSI378 templates.
-- BGM production must not receive this migration until separately reviewed.
CREATE UNIQUE INDEX IF NOT EXISTS bgm_hu20_one_active_template_per_employee
 ON public.bgm_staff_biometrics (employee_id)
 WHERE adapter_key='secugen-hu20-ansi378-v1' AND active=true AND status='enrolled';

CREATE OR REPLACE FUNCTION public.bgm_hu20_test_complete_enrollment(
 p_request_id uuid,
 p_terminal_id uuid,
 p_credential_id uuid,
 p_encrypted_template text
)
RETURNS TABLE(biometric_id uuid, employee_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE
 v_req public.bgm_hu20_enrollment_requests%ROWTYPE;
 v_bio uuid;
BEGIN
 IF p_request_id IS NULL OR p_terminal_id IS NULL OR p_credential_id IS NULL OR
    p_encrypted_template IS NULL OR
    length(p_encrypted_template) < 130 OR length(p_encrypted_template) > 150000 OR
    left(p_encrypted_template, 16) <> 'bgm-hu20-gcm-v1.' THEN
   RAISE EXCEPTION 'Invalid encrypted HU20 TEST enrollment payload' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_req FROM public.bgm_hu20_enrollment_requests
 WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.terminal_id <> p_terminal_id OR
    v_req.status <> 'pending' OR v_req.expires_at <= now() THEN
   RAISE EXCEPTION 'HU20 enrollment authorization expired, used or not assigned to terminal'
     USING ERRCODE='P0001';
 END IF;
 PERFORM 1 FROM public.bgm_staff_employees
   WHERE id=v_req.employee_id AND active=true FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Cannot enroll inactive employee' USING ERRCODE='P0001';
 END IF;
 PERFORM 1 FROM public.bgm_staff_terminals
   WHERE id=p_terminal_id AND active=true FOR SHARE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Cannot enroll on inactive terminal' USING ERRCODE='P0001';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.bgm_staff_biometrics
   WHERE employee_id=v_req.employee_id AND active=true AND status='enrolled'
 ) THEN
   RAISE EXCEPTION 'Employee already has active biometrics' USING ERRCODE='P0001';
 END IF;
 INSERT INTO public.bgm_staff_biometrics
   (id, employee_id, active, status, adapter_key, vendor,
    encrypted_template, template_version, metadata, created_by_system_user_id)
 VALUES
   (p_credential_id, v_req.employee_id, true, 'enrolled',
    'secugen-hu20-ansi378-v1', 'SecuGen',
    p_encrypted_template, 'ANSI378',
    pg_catalog.jsonb_build_object('test_only', true, 'terminal_id', p_terminal_id,
     'enrollment_request_id',p_request_id,'template_format','ANSI378'),
    v_req.initiated_by_system_user_id)
 RETURNING id INTO v_bio;
 UPDATE public.bgm_hu20_enrollment_requests
  SET status='completed', completed_at=now()
  WHERE id=p_request_id;
 INSERT INTO public.bgm_audit_log
  (system_user_id, action_key, entity_type, entity_id, after_data)
 VALUES
  (v_req.initiated_by_system_user_id, 'staff.hu20.biometric.enrolled.test',
   'staff_biometric', v_bio::text,
   pg_catalog.jsonb_build_object('employeeId',v_req.employee_id,'terminalId',p_terminal_id,
   'enrollmentRequestId',p_request_id,'templateFormat','ANSI378','testOnly',true));
 RETURN QUERY SELECT v_bio,v_req.employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_hu20_test_complete_enrollment(uuid,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_test_complete_enrollment(uuid,uuid,uuid,text)
 TO service_role;
