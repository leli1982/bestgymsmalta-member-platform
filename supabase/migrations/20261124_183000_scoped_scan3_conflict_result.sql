-- Retain all existing scan results; permit a pending ambiguous scan to be
-- recorded before staff resolve ONLY the allowlisted 32 Scan3 exceptions.
-- No members, memberships, card claims or existing scans are modified.
ALTER TABLE public.bgm_access_scans
  DROP CONSTRAINT bgm_access_scans_result_check,
  ADD CONSTRAINT bgm_access_scans_result_check CHECK (result IN (
    'granted','expired','inactive','unknown_card','disabled_card',
    'unknown_member','invalid_barcode','photo_required','restricted_gym',
    'ambiguous_card'
  ));
