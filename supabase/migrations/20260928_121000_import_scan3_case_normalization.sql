-- Scanner hardware can vary the case of alphanumeric legacy barcodes. The
-- source spelling remains in the immutable import row and source_scan3.
alter table public.bgm_legacy_card_claims
  add column if not exists source_scan3 text;
update public.bgm_legacy_card_claims
set source_scan3=coalesce(source_scan3,scan3), scan3=upper(scan3)
where import_batch_id is not null and
  (source_scan3 is null or scan3 is distinct from upper(scan3));
