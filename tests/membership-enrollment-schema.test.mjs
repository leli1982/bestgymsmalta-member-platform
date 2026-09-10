import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260910_100000_membership_enrollment_activation.sql",
  import.meta.url
);

function migrationSource() {
  return fs.readFileSync(migrationUrl, "utf8");
}

test("membership applications distinguish new memberships from renewals", () => {
  const migration = migrationSource();
  assert.match(migration, /application_kind/i);
  assert.match(migration, /check\s*\([^)]*application_kind[^)]*new[^)]*renewal/is);
  assert.match(migration, /existing_member_id/i);
  assert.match(migration, /references\s+public\.bgm_members\s*\(id\)/i);
});

test("membership application stores explicit start and expiry dates without inventing duration arithmetic", () => {
  const migration = migrationSource();
  assert.match(migration, /add\s+column\s+if\s+not\s+exists\s+start_date\s+date/i);
  assert.match(migration, /add\s+column\s+if\s+not\s+exists\s+expiry_date\s+date/i);
  assert.match(migration, /expiry_date\s*>?=\s*start_date/i);
});

test("activation is a single transactional database function with required Activation Staff Name", () => {
  const migration = migrationSource();
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.bgm_activate_membership_application/i);
  assert.match(migration, /btrim\(p_activation_staff_name\).*<>\s*''|p_activation_staff_name.*required/is);
  assert.match(migration, /for\s+update/i);
  assert.match(migration, /insert\s+into\s+public\.bgm_memberships/i);
  assert.match(migration, /insert\s+into\s+public\.bgm_membership_members/i);
  assert.match(migration, /payment_received_at/i);
  assert.match(migration, /activated_at/i);
});

test("new activation allocates members through the database default while renewal reuses existing_member_id", () => {
  const migration = migrationSource();
  assert.match(migration, /application_kind\s*=\s*'new'/i);
  assert.match(migration, /application_kind\s*=\s*'renewal'/i);
  assert.match(migration, /insert\s+into\s+public\.bgm_members\s*\([^)]*(?!member_number)/is);
  assert.match(migration, /existing_member_id/i);
  assert.match(migration, /update\s+public\.bgm_members[\s\S]*membership_expiry/i);
});

test("activation audit records the activating system user and human Staff Name", () => {
  const migration = migrationSource();
  assert.match(migration, /insert\s+into\s+public\.bgm_audit_log/i);
  assert.match(migration, /p_system_user_id/i);
  assert.match(migration, /p_activation_staff_name/i);
  assert.match(migration, /membership\.activate/i);
});

test("server-only activation function is not executable by PUBLIC", () => {
  const migration = migrationSource();
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.bgm_activate_membership_application[^;]+from\s+public/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.bgm_activate_membership_application[^;]+to\s+service_role/i);
});
