-- HU20 isolated TEST rollout only: NOT approved for production.
-- Default OFF in every gym; only Super Admin may enable individual TEST gyms.
ALTER TABLE public.bgm_gyms
  ADD COLUMN IF NOT EXISTS hu20_punch_clock_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.bgm_hu20_test_set_gym_rollout(
  p_gym_id text, p_enabled boolean, p_actor_system_user_id uuid
) RETURNS TABLE(gym_id text, punch_clock_enabled boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $hu20_rollout$
DECLARE old_state boolean; current_status text;
BEGIN
  IF p_gym_id IS NULL OR p_gym_id = '' OR p_enabled IS NULL
     OR p_actor_system_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid HU20 TEST rollout request' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bgm_system_users
     WHERE id=p_actor_system_user_id AND active=true
       AND (is_super_admin=true OR role='super_admin')
  ) THEN
    RAISE EXCEPTION 'Super Admin required' USING ERRCODE='P0001';
  END IF;
  SELECT hu20_punch_clock_enabled, status INTO old_state,current_status
    FROM public.bgm_gyms WHERE id=p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gym missing' USING ERRCODE='P0001'; END IF;
  IF p_enabled AND current_status <> 'active' THEN
    RAISE EXCEPTION 'Cannot enable Punch Clock for inactive gym' USING ERRCODE='P0001';
  END IF;
  IF old_state <> p_enabled THEN
    UPDATE public.bgm_gyms
      SET hu20_punch_clock_enabled=p_enabled, updated_at=now()
      WHERE id=p_gym_id;
    -- Cancelling active TEST kiosk windows prevents a disabled gym appearing
    -- authorised in Super Admin. This is in the same transaction as the toggle.
    IF NOT p_enabled THEN
      UPDATE public.bgm_hu20_test_kiosk_windows w SET status='cancelled'
      WHERE w.status='active' AND w.terminal_id IN (
        SELECT t.id FROM public.bgm_staff_terminals t WHERE t.gym_id=p_gym_id
      );
    END IF;
    INSERT INTO public.bgm_audit_log
      (system_user_id, context_gym_id, action_key, entity_type, entity_id, before_data, after_data)
    VALUES (p_actor_system_user_id,p_gym_id,'staff.hu20.gym_rollout.changed.test',
      'gym',p_gym_id,
      pg_catalog.jsonb_build_object('punchClockEnabled',old_state),
      pg_catalog.jsonb_build_object('punchClockEnabled',p_enabled,'testOnly',true));
  END IF;
  RETURN QUERY SELECT p_gym_id,p_enabled;
END;
$hu20_rollout$;
REVOKE ALL ON FUNCTION public.bgm_hu20_test_set_gym_rollout(text,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_hu20_test_set_gym_rollout(text,boolean,uuid) TO service_role;

-- Enforce the same switch atomically at punch time, including after a kiosk was
-- approved. Locking the gym row serialises switch OFF against punches.
DO $hu20_attendance_guard$
DECLARE definition text;
        old_clause constant text :=
          'WHERE t.id = p_terminal_id AND t.active = true AND g.status = ''active'';';
        new_clause constant text :=
          'WHERE t.id = p_terminal_id AND t.active = true AND g.status = ''active'' AND g.hu20_punch_clock_enabled IS TRUE FOR SHARE OF g;';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p
   JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='bgm_hu20_test_record_attendance';
  IF definition IS NULL THEN
    RAISE EXCEPTION 'Missing existing TEST attendance RPC';
  END IF;
  IF position(new_clause IN definition)>0 THEN RETURN; END IF;
  IF position(old_clause IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected attendance RPC: refusing unsafe replacement';
  END IF;
  EXECUTE replace(definition,old_clause,new_clause);
END;
$hu20_attendance_guard$;
