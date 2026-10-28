-- Serialize new offline activations by normalized ID/passport identity before the
-- canonical activation RPC allocates permanent members/numbers.

create or replace function public.bgm_activate_offline_membership_application(
  p_application_id uuid,
  p_activation_staff_name text,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_participant public.bgm_membership_application_members%rowtype;
  v_identity jsonb;
  v_normalized_identity text;
  v_conflict_reason text := null;
begin
  if p_application_id is null then raise exception 'Membership application is required.'; end if;
  if nullif(btrim(coalesce(p_activation_staff_name,'')), '') is null then raise exception 'Activation Staff Name is required.'; end if;
  if p_system_user_id is null then raise exception 'Activating system user is required.'; end if;

  select * into v_application
  from public.bgm_membership_applications
  where id=p_application_id
  for update;
  if not found then raise exception 'Membership application was not found.'; end if;
  if v_application.application_source <> 'offline_staff' then raise exception 'Offline activation requires an offline Staff application.'; end if;

  -- Once canonical activation completed, reuse its native idempotent response.
  if v_application.status='activated' then
    return public.bgm_activate_membership_application(
      p_application_id,
      p_activation_staff_name,
      p_system_user_id
    );
  end if;

  -- A single application may never create two people from the same identity.
  if exists (
    select 1
    from (
      select upper(regexp_replace(coalesce(m.id_number,''), '[^[:alnum:]]', '', 'g')) as normalized_identity,
             count(*) as identity_count
      from public.bgm_membership_application_members m
      where m.application_id=p_application_id
        and m.existing_member_id is null
      group by upper(regexp_replace(coalesce(m.id_number,''), '[^[:alnum:]]', '', 'g'))
    ) duplicates
    where duplicates.normalized_identity <> ''
      and duplicates.identity_count > 1
  ) then
    return jsonb_build_object(
      'applicationId', p_application_id,
      'offlineIdentityConflict', true,
      'reason', 'active_identity'
    );
  end if;

  -- Sort identities before locking so Couples applications cannot deadlock when
  -- two receptions submit the same people in a different order.
  for v_normalized_identity in
    select normalized_identity
    from (
      select distinct upper(regexp_replace(coalesce(m.id_number,''), '[^[:alnum:]]', '', 'g')) as normalized_identity
      from public.bgm_membership_application_members m
      where m.application_id=p_application_id
        and m.existing_member_id is null
    ) identities
    where normalized_identity <> ''
    order by normalized_identity
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('bgm-member-identity:' || v_normalized_identity, 0)
    );
  end loop;

  -- Recheck only after every identity lock is held. If another offline terminal
  -- won the race, convert this application into a review item instead of
  -- creating a duplicate person.
  for v_participant in
    select *
    from public.bgm_membership_application_members
    where application_id=p_application_id
      and existing_member_id is null
    order by participant_order
    for update
  loop
    v_identity := public.bgm_classify_membership_identity(v_participant.id_number);
    if coalesce(v_identity->>'state','clear') <> 'clear' then
      update public.bgm_membership_application_members
      set identity_match_state = v_identity->>'state',
          matched_member_id = nullif(v_identity->>'matchedMemberId','')::uuid,
          updated_at = now()
      where id=v_participant.id;

      if v_identity->>'state'='active' then
        v_conflict_reason := 'active_identity';
      elsif v_conflict_reason is null then
        v_conflict_reason := 'possible_renewal';
      end if;
    end if;
  end loop;

  if v_conflict_reason is not null then
    insert into public.bgm_audit_log(
      system_user_id,context_gym_id,staff_name,action_key,entity_type,entity_id,after_data
    ) values (
      p_system_user_id,
      v_application.enrollment_gym_id,
      btrim(p_activation_staff_name),
      'membership.offline_sync.identity_conflict',
      'membership_application',
      p_application_id::text,
      jsonb_build_object('reason',v_conflict_reason)
    );

    return jsonb_build_object(
      'applicationId', p_application_id,
      'offlineIdentityConflict', true,
      'reason', v_conflict_reason
    );
  end if;

  return public.bgm_activate_membership_application(
    p_application_id,
    p_activation_staff_name,
    p_system_user_id
  );
end;
$$;

revoke all on function public.bgm_activate_offline_membership_application(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.bgm_activate_offline_membership_application(uuid,text,uuid) to service_role;
