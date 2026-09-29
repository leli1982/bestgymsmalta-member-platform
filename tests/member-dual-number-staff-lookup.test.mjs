import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const memberCard = fs.readFileSync(new URL("../app/api/member/card/route.ts", import.meta.url), "utf8");
const staffScan = fs.readFileSync(new URL("../app/api/system/barcode/scan/route.ts", import.meta.url), "utf8");
const staffSearch = fs.readFileSync(new URL("../app/api/system/members/search/route.ts", import.meta.url), "utf8");

test("member app encodes only current active physical card and keeps the friendly BGM number separate", () => {
  assert.match(memberCard, /credential\.status === "active"/);
  assert.match(memberCard, /cardBarcode: activeCredential\?\.barcode_value \|\| null/);
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

test("staff member browser searches active card numbers as well as friendly BGM numbers", () => {
  assert.match(staffSearch, /eq\("member_number", exactMemberNumber\)/);
  assert.match(staffSearch, /from\("bgm_member_card_credentials"\)[\s\S]*?eq\("barcode_value", query\)[\s\S]*?eq\("status", "active"\)/);
  assert.match(staffSearch, /in\("id", cardMemberIds\)/);
  assert.match(staffSearch, /exactCardNumber: true/);
});
