-- Renewal reminders are enabled by default from this point forward.
-- Existing environments are aligned by switching the singleton master row on.

alter table public.bgm_membership_reminder_settings
  alter column enabled set default true;

update public.bgm_membership_reminder_settings
set enabled = true,
    updated_at = now()
where id = 'membership_expiry';
