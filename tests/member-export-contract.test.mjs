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

test("membership export writes optional CardBarcode from active credentials", () => {
  assert.match(source, /CardBarcode/);
  assert.match(source, /bgm_member_card_credentials/);
  assert.match(source, /status.*active/s);
  assert.doesNotMatch(source, /values\.MembershipNumber/);
});
