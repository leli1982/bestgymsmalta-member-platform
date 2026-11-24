import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (file) => fs.readFileSync(join(root, file), "utf8");
const list = read("lib/scopedCardConflictCandidates.ts");
const api = read("app/api/system/card-conflicts/assign/route.ts");
const scan = read("app/api/system/barcode/scan/route.ts");
const cards = read("components/staff/CardConflictCards.tsx");

test("recovery is restricted to exactly the 32 frozen members", () => {
  const names = list.slice(list.indexOf("SCOPED_CARD_CONFLICT_MEMBERS"), list.indexOf("] as const"));
  const numbers = [...names.matchAll(/BGM\d+/g)].map(m => m[0]);
  assert.equal(numbers.length, 32);
  assert.equal(new Set(numbers).size, 32);
  assert.ok(numbers.includes("BGM26592"));
  assert.ok(numbers.includes("BGM27092"));
  assert.ok(numbers.includes("BGM1000"));
  assert.ok(!numbers.includes("BGM12599")); // unrelated existing card owner
  assert.match(list, /isScopedConflictMember/);
  assert.match(list, /scopedConflictCandidates/);
});

test("normal scans remain unchanged outside the scoped source identifiers", () => {
  assert.match(scan, /scopedConflictCandidates\(originalPayload\)/);
  assert.match(scan, /scopedCandidates\.length/);
  assert.match(scan, /if \(!ambiguousPhysicalCard\)/);
  assert.match(scan, /const scopedOwner/);
  assert.match(scan, /if \(scopedCandidates\.length && !scopedOwner\)/);
});

test("staff can only confirm a recent scan in their own session and gym", () => {
  assert.match(api, /requireSystemPermission\(request, "barcode.scan"\)/);
  assert.match(api, /scan\.result !== "ambiguous_card"/);
  assert.match(api, /scan\.system_user_id !== auth\.context\.systemUserId/);
  assert.match(api, /scan\.gym_id !== auth\.context\.gymId/);
  assert.match(api, /age > 10 \* 60_000/);
  assert.match(api, /body\.confirmed !== true/);
});

test("no other member card can be removed or transferred", () => {
  assert.match(api, /candidateNumbers\.includes\(member\.member_number\)/);
  assert.match(api, /allCurrentOwners\.size > 0/);
  assert.match(api, /This physical card is already assigned to another member/);
  // Rollback is permitted only for the exact NEW credential created by this request.
  assert.match(api, /\.delete\(\)\.eq\("id", assign\.data\.id\)\.eq\("member_id", member\.id\)/);
  assert.doesNotMatch(api, /\.update\(\{\s*status:\s*"retired"/);
  assert.match(api, /evaluateBarcodeAccess/);
  assert.match(api, /recordCanonicalCheckin/);
  assert.match(api, /bgm_audit_log/);
});

test("confirmation buttons appear on all existing staff scan surfaces", () => {
  assert.match(cards, /Assign this card & check in/);
  assert.match(cards, /window\.confirm/);
  assert.match(cards, /isScopedCandidate/);
  assert.match(cards, /isExistingCardOwner/);
  for (const surface of [
    "components/staff/StaffHomeScanner.tsx",
    "components/staff/StaffGlobalScanner.tsx",
    "components/staff/BarcodeReceptionPage.tsx",
  ]) {
    assert.match(read(surface), /<CardConflictCards/);
    assert.match(read(surface), /onResolved=/);
  }
});

test("database allows pending conflict state without changing access decisions", () => {
  const migration = read("supabase/migrations/20261124_183000_scoped_scan3_conflict_result.sql");
  assert.match(migration, /'ambiguous_card'/);
  assert.match(migration, /'granted'/);
  assert.match(migration, /'restricted_gym'/);
});
