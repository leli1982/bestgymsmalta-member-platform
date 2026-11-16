-- Apply only to isolated HU20 TEST Supabase project vlvyqdjhzdcxatilbdiv.
-- Do NOT run on live BGM Supabase; TEST-only biometric enrolment guard.
-- Uses an exact-match replacement to preserve the existing audited transaction,
-- privileges and function body. Raises rather than change unexpected SQL.
DO $hu20_guard$
DECLARE
  current_definition text;
  old_clause constant text := 'WHERE id=v_req.employee_id AND active=true FOR UPDATE;';
  guarded_clause constant text := 'WHERE id=v_req.employee_id AND active=true AND id_number LIKE ''HU20-TEST-%'' FOR UPDATE;';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO current_definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'bgm_hu20_test_complete_enrollment';
  IF current_definition IS NULL THEN RAISE EXCEPTION 'Missing TEST enrollment RPC'; END IF;
  IF position(guarded_clause IN current_definition) > 0 THEN RETURN; END IF;
  IF position(old_clause IN current_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected RPC body: refusing modification';
  END IF;
  EXECUTE replace(current_definition, old_clause, guarded_clause);
END;
$hu20_guard$;
