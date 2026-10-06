-- BestGymsMalta staff employment, attendance and payroll foundation.
-- This migration is designed to be applied to TEST first. Production rollout is a separate approval checkpoint.

create table if not exists public.bgm_staff_employees (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (btrim(first_name) <> ''),
  surname text not null check (btrim(surname) <> ''),
  id_number text not null check (btrim(id_number) <> ''),
  address text,
  mobile text,
  email text,
  home_gym_id text references public.bgm_gyms(id) on update cascade on delete restrict,
  photo_path text,
  linked_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  active boolean not null default true,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bgm_staff_employees_id_number_normalized_key
  on public.bgm_staff_employees (lower(btrim(id_number)));
create index if not exists bgm_staff_employees_home_gym_idx
  on public.bgm_staff_employees(home_gym_id);
create index if not exists bgm_staff_employees_active_name_idx
  on public.bgm_staff_employees(active, surname, first_name);

create table if not exists public.bgm_staff_employment_type_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.bgm_staff_employees(id) on delete restrict,
  employment_type text not null check (employment_type in ('full_time', 'part_time')),
  effective_from date not null,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, effective_from)
);

create index if not exists bgm_staff_employment_type_history_lookup_idx
  on public.bgm_staff_employment_type_history(employee_id, effective_from desc);

create table if not exists public.bgm_staff_rate_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.bgm_staff_employees(id) on delete restrict,
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  effective_from date not null,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, effective_from)
);

create index if not exists bgm_staff_rate_history_lookup_idx
  on public.bgm_staff_rate_history(employee_id, effective_from desc);

create table if not exists public.bgm_staff_public_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.bgm_staff_public_holiday_versions (
  id uuid primary key default gen_random_uuid(),
  holiday_id uuid not null references public.bgm_staff_public_holidays(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  name text not null check (btrim(name) <> ''),
  full_time_multiplier_bps integer not null check (full_time_multiplier_bps > 0),
  part_time_multiplier_bps integer not null check (part_time_multiplier_bps > 0),
  active boolean not null default true,
  note text,
  effective_created_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (holiday_id, version_no),
  check (superseded_at is null or superseded_at >= effective_created_at)
);

create unique index if not exists bgm_staff_public_holiday_one_active_version_key
  on public.bgm_staff_public_holiday_versions(holiday_id)
  where active = true and superseded_at is null;
create index if not exists bgm_staff_public_holiday_versions_lookup_idx
  on public.bgm_staff_public_holiday_versions(holiday_id, version_no desc);

create table if not exists public.bgm_staff_terminals (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  name text not null check (btrim(name) <> ''),
  credential_hash text not null check (btrim(credential_hash) <> ''),
  active boolean not null default true,
  vendor text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bgm_staff_terminals_credential_hash_key
  on public.bgm_staff_terminals(credential_hash);
create index if not exists bgm_staff_terminals_gym_active_idx
  on public.bgm_staff_terminals(gym_id, active);

create table if not exists public.bgm_staff_biometrics (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.bgm_staff_employees(id) on delete restrict,
  active boolean not null default true,
  status text not null default 'enrolled' check (status in ('enrolled', 'revoked', 'pending')),
  adapter_key text not null check (btrim(adapter_key) <> ''),
  vendor text,
  template_reference text,
  encrypted_template text,
  template_version text,
  metadata jsonb not null default '{}'::jsonb,
  enrolled_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (template_reference is not null or encrypted_template is not null),
  check ((status = 'revoked' and revoked_at is not null) or status <> 'revoked')
);

create index if not exists bgm_staff_biometrics_employee_active_idx
  on public.bgm_staff_biometrics(employee_id, active);

create table if not exists public.bgm_staff_punch_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.bgm_staff_employees(id) on delete restrict,
  action text not null check (action in ('in', 'out')),
  source_timestamp timestamptz not null,
  effective_minute_timestamp timestamptz not null,
  gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  terminal_id uuid references public.bgm_staff_terminals(id) on delete restrict,
  source text not null check (source in ('terminal', 'manual')),
  event_key text not null check (btrim(event_key) <> ''),
  actor_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  manual_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_key),
  check ((source = 'terminal' and terminal_id is not null) or source = 'manual'),
  check ((source = 'manual' and actor_system_user_id is not null and btrim(coalesce(manual_reason, '')) <> '') or source <> 'manual')
);

create index if not exists bgm_staff_punch_events_employee_time_idx
  on public.bgm_staff_punch_events(employee_id, source_timestamp desc);
create index if not exists bgm_staff_punch_events_terminal_time_idx
  on public.bgm_staff_punch_events(terminal_id, source_timestamp desc);

create table if not exists public.bgm_staff_work_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.bgm_staff_employees(id) on delete restrict,
  clock_in_at timestamptz not null,
  clock_in_gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  clock_in_terminal_id uuid references public.bgm_staff_terminals(id) on delete restrict,
  clock_in_punch_event_id uuid references public.bgm_staff_punch_events(id) on delete restrict,
  clock_out_at timestamptz,
  clock_out_gym_id text references public.bgm_gyms(id) on update cascade on delete restrict,
  clock_out_terminal_id uuid references public.bgm_staff_terminals(id) on delete restrict,
  clock_out_punch_event_id uuid references public.bgm_staff_punch_events(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed', 'needs_attention', 'corrected', 'void')),
  updated_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at),
  check ((clock_out_at is null and status in ('open', 'needs_attention')) or clock_out_at is not null or status = 'void'),
  check ((clock_out_at is null and clock_out_gym_id is null and clock_out_punch_event_id is null) or clock_out_at is not null)
);

