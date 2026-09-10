-- Apply a reviewed membership import batch in one database transaction.
-- Permanent BGM membership numbers belong to one person for life and are never
-- changed during an update.

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
  v_resolved text;
  v_existing_id uuid;
  v_suffix bigint;
  v_status text;
  v_full_name text;
  v_generated_count integer := 0;
  v_first_generated text := null;
  v_last_generated text := null;
  v_context_gym_id text := null;
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
    v_resolved := null;
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

      select member_number
      into v_resolved
      from public.bgm_members
      where id = v_row.matched_member_id;

      if not found then
        raise exception 'Matched member missing for row %', v_row.row_number;
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
      returning member_number into v_resolved;

      if not found then
        raise exception 'Matched member missing for row %', v_row.row_number;
      end if;

    elsif v_row.action = 'new' then
      if nullif(btrim(v_row.membership_number), '') is null then
        -- Allocation happens inside this same transaction; any later exception
        -- rolls back both the member rows and bgm_next_member_number() state.
        v_resolved := public.bgm_next_member_number();
        v_generated_count := v_generated_count + 1;
        if v_first_generated is null then
          v_first_generated := v_resolved;
        end if;
        v_last_generated := v_resolved;
      else
        v_resolved := upper(btrim(v_row.membership_number));
        if v_resolved !~ '^BGM[0-9]{7}$' then
          raise exception 'Invalid permanent membership number on row %', v_row.row_number;
        end if;

        v_suffix := substring(v_resolved from '^BGM([0-9]{7})$')::bigint;
        if v_suffix < 1 or v_suffix > 9999999 then
          raise exception 'Invalid permanent membership number on row %', v_row.row_number;
        end if;

        select id
        into v_existing_id
        from public.bgm_members
        where member_number = v_resolved;

        if found then
          raise exception 'Permanent membership number % is already owned', v_resolved;
        end if;

        -- Serialize against automatic allocations and make sure the allocator
        -- can never later issue this explicit number.
        update public.bgm_member_number_state
        set last_issued = greatest(last_issued, v_suffix),
            updated_at = now()
        where id = 1;
      end if;

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
        v_resolved,
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
      );
    else
      raise exception 'Row % has unresolved action %', v_row.row_number, v_row.action;
    end if;

    update public.bgm_member_import_rows
    set resolved_membership_number = v_resolved
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
      'generatedCount', v_generated_count,
      'firstGenerated', v_first_generated,
      'lastGenerated', v_last_generated
    )
  );

  return jsonb_build_object(
    'batchId', p_batch_id,
    'totalRows', v_batch.total_rows,
    'newRows', v_batch.new_rows,
    'updateRows', v_batch.update_rows,
    'unchangedRows', v_batch.unchanged_rows,
    'generatedCount', v_generated_count,
    'firstGenerated', v_first_generated,
    'lastGenerated', v_last_generated
  );
end;
$$;

revoke all on function public.bgm_apply_member_import_batch(uuid, uuid) from public;
revoke all on function public.bgm_apply_member_import_batch(uuid, uuid) from anon;
revoke all on function public.bgm_apply_member_import_batch(uuid, uuid) from authenticated;
grant execute on function public.bgm_apply_member_import_batch(uuid, uuid) to service_role;
