-- Reception physical-card resolution and first-visit official-photo gate.
-- PHOTO REQUIRED is an access-attempt state, not a granted access result. The
-- finalizer locks the original scan so retries cannot create a second check-in.

alter table public.bgm_access_scans
  drop constraint if exists bgm_access_scans_result_check;

alter table public.bgm_access_scans
  add constraint bgm_access_scans_result_check
  check (result in (
    'granted',
    'expired',
    'inactive',
    'unknown_card',
    'disabled_card',
    'unknown_member',
    'invalid_barcode',
    'photo_required'
  ));

create or replace function public.bgm_finalize_photo_required_barcode_access(
  p_scan_id uuid,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scan public.bgm_access_scans%rowtype;
  v_member public.bgm_members%rowtype;
  v_card public.bgm_member_card_credentials%rowtype;
  v_checkin_id uuid;
  v_duplicate boolean := false;
  v_workouts integer := 0;
  v_passport_stamps integer := 0;
  v_last_checkin timestamptz;
begin
  if p_scan_id is null then
    raise exception 'Access scan is required.';
  end if;
  if p_system_user_id is null then
    raise exception 'System user is required.';
  end if;

  select *
  into v_scan
  from public.bgm_access_scans
  where id = p_scan_id
  for update;

  if not found then
    raise exception 'Access scan was not found.';
  end if;

  if v_scan.system_user_id is distinct from p_system_user_id then
    raise exception 'This access scan belongs to another reception session.';
  end if;

  if v_scan.result = 'granted' and v_scan.checkin_id is not null then
    return jsonb_build_object(
      'result', 'granted',
      'granted', true,
      'duplicate', false,
      'alreadyFinalized', true,
      'checkinId', v_scan.checkin_id,
      'memberId', v_scan.member_id
    );
  end if;

  if v_scan.result <> 'photo_required' then
    raise exception 'This access scan is not awaiting photo finalization.';
  end if;

  if v_scan.member_id is null then
    raise exception 'Photo-required access scan has no member.';
  end if;

  select *
  into v_member
  from public.bgm_members
  where id = v_scan.member_id
  for update;

  if not found then
    update public.bgm_access_scans
    set result = 'unknown_member', checkin_id = null
    where id = v_scan.id;

    return jsonb_build_object(
      'result', 'unknown_member',
      'granted', false,
      'duplicate', false,
      'checkinId', null,
      'memberId', null
    );
  end if;

  if v_member.status <> 'active' then
    update public.bgm_access_scans
    set result = 'inactive',
        membership_expiry_snapshot = v_member.membership_expiry,
        checkin_id = null
    where id = v_scan.id;

    return jsonb_build_object(
      'result', 'inactive',
      'granted', false,
      'duplicate', false,
      'checkinId', null,
      'memberId', v_member.id
    );
  end if;

  if v_member.membership_expiry is not null
     and v_member.membership_expiry < current_date then
    update public.bgm_access_scans
    set result = 'expired',
        membership_expiry_snapshot = v_member.membership_expiry,
        checkin_id = null
    where id = v_scan.id;

    return jsonb_build_object(
      'result', 'expired',
      'granted', false,
      'duplicate', false,
      'checkinId', null,
      'memberId', v_member.id
    );
  end if;

  if nullif(btrim(coalesce(v_member.official_photo_path, '')), '') is null then
    raise exception 'Official member photo is still required.';
  end if;

  -- Revalidate the exact scanned credential. Issued credential history takes
  -- precedence over the transitional member_number compatibility mirror.
  select *
  into v_card
  from public.bgm_member_card_credentials
  where barcode_value = v_scan.credential_value;

  if found then
    if v_card.status <> 'active'
       or v_card.member_id is distinct from v_member.id then
      update public.bgm_access_scans
      set result = 'disabled_card',
          membership_expiry_snapshot = v_member.membership_expiry,
          checkin_id = null
      where id = v_scan.id;

      return jsonb_build_object(
        'result', 'disabled_card',
        'granted', false,
        'duplicate', false,
        'checkinId', null,
        'memberId', v_member.id
      );
    end if;
  elsif btrim(coalesce(v_member.member_number, '')) <> v_scan.credential_value then
    update public.bgm_access_scans
    set result = 'disabled_card',
        membership_expiry_snapshot = v_member.membership_expiry,
        checkin_id = null
    where id = v_scan.id;

    return jsonb_build_object(
      'result', 'disabled_card',
      'granted', false,
      'duplicate', false,
      'checkinId', null,
      'memberId', v_member.id
    );
  end if;

  -- The access-scan row lock makes this operation idempotent for retries of the
  -- same PHOTO REQUIRED event. Preserve the canonical two-hour duplicate rule.
  select id
  into v_checkin_id
  from public.bgm_member_checkins
  where member_id = v_member.id::text
    and gym_id = v_scan.gym_id
    and checkin_at >= now() - interval '2 hours'
  order by checkin_at desc
  limit 1;

  if found then
    v_duplicate := true;
  else
    insert into public.bgm_member_checkins (
      member_id,
      gym_id,
      source
    ) values (
      v_member.id::text,
      v_scan.gym_id,
      'barcode'
    )
    returning id into v_checkin_id;
  end if;

  update public.bgm_access_scans
  set result = 'granted',
      membership_expiry_snapshot = v_member.membership_expiry,
      checkin_id = v_checkin_id
  where id = v_scan.id;

  -- Keep the existing member statistics projection in sync with the canonical
  -- check-in table after the atomic access finalization commits.
  select
    count(*)::integer,
    count(distinct gym_id)::integer,
    max(checkin_at)
  into v_workouts, v_passport_stamps, v_last_checkin
  from public.bgm_member_checkins
  where member_id = v_member.id::text;

  update public.bgm_member_stats
  set workouts_completed = v_workouts,
      current_streak = 0,
      passport_stamps = v_passport_stamps,
      last_checkin_at = v_last_checkin,
      updated_at = now()
  where member_id = v_member.id;

  if not found then
    insert into public.bgm_member_stats (
      member_id,
      workouts_completed,
      current_streak,
      passport_stamps,
      last_checkin_at,
      updated_at
    ) values (
      v_member.id,
      v_workouts,
      0,
      v_passport_stamps,
      v_last_checkin,
      now()
    );
  end if;

  return jsonb_build_object(
    'result', 'granted',
    'granted', true,
    'duplicate', v_duplicate,
    'alreadyFinalized', false,
    'checkinId', v_checkin_id,
    'memberId', v_member.id
  );
end;
$$;

revoke all on function public.bgm_finalize_photo_required_barcode_access(uuid, uuid) from public;
revoke all on function public.bgm_finalize_photo_required_barcode_access(uuid, uuid) from anon;
revoke all on function public.bgm_finalize_photo_required_barcode_access(uuid, uuid) from authenticated;
grant execute on function public.bgm_finalize_photo_required_barcode_access(uuid, uuid) to service_role;
