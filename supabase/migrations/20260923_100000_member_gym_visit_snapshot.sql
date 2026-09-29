-- Snapshot the enrollment gym at the moment a canonical visit is saved.
-- Existing rows deliberately retain NULL / false: their historical origin is unverified.
-- A member's later enrollment-gym changes never rewrite recorded visits.
alter table public.bgm_member_checkins
  add column if not exists enrollment_gym_id_at_checkin text,
  add column if not exists enrollment_snapshot_recorded boolean not null default false;

create or replace function public.bgm_snapshot_checkin_enrollment_gym()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_enrollment_gym text;
begin
  -- Hold the member row stable until this check-in commits. A simultaneous
  -- admin reassignment (UPDATE on that row) will serialize with this INSERT.
  select m.enrollment_gym_id into v_enrollment_gym
    from public.bgm_members m
    where m.id::text = new.member_id
    for share;

  new.enrollment_gym_id_at_checkin := v_enrollment_gym;
  new.enrollment_snapshot_recorded := true;
  return new;
end;
$$;

drop trigger if exists bgm_checkin_enrollment_snapshot_insert on public.bgm_member_checkins;
create trigger bgm_checkin_enrollment_snapshot_insert
before insert on public.bgm_member_checkins
for each row execute function public.bgm_snapshot_checkin_enrollment_gym();

create or replace function public.bgm_protect_checkin_enrollment_snapshot()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.enrollment_gym_id_at_checkin is distinct from old.enrollment_gym_id_at_checkin
    or new.enrollment_snapshot_recorded is distinct from old.enrollment_snapshot_recorded then
    raise exception 'Recorded enrollment gym of an existing visit cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists bgm_checkin_enrollment_snapshot_immutable on public.bgm_member_checkins;
create trigger bgm_checkin_enrollment_snapshot_immutable
before update on public.bgm_member_checkins
for each row execute function public.bgm_protect_checkin_enrollment_snapshot();

-- A dedicated person-level reassignment, not a change to a shared couple's
-- membership, an original Excel field, a visit, or a payment transaction.
create or replace function public.bgm_super_admin_change_member_enrollment_gym(
  p_system_user_id uuid,
  p_member_id uuid,
  p_expected_updated_at timestamptz,
  p_new_gym_id text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_before public.bgm_members%rowtype;
  v_after public.bgm_members%rowtype;
begin
  if not exists (
    select 1 from public.bgm_system_users
    where id = p_system_user_id and is_super_admin = true and active = true
  ) then
    raise exception 'Super Admin access required.';
  end if;
  if p_new_gym_id is null or btrim(p_new_gym_id) = '' then
    raise exception 'Select an active enrollment gym.';
  end if;
  if not exists (
    select 1 from public.bgm_gyms
    where id = p_new_gym_id and status = 'active'
  ) then
    raise exception 'The selected enrollment gym is not active.';
  end if;
  if p_expected_updated_at is null then
    raise exception 'Reload the member before saving the enrollment gym.';
  end if;

  select * into v_before from public.bgm_members
    where id = p_member_id for update;
  if not found then raise exception 'Member not found.'; end if;
  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'Member details changed elsewhere. Reload before changing the gym.';
  end if;
  if v_before.enrollment_gym_id is not distinct from p_new_gym_id then
    return jsonb_build_object('id', v_before.id, 'updatedAt', v_before.updated_at, 'changed', false);
  end if;

  update public.bgm_members
    set enrollment_gym_id = p_new_gym_id, updated_at = clock_timestamp()
    where id = p_member_id
    returning * into v_after;

  insert into public.bgm_audit_log(
    system_user_id, context_gym_id, action_key, entity_type, entity_id,
    member_id, before_data, after_data
  ) values (
    p_system_user_id, p_new_gym_id, 'member.enrollment_gym.change',
    'member', p_member_id::text, p_member_id,
    jsonb_build_object(
      'enrollmentGymId', v_before.enrollment_gym_id,
      'originalEnrollmentGym', v_before.legacy_gym
    ),
    jsonb_build_object(
      'enrollmentGymId', v_after.enrollment_gym_id,
      'originalEnrollmentGym', v_after.legacy_gym
    )
  );
  return jsonb_build_object('id', v_after.id, 'updatedAt', v_after.updated_at, 'changed', true);
end;
$$;

revoke all on function public.bgm_super_admin_change_member_enrollment_gym(uuid, uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.bgm_super_admin_change_member_enrollment_gym(uuid, uuid, timestamptz, text)
  to service_role;
