-- BestGymsMalta End of Day, live daily Bar sheet and generic voucher reimbursement support.
-- Applied to TEST first. Production rollout remains a separate approval checkpoint.

alter table public.bgm_discount_codes
  add column if not exists reimbursement_value_cents integer
  check (reimbursement_value_cents is null or (reimbursement_value_cents >= 0 and reimbursement_value_cents <= 100000000));

alter table public.bgm_membership_applications
  add column if not exists payment_business_date date,
  add column if not exists discount_reimbursement_cents_snapshot integer
  check (discount_reimbursement_cents_snapshot is null or (discount_reimbursement_cents_snapshot >= 0 and discount_reimbursement_cents_snapshot <= 100000000));

-- Current government Student Voucher reimbursement. The field is generic; any
-- voucher can carry its own optional reimbursement value through Super Admin.
update public.bgm_discount_codes
set reimbursement_value_cents = 30000,
    updated_at = now()
where upper(btrim(code)) = 'STUDENT VOUCHER'
  and reimbursement_value_cents is null;

-- Preserve the original Malta sale date for already-activated offline sales.
update public.bgm_membership_applications
set payment_business_date = case
  when application_source = 'offline_staff' and submitted_on_malta is not null then submitted_on_malta
  when payment_received_at is not null then (payment_received_at at time zone 'Europe/Malta')::date
  else (coalesce(activated_at, submitted_at, now()) at time zone 'Europe/Malta')::date
end
where status = 'activated'
  and payment_business_date is null;

update public.bgm_membership_applications a
set discount_reimbursement_cents_snapshot = d.reimbursement_value_cents
from public.bgm_discount_codes d
where a.discount_code_id = d.id
  and a.status = 'activated'
  and a.application_kind = 'new'
  and a.discount_reimbursement_cents_snapshot is null
  and d.reimbursement_value_cents is not null;

create or replace function public.bgm_snapshot_membership_payment_business_data()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_reimbursement integer;
  v_new_activation boolean := false;
begin
  if tg_op = 'INSERT' then
    v_new_activation := new.status = 'activated';
  else
    v_new_activation := new.status = 'activated' and old.status is distinct from 'activated';
  end if;

  if not v_new_activation then
    return new;
  end if;

  if new.payment_business_date is null then
    if new.application_source = 'offline_staff' and new.submitted_on_malta is not null then
      new.payment_business_date := new.submitted_on_malta;
    elsif new.payment_received_at is not null then
      new.payment_business_date := (new.payment_received_at at time zone 'Europe/Malta')::date;
    else
      new.payment_business_date := (now() at time zone 'Europe/Malta')::date;
    end if;
  end if;

  if new.application_kind = 'new'
     and new.discount_code_id is not null
     and new.discount_reimbursement_cents_snapshot is null then
    select reimbursement_value_cents into v_reimbursement
    from public.bgm_discount_codes
    where id = new.discount_code_id;
    new.discount_reimbursement_cents_snapshot := v_reimbursement;
  end if;

  return new;
end;
$$;

drop trigger if exists bgm_membership_payment_business_snapshot on public.bgm_membership_applications;
create trigger bgm_membership_payment_business_snapshot
before insert or update of status on public.bgm_membership_applications
for each row execute function public.bgm_snapshot_membership_payment_business_data();

create index if not exists bgm_membership_applications_payment_business_idx
  on public.bgm_membership_applications (enrollment_gym_id, payment_business_date, application_kind)
  where status = 'activated';

create table if not exists public.bgm_end_of_day_reports (
  id uuid primary key default gen_random_uuid(),
  gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  business_date date not null,
  submitted_by_system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  staff_name text not null check (length(btrim(staff_name)) between 1 and 120),
  memberships_cash_cents integer not null default 0 check (memberships_cash_cents >= 0),
  memberships_card_cents integer not null default 0 check (memberships_card_cents >= 0),
  memberships_other_cents integer not null default 0 check (memberships_other_cents >= 0),
  renewals_cash_cents integer not null default 0 check (renewals_cash_cents >= 0),
  renewals_card_cents integer not null default 0 check (renewals_card_cents >= 0),
  renewals_other_cents integer not null default 0 check (renewals_other_cents >= 0),
  voucher_reimbursement_cents integer not null default 0 check (voucher_reimbursement_cents >= 0),
  bar_sales_cents integer not null default 0 check (bar_sales_cents >= 0),
  gross_cents integer not null default 0 check (gross_cents >= 0),
  expenses_total_cents integer not null default 0 check (expenses_total_cents >= 0),
  daily_total_cents integer not null default 0,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (gym_id, business_date)
);

create index if not exists bgm_end_of_day_reports_submitted_at_idx
  on public.bgm_end_of_day_reports (submitted_at desc);
create index if not exists bgm_end_of_day_reports_gym_date_idx
  on public.bgm_end_of_day_reports (gym_id, business_date desc);
create index if not exists bgm_end_of_day_reports_submitter_idx
  on public.bgm_end_of_day_reports (submitted_by_system_user_id);

create table if not exists public.bgm_end_of_day_expenses (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bgm_end_of_day_reports(id) on delete cascade,
  description text not null check (length(btrim(description)) between 1 and 250),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);
create index if not exists bgm_end_of_day_expenses_report_id_idx
  on public.bgm_end_of_day_expenses (report_id, sort_order);

create table if not exists public.bgm_end_of_day_vouchers (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bgm_end_of_day_reports(id) on delete cascade,
  voucher_code text not null check (btrim(voucher_code) <> ''),
  quantity integer not null check (quantity > 0),
  reimbursement_total_cents integer not null check (reimbursement_total_cents >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);
create index if not exists bgm_end_of_day_vouchers_report_id_idx
  on public.bgm_end_of_day_vouchers (report_id, sort_order);

create table if not exists public.bgm_end_of_day_bar_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bgm_end_of_day_reports(id) on delete cascade,
  item_name text not null check (btrim(item_name) <> ''),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);
create index if not exists bgm_end_of_day_bar_items_report_id_idx
  on public.bgm_end_of_day_bar_items (report_id, sort_order);

alter table public.bgm_end_of_day_reports enable row level security;
alter table public.bgm_end_of_day_expenses enable row level security;
alter table public.bgm_end_of_day_vouchers enable row level security;
alter table public.bgm_end_of_day_bar_items enable row level security;

revoke all on public.bgm_end_of_day_reports from anon, authenticated;
revoke all on public.bgm_end_of_day_expenses from anon, authenticated;
revoke all on public.bgm_end_of_day_vouchers from anon, authenticated;
revoke all on public.bgm_end_of_day_bar_items from anon, authenticated;
grant select, insert, update, delete on public.bgm_end_of_day_reports to service_role;
grant select, insert, update, delete on public.bgm_end_of_day_expenses to service_role;
grant select, insert, update, delete on public.bgm_end_of_day_vouchers to service_role;
grant select, insert, update, delete on public.bgm_end_of_day_bar_items to service_role;

alter table public.bgm_operational_orders
  add column if not exists is_daily_sheet boolean not null default false,
  add column if not exists locked_at timestamptz;

create unique index if not exists bgm_bar_one_daily_sheet_per_gym_day_idx
  on public.bgm_operational_orders (gym_id, business_date)
  where order_type = 'bar' and is_daily_sheet = true;

revoke all on function public.bgm_snapshot_membership_payment_business_data() from public, anon, authenticated;
