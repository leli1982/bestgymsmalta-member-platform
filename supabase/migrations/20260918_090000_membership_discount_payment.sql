-- BestGymsMalta Plan 03 Task 4: Super Admin-owned rates, code-only discounts and atomic payment activation.

create or replace function public.bgm_enforce_membership_application_price_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog_version_id uuid;
  v_amount_cents integer;
  v_currency text;
begin
  if tg_op = 'UPDATE'
    and new.membership_type is not distinct from old.membership_type
    and new.duration_key is not distinct from old.duration_key then
    -- Staff and system flows may not replace a captured Super Admin rate.
    new.base_price_cents := old.base_price_cents;
    new.price_catalog_version_id := old.price_catalog_version_id;
    new.currency := old.currency;
    return new;
  end if;

  select c.id, e.amount_cents, e.currency
  into v_catalog_version_id, v_amount_cents, v_currency
  from public.bgm_membership_price_catalog_versions c
  join public.bgm_membership_price_entries e
    on e.catalog_version_id = c.id
   and e.membership_type = new.membership_type
   and e.duration_key = new.duration_key
  where c.status = 'published'
  order by c.version_no desc
  limit 1;

  if v_catalog_version_id is null or v_amount_cents is null then
    raise exception 'Published Super Admin membership rate was not found.';
  end if;

  new.base_price_cents := v_amount_cents;
  new.price_catalog_version_id := v_catalog_version_id;
  new.currency := coalesce(v_currency, 'EUR');

  -- Changing the selected membership invalidates any earlier discount preview.
  new.discount_code_id := null;
  new.discount_code_snapshot := null;
  new.discount_percentage_snapshot := null;
  new.discount_amount_cents := 0;
  new.final_amount_cents := v_amount_cents;

  return new;
end;
$$;

revoke all on function public.bgm_enforce_membership_application_price_snapshot() from public, anon, authenticated;
grant execute on function public.bgm_enforce_membership_application_price_snapshot() to service_role;

drop trigger if exists bgm_membership_application_price_snapshot_guard
  on public.bgm_membership_applications;

create trigger bgm_membership_application_price_snapshot_guard
before insert or update of membership_type, duration_key, base_price_cents, price_catalog_version_id, currency
on public.bgm_membership_applications
for each row
execute function public.bgm_enforce_membership_application_price_snapshot();

