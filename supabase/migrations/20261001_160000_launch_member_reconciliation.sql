-- Launch member reconciliation: TEST-first old-system 22-column conversion and non-destructive sync.

alter table public.bgm_member_import_batches
  drop constraint if exists bgm_member_import_batches_import_mode_check;

alter table public.bgm_member_import_batches
  add constraint bgm_member_import_batches_import_mode_check
  check (import_mode in ('legacy_15','exchange_16','legacy_22'));

alter table public.bgm_member_import_batches
  add column if not exists converted_rows integer not null default 0,
  add column if not exists duplicate_rows integer not null default 0,
  add column if not exists redundant_rows integer not null default 0,
  add column if not exists missing_source_rows integer not null default 0,
  add column if not exists warning_rows integer not null default 0,
  add column if not exists rejected_rows integer not null default 0;

alter table public.bgm_member_import_rows
  drop constraint if exists bgm_member_import_rows_action_check;

alter table public.bgm_member_import_rows
  add constraint bgm_member_import_rows_action_check
  check (action in ('new','update','unchanged','conflict','invalid','duplicate','redundant','rejected'));

alter table public.bgm_member_import_rows
  add column if not exists legacy_scan3 text,
  add column if not exists surname text,
  add column if not exists country text,
  add column if not exists id_number text,
  add column if not exists date_of_birth date,
  add column if not exists source_valid_yn text,
  add column if not exists source_data jsonb;

create table if not exists public.bgm_member_import_review_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bgm_member_import_batches(id) on delete cascade,
  review_type text not null check (review_type in ('conflict','invalid','warning','missing_source')),
  blocking boolean not null default false,
  source_row_number integer,
  member_id uuid references public.bgm_members(id) on delete set null,
  member_number text,
  customer_name text,
  gym text,
  pk_customer text,
  legacy_scan3 text,
  issue text not null,
  created_at timestamptz not null default now()
);

alter table public.bgm_member_import_review_items
  drop constraint if exists bgm_member_import_review_items_review_type_check;

alter table public.bgm_member_import_review_items
  add constraint bgm_member_import_review_items_review_type_check
  check (review_type in ('conflict','invalid','warning','missing_source','rejected'));

create index if not exists bgm_member_import_review_batch_type_idx
  on public.bgm_member_import_review_items(batch_id, review_type, created_at);

alter table public.bgm_member_import_review_items enable row level security;
revoke all on table public.bgm_member_import_review_items from anon, authenticated, public;
grant select, insert, update, delete on table public.bgm_member_import_review_items to service_role;

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
  v_system public.bgm_system_users%rowtype;
  v_id uuid;
  v_member_number text;
  v_name text;
  v_status text;
  v_existing_scan3 text;
  v_added int := 0;
  v_updated int := 0;
  v_kept int := 0;
  v_skipped int := 0;
  v_linked_claims int := 0;
