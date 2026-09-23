import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("new checkins snapshot a member's enrollment gym in the insert transaction and never backfill old visits", () => {
  const sql = read("supabase/migrations/20260923_100000_member_gym_visit_snapshot.sql");
  assert.match(sql, /add column if not exists enrollment_gym_id_at_checkin text/);
  assert.match(sql, /add column if not exists enrollment_snapshot_recorded boolean not null default false/);
  assert.match(sql, /before insert on public\.bgm_member_checkins/);
  assert.match(sql, /for share/);
  assert.match(sql, /new\.enrollment_gym_id_at_checkin := v_enrollment_gym/);
  assert.match(sql, /new\.enrollment_snapshot_recorded := true/);
  assert.match(sql, /before update on public\.bgm_member_checkins/);
  assert.match(sql, /Recorded enrollment gym of an existing visit cannot be changed/);
  assert.doesNotMatch(sql, /update public\.bgm_member_checkins\s+set/i);
  const service = read("lib/checkinService.ts");
  assert.match(service, /\.from\("bgm_member_checkins"\)/);
  assert.match(service, /member_id: memberId,\s*gym_id: gymId,\s*source/);
});

test("Super Admin gym reassignment only changes the person-level current gym after locking and auditing", () => {
  const sql = read("supabase/migrations/20260923_100000_member_gym_visit_snapshot.sql");
  assert.match(sql, /is_super_admin = true and active = true/);
  assert.match(sql, /select \* into v_before from public\.bgm_members[\s\S]*?for update/);
  assert.match(sql, /updated_at is distinct from p_expected_updated_at/);
  assert.match(sql, /enrollment_gym_id = p_new_gym_id, updated_at = clock_timestamp\(\)/);
  assert.match(sql, /member\.enrollment_gym\.change/);
  assert.match(sql, /before_data, after_data/);
  assert.match(sql, /grant execute on function public\.bgm_super_admin_change_member_enrollment_gym/);
  assert.doesNotMatch(sql, /update public\.bgm_memberships|update public\.bgm_membership_applications|set legacy_gym\s*=/i);
  assert.doesNotMatch(sql, /delete from public\.bgm_member_checkins/i);
});

test("gym reassignment has a dedicated Super Admin-only route and a separate UI save action", () => {
  const route = read("app/api/system/admin/members/[memberId]/enrollment-gym/route.ts");
  const profileRoute = read("app/api/system/admin/members/[memberId]/route.ts");
  const ui = read("components/staff/SuperAdminMemberEditor.tsx");
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /Object\.keys\(body\)\.sort\(\)\.join\(","\) !== "enrollmentGymId,expectedUpdatedAt"/);
  assert.match(route, /bgm_super_admin_change_member_enrollment_gym/);
  assert.match(route, /p_expected_updated_at: body\.expectedUpdatedAt/);
  assert.match(ui, /Save enrollment gym/);
  assert.match(ui, /!gymSelection \|\| changed/);
  assert.match(ui, /changed \|\| dateChanged \|\| cancelDraftDirty \|\| saving \|\| gymSaving \|\| dateSaving \|\| cancelBusy \|\| loading/);
  assert.match(ui, /Original enrollment gym \(Excel\)/);
  assert.match(ui, /Visits recorded before snapshots existed have unverified historical origin/);
  assert.doesNotMatch(profileRoute, /p_new_gym_id/);
});
