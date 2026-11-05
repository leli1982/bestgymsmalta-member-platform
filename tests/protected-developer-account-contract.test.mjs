import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createDeveloperRecoveryToken, developerRecoveryBaseUrl, developerRecoveryDestinations,
  validDeveloperPassword, validDeveloperRecoveryToken,
} from "../lib/developerRecoveryCore.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261105_163000_protected_developer_account_and_recovery.sql");

test("Developer recovery uses 256-bit single-use random tokens and 14+ character passwords", () => {
  const a = createDeveloperRecoveryToken();
  const b = createDeveloperRecoveryToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.tokenHash.length, 64);
  assert.equal(validDeveloperRecoveryToken(a.token), true);
  assert.equal(validDeveloperRecoveryToken("invalid"), false);
  assert.equal(validDeveloperPassword("short"), false);
  assert.equal(validDeveloperPassword("ThisIsALongerPassword123"), true);
});

test("Primary and backup recovery addresses are private and deduplicated", () => {
  assert.deepEqual(developerRecoveryDestinations({
    BGM_DEVELOPER_RECOVERY_EMAIL: "ONE@example.org",
    BGM_DEVELOPER_RECOVERY_BACKUP_EMAIL: "two@example.net",
  }), ["one@example.org", "two@example.net"]);
  assert.deepEqual(developerRecoveryDestinations({
    BGM_DEVELOPER_RECOVERY_EMAIL: "one@example.org",
    BGM_DEVELOPER_RECOVERY_BACKUP_EMAIL: "ONE@example.org",
  }), ["one@example.org"]);
  assert.deepEqual(developerRecoveryDestinations({
    BGM_DEVELOPER_RECOVERY_EMAIL: "bad-address",
    BGM_DEVELOPER_RECOVERY_BACKUP_EMAIL: "two@example.net",
  }), ["two@example.net"]);
  const route = read("app/api/system/developer/recovery/route.ts");
  assert.ok(route.includes("for (const destination of destinations)"));
  assert.ok(route.includes("if (delivered === 0)"));
  assert.match(route, /developerRecoveryDestinations/);
});

test("Recovery links are derived only from approved deployment URLs", () => {
  assert.equal(developerRecoveryBaseUrl({ VERCEL_ENV: "production" }), "https://bestgymsmalta-member-platform.vercel.app");
  assert.equal(developerRecoveryBaseUrl({ VERCEL_ENV: "preview", VERCEL_URL: "valid-preview.vercel.app" }), "https://valid-preview.vercel.app");
  assert.equal(developerRecoveryBaseUrl({ VERCEL_ENV: "preview", VERCEL_URL: "evil.com/path" }), null);
});

test("Developer account is hidden from ordinary Super Admin list and cannot be patched", () => {
  const users = read("app/api/admin/system-users/route.ts");
  assert.match(users, /\.eq\("is_protected_developer", false\)/);
  assert.match(users, /currentResult\.data\.is_protected_developer/);
  assert.match(users, /status: 404/);
  assert.match(migration, /before update or delete on public\.bgm_system_users/);
  assert.match(migration, /new\.active is distinct from old\.active/);
  assert.match(migration, /new\.password_hash is distinct from old\.password_hash/);
  assert.match(migration, /is_protected_developer = true/);
});

test("Recovery is email-controlled, atomic, one-time and not accessible to public roles", () => {
  const route = read("app/api/system/developer/recovery/route.ts");
  assert.match(read("lib/developerRecoveryCore.ts"), /BGM_DEVELOPER_RECOVERY_EMAIL/);
  assert.match(route, /bgm_consume_developer_password_reset/);
  assert.match(route, /15 \* 60 \* 1000/);
  assert.match(migration, /for update;/);
  assert.match(migration, /used_at is null/);
  assert.match(migration, /revoke all on function public\.bgm_consume_developer_password_reset/);
  assert.match(migration, /to service_role/);
});

test("Developer password recovery invalidates earlier Developer sessions", () => {
  const auth = read("lib/systemAuth.ts");
  assert.match(auth, /developer_password_changed_at/);
  assert.match(auth, /session\.issuedAt/);
  assert.match(migration, /developer_password_changed_at=clock_timestamp\(\)/);
});

test("Protected Developer feature branch is TEST-only in Preview", () => {
  assert.match(read("lib/supabaseAdminConfig.ts"), /feature\/protected-developer-account/);
});
