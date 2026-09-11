-- BestGymsMalta Phase 2 per-channel operational order notification status.

alter table public.bgm_operational_orders
  add column if not exists email_notification_status text not null default 'pending'
    check (email_notification_status in ('pending', 'sent', 'failed', 'disabled')),
  add column if not exists email_notification_sent_at timestamptz,
  add column if not exists email_notification_error text,
  add column if not exists push_notification_status text not null default 'pending'
    check (push_notification_status in ('pending', 'sent', 'failed', 'disabled', 'not_configured')),
  add column if not exists push_notification_sent_at timestamptz,
  add column if not exists push_notification_error text;
