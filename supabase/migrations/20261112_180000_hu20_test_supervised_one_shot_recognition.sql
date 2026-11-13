-- HU20 TEST ONLY. One-time supervised diagnostic scan authorization.
-- Do not apply to BGM Production; no attendance or member changes.
CREATE TABLE IF NOT EXISTS public.bgm_hu20_recognition_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES public.bgm_staff_terminals(id) ON DELETE RESTRICT,
  initiated_by_system_user_id uuid NOT NULL REFERENCES public.bgm_system_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','claimed','completed','cancelled','expired')),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  completed_at timestamptz,
  result text CHECK (result IS NULL OR result IN ('one_match','no_match','ambiguous')),
  matched_biometric_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bgm_hu20_recognition_one_pending_per_terminal
  ON public.bgm_hu20_recognition_tests(terminal_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS bgm_hu20_recognition_recent
  ON public.bgm_hu20_recognition_tests(terminal_id,created_at DESC);
ALTER TABLE public.bgm_hu20_recognition_tests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bgm_hu20_recognition_tests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bgm_hu20_recognition_tests TO service_role;

CREATE OR REPLACE FUNCTION public.bgm_hu20_test_claim_recognition(p_terminal_id uuid)
RETURNS TABLE(test_id uuid,valid_until timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE r public.bgm_hu20_recognition_tests%ROWTYPE;
DECLARE until_at timestamptz;
BEGIN
 SELECT * INTO r FROM public.bgm_hu20_recognition_tests
  WHERE terminal_id=p_terminal_id AND status='pending'
  ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR r.expires_at<=now() THEN
  RAISE EXCEPTION 'No active TEST recognition authorization' USING ERRCODE='P0001';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.bgm_staff_terminals t JOIN public.bgm_gyms g ON g.id=t.gym_id
  WHERE t.id=p_terminal_id AND t.active=true AND g.status='active'
 ) THEN
  RAISE EXCEPTION 'Inactive TEST terminal or gym' USING ERRCODE='P0001';
 END IF;
 until_at=least(r.expires_at,now()+interval '2 minutes');
 UPDATE public.bgm_hu20_recognition_tests
  SET status='claimed',claimed_at=now(),expires_at=until_at WHERE id=r.id;
 INSERT INTO public.bgm_audit_log(system_user_id,action_key,entity_type,entity_id,after_data)
 VALUES(r.initiated_by_system_user_id,'staff.hu20.recognition.claimed.test',
  'staff_hu20_recognition_test',r.id::text,
  pg_catalog.jsonb_build_object('terminalId',p_terminal_id,'expiresAt',until_at,'testOnly',true));
 RETURN QUERY SELECT r.id,until_at;
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_hu20_test_claim_recognition(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_test_claim_recognition(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bgm_hu20_test_finish_recognition(
 p_test_id uuid,p_terminal_id uuid,p_result text,p_biometric_id uuid
) RETURNS TABLE(test_id uuid,result text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE r public.bgm_hu20_recognition_tests%ROWTYPE;
BEGIN
 IF p_result NOT IN ('one_match','no_match','ambiguous')
  OR (p_result='one_match' AND p_biometric_id IS NULL)
  OR (p_result<>'one_match' AND p_biometric_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Invalid TEST recognition result' USING ERRCODE='22023';
 END IF;
 SELECT * INTO r FROM public.bgm_hu20_recognition_tests WHERE id=p_test_id FOR UPDATE;
 IF NOT FOUND OR r.terminal_id<>p_terminal_id OR r.status<>'claimed' OR r.expires_at<=now() THEN
  RAISE EXCEPTION 'TEST recognition expired or consumed' USING ERRCODE='P0001';
 END IF;
 IF p_result='one_match' AND NOT EXISTS(
  SELECT 1 FROM public.bgm_staff_biometrics b
  JOIN public.bgm_staff_employees e ON e.id=b.employee_id
  WHERE b.id=p_biometric_id AND b.active=true AND b.status='enrolled'
   AND b.adapter_key='secugen-hu20-ansi378-v1' AND b.encrypted_template IS NOT NULL
   AND e.active=true AND e.id_number LIKE 'HU20-TEST-%'
 ) THEN
  RAISE EXCEPTION 'Fingerprint was revoked or no longer authorised' USING ERRCODE='P0001';
 END IF;
 UPDATE public.bgm_hu20_recognition_tests
  SET status='completed',completed_at=now(),result=p_result,matched_biometric_id=p_biometric_id
  WHERE id=r.id;
 INSERT INTO public.bgm_audit_log(system_user_id,action_key,entity_type,entity_id,after_data)
 VALUES(r.initiated_by_system_user_id,'staff.hu20.recognition.finished.test',
  'staff_hu20_recognition_test',r.id::text,
  pg_catalog.jsonb_build_object('terminalId',p_terminal_id,'result',p_result,
   'matchedBiometricId',p_biometric_id,'testOnly',true,'attendanceEnabled',false));
 RETURN QUERY SELECT r.id,p_result;
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_hu20_test_finish_recognition(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_test_finish_recognition(uuid,uuid,text,uuid) TO service_role;
