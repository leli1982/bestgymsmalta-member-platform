import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const memberCard = fs.readFileSync(new URL("../app/api/member/card/route.ts", import.meta.url), "utf8");
const staffScan = fs.readFileSync(new URL("../app/api/system/barcode/scan/route.ts", import.meta.url), "utf8");
const staffSearch = fs.readFileSync(new URL("../app/api/system/members/search/route.ts", import.meta.url), "utf8");

test("member app prefers a modern active card and falls back to imported legacy Scan3", () => {
  assert.match(memberCard, /credential\.status === "active"/);
  assert.match(memberCard, /from\("bgm_legacy_card_claims"\)/);
  assert.match(memberCard, /eq\("assignment_status", "active"\)/);
  assert.match(memberCard, /currentCardBarcode/);
  assert.match(memberCard, /legacy_card_claim/);
  assert.match(memberCard, /member: publicMemberProfile/);
  assert.doesNotMatch(memberCard, /cardBarcode: memberNumber/);
});

test("staff scanner resolves both the current card and the friendly number into canonical gym checkins", () => {
  assert.match(staffScan, /from\("bgm_member_card_credentials"\)/);
  assert.match(staffScan, /eq\("barcode_value", membershipNumber\)/);
  assert.match(staffScan, /eq\("member_number", membershipNumber\)/);
  assert.match(staffScan, /card\.status !== "active"/);
  assert.match(staffScan, /memberId: member\.id,\s*gymId,\s*source: "barcode"/);
  assert.match(staffScan, /const gymId = auth\.context\.gymId \|\| requestedGymId/);
});

test("staff member browser searches modern cards, imported Scan3 cards and friendly BGM numbers", () => {
  assert.match(staffSearch, /eq\("member_number", exactMemberNumber\)/);
  assert.match(staffSearch, /from\("bgm_member_card_credentials"\)[\s\S]*?eq\("barcode_value", query\)[\s\S]*?eq\("status", "active"\)/);
  assert.match(staffSearch, /from\("bgm_legacy_card_claims"\)[\s\S]*?eq\("scan3", query\.toUpperCase\(\)\)[\s\S]*?eq\("assignment_status", "active"\)/);
  assert.match(staffSearch, /in\("id", cardMemberIds\)/);
  assert.match(staffSearch, /exactCardNumber: true/);
  assert.match(staffSearch, /legacyCardClaim:/);
  assert.match(staffSearch, /ambiguousCard:/);
});
