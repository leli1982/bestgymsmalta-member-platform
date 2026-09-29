-- A renewal may reserve the imported member's own existing card. A new
-- applicant or another member may not reserve a card already claimed.
create or replace function public.bgm_guard_imported_card_claim()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_target_member_id uuid;
begin
  if new.status not in ('reserved','active') then return new; end if;
  v_target_member_id := new.member_id;
  if v_target_member_id is null and new.application_member_id is not null then
    select coalesce(am.matched_member_id,am.existing_member_id)
    into v_target_member_id
    from public.bgm_membership_application_members am
    where am.id=new.application_member_id;
  end if;
  if exists (
    select 1 from public.bgm_legacy_card_claims c
    where c.scan3=upper(new.barcode_value)
      and c.assignment_status='active'
      and c.member_id is distinct from v_target_member_id
  ) then
    raise exception 'Card number belongs to an imported member or unresolved card conflict.';
  end if;
  return new;
end;
$$;
