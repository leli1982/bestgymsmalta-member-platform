-- 23 Nov 2026: Preserve the later expiry date when a member is updated
-- from a legacy import. Identity resolution is handled separately; this does
-- not merge people with matching names/old card numbers.
--
-- Modify exactly the three known snippets of the existing production function,
-- preserving every other protection, check, logging path and membership rule.
-- Abort rather than rewriting a function that differs from the reviewed version.
DO $migration$
DECLARE
  fn text;
  old_parallel_expiry constant text := 'membership_expiry=coalesce(r.expiry_date,m.membership_expiry)';
  new_parallel_expiry constant text := 'membership_expiry=greatest(r.expiry_date,m.membership_expiry)';
  old_parallel_status constant text := $old_status$when r.expiry_date is not null
           and r.expiry_date >= (now() at time zone 'Europe/Malta')::date$old_status$;
  new_parallel_status constant text := $new_status$when greatest(r.expiry_date,m.membership_expiry) >= (now() at time zone 'Europe/Malta')::date$new_status$;
  old_serial_expiry constant text := 'membership_expiry=coalesce(v_row.expiry_date,membership_expiry)';
  new_serial_expiry constant text := 'membership_expiry=greatest(v_row.expiry_date,membership_expiry)';
BEGIN
  fn := pg_get_functiondef('public.bgm_apply_member_import_batch(uuid,uuid)'::regprocedure);
  IF fn IS NULL THEN RAISE EXCEPTION 'Import function not found'; END IF;
  IF (length(fn)-length(replace(fn,old_parallel_expiry,'')))/length(old_parallel_expiry)<>1
    OR (length(fn)-length(replace(fn,old_parallel_status,'')))/length(old_parallel_status)<>1
    OR (length(fn)-length(replace(fn,old_serial_expiry,'')))/length(old_serial_expiry)<>1
  THEN
    RAISE EXCEPTION 'Unexpected import function version: expiry preservation patch refused';
  END IF;
  fn := replace(fn,old_parallel_expiry,new_parallel_expiry);
  fn := replace(fn,old_parallel_status,new_parallel_status);
  fn := replace(fn,old_serial_expiry,new_serial_expiry);
  EXECUTE fn;
END;
$migration$;

-- Service-only import remains permission-gated by the existing function.
REVOKE ALL ON FUNCTION public.bgm_apply_member_import_batch(uuid,uuid)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bgm_apply_member_import_batch(uuid,uuid)
  TO service_role;

COMMENT ON FUNCTION public.bgm_apply_member_import_batch(uuid,uuid) IS
  'Super Admin approved import: existing member expiry cannot be decreased by any imported date. Identity duplicates still require separate review.';

-- Regression contract (read-only): all expiry assignments must preserve the later date.
DO $verify$
DECLARE
 fn text;
BEGIN
 fn := pg_get_functiondef('public.bgm_apply_member_import_batch(uuid,uuid)'::regprocedure);
 IF position('membership_expiry=greatest(r.expiry_date,m.membership_expiry)' IN fn)=0
   OR position('membership_expiry=greatest(v_row.expiry_date,membership_expiry)' IN fn)=0
   OR position('when greatest(r.expiry_date,m.membership_expiry) >= ' IN fn)=0
   OR position('membership_expiry=coalesce(r.expiry_date,m.membership_expiry)' IN fn)>0
   OR greatest(DATE '2027-09-27',DATE '2027-01-15')<>DATE '2027-09-27'
   OR greatest(DATE '2027-01-15',DATE '2027-09-27')<>DATE '2027-09-27'
 THEN
   RAISE EXCEPTION 'Import expiry non-regression verification failed';
 END IF;
END;
$verify$;