begin
  select * into v_batch
  from public.bgm_member_import_batches
  where id=p_batch_id
  for update;

  if not found then raise exception 'Import batch does not exist'; end if;
  if v_batch.status <> 'preview' then raise exception 'Import batch is not awaiting apply'; end if;
  if v_batch.import_mode not in ('legacy_15','exchange_16','legacy_22') then
    raise exception 'Unsupported member import format';
  end if;
  if v_batch.conflict_rows > 0 or v_batch.invalid_rows > 0 then
    raise exception 'Import contains unresolved conflict or invalid rows; review the preview before applying';
  end if;

  select * into v_system
  from public.bgm_system_users
  where id=p_system_user_id and active=true and is_super_admin=true;
  if not found then raise exception 'Active Super Admin required for member import'; end if;

  if (select count(*) from public.bgm_member_import_rows where batch_id=p_batch_id) <> v_batch.total_rows then
    raise exception 'Staged import row count does not match its preview';
  end if;

  for v_row in
    select * from public.bgm_member_import_rows
    where batch_id=p_batch_id
    order by row_number
  loop
    v_id := null;
    v_member_number := null;
    v_name := coalesce(nullif(btrim(v_row.customer_name),''),nullif(btrim(v_row.company_name),''));

    if v_row.action in ('duplicate','redundant','rejected') then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_name is null then
      raise exception 'Missing member name on row %',v_row.row_number;
    end if;

    if v_batch.import_mode='legacy_22' then
      v_status := case
        when v_row.expiry_date is not null
         and v_row.expiry_date >= (now() at time zone 'Europe/Malta')::date
        then 'active' else 'inactive' end;
    else
      v_status := case
        when lower(btrim(coalesce(v_row.valid_yn,'')))='valid'
         and (v_row.expiry_date is null or v_row.expiry_date >= (now() at time zone 'Europe/Malta')::date)
        then 'active' else 'inactive' end;
    end if;

    if v_row.action='unchanged' then
      if v_row.matched_member_id is null then
        raise exception 'Existing member not resolved on row %',v_row.row_number;
      end if;

      select id,member_number into v_id,v_member_number
      from public.bgm_members
      where id=v_row.matched_member_id
        and (v_row.membership_number is null or member_number=upper(btrim(v_row.membership_number)))
      for update;

      if not found then
        raise exception 'Existing member identity changed since preview on row %',v_row.row_number;
      end if;
      v_kept:=v_kept+1;

    elsif v_row.action='update' then
      if v_row.matched_member_id is null then
        raise exception 'Existing member not resolved on row %',v_row.row_number;
      end if;

      if exists (
        select 1 from public.bgm_members
        where id=v_row.matched_member_id and cancellation_effective_date is not null
      ) then
        raise exception 'Member cancellation exists; preview again and review row %',v_row.row_number;
      end if;

      update public.bgm_members
      set full_name=v_name,
          email=coalesce(nullif(btrim(v_row.email),''),email),
          status=v_status,
          membership_expiry=coalesce(v_row.expiry_date,membership_expiry),
          legacy_gym=coalesce(nullif(btrim(v_row.gym),''),legacy_gym),
          legacy_pk_customer=coalesce(nullif(btrim(v_row.pk_customer),''),legacy_pk_customer),
          address_line_1=coalesce(nullif(btrim(v_row.address1),''),address_line_1),
          address_line_2=coalesce(nullif(btrim(v_row.address2),''),address_line_2),
          town=coalesce(nullif(btrim(v_row.town),''),town),
          postcode=coalesce(nullif(btrim(v_row.postcode),''),postcode),
          country=coalesce(nullif(btrim(v_row.country),''),country),
          gender=coalesce(nullif(btrim(v_row.gender),''),gender),
          telephone_no_1=coalesce(nullif(btrim(v_row.telephone_no_1),''),telephone_no_1),
          telephone_no_2=coalesce(nullif(btrim(v_row.telephone_no_2),''),telephone_no_2),
          mobile=coalesce(nullif(btrim(v_row.mobile),''),mobile),
          id_number=coalesce(nullif(btrim(v_row.id_number),''),id_number),
          date_of_birth=coalesce(v_row.date_of_birth,date_of_birth),
          updated_at=now()
      where id=v_row.matched_member_id
      returning id,member_number into v_id,v_member_number;

      if v_id is null then
        raise exception 'Existing member changed since preview on row %',v_row.row_number;
      end if;
      v_updated:=v_updated+1;

    elsif v_row.action='new' then
      if nullif(btrim(coalesce(v_row.membership_number,'')),'') is not null then
        raise exception 'New member cannot be assigned a supplied BGM number on row %',v_row.row_number;
      end if;

      if exists (
        select 1
        from public.bgm_members m
        where btrim(lower(m.full_name))=btrim(lower(v_name))
          and (
            (
              v_batch.import_mode='legacy_22'
              and (
                (nullif(lower(btrim(m.email)),'')=nullif(lower(btrim(v_row.email)),'')
                 and nullif(lower(btrim(v_row.email)),'') is not null)
                or
                (nullif(btrim(m.id_number),'')=nullif(btrim(v_row.id_number),'')
                 and nullif(btrim(v_row.id_number),'') is not null)
              )
            )
            or
            (
              v_batch.import_mode<>'legacy_22'
              and (
                (nullif(btrim(m.legacy_pk_customer),'')=nullif(btrim(v_row.pk_customer),'')
                 and nullif(btrim(v_row.pk_customer),'') is not null)
                or
                (nullif(lower(btrim(m.email)),'')=nullif(lower(btrim(v_row.email)),'')
                 and nullif(lower(btrim(v_row.email)),'') is not null)
                or
                (nullif(btrim(m.id_number),'')=nullif(btrim(v_row.id_number),'')
                 and nullif(btrim(v_row.id_number),'') is not null)
              )
            )
          )
      ) then
        raise exception 'Possible duplicate was enrolled after preview; preview the workbook again (row %)',v_row.row_number;
      end if;

      insert into public.bgm_members (
        full_name,email,status,membership_expiry,legacy_gym,legacy_pk_customer,
        address_line_1,address_line_2,town,postcode,country,gender,
        telephone_no_1,telephone_no_2,mobile,id_number,date_of_birth
      ) values (
        v_name,nullif(btrim(v_row.email),''),v_status,v_row.expiry_date,
        nullif(btrim(v_row.gym),''),nullif(btrim(v_row.pk_customer),''),
        nullif(btrim(v_row.address1),''),nullif(btrim(v_row.address2),''),
        nullif(btrim(v_row.town),''),nullif(btrim(v_row.postcode),''),
        nullif(btrim(v_row.country),''),nullif(btrim(v_row.gender),''),
        nullif(btrim(v_row.telephone_no_1),''),nullif(btrim(v_row.telephone_no_2),''),
        nullif(btrim(v_row.mobile),''),nullif(btrim(v_row.id_number),''),v_row.date_of_birth
      )
      returning id,member_number into v_id,v_member_number;

      v_added:=v_added+1;
    else
      raise exception 'Unresolved or unsupported import action on row %',v_row.row_number;
    end if;

    if nullif(btrim(coalesce(v_row.legacy_scan3,'')),'') is not null then
      select scan3 into v_existing_scan3
      from public.bgm_legacy_card_claims
      where member_id=v_id;

      if found and upper(btrim(v_existing_scan3)) <> upper(btrim(v_row.legacy_scan3)) then
        raise exception 'Legacy Scan3 changed after preview on row %',v_row.row_number;
      elsif not found then
        insert into public.bgm_legacy_card_claims(member_id,scan3,assignment_status,updated_at)
        values(v_id,btrim(v_row.legacy_scan3),'active',now());
        v_linked_claims:=v_linked_claims+1;
      else
        update public.bgm_legacy_card_claims
        set assignment_status='active',updated_at=now()
        where member_id=v_id;
      end if;
    end if;

    update public.bgm_member_import_rows
    set resolved_membership_number=v_member_number,
        resolved_card_barcode=(
          select barcode_value from public.bgm_member_card_credentials
          where member_id=v_id and status='active'
          order by activated_at desc nulls last limit 1
        )
    where id=v_row.id;
  end loop;

  update public.bgm_member_import_batches
  set status='applied',applied_at=now()
  where id=p_batch_id;

  insert into public.bgm_audit_log(
    system_user_id,context_gym_id,action_key,entity_type,entity_id,after_data
  ) values (
    p_system_user_id,v_system.gym_id,'members.import.applied','member_import_batch',p_batch_id::text,
    jsonb_build_object(
      'batchId',p_batch_id,
      'newRows',v_added,
      'updateRows',v_updated,
      'unchangedRows',v_kept,
      'skippedRows',v_skipped,
      'missingSourceRows',v_batch.missing_source_rows,
      'rejectedRows',v_batch.rejected_rows,
      'deletions',0,
      'mode',v_batch.import_mode
    )
  );

  return jsonb_build_object(
    'batchId',p_batch_id,
    'totalRows',v_batch.total_rows,
    'newRows',v_added,
    'updateRows',v_updated,
    'unchangedRows',v_kept,
    'duplicateRows',v_batch.duplicate_rows,
    'redundantRows',v_batch.redundant_rows,
    'missingSourceRows',v_batch.missing_source_rows,
    'warningRows',v_batch.warning_rows,
    'rejectedRows',v_batch.rejected_rows,
    'linkedCardCount',v_linked_claims,
    'deletions',0
  );
end;
$$;

revoke all on function public.bgm_apply_member_import_batch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bgm_apply_member_import_batch(uuid,uuid) to service_role;
