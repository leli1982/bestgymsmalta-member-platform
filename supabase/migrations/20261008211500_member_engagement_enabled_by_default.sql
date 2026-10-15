-- C3 follow-up: keep all notification categories enabled by default.
-- Existing member-level critical/motivational preference defaults are already true.
-- This migration changes the global engagement master default to true and enables
-- the existing singleton without overriding the inactivity/streak feature switches.

alter table public.bgm_member_engagement_settings
  alter column enabled set default true;

update public.bgm_member_engagement_settings
set enabled = true,
    updated_at = now()
where id = 'member_engagement';
