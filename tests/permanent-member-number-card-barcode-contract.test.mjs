import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const migrationPath = "supabase/migrations/20260918_123000_permanent_member_number_dual_barcode.sql";

test("legacy members receive permanent BGM numbers without losing their physical card barcode", () => {
  assert.equal(existsSync(join(root, migrationPath)), true);
  const sql = read(migrationPath);
  assert.match(sql, /bgm_next_member_numbers*(/i);
  assert.match(sql, /legacy_pk_customer/i);
  assert.match(sql, /duplicate legacy members/i);
  assert.match(sql, /^BGM[0-9]{7}$/i);
  assert.match(sql, /member_number/i);
  assert.match(sql, /unique index/i);
  assert.match(sql, /before insert or update/i);
});

test("barcode reception resolves physical cards, BGM numbers and legacy pkCustomer values", () => {
  const route = read("app/api/system/barcode/scan/route.ts");
  const cardLookup = route.indexOf('from("bgm_member_card_credentials")');
  const memberLookup = route.indexOf('.eq("member_number", membershipNumber)');
  const legacyLookup = route.indexOf('.eq("legacy_pk_customer", membershipNumber)');
  assert.ok(cardLookup >= 0, "physical credential lookup must exist");
  assert.ok(memberLookup > cardLookup, "permanent member-number fallback must exist after physical-card lookup");
  assert.ok(legacyLookup > memberLookup, "legacy pkCustomer fallback must exist after BGM-number lookup");
  assert.match(route, /credentialKind/);
  assert.match(route, /physical_card/);
  assert.match(route, /member_number/);
  assert.match(route, /legacy_pk_customer/);
  assert.match(route, /ambiguous_card/);
  assert.match(route, /legacyMatches/);
});

test("member app virtual barcode is the permanent BGM member number while physical card stays separate", () => {
  const api = read("app/api/member/card/route.ts");
  const card = read("components/member/MemberCard.tsx");
  const state = read("lib/memberCardState.ts");

  assert.match(api, /cardBarcode:s*memberNumber/);
  assert.match(api, /physicalCardBarcode/);
  assert.match(api, /member_number/);
  assert.match(card, /MemberBarcodes+memberNumber={cardBarcode}/);
  assert.match(card, /BGM member number/i);
  assert.match(card, /Physical card/i);
  assert.match(state, /physicalCardBarcode/);
});

test("staff home is always ready for a barcode scan without opening Reception", () => {
  const dashboard = read("components/staff/StaffDashboard.tsx");
  const scanner = read("components/staff/StaffHomeScanner.tsx");
  assert.match(dashboard, /StaffHomeScanner/);
  assert.match(scanner, //api/system/barcode/scan/);
  assert.match(scanner, /Barcode scanner input/);
  assert.match(scanner, /READY TO SCAN/);
  assert.match(scanner, /autoFocus/);
  assert.match(scanner, /ACCESS GRANTED/);
  assert.match(scanner, /MEMBERSHIP EXPIRED/);
});


test("new/replaced physical cards synchronize pkCustomer while BGM number remains permanent", () => {
  const sql = read("supabase/migrations/20260918_131000_pkcustomer_current_card_semantics.sql");
  assert.match(sql, /bgm_member_card_credentials/i);
  assert.match(sql, /legacy_pk_customer/i);
  assert.match(sql, /barcode_value/i);
  assert.match(sql, /after insert or update/i);
  assert.match(sql, /status = 'active'/i);
  assert.match(sql, /ambiguous_card/i);
});

test("legacy 15-column import keeps pkCustomer as the old barcode without rejecting duplicate active members", () => {
  const core = read("lib/memberExchangeCore.ts");
  const importServer = read("lib/memberImportServer.ts");
  assert.match(core, /pkCustomer/);
  assert.match(importServer, /legacy_pk_customer/);
  assert.doesNotMatch(importServer, /pkCustomer.*globally unique/i);
});
