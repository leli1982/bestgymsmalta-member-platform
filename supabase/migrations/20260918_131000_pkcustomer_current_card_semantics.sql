-- BestGymsMalta legacy/current physical-card semantics.
-- pkCustomer is the old/current physical card membership number.
-- It is intentionally NOT unique because the legacy manual-card system reused
-- numbers. Permanent BGM member_number remains the unique lifetime identity.

create index if not exists bgm_members_legacy_pk_customer_scan_idx
  on public.bgm_members (legacy_pk_customer)
  where legacy_pk_customer is not null and btrim(legacy_pk_customer) <> '';

comment on column public.bgm_members.legacy_pk_customer is
  'Current/legacy physical-card membership number (pkCustomer). Legacy duplicates are preserved; permanent identity is member_number.';

create or replace function public.bgm_sync_pkcustomer_from_active_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.member_id is not null then
    update public.bgm_members
    set legacy_pk_customer = new.barcode_value,
        updated_at = now()
    where id = new.member_id;
  end if;

  return new;
end;
$$;

drop trigger if exists bgm_sync_pkcustomer_from_active_card_trigger
  on public.bgm_member_card_credentials;

create trigger bgm_sync_pkcustomer_from_active_card_trigger
after insert or update of status, member_id, barcode_value
on public.bgm_member_card_credentials
for each row
execute function public.bgm_sync_pkcustomer_from_active_card();

-- Backfill current physical-card number for already-linked modern members.
update public.bgm_members m
set legacy_pk_customer = c.barcode_value,
    updated_at = now()
from public.bgm_member_card_credentials c
where c.member_id = m.id
  and c.status = 'active'
  and m.legacy_pk_customer is distinct from c.barcode_value;

alter table public.bgm_access_scans
  drop constraint if exists bgm_access_scans_result_check;

alter table public.bgm_access_scans
  add constraint bgm_access_scans_result_check
  check (result in (
    'granted',
    'expired',
    'inactive',
    'unknown_card',
    'disabled_card',
    'unknown_member',
    'invalid_barcode',
    'ambiguous_card'
  ));

revoke all on function public.bgm_sync_pkcustomer_from_active_card() from public;
revoke all on function public.bgm_sync_pkcustomer_from_active_card() from anon;
revoke all on function public.bgm_sync_pkcustomer_from_active_card() from authenticated;
grant execute on function public.bgm_sync_pkcustomer_from_active_card() to service_role;
