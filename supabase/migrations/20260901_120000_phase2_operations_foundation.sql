-- BestGymsMalta Phase 2 operations foundation.
-- Authored in Git first. Do not apply to the live Supabase database until the controlled migration checkpoint.

create table if not exists public.bgm_system_users (
  id uuid primary key default gen_random_uuid(),
  gym_id text references public.bgm_gyms(id) on update cascade on delete restrict,
  username text not null check (btrim(username) <> ''),
  password_hash text not null check (btrim(password_hash) <> ''),
  display_name text not null check (btrim(display_name) <> ''),
  is_super_admin boolean not null default false,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bgm_system_users_username_lower_key
  on public.bgm_system_users (lower(username));

create unique index if not exists bgm_system_users_one_login_per_gym_key
  on public.bgm_system_users (gym_id)
  where gym_id is not null;

create table if not exists public.bgm_user_permissions (
  system_user_id uuid not null references public.bgm_system_users(id) on delete cascade,
  permission_key text not null check (btrim(permission_key) <> ''),
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (system_user_id, permission_key)
);

create table if not exists public.bgm_audit_log (
  id uuid primary key default gen_random_uuid(),
  system_user_id uuid references public.bgm_system_users(id) on delete set null,
  context_gym_id text references public.bgm_gyms(id) on update cascade on delete set null,
  staff_name text,
  action_key text not null check (btrim(action_key) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id text,
  member_id uuid references public.bgm_members(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bgm_audit_log_created_at_idx
  on public.bgm_audit_log (created_at desc);
create index if not exists bgm_audit_log_system_user_id_idx
  on public.bgm_audit_log (system_user_id);
create index if not exists bgm_audit_log_member_id_idx
  on public.bgm_audit_log (member_id);
create index if not exists bgm_audit_log_staff_name_lower_idx
  on public.bgm_audit_log (lower(staff_name))
  where staff_name is not null;

create table if not exists public.bgm_membership_applications (
  id uuid primary key default gen_random_uuid(),
  application_reference text not null unique check (btrim(application_reference) <> ''),
  membership_type text not null check (membership_type in ('single', 'couples', 'student')),
  duration_key text not null check (duration_key in ('1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year')),
  enrollment_gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  staff_name text not null check (btrim(staff_name) <> ''),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'awaiting_payment', 'activated', 'cancelled')),
  submitted_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  reviewed_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  submitted_at timestamptz,
  payment_received_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bgm_membership_applications_status_idx
  on public.bgm_membership_applications (status);
create index if not exists bgm_membership_applications_enrollment_gym_id_idx
  on public.bgm_membership_applications (enrollment_gym_id);
create index if not exists bgm_membership_applications_staff_name_lower_idx
  on public.bgm_membership_applications (lower(staff_name));

create table if not exists public.bgm_membership_application_members (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.bgm_membership_applications(id) on delete cascade,
  participant_order smallint not null check (participant_order in (1, 2)),
  first_name text not null check (btrim(first_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  address_line_1 text,
  address_line_2 text,
  postcode text,
  id_number text,
  date_of_birth date,
  phone text,
  email text,
  next_of_kin text,
  official_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, participant_order)
);

create index if not exists bgm_membership_application_members_application_id_idx
  on public.bgm_membership_application_members (application_id);

create table if not exists public.bgm_memberships (
  id uuid primary key default gen_random_uuid(),
  application_id uuid unique references public.bgm_membership_applications(id) on delete set null,
  membership_type text not null check (membership_type in ('single', 'couples', 'student')),
  duration_key text not null check (duration_key in ('1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year')),
  start_date date not null,
  expiry_date date not null,
  enrollment_gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  activation_staff_name text not null check (btrim(activation_staff_name) <> ''),
  activated_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date >= start_date)
);

create index if not exists bgm_memberships_status_idx
  on public.bgm_memberships (status);
create index if not exists bgm_memberships_expiry_date_idx
  on public.bgm_memberships (expiry_date);
create index if not exists bgm_memberships_enrollment_gym_id_idx
  on public.bgm_memberships (enrollment_gym_id);

create table if not exists public.bgm_membership_members (
  membership_id uuid not null references public.bgm_memberships(id) on delete cascade,
  member_id uuid not null references public.bgm_members(id) on delete restrict,
  member_role text not null default 'primary' check (member_role in ('primary', 'partner')),
  created_at timestamptz not null default now(),
  primary key (membership_id, member_id),
  unique (membership_id, member_role)
);

create index if not exists bgm_membership_members_member_id_idx
  on public.bgm_membership_members (member_id);

alter table public.bgm_members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists postcode text,
  add column if not exists id_number text,
  add column if not exists date_of_birth date,
  add column if not exists next_of_kin text,
  add column if not exists enrollment_gym_id text references public.bgm_gyms(id) on update cascade on delete restrict,
  add column if not exists official_photo_path text;

alter table public.bgm_system_users enable row level security;
alter table public.bgm_user_permissions enable row level security;
alter table public.bgm_audit_log enable row level security;
alter table public.bgm_membership_applications enable row level security;
alter table public.bgm_membership_application_members enable row level security;
alter table public.bgm_memberships enable row level security;
alter table public.bgm_membership_members enable row level security;
