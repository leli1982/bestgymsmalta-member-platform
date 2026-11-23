-- Staff renewals use the explicitly selected permanent BGM member identity.
-- Legacy personal fields (including an empty ID/passport) are allowed to be
-- completed during renewal; the typed ID must never resolve to another member.
-- NEW membership classification remains unchanged and rejects active matches.
CREATE OR REPLACE FUNCTION public.bgm_enforce_membership_application_identity_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_classification jsonb;
  v_state text;
  v_application_kind text;
  v_selected public.bgm_members%rowtype;
  v_input_id text := upper(regexp_replace(coalesce(new.id_number, ''), '[^[:alnum:]]', '', 'g'));
  v_existing_id text;
  v_conflict uuid;
  v_today date := (now() AT TIME ZONE 'Europe/Malta')::date;
BEGIN
  SELECT a.application_kind INTO v_application_kind
  FROM public.bgm_membership_applications a WHERE a.id = new.application_id;
  IF v_application_kind IS NULL THEN
    RAISE EXCEPTION 'Membership application was not found.';
  END IF;

  IF v_application_kind = 'new' THEN
    v_classification := public.bgm_classify_membership_identity(new.id_number);
    v_state := coalesce(v_classification->>'state', 'clear');
    new.identity_match_state := v_state;
    new.matched_member_id := nullif(v_classification->>'matchedMemberId', '')::uuid;
    IF v_state = 'active' THEN
      RAISE EXCEPTION 'An active membership already exists for this identity.';
    END IF;
    IF tg_op = 'INSERT'
      OR new.existing_member_id IS DISTINCT FROM new.matched_member_id THEN
      new.existing_member_id := NULL;
    END IF;
  ELSIF v_application_kind = 'renewal' THEN
    IF new.existing_member_id IS NULL THEN
      RAISE EXCEPTION 'Renewal requires an existing member. Search and select the existing BGM member.';
    END IF;

    -- Do not select a different member through an optional/previously missing ID.
    SELECT * INTO v_selected FROM public.bgm_members
    WHERE id = new.existing_member_id AND archived_at IS NULL
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected renewal member was not found or was archived. Search and select the correct member again.';
    END IF;

    v_existing_id := upper(regexp_replace(coalesce(v_selected.id_number, ''), '[^[:alnum:]]', '', 'g'));
    IF v_existing_id <> '' AND v_input_id <> '' AND v_existing_id <> v_input_id THEN
      RAISE EXCEPTION 'The ID / passport number differs from the selected member record. Verify the member and correct their record before renewing.';
    END IF;

    IF v_input_id <> '' THEN
      SELECT m.id INTO v_conflict FROM public.bgm_members m
      WHERE m.id <> v_selected.id
        AND upper(regexp_replace(coalesce(m.id_number, ''), '[^[:alnum:]]', '', 'g')) = v_input_id
      LIMIT 1;
      IF v_conflict IS NOT NULL THEN
        RAISE EXCEPTION 'This ID / passport number is already recorded against a different BGM member. Verify the correct permanent member before renewing.';
      END IF;
    END IF;

    -- A blank legacy ID is not proof of a different person. The selected UUID
    -- remains authoritative, and renewal keeps the original member number.
    new.matched_member_id := v_selected.id;
    new.identity_match_state := CASE
      WHEN v_selected.status = 'active'
        AND (v_selected.membership_expiry IS NULL OR v_selected.membership_expiry >= v_today)
      THEN 'active'
      ELSE 'expired_inactive'
    END;
  ELSE
    RAISE EXCEPTION 'Unknown membership application kind.';
  END IF;

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION public.bgm_enforce_membership_application_identity_match()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_enforce_membership_application_identity_match()
  TO service_role;
