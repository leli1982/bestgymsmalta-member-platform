-- Speed up case-insensitive legacy-PK checks for protected photo assignments.
-- Non-unique: ambiguous legacy keys remain possible and MUST be skipped.
CREATE INDEX IF NOT EXISTS bgm_members_legacy_pk_normalized_photo_idx
 ON public.bgm_members (lower(btrim(legacy_pk_customer)))
 WHERE legacy_pk_customer IS NOT NULL;
