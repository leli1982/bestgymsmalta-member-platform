import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20261124_161000_reconcile_inactive_unexpired_legacy_members.sql", import.meta.url), "utf8"
);
test("one-time correction only reactivates uncancelled, unarchived, currently valid legacy records", () => {
  assert.match(sql, /m.status = 'inactive'/);
  assert.match(sql, /m.membership_expiry >= \(now\(\) AT TIME ZONE 'Europe\/Malta'\)::date/);
  assert.match(sql, /m.archived_at IS NULL/);
  assert.match(sql, /m.cancellation_effective_date IS NULL/);
  assert.match(sql, /m.cancellation_effective_date > \(now\(\) AT TIME ZONE 'Europe\/Malta'\)::date/);
  assert.match(sql, /m.enrollment_date IS NULL/);
  assert.match(sql, /m.enrollment_date <= \(now\(\) AT TIME ZONE 'Europe\/Malta'\)::date/);
  assert.match(sql, /NOT EXISTS \(/);
  assert.match(sql, /public.bgm_membership_members mm/);
});
test("reconciliation is auditable, idempotent and does not modify related records", () => {
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /m.updated_at = e.old_updated_at/);
  assert.match(sql, /status = 'active'/);
  assert.match(sql, /public.bgm_audit_log/);
  assert.match(sql, /member.membership_dates.status.reconcile/);
  assert.match(sql, /'autoActivated', true/);
  assert.doesNotMatch(sql, /update public\.bgm_memberships|update public\.bgm_member_card_credentials|update public\.bgm_member_checkins|delete from/i);
});
