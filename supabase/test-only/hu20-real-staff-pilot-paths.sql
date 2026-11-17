-- EXCLUSIVELY isolated HU20 TEST Supabase project vlvyqdjhzdcxatilbdiv.
-- Depends on hu20-real-staff-pilot-approvals.sql.
-- Distinct real-staff pilot RPCs preserve all existing fictional-only TEST functions.
-- Production MUST NOT receive these functions; real staff pilot env flag remains OFF until reviewed.

CREATE OR REPLACE FUNCTION public.bgm_hu20_pilot_complete_enrollment(p_request_id uuid, p_terminal_id uuid, p_credential_id uuid, p_encrypted_template text)
 RETURNS TABLE(biometric_id uuid, employee_id uuid)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 IF v_req.metadata->>'scope' IS DISTINCT FROM 'real_staff_pilot' THEN
   RAISE EXCEPTION 'Not authorised for real staff pilot' USING ERRCODE='P0001';
 END IF;
 PERFORM 1 FROM public.bgm_staff_employees e
   JOIN public.bgm_hu20_real_staff_pilot p ON p.employee_id=e.id AND p.enabled IS TRUE
   JOIN public.bgm_staff_terminals t ON t.id=p_terminal_id AND t.active IS TRUE
   JOIN public.bgm_gyms g ON g.id=t.gym_id AND g.status='active'
      AND g.hu20_punch_clock_enabled IS TRUE
   WHERE e.id=v_req.employee_id AND e.active IS TRUE
      AND e.id_number NOT LIKE 'HU20-TEST-%'
   FOR UPDATE OF e FOR SHARE OF p,g;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Cannot enroll inactive employee' USING ERRCODE='P0001';
 END IF;
 PERFORM 1 FROM public.bgm_staff_terminals
   WHERE id=p_terminal_id AND active=true FOR SHARE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Cannot enroll on inactive terminal' USING ERRCODE='P0001';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.bgm_staff_biometrics AS b
   WHERE b.employee_id=v_req.employee_id AND b.active=true AND b.status='enrolled'
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
    pg_catalog.jsonb_build_object('test_only', true, 'real_staff_pilot', true, 'terminal_id', p_terminal_id,
     'enrollment_request_id',p_request_id,'template_format','ANSI378'),
    v_req.initiated_by_system_user_id)
 RETURNING id INTO v_bio;
 UPDATE public.bgm_hu20_enrollment_requests
  SET status='completed', completed_at=now()
  WHERE id=p_request_id;
 INSERT INTO public.bgm_audit_log
  (system_user_id, action_key, entity_type, entity_id, after_data)
 VALUES
  (v_req.initiated_by_system_user_id, 'staff.hu20.biometric.enrolled.real_pilot.test',
   'staff_biometric', v_bio::text,
   pg_catalog.jsonb_build_object('employeeId',v_req.employee_id,'terminalId',p_terminal_id,
   'enrollmentRequestId',p_request_id,'templateFormat','ANSI378','testOnly',true,'realStaffPilot',true));
 RETURN QUERY SELECT v_bio,v_req.employee_id;
END;
$function$

