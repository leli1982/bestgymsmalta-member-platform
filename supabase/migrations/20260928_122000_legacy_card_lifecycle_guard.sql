-- New card issuance must not accidentally take an imported member's Scan3.
create or replace function public.bgm_guard_imported_card_claim()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status in ('reserved','active') and exists (
    select 1 from public.bgm_legacy_card_claims c
    where c.scan3=upper(new.barcode_value)
      and c.assignment_status='active'
      and c.member_id is distinct from new.member_id
  ) then
    raise exception 'Card number belongs to an imported member or unresolved card conflict.';
  end if;
  return new;
end;
$$;
create trigger bgm_guard_imported_card_claim_trigger
before insert or update of barcode_value,status,member_id
on public.bgm_member_card_credentials
for each row execute function public.bgm_guard_imported_card_claim();

-- When a modern card replaces an imported one, its old Scan3 stops scanning.
create or replace function public.bgm_retire_replaced_legacy_claim()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status='active' and new.member_id is not null then
    update public.bgm_legacy_card_claims
    set assignment_status='removed', updated_at=now()
    where member_id=new.member_id and assignment_status='active'
      and scan3<>upper(new.barcode_value);
  end if;
  return new;
end;
$$;
create trigger bgm_retire_replaced_legacy_claim_trigger
after insert or update of barcode_value,status,member_id
on public.bgm_member_card_credentials
for each row execute function public.bgm_retire_replaced_legacy_claim();

revoke all on function public.bgm_guard_imported_card_claim() from public,anon,authenticated;
revoke all on function public.bgm_retire_replaced_legacy_claim() from public,anon,authenticated;
