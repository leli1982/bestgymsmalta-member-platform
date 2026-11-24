import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20261124_160000_reactivate_on_super_admin_membership_date_correction.sql", import.meta.url),
  "utf8"
);

test("date correction restores an inactive member only within Malta's paid membership period", () => {
  assert.match(sql, /v_today date := \(now\(\) at time zone 'Europe\/Malta'\)::date/);
  assert.match(sql, /v_member.status = 'inactive'/);
  assert.match(sql, /p_expiry_date >= v_today/);
  assert.match(sql, /p_start_date is null or p_start_date <= v_today/);
  assert.equal((sql.match(/status = case when v_auto_activate then 'active' else status end/g)||[]).length, 2);
  assert.equal((sql.match(/or v_auto_activate\);/g)||[]).length, 2);
});

test("date correction never bypasses cancellation, archive or linked membership rules", () => {
  assert.match(sql, /v_member.archived_at is null/);
  assert.match(sql, /v_member.cancellation_effective_date is null/);
  assert.match(sql, /v_member.cancellation_effective_date > v_today/);
  assert.match(sql, /v_auto_activate := v_auto_activate and v_membership.status = 'active'/);
  assert.match(sql, /v_participants <> 1/);
  assert.match(sql, /v_current_matches <> 1/);
  assert.match(sql, /v_membership.status = 'cancelled'/);
});

test("date and automatic status changes stay atomic, audited and Super Admin only", () => {
  assert.match(sql, /is_super_admin = true/);
  assert.match(sql, /updated_at is distinct from p_expected_member_updated_at/);
  assert.match(sql, /v_membership.updated_at is distinct from p_expected_membership_updated_at/);
  assert.match(sql, /'memberStatus', v_member.status/);
  assert.match(sql, /'memberStatus', v_after.status/);
  assert.match(sql, /'autoActivated', v_auto_activate/);
  assert.match(sql, /insert into public.bgm_audit_log/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /update public\.bgm_membership_applications|update public\.bgm_member_card_credentials|update public\.bgm_member_checkins|delete from/i);
});
