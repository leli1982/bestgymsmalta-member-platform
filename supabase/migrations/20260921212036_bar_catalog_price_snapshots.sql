-- BGM bar sales: Super Admin catalogue and immutable order price snapshots.
create table if not exists public.bgm_bar_catalog_items (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 120),
 price_cents integer check (price_cents between 0 and 100000000),
 is_other boolean not null default false,
 active boolean not null default true,
 sort_order integer not null default 0,
 updated_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint bgm_bar_catalog_price_mode check ((is_other and price_cents is null) or (not is_other and price_cents is not null))
);
create unique index if not exists bgm_bar_catalog_single_other_key on public.bgm_bar_catalog_items (is_other) where is_other;
create unique index if not exists bgm_bar_catalog_item_name_key on public.bgm_bar_catalog_items (lower(btrim(name)));
create index if not exists bgm_bar_catalog_active_order_idx on public.bgm_bar_catalog_items (active, sort_order, name);
alter table public.bgm_bar_catalog_items enable row level security;
revoke all on public.bgm_bar_catalog_items from anon, authenticated;
grant select, insert, update, delete on public.bgm_bar_catalog_items to service_role;

alter table public.bgm_operational_orders
 add column if not exists business_date date,
 add column if not exists total_cents integer check (total_cents >= 0);
create index if not exists bgm_bar_orders_gym_day_idx
 on public.bgm_operational_orders (gym_id,business_date,order_type)
 where order_type='bar';

alter table public.bgm_operational_order_items
 add column if not exists catalog_item_id uuid references public.bgm_bar_catalog_items(id) on delete set null,
 add column if not exists unit_price_cents integer check (unit_price_cents >= 0),
 add column if not exists line_total_cents integer check (line_total_cents >= 0);
