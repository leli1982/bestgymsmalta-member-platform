-- HU20 fictional TEST attendance only. NEVER apply to Production.
-- Existing recognition-only script and its zero-punch behavior are preserved.
-- A completed one-match authorization may be consumed only once, within 90 seconds,
-- by its own authenticated terminal. The existing attendance RPC owns IN/OUT/payroll.
ALTER TABLE public.bgm_hu20_recognition_tests
  ADD COLUMN IF NOT EXISTS attendance_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_outcome text,
  ADD COLUMN IF NOT EXISTS attendance_punch_event_id uuid REFERENCES public.bgm_staff_punch_events(id) ON DELETE RESTRICT;

ALTER TABLE public.bgm_hu20_recognition_tests
  DROP CONSTRAINT IF EXISTS bgm_hu20_test_attendance_consumption_check;
ALTER TABLE public.bgm_hu20_recognition_tests
  ADD CONSTRAINT bgm_hu20_test_attendance_consumption_check CHECK (
    (attendance_consumed_at IS NULL AND attendance_outcome IS NULL AND attendance_punch_event_id IS NULL)
    OR (attendance_consumed_at IS NOT NULL
        AND status = 'completed' AND result = 'one_match'
        AND attendance_outcome IN ('clocked_in','clocked_out','duplicate_ignored'))
  );

CREATE OR REPLACE FUNCTION public.bgm_hu20_test_record_attendance(
  p_test_id uuid, p_terminal_id uuid
)
RETURNS TABLE(
  outcome text,
  result_employee_id uuid,
  result_session_id uuid,
  result_punch_event_id uuid,
  result_gym_id text
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE
  r public.bgm_hu20_recognition_tests%ROWTYPE;
  v_employee_id uuid;
  v_gym_id text;
  v_punch record;
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
   WHERE t.id = p_terminal_id AND t.active = true AND g.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive TEST terminal or gym' USING ERRCODE='P0001';
  END IF;

  -- Revalidate revocation at the moment of the punch; lock the biometric row
  -- so a concurrent revocation cannot erase authorization mid-transaction.
  SELECT b.employee_id INTO v_employee_id
    FROM public.bgm_staff_biometrics b
    JOIN public.bgm_staff_employees e ON e.id = b.employee_id
   WHERE b.id = r.matched_biometric_id
     AND b.active = true AND b.status = 'enrolled'
     AND b.adapter_key = 'secugen-hu20-ansi378-v1'
     AND b.encrypted_template IS NOT NULL AND e.active = true
     AND e.id_number LIKE 'HU20-TEST-%'
   FOR SHARE OF b;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fictional TEST biometric revoked, unknown or inactive' USING ERRCODE='P0001';
  END IF;

  -- This RPC already serializes employee state, debounces rapid scans,
  -- attributes the gym to the registered terminal, and snapshots payroll.
  SELECT * INTO v_punch FROM public.bgm_staff_record_punch(
    v_employee_id, 'hu20-test:' || r.id::text, now(),
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
    (r.initiated_by_system_user_id, 'staff.hu20.attendance.recorded.test',
     'staff_hu20_recognition_test', r.id::text,
     pg_catalog.jsonb_build_object(
       'terminalId',p_terminal_id,'employeeId',v_employee_id,
       'outcome',v_punch.outcome,'punchEventId',v_punch.result_punch_event_id,
       'gymId',v_gym_id,'fictionalTestOnly',true));

  RETURN QUERY SELECT v_punch.outcome::text, v_employee_id, v_punch.result_session_id,
    v_punch.result_punch_event_id, v_gym_id;
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_hu20_test_record_attendance(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_test_record_attendance(uuid,uuid) TO service_role;
