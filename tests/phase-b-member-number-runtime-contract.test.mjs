import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const oldFixedWidthPattern = /\^BGM\[0-9\]\{7\}\$/;

test("member card validates the permanent BGM number through the shared canonical core", () => {
  const route = read("app/api/member/card/route.ts");
  assert.match(route, /@\/lib\/memberNumberCore/);
  assert.match(route, /parseMembershipNumber|MEMBERSHIP_NUMBER_PATTERN/);
  assert.doesNotMatch(route, oldFixedWidthPattern);
});

test("Super Admin permanent-delete confirmation uses canonical BGM validation", () => {
  const route = read("app/api/system/admin/members/[memberId]/delete/route.ts");
  assert.match(route, /@\/lib\/memberNumberCore/);
  assert.match(route, /parseMembershipNumber|MEMBERSHIP_NUMBER_PATTERN/);
  assert.doesNotMatch(route, oldFixedWidthPattern);
  assert.match(route, /confirmedMemberNumber/);
});

test("member import validation uses the shared canonical BGM core", () => {
  const source = read("lib/memberImportServer.ts");
  assert.match(source, /@\/lib\/memberNumberCore/);
  assert.match(source, /parseMembershipNumber|MEMBERSHIP_NUMBER_PATTERN/);
  assert.doesNotMatch(source, oldFixedWidthPattern);
  assert.match(source, /legacy_pk_customer/);
  assert.match(source, /legacy_scan3/);
});

test("existing member-number entry points remain on shared normalization and parsing", () => {
  const login = read("app/api/member/auth/login/route.ts");
  const adminMembers = read("app/api/admin/members/route.ts");
  const staffSearch = read("app/api/system/members/search/route.ts");

  assert.match(login, /@\/lib\/memberNumberCore/);
  assert.match(login, /normalizeMembershipNumber/);
  assert.match(adminMembers, /parseMembershipNumber/);
  assert.match(staffSearch, /parseMembershipNumber/);
});

test("Phase B does not couple permanent BGM numbers to physical-card credential values", () => {
  const cardRoute = read("app/api/member/card/route.ts");
  const scanner = read("app/api/system/barcode/scan/route.ts");

  assert.match(cardRoute, /activeCredential\?\.barcode_value/);
  assert.match(scanner, /bgm_member_card_credentials/);
  assert.match(scanner, /legacy_pk_customer/);
  assert.match(scanner, /member_number/);
  assert.doesNotMatch(cardRoute, /barcode_value\s*[:=]\s*memberNumber/);
});
