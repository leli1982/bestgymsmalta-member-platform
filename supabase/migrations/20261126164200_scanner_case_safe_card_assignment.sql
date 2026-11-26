-- Case-insensitive credential guard: block new conflicts without rewriting historical cards.
create index if not exists bgm_member_card_credentials_upper_barcode_idx
  on public.bgm_member_card_credentials (upper(barcode_value));
create or replace function public.bgm_guard_case_safe_card_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status not in ('active','reserved') then return new; end if;
  if tg_op = 'UPDATE' then
    if new.barcode_value is not distinct from old.barcode_value
       and new.status is not distinct from old.status
       and new.member_id is not distinct from old.member_id
       and new.application_member_id is not distinct from old.application_member_id then
      return new;
    end if;
  end if;
  if new.barcode_value ~* '^(X[0-9]+){2,}$' then
    raise exception 'Multiple card barcodes detected. Scan one physical card only.' using errcode = '23514';
  end if;
  -- Serialize assignment of the same normalized identifier, including concurrent reservations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bgm-card:' || upper(new.barcode_value),0));
  if exists (
    select 1 from public.bgm_member_card_credentials c
    where upper(c.barcode_value)=upper(new.barcode_value)
      and c.id is distinct from new.id
  ) then
    raise exception 'That physical card has already been issued or reserved and cannot be reused.' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function public.bgm_guard_case_safe_card_assignment() from public, anon, authenticated;
drop trigger if exists bgm_guard_case_safe_card_assignment_trigger on public.bgm_member_card_credentials;
create trigger bgm_guard_case_safe_card_assignment_trigger
before insert or update of barcode_value, status, member_id, application_member_id on public.bgm_member_card_credentials
for each row execute function public.bgm_guard_case_safe_card_assignment();
alter table public.bgm_access_scans
  add column if not exists original_credential_value text,
  add column if not exists normalized_credential_value text,
  add column if not exists scan_input_source text,
  add column if not exists lookup_kind text;
comment on column public.bgm_access_scans.scan_input_source is 'Client-observed input path, not proof of hardware identity. Null for historical or unclassified clients.';
