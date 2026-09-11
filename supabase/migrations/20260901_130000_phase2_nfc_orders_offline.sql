-- BestGymsMalta Phase 2 NFC, operational orders and offline roster support.

create table if not exists public.bgm_nfc_cards (
  id uuid primary key default gen_random_uuid(),
  card_uid text not null check (btrim(card_uid) <> ''),
  member_id uuid not null references public.bgm_members(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'disabled', 'replaced')),
  assigned_gym_id text references public.bgm_gyms(id) on update cascade on delete set null,
  assigned_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  assigned_staff_name text not null check (btrim(assigned_staff_name) <> ''),
  assigned_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  disabled_staff_name text,
  replacement_card_id uuid references public.bgm_nfc_cards(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bgm_nfc_cards_uid_lower_key
  on public.bgm_nfc_cards (lower(card_uid));

create unique index if not exists bgm_nfc_cards_one_active_per_member_key
  on public.bgm_nfc_cards (member_id)
  where status = 'active';

create index if not exists bgm_nfc_cards_member_id_idx
  on public.bgm_nfc_cards (member_id);

create table if not exists public.bgm_access_scans (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.bgm_nfc_cards(id) on delete set null,
  card_uid text not null check (btrim(card_uid) <> ''),
  member_id uuid references public.bgm_members(id) on delete set null,
  gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  device_id text,
  result text not null check (result in ('granted', 'expired', 'inactive', 'unknown_card', 'disabled_card')),
  membership_expiry_snapshot date,
  checkin_id uuid references public.bgm_member_checkins(id) on delete set null,
  scanned_at timestamptz not null default now()
);

create index if not exists bgm_access_scans_scanned_at_idx
  on public.bgm_access_scans (scanned_at desc);
create index if not exists bgm_access_scans_member_id_idx
  on public.bgm_access_scans (member_id);
create index if not exists bgm_access_scans_gym_id_idx
  on public.bgm_access_scans (gym_id);

create table if not exists public.bgm_operational_orders (
  id uuid primary key default gen_random_uuid(),
  order_type text not null check (order_type in ('sundries', 'bar')),
  gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  submitted_by_system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  staff_name text not null check (btrim(staff_name) <> ''),
  status text not null default 'submitted' check (status in ('submitted', 'ordered', 'completed', 'cancelled')),
  notes text,
  submitted_at timestamptz not null default now(),
  ordered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  status_updated_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  status_staff_name text,
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sent', 'failed')),
  notification_sent_at timestamptz,
  notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bgm_operational_orders_gym_id_idx
  on public.bgm_operational_orders (gym_id);
create index if not exists bgm_operational_orders_status_idx
  on public.bgm_operational_orders (status);
create index if not exists bgm_operational_orders_order_type_idx
  on public.bgm_operational_orders (order_type);
create index if not exists bgm_operational_orders_staff_name_lower_idx
  on public.bgm_operational_orders (lower(staff_name));

create table if not exists public.bgm_operational_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.bgm_operational_orders(id) on delete cascade,
  item_name text not null check (btrim(item_name) <> ''),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bgm_operational_order_items_order_id_idx
  on public.bgm_operational_order_items (order_id);

create table if not exists public.bgm_offline_roster_syncs (
  id uuid primary key default gen_random_uuid(),
  system_user_id uuid not null references public.bgm_system_users(id) on delete cascade,
  gym_id text not null references public.bgm_gyms(id) on update cascade on delete cascade,
  device_id text not null check (btrim(device_id) <> ''),
  last_synced_at timestamptz not null default now(),
  member_count integer not null default 0 check (member_count >= 0),
  roster_hash text not null check (btrim(roster_hash) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (system_user_id, device_id)
);

create index if not exists bgm_offline_roster_syncs_gym_id_idx
  on public.bgm_offline_roster_syncs (gym_id);
create index if not exists bgm_offline_roster_syncs_last_synced_at_idx
  on public.bgm_offline_roster_syncs (last_synced_at);

alter table public.bgm_nfc_cards enable row level security;
alter table public.bgm_access_scans enable row level security;
alter table public.bgm_operational_orders enable row level security;
alter table public.bgm_operational_order_items enable row level security;
alter table public.bgm_offline_roster_syncs enable row level security;
