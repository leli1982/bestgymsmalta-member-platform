-- Compatibility member_number is no longer the barcode uniqueness authority.
-- Exact card uniqueness is owned by bgm_member_card_credentials.barcode_value.
alter table public.bgm_members drop constraint if exists bgm_members_member_number_key;
