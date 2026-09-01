-- BestGymsMalta Phase 2 server-side Web Push VAPID configuration.

alter table public.bgm_notification_settings
  add column if not exists vapid_public_key text,
  add column if not exists vapid_private_key text,
  add column if not exists vapid_subject text;
