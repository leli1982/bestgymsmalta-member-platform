-- Serialize live daily Bar saves with End of Day submission and perform the
-- authoritative End of Day snapshot atomically for one Malta business date.

create or replace function public.bgm_save_daily_bar_sheet(
  p_gym_id text,
  p_system_user_id uuid,
  p_staff_name text,
  p_business_date date,
  p_cash_found_cents integer,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_locked_at timestamptz;
  v_total bigint := 0;
begin
  if p_gym_id is null or btrim(p_gym_id) = '' or p_system_user_id is null or p_business_date is null then
    raise exception 'Daily Bar sheet context is incomplete.';
  end if;
  if p_staff_name is null or btrim(p_staff_name) = '' then
    raise exception 'Staff name is required.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Daily Bar sheet items are invalid.';
  end if;
  if p_cash_found_cents is not null and (p_cash_found_cents < 0 or p_cash_found_cents > 100000000) then
    raise exception 'Daily Bar cash value is invalid.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bgm-eod:' || p_gym_id || ':' || p_business_date::text, 0)
  );

  if exists (
    select 1 from public.bgm_end_of_day_reports
    where gym_id = p_gym_id and business_date = p_business_date
  ) then
    raise exception 'End of Day has already been submitted for this gym.';
  end if;

  select id, locked_at into v_order_id, v_locked_at
  from public.bgm_operational_orders
  where order_type = 'bar'
    and is_daily_sheet = true
    and gym_id = p_gym_id
    and business_date = p_business_date
  for update;

  if v_locked_at is not null then
    raise exception 'This Bar sheet is locked by End of Day.';
  end if;

  select coalesce(sum((entry->>'lineTotalCents')::bigint), 0)
  into v_total
  from jsonb_array_elements(p_items) entry;
  if v_total < 0 or v_total > 2000000000 then
    raise exception 'Daily Bar total is invalid.';
  end if;

  if v_order_id is null then
    insert into public.bgm_operational_orders (
      order_type, gym_id, submitted_by_system_user_id, staff_name, status,
      business_date, total_cents, cash_found_cents, is_daily_sheet,
      notification_status, email_notification_status, push_notification_status
    ) values (
      'bar', p_gym_id, p_system_user_id, btrim(p_staff_name), 'submitted',
      p_business_date, v_total::integer, p_cash_found_cents, true,
      'sent', 'disabled', 'disabled'
    ) returning id into v_order_id;
  else
    update public.bgm_operational_orders
    set submitted_by_system_user_id = p_system_user_id,
        staff_name = btrim(p_staff_name),
        total_cents = v_total::integer,
        cash_found_cents = p_cash_found_cents,
        updated_at = now()
    where id = v_order_id;
  end if;

  delete from public.bgm_operational_order_items where order_id = v_order_id;

  insert into public.bgm_operational_order_items (
    order_id, item_name, quantity, unit, notes, sort_order,
    catalog_item_id, unit_price_cents, line_total_cents
  )
  select
    v_order_id,
    btrim(entry->>'itemName'),
    (entry->>'quantity')::numeric,
    null,
    null,
    ordinality - 1,
    (entry->>'catalogItemId')::uuid,
    (entry->>'unitPriceCents')::integer,
    (entry->>'lineTotalCents')::integer
  from jsonb_array_elements(p_items) with ordinality as rows(entry, ordinality)
  where coalesce((entry->>'quantity')::numeric, 0) > 0;

  return v_order_id;
end;
$$;

