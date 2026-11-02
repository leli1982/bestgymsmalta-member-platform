-- Explicit membership access scope, independent from pricing/discounts.

alter table public.bgm_members
  add column if not exists access_scope text not null default 'network';

alter table public.bgm_members
  drop constraint if exists bgm_members_access_scope_check;
alter table public.bgm_members
  add constraint bgm_members_access_scope_check
  check (access_scope in ('network', 'neptunes_only'));

alter table public.bgm_membership_applications
  add column if not exists access_scope text not null default 'network';

alter table public.bgm_membership_applications
  drop constraint if exists bgm_membership_applications_access_scope_check;
alter table public.bgm_membership_applications
  add constraint bgm_membership_applications_access_scope_check
  check (access_scope in ('network', 'neptunes_only'));

-- Verified legacy rule: only records from the real import whose PK starts NO
-- are Neptunes-only. Preserve their historical legacy fields unchanged.
update public.bgm_members
set access_scope = 'neptunes_only',
    updated_at = now()
where real_import_batch_id is not null
  and upper(btrim(coalesce(legacy_pk_customer, ''))) like 'NO%';

-- Allow the staffed scan audit table to record a valid membership denied only
-- because it is presented at the wrong gym.
alter table public.bgm_access_scans
  drop constraint if exists bgm_access_scans_result_check;
alter table public.bgm_access_scans
  add constraint bgm_access_scans_result_check
  check (result in (
    'granted', 'expired', 'inactive', 'unknown_card', 'disabled_card',
    'unknown_member', 'invalid_barcode', 'photo_required', 'restricted_gym'
  ));

-- Copy the application's explicit scope onto the activated permanent member(s)
-- after the existing activation RPC completes. This avoids changing the large,
-- safety-critical activation function. Renewals preserve scope because their
-- application scope is inherited from the existing member before submission.
create or replace function public.bgm_sync_activated_membership_access_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'activated' and old.status is distinct from new.status then
    update public.bgm_members member
    set access_scope = new.access_scope,
        updated_at = now()
    where member.id in (
      select membership_member.member_id
      from public.bgm_memberships membership
      join public.bgm_membership_members membership_member
        on membership_member.membership_id = membership.id
      where membership.application_id = new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists bgm_sync_activated_membership_access_scope
  on public.bgm_membership_applications;
create trigger bgm_sync_activated_membership_access_scope
after update of status on public.bgm_membership_applications
for each row
execute function public.bgm_sync_activated_membership_access_scope();
