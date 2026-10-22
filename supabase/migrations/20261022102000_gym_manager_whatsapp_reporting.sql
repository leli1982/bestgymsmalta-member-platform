alter table public.bgm_system_users
  add column if not exists report_whatsapp_number text null;

alter table public.bgm_system_users
  drop constraint if exists bgm_system_users_report_whatsapp_number_format;

alter table public.bgm_system_users
  add constraint bgm_system_users_report_whatsapp_number_format
  check (
    report_whatsapp_number is null
    or report_whatsapp_number ~ '^[1-9][0-9]{7,14}$'
  );

comment on column public.bgm_system_users.report_whatsapp_number is
  'Super Admin controlled WhatsApp destination for Gym Manager membership reports, stored as E.164 digits without a leading plus.';