create or replace function public.bgm_submit_end_of_day(
  p_gym_id text,
  p_system_user_id uuid,
  p_staff_name text,
  p_business_date date,
  p_expenses jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user record;
  v_report_id uuid;
  v_bar_order_id uuid;
  v_bar_locked_at timestamptz;
  v_memberships_cash bigint := 0;
  v_memberships_card bigint := 0;
  v_memberships_other bigint := 0;
  v_renewals_cash bigint := 0;
  v_renewals_card bigint := 0;
  v_renewals_other bigint := 0;
  v_voucher_reimbursement bigint := 0;
  v_bar_sales bigint := 0;
  v_gross bigint := 0;
  v_expenses_total bigint := 0;
  v_daily_total bigint := 0;
  v_expense jsonb;
  v_expense_description text;
  v_expense_amount integer;
begin
  if p_gym_id is null or btrim(p_gym_id) = '' or p_system_user_id is null or p_business_date is null then
    raise exception 'End of Day context is incomplete.';
  end if;
  if p_staff_name is null or btrim(p_staff_name) = '' or length(btrim(p_staff_name)) > 120 then
    raise exception 'Staff Name is required.';
  end if;
  if p_expenses is null or jsonb_typeof(p_expenses) <> 'array' then
    raise exception 'Expenses must be a list.';
  end if;
  if jsonb_array_length(p_expenses) > 50 then
    raise exception 'A maximum of 50 expense rows is allowed.';
  end if;

  select id, gym_id, is_super_admin, active
  into v_user
  from public.bgm_system_users
  where id = p_system_user_id and active = true;
  if not found then raise exception 'Submitting system user is not active.'; end if;
  if not v_user.is_super_admin and v_user.gym_id is distinct from p_gym_id then
    raise exception 'This Staff account belongs to another gym.';
  end if;
  if not exists (select 1 from public.bgm_gyms where id = p_gym_id) then raise exception 'Gym not found.'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bgm-eod:' || p_gym_id || ':' || p_business_date::text, 0)
  );

  if exists (
    select 1 from public.bgm_end_of_day_reports
    where gym_id = p_gym_id and business_date = p_business_date
  ) then
    raise exception 'End of Day has already been submitted for this gym today.';
  end if;

  for v_expense in select value from jsonb_array_elements(p_expenses)
  loop
    v_expense_description := btrim(coalesce(v_expense->>'description', ''));
    begin
      v_expense_amount := (v_expense->>'amountCents')::integer;
    exception when others then
      raise exception 'Every expense must have a valid amount.';
    end;
    if v_expense_description = '' or length(v_expense_description) > 250 then
      raise exception 'Every expense requires a description of 250 characters or less.';
    end if;
    if v_expense_amount <= 0 or v_expense_amount > 100000000 then
      raise exception 'Every expense must have a positive valid amount.';
    end if;
    v_expenses_total := v_expenses_total + v_expense_amount;
  end loop;

  select
    coalesce(sum(case when application_kind = 'new' and payment_method = 'cash' then coalesce(final_amount_cents, 0) else 0 end), 0),
    coalesce(sum(case when application_kind = 'new' and payment_method = 'card' then coalesce(final_amount_cents, 0) else 0 end), 0)
      + coalesce(sum(case when application_kind = 'new' then coalesce(discount_reimbursement_cents_snapshot, 0) else 0 end), 0),
    coalesce(sum(case when application_kind = 'new' and coalesce(payment_method, 'other') not in ('cash', 'card') then coalesce(final_amount_cents, 0) else 0 end), 0),
    coalesce(sum(case when application_kind = 'renewal' and payment_method = 'cash' then coalesce(final_amount_cents, 0) else 0 end), 0),
    coalesce(sum(case when application_kind = 'renewal' and payment_method = 'card' then coalesce(final_amount_cents, 0) else 0 end), 0),
    coalesce(sum(case when application_kind = 'renewal' and coalesce(payment_method, 'other') not in ('cash', 'card') then coalesce(final_amount_cents, 0) else 0 end), 0),
    coalesce(sum(case when application_kind = 'new' then coalesce(discount_reimbursement_cents_snapshot, 0) else 0 end), 0)
  into
    v_memberships_cash, v_memberships_card, v_memberships_other,
    v_renewals_cash, v_renewals_card, v_renewals_other,
    v_voucher_reimbursement
  from public.bgm_membership_applications
  where status = 'activated'
    and enrollment_gym_id = p_gym_id
    and payment_business_date = p_business_date;

  select id, locked_at into v_bar_order_id, v_bar_locked_at
  from public.bgm_operational_orders
  where order_type = 'bar'
    and is_daily_sheet = true
    and gym_id = p_gym_id
    and business_date = p_business_date
  for update;

  if v_bar_locked_at is not null then raise exception 'This Bar sheet has already been locked.'; end if;

  if v_bar_order_id is not null then
    select coalesce(sum(coalesce(line_total_cents, 0)), 0)
    into v_bar_sales
    from public.bgm_operational_order_items
    where order_id = v_bar_order_id;
  end if;

  v_gross := v_memberships_cash + v_memberships_card + v_memberships_other
    + v_renewals_cash + v_renewals_card + v_renewals_other + v_bar_sales;
  v_daily_total := v_gross - v_expenses_total;

  if greatest(
    v_memberships_cash, v_memberships_card, v_memberships_other,
    v_renewals_cash, v_renewals_card, v_renewals_other,
    v_voucher_reimbursement, v_bar_sales, v_gross, v_expenses_total
  ) > 2000000000 then raise exception 'End of Day totals exceed the supported amount.'; end if;
  if v_daily_total < -2000000000 or v_daily_total > 2000000000 then raise exception 'End of Day final total exceeds the supported amount.'; end if;

  insert into public.bgm_end_of_day_reports (
    gym_id, business_date, submitted_by_system_user_id, staff_name,
    memberships_cash_cents, memberships_card_cents, memberships_other_cents,
    renewals_cash_cents, renewals_card_cents, renewals_other_cents,
    voucher_reimbursement_cents, bar_sales_cents,
    gross_cents, expenses_total_cents, daily_total_cents
  ) values (
    p_gym_id, p_business_date, p_system_user_id, btrim(p_staff_name),
    v_memberships_cash::integer, v_memberships_card::integer, v_memberships_other::integer,
    v_renewals_cash::integer, v_renewals_card::integer, v_renewals_other::integer,
    v_voucher_reimbursement::integer, v_bar_sales::integer,
    v_gross::integer, v_expenses_total::integer, v_daily_total::integer
  ) returning id into v_report_id;

  insert into public.bgm_end_of_day_expenses (report_id, description, amount_cents, sort_order)
  select v_report_id, btrim(entry->>'description'), (entry->>'amountCents')::integer, ordinality - 1
  from jsonb_array_elements(p_expenses) with ordinality as rows(entry, ordinality);

  if v_bar_order_id is not null then
    insert into public.bgm_end_of_day_bar_items (
      report_id, item_name, quantity, unit_price_cents, line_total_cents, sort_order
    )
    select v_report_id, item_name, quantity, coalesce(unit_price_cents, 0), coalesce(line_total_cents, 0), sort_order
    from public.bgm_operational_order_items
    where order_id = v_bar_order_id and quantity > 0
    order by sort_order, created_at;

    update public.bgm_operational_orders
    set total_cents = v_bar_sales::integer,
        locked_at = now(),
        updated_at = now()
    where id = v_bar_order_id;
  end if;

  insert into public.bgm_end_of_day_vouchers (
    report_id, voucher_code, quantity, reimbursement_total_cents, sort_order
  )
  select
    v_report_id,
    coalesce(nullif(btrim(discount_code_snapshot), ''), 'VOUCHER'),
    count(*)::integer,
    sum(discount_reimbursement_cents_snapshot)::integer,
    (row_number() over (order by coalesce(nullif(btrim(discount_code_snapshot), ''), 'VOUCHER')) - 1)::integer
  from public.bgm_membership_applications
  where status = 'activated'
    and enrollment_gym_id = p_gym_id
    and payment_business_date = p_business_date
    and application_kind = 'new'
    and coalesce(discount_reimbursement_cents_snapshot, 0) > 0
  group by coalesce(nullif(btrim(discount_code_snapshot), ''), 'VOUCHER');

  insert into public.bgm_audit_log (
    system_user_id, context_gym_id, staff_name, action_key,
    entity_type, entity_id, before_data, after_data
  ) values (
    p_system_user_id, p_gym_id, btrim(p_staff_name), 'end_of_day.submitted',
    'end_of_day_report', v_report_id::text, null,
    jsonb_build_object(
      'businessDate', p_business_date,
      'membershipsCashCents', v_memberships_cash,
      'membershipsCardCents', v_memberships_card,
      'membershipsOtherCents', v_memberships_other,
      'renewalsCashCents', v_renewals_cash,
      'renewalsCardCents', v_renewals_card,
      'renewalsOtherCents', v_renewals_other,
      'voucherReimbursementCents', v_voucher_reimbursement,
      'barSalesCents', v_bar_sales,
      'grossCents', v_gross,
      'expensesTotalCents', v_expenses_total,
      'dailyTotalCents', v_daily_total
    )
  );

  return jsonb_build_object(
    'reportId', v_report_id,
    'gymId', p_gym_id,
    'businessDate', p_business_date,
    'staffName', btrim(p_staff_name),
    'memberships', jsonb_build_object('cashCents', v_memberships_cash, 'cardCents', v_memberships_card, 'otherCents', v_memberships_other),
    'renewals', jsonb_build_object('cashCents', v_renewals_cash, 'cardCents', v_renewals_card, 'otherCents', v_renewals_other),
    'voucherReimbursementCents', v_voucher_reimbursement,
    'barSalesCents', v_bar_sales,
    'grossCents', v_gross,
    'expensesTotalCents', v_expenses_total,
    'dailyTotalCents', v_daily_total
  );
end;
$$;

revoke all on function public.bgm_save_daily_bar_sheet(text,uuid,text,date,integer,jsonb) from public, anon, authenticated;
grant execute on function public.bgm_save_daily_bar_sheet(text,uuid,text,date,integer,jsonb) to service_role;

revoke all on function public.bgm_submit_end_of_day(text,uuid,text,date,jsonb) from public, anon, authenticated;
grant execute on function public.bgm_submit_end_of_day(text,uuid,text,date,jsonb) to service_role;
