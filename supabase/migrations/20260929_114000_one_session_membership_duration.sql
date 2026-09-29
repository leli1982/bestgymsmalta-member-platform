-- Add 1 Gym Session as a supported membership duration.
-- Existing price catalog versions are intentionally left unchanged so historical
-- published pricing remains immutable. New catalogs may include 1_session.

alter table public.bgm_membership_applications
  drop constraint if exists bgm_membership_applications_duration_key_check;

alter table public.bgm_membership_applications
  add constraint bgm_membership_applications_duration_key_check
  check (duration_key in ('1_session','1_week','2_weeks','1_month','3_months','6_months','1_year'));

alter table public.bgm_membership_price_entries
  drop constraint if exists bgm_membership_price_entries_duration_key_check;

alter table public.bgm_membership_price_entries
  add constraint bgm_membership_price_entries_duration_key_check
  check (duration_key in ('1_session','1_week','2_weeks','1_month','3_months','6_months','1_year'));

alter table public.bgm_memberships
  drop constraint if exists bgm_memberships_duration_key_check;

alter table public.bgm_memberships
  add constraint bgm_memberships_duration_key_check
  check (duration_key in ('1_session','1_week','2_weeks','1_month','3_months','6_months','1_year'));
