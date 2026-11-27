import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const memberCard = fs.readFileSync(new URL("../app/api/member/card/route.ts", import.meta.url), "utf8");
const staffScan = fs.readFileSync(new URL("../app/api/system/barcode/scan/route.ts", import.meta.url), "utf8");
const staffSearch = fs.readFileSync(new URL("../app/api/system/members/search/route.ts", import.meta.url), "utf8");

test("member app encodes only current active physical card and keeps the friendly BGM number separate", () => {
  assert.match(memberCard, /credential\.status === "active"/);
  assert.match(memberCard, /cardBarcode: activeCredential\?\.barcode_value \|\| null/);
  assert.match(memberCard, /\.\.\.publicMemberProfile\(memberResult\.data\)/);
  assert.match(memberCard, /membershipType/);
  assert.doesNotMatch(memberCard, /cardBarcode: memberNumber/);
});

test("staff scanner resolves both the current card and the friendly number into canonical gym checkins", () => {
  assert.match(staffScan, /from\("bgm_member_card_credentials"\)/);
  assert.match(staffScan, /ilike\("barcode_value", exact\)/);
  assert.match(staffScan, /ilike\("member_number", membershipNumber\.replace/);
  assert.match(staffScan, /card\.status !== "active"/);
  assert.match(staffScan, /memberId: member\.id,\s*gymId,\s*source: "barcode"/);
  assert.match(staffScan, /const gymId = auth\.context\.gymId \|\| requestedGymId/);
});

test("staff member browser searches active card numbers as well as friendly BGM numbers", () => {
  assert.match(staffSearch, /eq\("member_number", exactMemberNumber\)/);
  assert.match(staffSearch, /from\("bgm_member_card_credentials"\)[\s\S]*?ilike\("barcode_value", escapeLikePattern\(query\)\)[\s\S]*?eq\("status", "active"\)/);
  assert.match(staffSearch, /in\("id", cardMemberIds\)/);
  assert.match(staffSearch, /exactCardNumber: true/);
});

test("partial numeric staff search aggregates member number and legacy pkCustomer matches", () => {
  assert.doesNotMatch(staffSearch, /exactLegacyPkCustomer:\s*true/);
  assert.match(staffSearch, /ilike\("member_number", pattern\)/);
  assert.match(staffSearch, /ilike\("legacy_pk_customer", pattern\)/);
});

test("case-insensitive scanner retains all active credential owners for conflict detection", () => {
  assert.match(staffScan, /new Set\(activeCards\.map\(row => row\.member_id\)/);
  assert.match(staffScan, /existingOwnerIds.length > 1/);
  assert.match(staffScan, /ambiguousPhysicalCard = true/);
});

test("staff name lookup requires every name term independently of word order", () => {
  assert.match(staffSearch, /const nameTerms = Array.from\(new Set\(query.toLowerCase\(\).split/);
  assert.match(staffSearch, /for \(const term of nameTerms\)/);
  assert.match(staffSearch, /nameQuery = nameQuery.ilike\("full_name",/);
  assert.match(staffSearch, /nameQuery.order\("full_name"/);
});

test("permanent and legacy number lookups are literal case-insensitive matches and preserve conflicts", () => {
  for (const field of ["member_number", "legacy_pk_customer"]) {
    assert.ok(staffScan.includes('.ilike("' + field + '", membershipNumber.replace'));
    assert.ok(!staffScan.includes('.eq("' + field + '", membershipNumber)'));
  }
  assert.match(staffScan, /if \(\(memberNumberResult\.data \|\| \[\]\)\.length > 1\) \{\s*cardMatches = memberNumberResult\.data \|\| \[\];\s*ambiguousPhysicalCard = true/);
  assert.match(staffScan, /if \(legacyMembers\.length > 1\) \{\s*cardMatches = legacyMembers;\s*ambiguousPhysicalCard = true/);
  assert.match(staffScan, /else if \(ambiguousPhysicalCard\) \{\s*decision = \{ result: "ambiguous_card", granted: false \}/);
});
