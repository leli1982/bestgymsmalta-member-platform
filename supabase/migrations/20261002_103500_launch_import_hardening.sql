-- Launch import hardening after TEST reconciliation rehearsal.
-- Keep the set-based import apply RPC within a bounded statement timeout.
alter function public.bgm_apply_member_import_batch(uuid, uuid)
  set statement_timeout = '60s';

-- These five SECURITY DEFINER functions are trigger-only internals.
-- Prevent direct REST/RPC execution by public client roles.
revoke execute on function public.bgm_clear_cancellation_on_new_membership() from public, anon, authenticated;
revoke execute on function public.bgm_guard_cancelled_member_checkin() from public, anon, authenticated;
revoke execute on function public.bgm_guard_couples_pending_renewal() from public, anon, authenticated;
revoke execute on function public.bgm_protect_checkin_enrollment_snapshot() from public, anon, authenticated;
revoke execute on function public.bgm_snapshot_checkin_enrollment_gym() from public, anon, authenticated;