create unique index if not exists bgm_staff_work_sessions_one_open_per_employee_key
  on public.bgm_staff_work_sessions(employee_id)
  where clock_out_at is null and status <> 'void';
create unique index if not exists bgm_staff_work_sessions_clock_in_event_key
  on public.bgm_staff_work_sessions(clock_in_punch_event_id)
  where clock_in_punch_event_id is not null;
create unique index if not exists bgm_staff_work_sessions_clock_out_event_key
  on public.bgm_staff_work_sessions(clock_out_punch_event_id)
  where clock_out_punch_event_id is not null;
create index if not exists bgm_staff_work_sessions_employee_time_idx
  on public.bgm_staff_work_sessions(employee_id, clock_in_at desc);

create table if not exists public.bgm_staff_session_payroll_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bgm_staff_work_sessions(id) on delete restrict,
  employee_id uuid not null references public.bgm_staff_employees(id) on delete restrict,
  work_date date not null,
  worked_minutes integer not null check (worked_minutes >= 0),
  rate_history_id uuid not null references public.bgm_staff_rate_history(id) on delete restrict,
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  employment_history_id uuid not null references public.bgm_staff_employment_type_history(id) on delete restrict,
  employment_type text not null check (employment_type in ('full_time', 'part_time')),
  holiday_version_id uuid references public.bgm_staff_public_holiday_versions(id) on delete restrict,
  holiday_multiplier_bps integer not null default 10000 check (holiday_multiplier_bps > 0),
  pay_cents integer not null check (pay_cents >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, work_date)
);

create index if not exists bgm_staff_session_payroll_segments_employee_date_idx
  on public.bgm_staff_session_payroll_segments(employee_id, work_date desc);

create table if not exists public.bgm_staff_attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bgm_staff_work_sessions(id) on delete restrict,
  employee_id uuid not null references public.bgm_staff_employees(id) on delete restrict,
  before_data jsonb not null,
  after_data jsonb not null,
  reason text not null check (btrim(reason) <> ''),
  actor_system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists bgm_staff_attendance_adjustments_session_idx
  on public.bgm_staff_attendance_adjustments(session_id, created_at desc);
create index if not exists bgm_staff_attendance_adjustments_employee_idx
  on public.bgm_staff_attendance_adjustments(employee_id, created_at desc);

create or replace function public.bgm_staff_reject_punch_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Staff punch events are immutable evidence and cannot be updated or deleted.';
end;
$$;

drop trigger if exists bgm_staff_punch_events_immutable_trigger on public.bgm_staff_punch_events;
create trigger bgm_staff_punch_events_immutable_trigger
before update or delete on public.bgm_staff_punch_events
for each row execute function public.bgm_staff_reject_punch_event_mutation();

alter table public.bgm_staff_employees enable row level security;
alter table public.bgm_staff_employment_type_history enable row level security;
alter table public.bgm_staff_rate_history enable row level security;
alter table public.bgm_staff_public_holidays enable row level security;
alter table public.bgm_staff_public_holiday_versions enable row level security;
alter table public.bgm_staff_terminals enable row level security;
alter table public.bgm_staff_biometrics enable row level security;
alter table public.bgm_staff_punch_events enable row level security;
alter table public.bgm_staff_work_sessions enable row level security;
alter table public.bgm_staff_session_payroll_segments enable row level security;
alter table public.bgm_staff_attendance_adjustments enable row level security;

revoke all on public.bgm_staff_employees from public, anon, authenticated;
revoke all on public.bgm_staff_employment_type_history from public, anon, authenticated;
revoke all on public.bgm_staff_rate_history from public, anon, authenticated;
revoke all on public.bgm_staff_public_holidays from public, anon, authenticated;
revoke all on public.bgm_staff_public_holiday_versions from public, anon, authenticated;
revoke all on public.bgm_staff_terminals from public, anon, authenticated;
revoke all on public.bgm_staff_biometrics from public, anon, authenticated;
revoke all on public.bgm_staff_punch_events from public, anon, authenticated;
revoke all on public.bgm_staff_work_sessions from public, anon, authenticated;
revoke all on public.bgm_staff_session_payroll_segments from public, anon, authenticated;
revoke all on public.bgm_staff_attendance_adjustments from public, anon, authenticated;

grant all on public.bgm_staff_employees to service_role;
grant all on public.bgm_staff_employment_type_history to service_role;
grant all on public.bgm_staff_rate_history to service_role;
grant all on public.bgm_staff_public_holidays to service_role;
grant all on public.bgm_staff_public_holiday_versions to service_role;
grant all on public.bgm_staff_terminals to service_role;
grant all on public.bgm_staff_biometrics to service_role;
grant all on public.bgm_staff_punch_events to service_role;
grant all on public.bgm_staff_work_sessions to service_role;
grant all on public.bgm_staff_session_payroll_segments to service_role;
grant all on public.bgm_staff_attendance_adjustments to service_role;

insert into storage.buckets (id, name, public)
values ('bgm-staff-photos', 'bgm-staff-photos', false)
on conflict (id) do update
set public = false;
