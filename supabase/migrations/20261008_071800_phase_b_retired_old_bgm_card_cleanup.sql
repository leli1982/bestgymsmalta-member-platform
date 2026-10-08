-- Phase B TEST-rehearsal correction: old permanent BGM numbers must not survive
-- as retired card credentials. Active/reserved physical-card credentials and all
-- Scan3 provenance remain untouched.

do $phase_b_old_card_preflight$
begin
  if exists (
    select 1
    from public.bgm_member_card_credentials
    where barcode_value ~ '^BGM[0-9]{7}$'
      and status <> 'retired'
  ) then
    raise exception 'Phase B retired-card cleanup refused: an active/reserved old-format BGM card credential exists';
  end if;
end
$phase_b_old_card_preflight$;

delete from public.bgm_member_card_credentials
where status = 'retired'
  and barcode_value ~ '^BGM[0-9]{7}$';

do $phase_b_old_card_postcheck$
begin
  if exists (
    select 1
    from public.bgm_member_card_credentials
    where barcode_value ~ '^BGM[0-9]{7}$'
  ) then
    raise exception 'Phase B retired-card cleanup failed: old-format BGM card credential remains';
  end if;
end
$phase_b_old_card_postcheck$;
