import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const scope = read("../lib/sourceDuplicateReviewScope.ts");
const route = read("../app/api/system/admin/source-duplicates/route.ts");
const ui = read("../components/staff/SourceDuplicateReview.tsx");
const physicalCards = read("../app/api/system/admin/card-conflicts/route.ts");
const migration = read("../supabase/migrations/20261123_120000_source_duplicate_identity_review_decisions.sql");

function literalArray(variable) {
  const assigned = scope.split(`const ${variable} = `)[1]?.split(";")[0] || "";
  const match = assigned.match(/\\[[\\s\\S]*\\]/);
  assert.ok(match, `Missing ${variable}`);
  return JSON.parse(match[0]);
}

test("latest source review scope is complete, nonpersonal and excludes strict same-person duplicates", () => {
  const keys = literalArray("sourceKeys");
  const identical = literalArray("samePersonCandidates"); // wrapped in new Set()
  const manuallyRemoved = literalArray("manuallyExcluded");
  const manualStrong = literalArray("confidentlyExcluded");
  assert.equal(keys.length, 178);
  assert.equal(new Set(keys).size, 178);
  assert.equal(identical.length, 28);
  assert.equal(manuallyRemoved.length, 8);
  assert.equal(manualStrong.length, 4);
  for (const key of [...identical, ...manuallyRemoved]) assert.ok(keys.includes(key));
  assert.equal(keys.filter((key) => !identical.includes(key) && !manualStrong.includes(key)).length, 146);
  assert.doesNotMatch(scope, /@(?:gmail|hotmail|icloud)\\.com|date_of_birth|phone\\s*:/i);
});

test("only Super Admin reads and records identity decisions, never mutates members or cards", () => {
  assert.match(route, /requireSuperAdmin\\(request\\)/g);
  assert.match(route, /getSupabaseAdmin\\(\\)/);
  assert.match(route, /sourceDuplicateGroups/);
  assert.match(route, /bgm_source_duplicate_review_decisions/);
  assert.match(route, /bgm_audit_log/);
  assert.doesNotMatch(route, /\\.from\\(["']bgm_members["']\\)\\.(?:update|upsert|insert|delete)/);
  assert.doesNotMatch(route, /bgm_super_admin_change_legacy_card/);
  assert.match(route, /hasLiveIdentityConflict/);
  assert.match(route, /real_import_batch_id/);
});

test("UI replaces main list but preserves physical-card incident review separately", () => {
  const mainPage = read("../app/staff/admin/card-conflicts/page.tsx");
  const cardsPage = read("../app/staff/admin/card-conflicts/cards/page.tsx");
  assert.match(mainPage, /SourceDuplicateReview/);
  assert.match(cardsPage, /CardConflictReview/);
  assert.match(ui, /mark_reviewed/);
  assert.match(ui, /Never archive a record based on pkCustomer alone/);
  assert.match(physicalCards, /bgm_active_card_conflicts/);
});

test("new review decisions table denies public reads and never alters live memberships", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all .* from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update .* to service_role/);
  assert.doesNotMatch(migration, /(?:delete|update|truncate)\\s+public\\.bgm_members/i);
});
