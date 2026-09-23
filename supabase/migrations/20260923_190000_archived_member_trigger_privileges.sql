-- Trigger helpers are internal-only; ordinary API roles must not invoke security-definer functions.
revoke all on function public.bgm_guard_archived_member_status() from public, anon, authenticated;
revoke all on function public.bgm_guard_archived_member_membership_link() from public, anon, authenticated;
