-- Super Admin Audit Trail read model and future staff-name capture.

create index if not exists bgm_audit_log_created_at_idx
  on public.bgm_audit_log(created_at desc);
create index if not exists bgm_audit_log_system_user_created_idx
  on public.bgm_audit_log(system_user_id, created_at desc);
create index if not exists bgm_audit_log_gym_created_idx
  on public.bgm_audit_log(context_gym_id, created_at desc);
create index if not exists bgm_audit_log_action_created_idx
  on public.bgm_audit_log(action_key, created_at desc);
create index if not exists bgm_audit_log_entity_created_idx
  on public.bgm_audit_log(entity_type, created_at desc);
create index if not exists bgm_audit_log_member_created_idx
  on public.bgm_audit_log(member_id, created_at desc);

create or replace function public.bgm_audit_fill_staff_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(new.staff_name, '')), '') is null
     and new.system_user_id is not null then
    select nullif(btrim(coalesce(u.display_name, '')), '')
      into new.staff_name
    from public.bgm_system_users u
    where u.id = new.system_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bgm_audit_fill_staff_name_trigger on public.bgm_audit_log;
create trigger bgm_audit_fill_staff_name_trigger
before insert on public.bgm_audit_log
for each row execute function public.bgm_audit_fill_staff_name();

create or replace view public.bgm_audit_trail_read
with (security_invoker = true)
as
select
  a.id,
  a.created_at,
  a.system_user_id,
  u.username as system_username,
  u.display_name as system_display_name,
  u.is_super_admin as system_is_super_admin,
  a.staff_name,
  a.context_gym_id,
  coalesce(g.name, a.context_gym_id) as context_gym_name,
  a.action_key,
  a.entity_type,
  a.entity_id,
  a.member_id,
  m.member_number,
  m.full_name as member_name,
  a.before_data,
  a.after_data,
  case
    when a.action_key ilike '%voucher%'
      or a.action_key ilike '%refund%'
      or a.action_key ilike '%price%'
      or a.action_key ilike '%payment%'
      or a.action_key ilike '%discount%'
      or a.action_key ilike 'orders.bar.%'
      then 'financial'
    when a.action_key ilike 'system_user.%'
      or a.action_key ilike '%settings%'
      or a.action_key ilike '%notification%'
      or a.entity_type in ('system_user','notification_settings')
      then 'system'
    when a.member_id is not null
      or a.action_key ilike 'member.%'
      or a.action_key ilike 'membership.%'
      or a.action_key ilike 'card_%'
      or a.action_key ilike 'membership.card.%'
      then 'member'
    else 'operations'
  end as category,
  concat_ws(' ',
    a.action_key,
    a.entity_type,
    a.entity_id,
    a.staff_name,
    a.context_gym_id,
    g.name,
    u.username,
    u.display_name,
    m.member_number,
    m.full_name
  ) as search_text
from public.bgm_audit_log a
left join public.bgm_system_users u on u.id = a.system_user_id
left join public.bgm_gyms g on g.id = a.context_gym_id
left join public.bgm_members m on m.id = a.member_id;

revoke all on public.bgm_audit_trail_read from public, anon, authenticated;
grant select on public.bgm_audit_trail_read to service_role;
