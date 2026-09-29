-- Add a separately counted cash figure to each submitted Bar List.
-- Nullable for existing lists and Sundries; new Bar submissions require an
-- integer euro-cent value through the server route. Historic sale prices stay intact.
alter table public.bgm_operational_orders
 add column if not exists cash_found_cents integer
 check (cash_found_cents is null or (cash_found_cents >= 0 and cash_found_cents <= 100000000));
