-- Legacy photo assignment: atomic, no-overwrite, audited and service-only.
-- Photo bytes are uploaded privately by an authenticated Super Admin route
-- BEFORE calling this function. Rejected attachments are deleted from storage.
CREATE OR REPLACE FUNCTION public.bgm_attach_legacy_import_member_photo(
  p_member_number text, p_legacy_pk_customer text, p_object_path text,
  p_system_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
DECLARE
 v_member public.bgm_members%rowtype;
 v_count int;
 v_today date := (now() AT TIME ZONE 'Europe/Malta')::date;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.bgm_system_users
   WHERE id=p_system_user_id AND active=true AND is_super_admin=true
 ) THEN
   RAISE EXCEPTION 'Active Super Admin required';
 END IF;
 IF p_member_number IS NULL OR p_member_number !~ '^BGM[1-9][0-9]{3,}$'
    OR p_legacy_pk_customer IS NULL OR p_legacy_pk_customer !~ '^[A-Za-z0-9-]{1,50}$'
 THEN
   RAISE EXCEPTION 'Invalid legacy photo identity';
 END IF;
 SELECT * INTO v_member FROM public.bgm_members
 WHERE member_number=p_member_number FOR UPDATE;
 IF NOT FOUND THEN
   RETURN jsonb_build_object('assigned',false,'reason','member_not_found');
 END IF;
 IF p_object_path IS NULL OR
    p_object_path !~ ('^' || v_member.id::text || '/official/legacy-import-[0-9a-f-]{36}[.]webp$')
 THEN
   RAISE EXCEPTION 'Invalid private official photo path';
 END IF;
 IF v_member.legacy_pk_customer IS NULL OR
   lower(btrim(v_member.legacy_pk_customer))<>lower(btrim(p_legacy_pk_customer))
 THEN
   RETURN jsonb_build_object('assigned',false,'reason','legacy_number_mismatch');
 END IF;
 -- Include inactive records in the duplicate check; do not choose between
 -- two identities just because only one is unexpired.
 SELECT count(*) INTO v_count FROM public.bgm_members
 WHERE lower(btrim(legacy_pk_customer))=lower(btrim(p_legacy_pk_customer));
 IF v_count<>1 THEN
   RETURN jsonb_build_object('assigned',false,'reason','shared_legacy_number');
 END IF;
 IF v_member.archived_at IS NOT NULL OR
    v_member.status<>'active' OR
    v_member.membership_expiry IS NULL OR v_member.membership_expiry<v_today
 THEN
   RETURN jsonb_build_object('assigned',false,'reason','member_inactive');
 END IF;
 IF nullif(btrim(v_member.official_photo_path),'') IS NOT NULL OR
    EXISTS(SELECT 1 FROM public.bgm_member_official_photos
      WHERE member_id=v_member.id)
 THEN
   RETURN jsonb_build_object('assigned',false,'reason','already_has_photo');
 END IF;
 UPDATE public.bgm_members
 SET official_photo_path=p_object_path, updated_at=now()
 WHERE id=v_member.id;
 INSERT INTO public.bgm_member_official_photos(
  member_id,application_member_id,object_path,source,system_user_id,staff_name
 ) VALUES(
  v_member.id,NULL,p_object_path,'legacy_import',p_system_user_id,NULL
 );
 INSERT INTO public.bgm_audit_log(
  system_user_id,action_key,entity_type,entity_id,member_id,after_data
 ) VALUES (
  p_system_user_id,'members.legacy_photo_import','member',
  v_member.id::text,v_member.id,
  jsonb_build_object('memberNumber',v_member.member_number,
  'legacyPkCustomer',p_legacy_pk_customer,
  'photoPath',p_object_path)
 );
 RETURN jsonb_build_object('assigned',true,'reason','saved');
END;
$function$;

REVOKE ALL ON FUNCTION public.bgm_attach_legacy_import_member_photo(text,text,text,uuid)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_attach_legacy_import_member_photo(text,text,text,uuid)
 TO service_role;
