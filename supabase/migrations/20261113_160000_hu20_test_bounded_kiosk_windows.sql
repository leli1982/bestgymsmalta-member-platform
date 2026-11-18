-- HU20 experimental unattended TEST kiosk windows. NEVER apply to BGM Production.
-- Requires existing HU20 TEST enrollment, recognition, and attendance migrations.
-- A Super Admin opens a short, revocable window. Each scan gets a unique, single-use
-- recognition row; old TEST attendance RPC still validates biometric and idempotency.
CREATE TABLE IF NOT EXISTS public.bgm_hu20_test_kiosk_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES public.bgm_staff_terminals(id) ON DELETE RESTRICT,
  initiated_by_system_user_id uuid NOT NULL REFERENCES public.bgm_system_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  max_scans integer NOT NULL DEFAULT 6 CHECK (max_scans BETWEEN 1 AND 6),
  scans_used integer NOT NULL DEFAULT 0 CHECK (scans_used BETWEEN 0 AND 6 AND scans_used <= max_scans),
  last_claim_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS bgm_hu20_test_kiosk_one_active_per_terminal
 ON public.bgm_hu20_test_kiosk_windows(terminal_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS bgm_hu20_test_kiosk_recent
 ON public.bgm_hu20_test_kiosk_windows(terminal_id,created_at DESC);
ALTER TABLE public.bgm_hu20_test_kiosk_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bgm_hu20_test_kiosk_windows FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bgm_hu20_test_kiosk_windows TO service_role;

ALTER TABLE public.bgm_hu20_recognition_tests
 ADD COLUMN IF NOT EXISTS kiosk_window_id uuid REFERENCES public.bgm_hu20_test_kiosk_windows(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS bgm_hu20_recognition_kiosk_reference
 ON public.bgm_hu20_recognition_tests(kiosk_window_id) WHERE kiosk_window_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bgm_hu20_test_claim_kiosk_recognition(p_terminal_id uuid)
RETURNS TABLE(test_id uuid, valid_until timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE
 v_window public.bgm_hu20_test_kiosk_windows%ROWTYPE;
 v_id uuid;
 v_until timestamptz;
BEGIN
 IF p_terminal_id IS NULL THEN
  RAISE EXCEPTION 'Invalid TEST terminal' USING ERRCODE='P0001';
 END IF;
 SELECT * INTO v_window FROM public.bgm_hu20_test_kiosk_windows
 WHERE terminal_id=p_terminal_id AND status='active'
 FOR UPDATE;
 IF NOT FOUND OR v_window.expires_at<=now() OR v_window.scans_used>=v_window.max_scans THEN
  RAISE EXCEPTION 'No active fictional TEST kiosk window' USING ERRCODE='P0001';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.bgm_staff_terminals t JOIN public.bgm_gyms g ON g.id=t.gym_id
  WHERE t.id=p_terminal_id AND t.active=true AND g.status='active'
 ) THEN
  RAISE EXCEPTION 'Inactive terminal or gym' USING ERRCODE='P0001';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.bgm_hu20_recognition_tests r
  WHERE r.terminal_id=p_terminal_id AND r.status='claimed' AND r.expires_at>now()
 ) THEN
  RAISE EXCEPTION 'Another recognition is still active' USING ERRCODE='P0002';
 END IF;
 IF v_window.last_claim_at IS NOT NULL AND
    v_window.last_claim_at > now() - interval '60 seconds' THEN
  RAISE EXCEPTION 'TEST kiosk scan cooldown' USING ERRCODE='P0002';
 END IF;
 v_until=least(v_window.expires_at,now()+interval '70 seconds');
 IF v_until<=now() THEN
  RAISE EXCEPTION 'TEST kiosk window expired' USING ERRCODE='P0001';
 END IF;
 UPDATE public.bgm_hu20_test_kiosk_windows
 SET scans_used=scans_used+1,last_claim_at=now()
 WHERE id=v_window.id AND status='active' AND scans_used<max_scans;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEST kiosk scan limit reached' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.bgm_hu20_recognition_tests (
  terminal_id,initiated_by_system_user_id,status,claimed_at,expires_at,kiosk_window_id
 ) VALUES (
  p_terminal_id,v_window.initiated_by_system_user_id,'claimed',now(),v_until,v_window.id
 ) RETURNING id INTO v_id;
 INSERT INTO public.bgm_audit_log(system_user_id,action_key,entity_type,entity_id,after_data)
 VALUES (
  v_window.initiated_by_system_user_id,'staff.hu20.kiosk.claim.test',
  'staff_hu20_recognition_test',v_id::text,
  pg_catalog.jsonb_build_object('terminalId',p_terminal_id,'windowId',v_window.id,
   'expiresAt',v_until,'fictionalTestOnly',true)
 );
 RETURN QUERY SELECT v_id,v_until;
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_hu20_test_claim_kiosk_recognition(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_test_claim_kiosk_recognition(uuid) TO service_role;

-- Even if a recognition was claimed before the admin presses STOP, completion
-- and attendance submission are rejected once the kiosk window is cancelled.
CREATE OR REPLACE FUNCTION public.bgm_hu20_test_kiosk_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_window_id uuid;
BEGIN
 IF NEW.kiosk_window_id IS NULL THEN RETURN NEW; END IF;
 IF (NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed')
  OR (NEW.attendance_consumed_at IS NOT NULL AND OLD.attendance_consumed_at IS NULL) THEN
  SELECT k.id INTO v_window_id FROM public.bgm_hu20_test_kiosk_windows k
  WHERE k.id=NEW.kiosk_window_id AND k.status='active' AND k.expires_at>now()
  FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'TEST kiosk window revoked or expired' USING ERRCODE='P0001';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bgm_hu20_test_kiosk_check ON public.bgm_hu20_recognition_tests;
CREATE TRIGGER bgm_hu20_test_kiosk_check
 BEFORE UPDATE ON public.bgm_hu20_recognition_tests
 FOR EACH ROW EXECUTE FUNCTION public.bgm_hu20_test_kiosk_guard();
REVOKE ALL ON FUNCTION public.bgm_hu20_test_kiosk_guard() FROM PUBLIC,anon,authenticated;
