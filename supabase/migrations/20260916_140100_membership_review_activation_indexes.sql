-- Cover Plan 03 staff-review actor foreign keys flagged by the Supabase performance advisor.

create index if not exists bgm_membership_application_members_guardian_present_verified_by_idx
  on public.bgm_membership_application_members (guardian_present_verified_by_system_user_id)
  where guardian_present_verified_by_system_user_id is not null;

create index if not exists bgm_membership_application_members_guardian_cosign_verified_by_idx
  on public.bgm_membership_application_members (guardian_cosign_verified_by_system_user_id)
  where guardian_cosign_verified_by_system_user_id is not null;

create index if not exists bgm_membership_applications_same_address_verified_by_idx
  on public.bgm_membership_applications (same_address_verified_by_system_user_id)
  where same_address_verified_by_system_user_id is not null;

create index if not exists bgm_membership_applications_payment_system_user_idx
  on public.bgm_membership_applications (payment_system_user_id)
  where payment_system_user_id is not null;
