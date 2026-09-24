-- TEST-first: add-only legacy import. Keep permanent BGM IDs and all existing records immutable.
-- A staged batch with ANY conflict or invalid row cannot be applied.
CREATE OR REPLACE FUNCTION public.bgm_apply_member_import_batch(p_batch_id uuid, p_system_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_batch public.bgm_member_import_batches%rowtype;
  v_row public.bgm_member_import_rows%rowtype;
  v_system public.bgm_system_users%rowtype;
  v_id uuid;
  v_member_number text;
  v_name text;
  v_status text;
  v_added int := 0;
  v_kept int := 0;
BEGIN
  SELECT * INTO v_batch FROM public.bgm_member_import_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import batch does not exist'; END IF;
  IF v_batch.status <> 'preview' THEN RAISE EXCEPTION 'Import batch is not awaiting apply'; END IF;
  IF v_batch.import_mode NOT IN ('legacy_15','exchange_16') THEN RAISE EXCEPTION 'Unsupported member import format'; END IF;
  IF v_batch.conflict_rows > 0 OR v_batch.invalid_rows > 0 THEN
    RAISE EXCEPTION 'Import contains unresolved conflict or invalid rows; review the preview before applying';
  END IF;
  SELECT * INTO v_system FROM public.bgm_system_users WHERE id=p_system_user_id AND active=true AND is_super_admin=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active Super Admin required for member import'; END IF;
  IF (SELECT COUNT(*) FROM public.bgm_member_import_rows WHERE batch_id=p_batch_id) <> v_batch.total_rows THEN
    RAISE EXCEPTION 'Staged import row count does not match its preview';
  END IF;
  FOR v_row IN SELECT * FROM public.bgm_member_import_rows WHERE batch_id=p_batch_id ORDER BY row_number LOOP
    v_id := NULL;
    v_member_number := NULL;
    v_name := coalesce(nullif(btrim(v_row.customer_name),''),nullif(btrim(v_row.company_name),''));
    IF v_name IS NULL THEN RAISE EXCEPTION 'Missing member name on row %',v_row.row_number; END IF;
    IF v_row.action='unchanged' THEN
      IF v_row.matched_member_id IS NULL THEN RAISE EXCEPTION 'Existing member not resolved on row %',v_row.row_number; END IF;
      SELECT id,member_number INTO v_id,v_member_number FROM public.bgm_members
      WHERE id=v_row.matched_member_id
        AND (v_row.membership_number IS NULL OR member_number=upper(btrim(v_row.membership_number)))
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Existing member identity changed since preview on row %',v_row.row_number; END IF;
      -- Add-only import: NO UPDATE of existing membership, card, profile, dates or payment data.
      v_kept:=v_kept+1;
    ELSIF v_row.action='new' THEN
      IF nullif(btrim(coalesce(v_row.membership_number,'')),'') IS NOT NULL THEN
        RAISE EXCEPTION 'New member cannot be assigned a supplied BGM number on row %',v_row.row_number;
      END IF;
      -- Avoid duplicates if an existing member was enrolled after the preview.
      IF EXISTS (
        SELECT 1 FROM public.bgm_members m
        WHERE btrim(lower(m.full_name))=btrim(lower(v_name))
          AND (
            (m.legacy_gym IS NOT NULL AND lower(btrim(m.legacy_gym))=lower(btrim(coalesce(v_row.gym,'')))
             AND nullif(btrim(m.legacy_pk_customer),'')=nullif(btrim(v_row.pk_customer),''))
            OR (m.legacy_pk_customer IS NOT NULL AND nullif(btrim(m.legacy_pk_customer),'')=nullif(btrim(v_row.pk_customer),'')
                AND nullif(lower(btrim(m.email)),'')=nullif(lower(btrim(v_row.email)),'')
                AND nullif(lower(btrim(v_row.email)),'') IS NOT NULL)
          )
      ) THEN RAISE EXCEPTION 'Possible duplicate was enrolled after preview; preview the workbook again (row %)',v_row.row_number; END IF;
      v_status := CASE WHEN lower(btrim(coalesce(v_row.valid_yn,'')))='valid'
                            AND (v_row.expiry_date IS NULL OR v_row.expiry_date>=current_date)
                       THEN 'active' ELSE 'inactive' END;
      INSERT INTO public.bgm_members (
        full_name,email,status,membership_expiry,legacy_gym,legacy_pk_customer,
        company_name,address_line_1,address_line_2,town,postcode,gender,
        telephone_no_1,telephone_no_2,mobile
      ) VALUES (
        v_name,nullif(btrim(v_row.email),''),v_status,v_row.expiry_date,
        nullif(btrim(v_row.gym),''),nullif(btrim(v_row.pk_customer),''),
        nullif(btrim(v_row.company_name),''),nullif(btrim(v_row.address1),''),
        nullif(btrim(v_row.address2),''),nullif(btrim(v_row.town),''),
        nullif(btrim(v_row.postcode),''),nullif(btrim(v_row.gender),''),
        nullif(btrim(v_row.telephone_no_1),''),nullif(btrim(v_row.telephone_no_2),''),
        nullif(btrim(v_row.mobile),'')
      ) RETURNING id,member_number INTO v_id,v_member_number;
      -- The permanent BGM number comes from the database allocator, never pkCustomer or card barcode.
      -- Historical pkCustomer is retained as a legacy lookup reference, even when reused.
      -- Physical card credential assignment/replacement remains a separate controlled workflow.
      v_added:=v_added+1;
    ELSE
      RAISE EXCEPTION 'Unresolved or unsupported import action on row %',v_row.row_number;
    END IF;
    UPDATE public.bgm_member_import_rows SET resolved_membership_number=v_member_number,
      resolved_card_barcode=(SELECT barcode_value FROM public.bgm_member_card_credentials
       WHERE member_id=v_id AND status='active' ORDER BY activated_at DESC NULLS LAST LIMIT 1)
    WHERE id=v_row.id;
  END LOOP;
  UPDATE public.bgm_member_import_batches SET status='applied',applied_at=now() WHERE id=p_batch_id;
  INSERT INTO public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,after_data)
  VALUES (p_system_user_id,v_system.gym_id,'members.import.applied','member_import_batch',p_batch_id::text,
    jsonb_build_object('batchId',p_batch_id,'newRows',v_added,'unchangedRows',v_kept,'deletions',0,'mode',v_batch.import_mode));
  RETURN jsonb_build_object('batchId',p_batch_id,'totalRows',v_batch.total_rows,'newRows',v_added,
    'updateRows',0,'unchangedRows',v_kept,'linkedCardCount',0,'blankCardRows',0,'deletions',0);
END;
$$;
REVOKE ALL ON FUNCTION public.bgm_apply_member_import_batch(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_apply_member_import_batch(uuid,uuid) TO service_role;
