-- BestGymsMalta member import transition to optional preprinted card barcodes.
-- Person identity remains bgm_members.id. CardBarcode is an optional opaque
-- physical-card credential and blank values never allocate or fabricate a card.

alter table public.bgm_member_import_rows
  add column if not exists card_barcode text,
  add column if not exists resolved_card_barcode text;

-- A preview made under the former MembershipNumber contract must not be applied
-- under the new CardBarcode rules. The source file can simply be previewed again.
update public.bgm_member_import_batches
set status = 'cancelled'
where status = 'preview';

create or replace function public.bgm_apply_member_import_batch(
  p_batch_id uuid,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.bgm_member_import_batches%rowtype;
  v_row public.bgm_member_import_rows%rowtype;
  v_member_id uuid;
  v_status text;
  v_full_name text;
  v_card_barcode text;
  v_active_card text;
  v_context_gym_id text := null;
  v_linked_card_count integer := 0;
  v_blank_card_rows integer := 0;
begin
  select *
  into v_batch
  from public.bgm_member_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Membership import batch not found';
  end if;

  if v_batch.status <> 'preview' then
    raise exception 'Membership import batch is not awaiting apply';
  end if;

  if v_batch.conflict_rows > 0 or v_batch.invalid_rows > 0 then
    raise exception 'Membership import batch has unresolved conflict or invalid rows';
  end if;

  select gym_id
  into v_context_gym_id
  from public.bgm_system_users
  where id = p_system_user_id
    and active = true;

  if not found then
    raise exception 'Active system user not found';
  end if;

  for v_row in
    select *
    from public.bgm_member_import_rows
    where batch_id = p_batch_id
    order by row_number
  loop
    v_member_id := null;
    v_active_card := null;
    v_card_barcode := nullif(btrim(v_row.card_barcode), '');
    if v_card_barcode is null then
      v_blank_card_rows := v_blank_card_rows + 1;
    end if;

    v_full_name := coalesce(
      nullif(btrim(v_row.customer_name), ''),
      nullif(btrim(v_row.company_name), '')
    );

    if v_full_name is null then
      raise exception 'Row % has no customer or company name', v_row.row_number;
    end if;

    v_status := case
      when lower(coalesce(btrim(v_row.valid_yn), '')) = 'valid'
        and (v_row.expiry_date is null or v_row.expiry_date >= current_date)
      then 'active'
      else 'inactive'
    end;

    if v_row.action = 'unchanged' then
      if v_row.matched_member_id is null then
        raise exception 'Row % is unchanged but has no matched member', v_row.row_number;
      end if;

      select id
      into v_member_id
      from public.bgm_members
      where id = v_row.matched_member_id;

      if not found then
        raise exception 'Matched member missing for row %', v_row.row_number;
      end if;

      select barcode_value
      into v_active_card
      from public.bgm_member_card_credentials
      where member_id = v_member_id
        and status = 'active'
      limit 1;

      if v_card_barcode is not null
        and (v_active_card is null or v_active_card <> v_card_barcode) then
        raise exception 'CardBarcode % does not match the member active card on row %',
          v_card_barcode, v_row.row_number;
      end if;

    elsif v_row.action = 'update' then
      if v_row.matched_member_id is null then
        raise exception 'Row % is update but has no matched member', v_row.row_number;
      end if;

      update public.bgm_members
      set
        full_name = v_full_name,
        email = nullif(btrim(v_row.email), ''),
        status = v_status,
        membership_expiry = v_row.expiry_date,
        legacy_gym = nullif(btrim(v_row.gym), ''),
        legacy_pk_customer = nullif(btrim(v_row.pk_customer), ''),
        company_name = nullif(btrim(v_row.company_name), ''),
        address_line_1 = nullif(btrim(v_row.address1), ''),
        address_line_2 = nullif(btrim(v_row.address2), ''),
        town = nullif(btrim(v_row.town), ''),
        postcode = nullif(btrim(v_row.postcode), ''),
        gender = nullif(btrim(v_row.gender), ''),
        telephone_no_1 = nullif(btrim(v_row.telephone_no_1), ''),
        telephone_no_2 = nullif(btrim(v_row.telephone_no_2), ''),
        mobile = nullif(btrim(v_row.mobile), ''),
        updated_at = now()
      where id = v_row.matched_member_id
      returning id into v_member_id;

      if not found then
        raise exception 'Matched member missing for row %', v_row.row_number;
      end if;

      select barcode_value
      into v_active_card
      from public.bgm_member_card_credentials
      where member_id = v_member_id
        and status = 'active'
      limit 1
      for update;

      if v_card_barcode is not null then
        if v_active_card is not null and v_active_card <> v_card_barcode then
          raise exception 'Member on row % already has a different active card', v_row.row_number;
        end if;

        if v_active_card is null then
          if exists (
            select 1
            from public.bgm_member_card_credentials
            where barcode_value = v_card_barcode
          ) then
            raise exception 'CardBarcode % is already issued or reserved', v_card_barcode;
          end if;

          insert into public.bgm_member_card_credentials (
            barcode_value,
            member_id,
            status,
            activated_at,
            created_by_system_user_id,
            updated_at
          ) values (
            v_card_barcode,
            v_member_id,
            'active',
            now(),
            p_system_user_id,
            now()
          );

          v_active_card := v_card_barcode;
          v_linked_card_count := v_linked_card_count + 1;
        end if;

        update public.bgm_members
        set member_number = v_card_barcode,
            updated_at = now()
        where id = v_member_id
          and member_number is distinct from v_card_barcode;
      end if;

    elsif v_row.action = 'new' then
      insert into public.bgm_members (
        member_number,
        full_name,
        email,
        status,
        membership_expiry,
        legacy_gym,
        legacy_pk_customer,
        company_name,
        address_line_1,
        address_line_2,
        town,
        postcode,
        gender,
        telephone_no_1,
        telephone_no_2,
        mobile,
        updated_at
      ) values (
        v_card_barcode,
        v_full_name,
        nullif(btrim(v_row.email), ''),
        v_status,
        v_row.expiry_date,
        nullif(btrim(v_row.gym), ''),
        nullif(btrim(v_row.pk_customer), ''),
        nullif(btrim(v_row.company_name), ''),
        nullif(btrim(v_row.address1), ''),
        nullif(btrim(v_row.address2), ''),
        nullif(btrim(v_row.town), ''),
        nullif(btrim(v_row.postcode), ''),
        nullif(btrim(v_row.gender), ''),
        nullif(btrim(v_row.telephone_no_1), ''),
        nullif(btrim(v_row.telephone_no_2), ''),
        nullif(btrim(v_row.mobile), ''),
        now()
      )
      returning id into v_member_id;

      if v_card_barcode is not null then
        if exists (
          select 1
          from public.bgm_member_card_credentials
          where barcode_value = v_card_barcode
        ) then
          raise exception 'CardBarcode % is already issued or reserved', v_card_barcode;
        end if;

        insert into public.bgm_member_card_credentials (
          barcode_value,
          member_id,
          status,
          activated_at,
          created_by_system_user_id,
          updated_at
        ) values (
          v_card_barcode,
          v_member_id,
          'active',
          now(),
          p_system_user_id,
          now()
        );

        v_active_card := v_card_barcode;
        v_linked_card_count := v_linked_card_count + 1;
      end if;
    else
      raise exception 'Row % has unresolved action %', v_row.row_number, v_row.action;
    end if;

    if v_active_card is null and v_member_id is not null then
      select barcode_value
      into v_active_card
      from public.bgm_member_card_credentials
      where member_id = v_member_id
        and status = 'active'
      limit 1;
    end if;

    update public.bgm_member_import_rows
    set resolved_card_barcode = v_active_card
    where id = v_row.id;
  end loop;

  update public.bgm_member_import_batches
  set status = 'applied',
      applied_at = now()
  where id = p_batch_id;

  insert into public.bgm_audit_log (
    system_user_id,
    context_gym_id,
    action_key,
    entity_type,
    entity_id,
    after_data
  ) values (
    p_system_user_id,
    v_context_gym_id,
    'members.import.applied',
    'member_import_batch',
    p_batch_id::text,
    jsonb_build_object(
      'totalRows', v_batch.total_rows,
      'newRows', v_batch.new_rows,
      'updateRows', v_batch.update_rows,
      'unchangedRows', v_batch.unchanged_rows,
      'linkedCardCount', v_linked_card_count,
      'blankCardRows', v_blank_card_rows
    )
  );

  return jsonb_build_object(
    'batchId', p_batch_id,
    'totalRows', v_batch.total_rows,
    'newRows', v_batch.new_rows,
    'updateRows', v_batch.update_rows,
    'unchangedRows', v_batch.unchanged_rows,
    'linkedCardCount', v_linked_card_count,
    'blankCardRows', v_blank_card_rows
  );
end;
$$;

revoke all on function public.bgm_apply_member_import_batch(uuid, uuid) from public;
revoke all on function public.bgm_apply_member_import_batch(uuid, uuid) from anon;
revoke all on function public.bgm_apply_member_import_batch(uuid, uuid) from authenticated;
grant execute on function public.bgm_apply_member_import_batch(uuid, uuid) to service_role;
