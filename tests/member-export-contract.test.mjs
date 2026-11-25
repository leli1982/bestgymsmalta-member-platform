import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../app/api/admin/members/export/route.ts", import.meta.url),
  "utf8"
);

test("membership export supports XLSX and CSV exchange formats", () => {
  assert.match(source, /MEMBER_EXCHANGE_HEADERS/);
  assert.match(source, /format.*xlsx/s);
  assert.match(source, /format.*csv/s);
  assert.match(source, /members\.export/);
  assert.doesNotMatch(source, /memberNumber,fullName,email,phone,status/);
});

test("membership export retains permanent BGM number and physical card and legacy customer ID in separate fields", () => {
  assert.match(source, /MembershipNumber/);
  assert.match(source, /values\.pkCustomer = text\(member\.legacy_pk_customer\)/);
  assert.match(source, /values\.CardBarcode = cardBarcode/);
  assert.match(source, /EXPORT_HEADERS = \[\.\.\.MEMBER_EXCHANGE_HEADERS, "CardBarcode"\]/);
  assert.match(source, /serializeMemberExchangeCsv\(rows, EXPORT_HEADERS\)/);
  assert.match(source, /buildMemberExchangeXlsx\(rows, EXPORT_HEADERS\)/);
  assert.match(source, /bgm_member_card_credentials/);
  assert.match(source, /status.*active/s);
  assert.match(source, /values\.MembershipNumber = member\.member_number/);
  assert.doesNotMatch(source, /values\.MembershipNumber = cardBarcode/);
});


test("membership export derives ValidYN from effective membership state, not raw status alone", () => {
  assert.match(source, /evaluateBarcodeAccess/);
  assert.match(source, /membershipExpiry: member\.membership_expiry/);
  assert.match(source, /cancellationEffectiveDate: member\.cancellation_effective_date/);
  assert.match(source, /effectiveStatus\.granted \? "Valid" : "Not Valid"/);
  assert.doesNotMatch(source, /member\.status === "active" \? "Valid" : "Not Valid"/);
});
