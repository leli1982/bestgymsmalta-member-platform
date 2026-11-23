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
  const firstBracket = assigned.indexOf("[");
  const lastBracket = assigned.lastIndexOf("]");
  assert.ok(firstBracket >= 0 && lastBracket > firstBracket, `Missing ${variable}`);
  return JSON.parse(assigned.slice(firstBracket, lastBracket + 1));
}
function contains(source, snippet) {
  assert.ok(source.includes(snippet), `Missing required source: ${snippet}`);
}

test("latest source scope is complete, nonpersonal and excludes strict same-person candidates", () => {
  const keys = literalArray("sourceKeys");
  const identical = literalArray("samePersonCandidates");
  const manuallyRemoved = literalArray("manuallyExcluded");
  const manualStrong = literalArray("confidentlyExcluded");
  assert.equal(keys.length, 178);
  assert.equal(new Set(keys).size, 178);
  assert.equal(identical.length, 28);
  assert.equal(manuallyRemoved.length, 8);
  assert.equal(manualStrong.length, 4);
  for (const key of [...identical, ...manuallyRemoved]) assert.ok(keys.includes(key));
  assert.equal(keys.filter((key) => !identical.includes(key) && !manualStrong.includes(key)).length, 146);
  assert.ok(!scope.includes("@gmail.com"));
  assert.ok(!scope.includes("date_of_birth"));
});

test("only Super Admin reads/records review decisions, never mutates members or cards", () => {
  contains(route, "requireSuperAdmin(request)");
  contains(route, "getSupabaseAdmin()");
  contains(route, "sourceDuplicateGroups");
  contains(route, "bgm_source_duplicate_review_decisions");
  contains(route, "bgm_audit_log");
  contains(route, "hasLiveIdentityConflict");
  contains(route, "real_import_batch_id");
  for (const verb of ["update", "upsert", "insert", "delete"]) {
    assert.ok(!route.includes('.from("bgm_members").' + verb + "("));
  }
  assert.ok(!route.includes("bgm_super_admin_change_legacy_card"));
});

test("new list replaces main page, existing Scan3 conflict handling remains separate", () => {
  const mainPage = read("../app/staff/admin/card-conflicts/page.tsx");
  const cardsPage = read("../app/staff/admin/card-conflicts/cards/page.tsx");
  contains(mainPage, "SourceDuplicateReview");
  contains(cardsPage, "CardConflictReview");
  contains(ui, "mark_reviewed");
  contains(ui, "Never archive a record based on pkCustomer alone");
  contains(physicalCards, "bgm_active_card_conflicts");
});

test("review decision table cannot be read by ordinary members", () => {
  contains(migration, "enable row level security");
  contains(migration, "from public, anon, authenticated");
  contains(migration, "to service_role");
  assert.ok(!migration.includes("delete from public.bgm_members"));
  assert.ok(!migration.includes("update public.bgm_members"));
});