create or replace function public.bgm_activate_membership_application(
  p_application_id uuid,
  p_payment_method text,
  p_payment_other_text text,
  p_payment_staff_name text,
  p_discount_code text,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_system_user record;
  v_payment_method text := lower(btrim(coalesce(p_payment_method, '')));
  v_payment_other_text text := nullif(btrim(coalesce(p_payment_other_text, '')), '');
  v_payment_staff_name text := nullif(btrim(coalesce(p_payment_staff_name, '')), '');
  v_discount_code text := upper(btrim(coalesce(p_discount_code, '')));
  v_discount public.bgm_discount_codes%rowtype;
  v_catalog_status text;
  v_catalog_amount integer;
  v_catalog_currency text;
  v_catalog_version_id uuid;
  v_discount_amount integer := 0;
  v_final_amount integer;
  v_today date := (now() at time zone 'Europe/Malta')::date;
begin
  if p_application_id is null then raise exception 'Membership application is required.'; end if;
  if p_system_user_id is null then raise exception 'Activating system user is required.'; end if;
  if v_payment_staff_name is null then raise exception 'Payment Staff Name is required.'; end if;
  if v_payment_method not in ('cash', 'card', 'other') then raise exception 'A valid payment method is required.'; end if;
  if v_payment_method = 'other' and v_payment_other_text is null then
    raise exception 'Other payment description is required.';
  end if;

  select id, gym_id, is_super_admin, active
  into v_system_user
  from public.bgm_system_users
  where id = p_system_user_id
    and active = true;

  if not found then raise exception 'Activating system user is not active.'; end if;

  select *
  into v_application
  from public.bgm_membership_applications
  where id = p_application_id
  for update;

  if not found then raise exception 'Membership application was not found.'; end if;

  if not v_system_user.is_super_admin
    and v_system_user.gym_id is distinct from v_application.enrollment_gym_id then
    raise exception 'This application belongs to another gym.';
  end if;

  if v_application.status = 'activated' then
    return public.bgm_activate_membership_application(
      p_application_id,
      v_payment_staff_name,
      p_system_user_id
    );
  end if;

  if v_application.status not in ('submitted', 'awaiting_payment') then
    raise exception 'Membership application is not awaiting activation.';
  end if;

  if v_application.price_catalog_version_id is null then
    select c.id, c.status, e.amount_cents, e.currency
    into v_catalog_version_id, v_catalog_status, v_catalog_amount, v_catalog_currency
    from public.bgm_membership_price_catalog_versions c
    join public.bgm_membership_price_entries e
      on e.catalog_version_id = c.id
     and e.membership_type = v_application.membership_type
     and e.duration_key = v_application.duration_key
    where c.status = 'published'
    order by c.version_no desc
    limit 1;

    if v_catalog_version_id is null or v_catalog_amount is null then
      raise exception 'Published Super Admin membership rate was not found.';
    end if;

    update public.bgm_membership_applications
    set base_price_cents = v_catalog_amount,
        price_catalog_version_id = v_catalog_version_id,
        currency = coalesce(v_catalog_currency, 'EUR'),
        discount_code_id = null,
        discount_code_snapshot = null,
        discount_percentage_snapshot = null,
        discount_amount_cents = 0,
        final_amount_cents = v_catalog_amount,
        updated_at = now()
    where id = p_application_id;

    select * into v_application
    from public.bgm_membership_applications
    where id = p_application_id
    for update;
  else
    select c.status, e.amount_cents, e.currency
    into v_catalog_status, v_catalog_amount, v_catalog_currency
    from public.bgm_membership_price_catalog_versions c
    join public.bgm_membership_price_entries e
      on e.catalog_version_id = c.id
    where c.id = v_application.price_catalog_version_id
      and e.membership_type = v_application.membership_type
      and e.duration_key = v_application.duration_key;

    if v_catalog_amount is null
      or v_catalog_status not in ('published', 'retired')
      or v_application.base_price_cents is distinct from v_catalog_amount
      or v_application.currency is distinct from v_catalog_currency then
      raise exception 'Application Super Admin price snapshot is invalid.';
    end if;
  end if;

  if v_discount_code = '' then
    v_discount_amount := 0;
    v_final_amount := v_application.base_price_cents;

    update public.bgm_membership_applications
    set discount_code_id = null,
        discount_code_snapshot = null,
        discount_percentage_snapshot = null,
        discount_amount_cents = 0,
        final_amount_cents = v_final_amount
    where id = p_application_id;
  else
    select *
    into v_discount
    from public.bgm_discount_codes
    where upper(btrim(code)) = v_discount_code
    for update;

    if not found
      or not v_discount.active
      or (v_discount.valid_from is not null and v_today < v_discount.valid_from)
      or (v_discount.valid_until is not null and v_today > v_discount.valid_until)
      or (v_discount.max_uses is not null and v_discount.successful_uses >= v_discount.max_uses) then
      raise exception 'Discount code is unavailable.';
    end if;

    v_discount_amount := round(v_application.base_price_cents * v_discount.percentage / 100.0)::integer;
    v_final_amount := greatest(v_application.base_price_cents - v_discount_amount, 0);

    update public.bgm_membership_applications
    set discount_code_id = v_discount.id,
        discount_code_snapshot = v_discount.code,
        discount_percentage_snapshot = v_discount.percentage,
        discount_amount_cents = v_discount_amount,
        final_amount_cents = v_final_amount
    where id = p_application_id;
  end if;

  update public.bgm_membership_applications
  set payment_method = v_payment_method,
      payment_other_text = case when v_payment_method = 'other' then v_payment_other_text else null end,
      payment_staff_name = v_payment_staff_name,
      payment_system_user_id = p_system_user_id,
      updated_at = now()
  where id = p_application_id;

  -- The existing 3-argument activation function performs all verification,
  -- member/card writes, discount-use consumption and activation audit in this same transaction.
  return public.bgm_activate_membership_application(
    p_application_id,
    v_payment_staff_name,
    p_system_user_id
  );
end;
$$;

revoke all on function public.bgm_activate_membership_application(uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.bgm_activate_membership_application(uuid, text, text, text, text, uuid) to service_role;
