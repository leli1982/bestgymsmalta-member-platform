-- Server-authoritative identity classification and shared public-enrollment rate limiter.
-- Normalizes both incoming and stored ID/passport values and prevents client-supplied match state from winning.

create index if not exists bgm_members_normalized_id_number_idx
  on public.bgm_members (
    upper(regexp_replace(coalesce(id_number, ''), '[^[:alnum:]]', '', 'g'))
  )
  where id_number is not null and btrim(id_number) <> '';

create or replace function public.bgm_classify_membership_identity(
  p_id_number text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized text := upper(regexp_replace(coalesce(p_id_number, ''), '[^[:alnum:]]', '', 'g'));
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_member_id uuid;
  v_status text;
  v_expiry date;
  v_state text := 'clear';
begin
  if v_normalized = '' then
    return jsonb_build_object('state', 'clear', 'matchedMemberId', null);
  end if;

  select m.id, m.status, m.membership_expiry
  into v_member_id, v_status, v_expiry
  from public.bgm_members m
  where upper(regexp_replace(coalesce(m.id_number, ''), '[^[:alnum:]]', '', 'g')) = v_normalized
  order by
    case
      when m.status = 'active' and (m.membership_expiry is null or m.membership_expiry >= v_today) then 0
      else 1
    end,
    m.membership_expiry desc nulls first,
    m.id
  limit 1;

  if v_member_id is null then
    return jsonb_build_object('state', 'clear', 'matchedMemberId', null);
  end if;

  if v_status = 'active' and (v_expiry is null or v_expiry >= v_today) then
    v_state := 'active';
  else
    v_state := 'expired_inactive';
  end if;

  return jsonb_build_object('state', v_state, 'matchedMemberId', v_member_id);
end;
$$;

revoke all on function public.bgm_classify_membership_identity(text) from public, anon, authenticated;
grant execute on function public.bgm_classify_membership_identity(text) to service_role;

create or replace function public.bgm_consume_public_enrollment_rate_limit(
  p_rate_key_hash text,
  p_enrollment_gym_id text,
  p_window_start timestamptz,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_count integer;
begin
  if btrim(coalesce(p_rate_key_hash, '')) = ''
     or btrim(coalesce(p_enrollment_gym_id, '')) = ''
     or p_window_start is null
     or p_limit is null
     or p_limit <= 0 then
    raise exception 'Invalid rate-limit input.';
  end if;

  insert into public.bgm_public_enrollment_rate_buckets (
    rate_key_hash,
    enrollment_gym_id,
    window_start,
    attempt_count,
    last_attempt_at
  ) values (
    p_rate_key_hash,
    p_enrollment_gym_id,
    p_window_start,
    1,
    now()
  )
  on conflict (rate_key_hash, enrollment_gym_id, window_start)
  do update set
    attempt_count = public.bgm_public_enrollment_rate_buckets.attempt_count + 1,
    last_attempt_at = now()
  returning attempt_count into v_attempt_count;

  return v_attempt_count <= p_limit;
end;
$$;

revoke all on function public.bgm_consume_public_enrollment_rate_limit(text, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.bgm_consume_public_enrollment_rate_limit(text, text, timestamptz, integer) to service_role;

create or replace function public.bgm_enforce_membership_application_identity_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_classification jsonb;
  v_state text;
begin
  v_classification := public.bgm_classify_membership_identity(new.id_number);
  v_state := coalesce(v_classification->>'state', 'clear');

  if v_state = 'active' then
    raise exception 'An active membership already exists for this identity.';
  end if;

  new.identity_match_state := v_state;
  new.matched_member_id := nullif(v_classification->>'matchedMemberId', '')::uuid;
  new.existing_member_id := case
    when v_state = 'expired_inactive' then new.matched_member_id
    else null
  end;

  return new;
end;
$$;

revoke all on function public.bgm_enforce_membership_application_identity_match() from public, anon, authenticated;
grant execute on function public.bgm_enforce_membership_application_identity_match() to service_role;

drop trigger if exists bgm_membership_application_members_enforce_identity on public.bgm_membership_application_members;
create trigger bgm_membership_application_members_enforce_identity
before insert or update of id_number on public.bgm_membership_application_members
for each row execute function public.bgm_enforce_membership_application_identity_match();
