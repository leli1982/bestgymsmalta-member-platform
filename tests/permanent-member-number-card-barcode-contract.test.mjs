import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const migrationPath = "supabase/migrations/20260918_123000_permanent_member_number_dual_barcode.sql";

test("legacy members receive permanent BGM numbers without losing duplicate pkCustomer values", () => {
  assert.equal(existsSync(join(root, migrationPath)), true);
  const sql = read(migrationPath);
  assert.equal(sql.includes("bgm_next_member_number()"), true);
  assert.equal(sql.includes("legacy_pk_customer"), true);
  assert.equal(sql.includes("duplicate legacy members"), true);
  assert.equal(sql.includes("^BGM[0-9]{7}$"), true);
  assert.equal(sql.includes("create unique index"), true);
  assert.equal(sql.includes("before insert or update of member_number"), true);
});

test("barcode reception resolves physical cards, BGM numbers and legacy pkCustomer values", () => {
  const route = read("app/api/system/barcode/scan/route.ts");
  const cardLookup = route.indexOf('from("bgm_member_card_credentials")');
  const memberLookup = route.indexOf('.eq("member_number", membershipNumber)');
  const legacyLookup = route.indexOf('.eq("legacy_pk_customer", membershipNumber)');
  assert.ok(cardLookup >= 0, "physical credential lookup must exist");
  assert.ok(memberLookup > cardLookup, "permanent member-number fallback must exist after physical-card lookup");
  assert.ok(legacyLookup > memberLookup, "legacy pkCustomer fallback must exist after BGM-number lookup");
  for (const token of [
    "credentialKind",
    "physical_card",
    "member_number",
    "legacy_pk_customer",
    "ambiguous_card",
    "legacyMatches",
  ]) {
    assert.equal(route.includes(token), true, `expected scan route to include ${token}`);
  }
});

test("member app barcode uses active physical card and displays BGM number separately", () => {
  const api = read("app/api/member/card/route.ts");
  const card = read("components/member/MemberCard.tsx");
  const state = read("lib/memberCardState.ts");

  assert.equal(api.includes("cardBarcode: activeCredential?.barcode_value || null"), true);
  assert.equal(api.includes("member_number"), true);
  assert.equal(card.includes("<MemberBarcode memberNumber={assignedCardNumber} />"), true);
  assert.match(card, /member\.memberNumber/);
  assert.doesNotMatch(card, /legacyPkCustomer|Legacy pkCustomer/);
  assert.match(card, /Card not assigned/);
  assert.equal(state.includes("physicalCardBarcode"), true);
});

test("staff home is always ready for a barcode scan without opening Reception", () => {
  const dashboard = read("components/staff/StaffDashboard.tsx");
  const scanner = read("components/staff/StaffHomeScanner.tsx");
  assert.equal(dashboard.includes("StaffHomeScanner"), true);
  assert.equal(scanner.includes("/api/system/barcode/scan"), true);
  assert.equal(scanner.includes("Barcode scanner input"), true);
  assert.equal(scanner.includes("READY TO SCAN"), true);
  assert.equal(scanner.includes("autoFocus"), true);
  assert.equal(scanner.includes("ACCESS GRANTED"), true);
  assert.equal(scanner.includes("MEMBERSHIP EXPIRED"), true);
});

test("new/replaced physical cards synchronize pkCustomer while BGM number remains permanent", () => {
  const sql = read("supabase/migrations/20260918_131000_pkcustomer_current_card_semantics.sql");
  for (const token of [
    "bgm_member_card_credentials",
    "legacy_pk_customer",
    "barcode_value",
    "after insert or update",
    "status = 'active'",
    "ambiguous_card",
  ]) {
    assert.equal(sql.toLowerCase().includes(token.toLowerCase()), true, `expected card semantics migration to include ${token}`);
  }
});

test("legacy 15-column import keeps pkCustomer as the old barcode without requiring global uniqueness", () => {
  const core = read("lib/memberExchangeCore.ts");
  const importServer = read("lib/memberImportServer.ts");
  assert.equal(core.includes("pkCustomer"), true);
  assert.equal(importServer.includes("legacy_pk_customer"), true);
  assert.equal(importServer.includes("legacyPk = normalizeBarcodePayload(v.pkCustomer)"), true);
  assert.equal(importServer.includes("pk_customer: nullable(v.pkCustomer)"), true);
  assert.doesNotMatch(importServer, /pkCustomer.*globally unique/i);
});