CREATE OR REPLACE FUNCTION public.bgm_hu20_pilot_finish_recognition(p_test_id uuid, p_terminal_id uuid, p_result text, p_biometric_id uuid)
 RETURNS TABLE(test_id uuid, result text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE r public.bgm_hu20_recognition_tests%ROWTYPE;
BEGIN
  IF p_result NOT IN ('one_match','no_match','ambiguous')
    OR (p_result='one_match' AND p_biometric_id IS NULL)
    OR (p_result<>'one_match' AND p_biometric_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Invalid TEST recognition result' USING ERRCODE='22023';
  END IF;
  SELECT * INTO r FROM public.bgm_hu20_recognition_tests
    WHERE id=p_test_id FOR UPDATE;
  IF NOT FOUND OR r.terminal_id<>p_terminal_id
    OR r.status<>'claimed' OR r.expires_at<=now() THEN
    RAISE EXCEPTION 'TEST recognition expired or consumed' USING ERRCODE='P0001';
  END IF;
  IF p_result='one_match' AND NOT EXISTS (
    SELECT 1 FROM public.bgm_staff_biometrics b
    JOIN public.bgm_staff_employees e ON e.id=b.employee_id
    WHERE b.id=p_biometric_id AND b.active=true AND b.status='enrolled'
      AND b.adapter_key='secugen-hu20-ansi378-v1' AND b.encrypted_template IS NOT NULL
      AND e.active=true AND (e.id_number LIKE 'HU20-TEST-%' OR
         EXISTS (SELECT 1 FROM public.bgm_hu20_real_staff_pilot p
           WHERE p.employee_id=e.id AND p.enabled IS TRUE))
  ) THEN
    RAISE EXCEPTION 'Fingerprint was revoked or is no longer authorised'
      USING ERRCODE='P0001';
  END IF;
  UPDATE public.bgm_hu20_recognition_tests
    SET status='completed',completed_at=now(),result=p_result,
      matched_biometric_id=p_biometric_id WHERE id=r.id;
  INSERT INTO public.bgm_audit_log
    (system_user_id,action_key,entity_type,entity_id,after_data)
  VALUES
    (r.initiated_by_system_user_id,'staff.hu20.recognition.finished.test',
     'staff_hu20_recognition_test',r.id::text,
     pg_catalog.jsonb_build_object('terminalId',p_terminal_id,'result',p_result,
       'matchedBiometricId',p_biometric_id,'testOnly',true,'attendanceEnabled',false));
  RETURN QUERY SELECT r.id,p_result;
END;
$function$

CREATE OR REPLACE FUNCTION public.bgm_hu20_pilot_record_attendance(p_test_id uuid, p_terminal_id uuid)
 RETURNS TABLE(outcome text, result_employee_id uuid, result_session_id uuid, result_punch_event_id uuid, result_gym_id text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  r public.bgm_hu20_recognition_tests%ROWTYPE;
  v_employee_id uuid;
  v_gym_id text;
  v_punch record;
  v_fictional boolean;
BEGIN
  IF p_test_id IS NULL OR p_terminal_id IS NULL THEN
    RAISE EXCEPTION 'Invalid fictional TEST attendance request' USING ERRCODE='P0001';
  END IF;

  -- Lock the recognition token first so concurrent submissions cannot flip IN/OUT twice.
  SELECT * INTO r FROM public.bgm_hu20_recognition_tests
   WHERE id = p_test_id FOR UPDATE;
  IF NOT FOUND OR r.terminal_id <> p_terminal_id
     OR r.status <> 'completed' OR r.result <> 'one_match'
     OR r.matched_biometric_id IS NULL OR r.completed_at IS NULL
  THEN
    RAISE EXCEPTION 'No confirmed one-match TEST recognition for this terminal' USING ERRCODE='P0001';
  END IF;

  -- Replays never produce a second attendance action, including after a timeout.
  IF r.attendance_consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicate_ignored'::text, pe.employee_id,
      NULL::uuid, r.attendance_punch_event_id, pe.gym_id
    FROM public.bgm_staff_punch_events pe
    WHERE pe.id = r.attendance_punch_event_id;
    RETURN;
  END IF;

  -- The server time is authoritative. Expired recognition evidence cannot become a punch.
  IF r.completed_at > now() OR r.completed_at < now() - interval '90 seconds' THEN
    RAISE EXCEPTION 'TEST recognition confirmation expired' USING ERRCODE='P0001';
  END IF;

  SELECT t.gym_id INTO v_gym_id
    FROM public.bgm_staff_terminals t
    JOIN public.bgm_gyms g ON g.id = t.gym_id
   WHERE t.id = p_terminal_id AND t.active = true AND g.status = 'active' AND g.hu20_punch_clock_enabled IS TRUE FOR SHARE OF g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive TEST terminal or gym' USING ERRCODE='P0001';
  END IF;

  -- Revalidate revocation at the moment of the punch; lock the biometric row
  -- so a concurrent revocation cannot erase authorization mid-transaction.
  SELECT b.employee_id, (e.id_number LIKE 'HU20-TEST-%') INTO v_employee_id,v_fictional
    FROM public.bgm_staff_biometrics b
    JOIN public.bgm_staff_employees e ON e.id = b.employee_id
   WHERE b.id = r.matched_biometric_id
     AND b.active = true AND b.status = 'enrolled'
     AND b.adapter_key = 'secugen-hu20-ansi378-v1'
     AND b.encrypted_template IS NOT NULL AND e.active = true
     AND (e.id_number LIKE 'HU20-TEST-%' OR
       EXISTS (SELECT 1 FROM public.bgm_hu20_real_staff_pilot p
         WHERE p.employee_id=e.id AND p.enabled IS TRUE FOR SHARE))
   FOR SHARE OF b;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fictional TEST biometric revoked, unknown or inactive' USING ERRCODE='P0001';
  END IF;

  -- This RPC already serializes employee state, debounces rapid scans,
  -- attributes the gym to the registered terminal, and snapshots payroll.
  SELECT * INTO v_punch FROM public.bgm_staff_record_punch(
    v_employee_id, (CASE WHEN v_fictional THEN 'hu20-test:' ELSE 'hu20-pilot:' END) || r.id::text, now(),
    'terminal', p_terminal_id, NULL, NULL, NULL
  );
  IF NOT FOUND OR v_punch.outcome NOT IN ('clocked_in','clocked_out','duplicate_ignored')
     OR v_punch.result_punch_event_id IS NULL THEN
    RAISE EXCEPTION 'Fictional TEST attendance transition was rejected' USING ERRCODE='P0001';
  END IF;

  UPDATE public.bgm_hu20_recognition_tests
    SET attendance_consumed_at = now(), attendance_outcome = v_punch.outcome,
        attendance_punch_event_id = v_punch.result_punch_event_id
   WHERE id = r.id AND attendance_consumed_at IS NULL;

  INSERT INTO public.bgm_audit_log
    (system_user_id, action_key, entity_type, entity_id, after_data)
  VALUES
    (r.initiated_by_system_user_id, (CASE WHEN v_fictional THEN 'staff.hu20.attendance.recorded.test'
       ELSE 'staff.hu20.attendance.recorded.real_pilot.test' END),
     'staff_hu20_recognition_test', r.id::text,
     pg_catalog.jsonb_build_object(
       'terminalId',p_terminal_id,'employeeId',v_employee_id,
       'outcome',v_punch.outcome,'punchEventId',v_punch.result_punch_event_id,
       'gymId',v_gym_id,'fictionalTestOnly',v_fictional,'realStaffPilot',NOT v_fictional));

  RETURN QUERY SELECT v_punch.outcome::text, v_employee_id, v_punch.result_session_id,
    v_punch.result_punch_event_id, v_gym_id;
END;
$function$

REVOKE ALL ON FUNCTION public.bgm_hu20_pilot_complete_enrollment(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_pilot_complete_enrollment(uuid,uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.bgm_hu20_pilot_finish_recognition(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_pilot_finish_recognition(uuid,uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.bgm_hu20_pilot_record_attendance(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_pilot_record_attendance(uuid,uuid) TO service_role;
