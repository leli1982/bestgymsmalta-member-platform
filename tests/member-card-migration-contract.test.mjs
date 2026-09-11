import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";
import { MEMBER_EXCHANGE_HEADERS } from "../lib/memberExchangeCore.ts";
import {
  parseMemberExchangeCsv,
  serializeMemberExchangeCsv,
} from "../lib/memberExchangeCsv.ts";
import { parseMemberExchangeXlsx } from "../lib/memberExchangeWorkbook.ts";
import { classifyMemberImportRow } from "../lib/memberImportMatchCore.ts";

const legacyHeaders = [
  "Gym",
  "pkCustomer",
  "CustomerName",
  "CompanyName",
  "Address1",
  "Address2",
  "Town",
  "PostCode",
  "Gender",
  "TelephoneNo1",
  "TelephoneNo2",
  "Mobile",
  "Email",
  "ExpiryDate1",
  "ValidYN",
];

const exchangeHeaders = ["CardBarcode", ...legacyHeaders];
const migrationUrl = new URL(
  "../supabase/migrations/20260910_115000_member_import_card_barcode.sql",
  import.meta.url
);

test("the 16-column exchange contract begins with CardBarcode", () => {
  assert.deepEqual([...MEMBER_EXCHANGE_HEADERS], exchangeHeaders);
  assert.doesNotMatch(MEMBER_EXCHANGE_HEADERS.join(","), /MembershipNumber/);
});

test("CSV preserves an exact card barcode including leading zeroes", () => {
  const csv = [
    exchangeHeaders.join(","),
    "0012345,QROQQ,123,John Borg,,,,,,,,,,,2027-09-03,Valid",
  ].join("\n");

  const parsed = parseMemberExchangeCsv(csv);
  assert.equal(parsed.mode, "exchange_16");
  assert.equal(parsed.rows[0].values.CardBarcode, "0012345");

  const roundTrip = parseMemberExchangeCsv(serializeMemberExchangeCsv(parsed.rows));
  assert.equal(roundTrip.rows[0].values.CardBarcode, "0012345");
});

test("CSV accepts a blank optional CardBarcode", () => {
  const csv = [
    exchangeHeaders.join(","),
    ",QROQQ,124,Mary Vella,,,,,,,,,,,2027-09-03,Valid",
  ].join("\n");

  const parsed = parseMemberExchangeCsv(csv);
  assert.equal(parsed.rows[0].values.CardBarcode, "");
});

test("XLSX preserves CardBarcode as text instead of numeric coercion", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers");
  sheet.addRow(exchangeHeaders);
  sheet.addRow([
    "0012345",
    "QROQQ",
    "125",
    "Leading Zero Member",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "2027-09-03",
    "Valid",
  ]);

  const parsed = await parseMemberExchangeXlsx(
    Buffer.from(await workbook.xlsx.writeBuffer())
  );
  assert.equal(parsed.rows[0].values.CardBarcode, "0012345");
});

test("an incoming card already owned by another member is a conflict", () => {
  const result = classifyMemberImportRow({
    incoming: {
      cardBarcode: "0012345",
      gym: "QROQQ",
      pkCustomer: "900",
      customerName: "New Person",
      email: "new@example.com",
    },
    byCardBarcode: [
      {
        id: "existing-card-owner",
        cardBarcode: "0012345",
        legacyGym: "Marsa",
        legacyPkCustomer: "1",
        fullName: "Existing Person",
        email: "existing@example.com",
      },
    ],
    legacyCandidates: [],
  });

  assert.equal(result.action, "conflict");
});

test("a different incoming card for a legacy member with an active card is a conflict", () => {
  const result = classifyMemberImportRow({
    incoming: {
      cardBarcode: "0099999",
      gym: "QROQQ",
      pkCustomer: "12",
      customerName: "John Borg",
      email: "john@example.com",
    },
    byCardBarcode: [],
    legacyCandidates: [
      {
        id: "m1",
        cardBarcode: "0012345",
        legacyGym: "QROQQ",
        legacyPkCustomer: "12",
        fullName: "John Borg",
        email: "john@example.com",
      },
    ],
  });

  assert.equal(result.action, "conflict");
});

test("Task 10 migration removes generated BGM allocation from import apply", () => {
  assert.equal(
    fs.existsSync(migrationUrl),
    true,
    "expected the Task 10 card-barcode migration to exist"
  );

  const sql = fs.readFileSync(migrationUrl, "utf8");
  assert.match(sql, /card_barcode/i);
  assert.match(sql, /bgm_member_card_credentials/i);
  assert.doesNotMatch(sql, /bgm_next_member_number\s*\(/i);
  assert.doesNotMatch(sql, /BGM\[0-9\]|BGM[0-9]{7}/i);
});

test("member export derives CardBarcode from the active credential lifecycle", () => {
  const source = fs.readFileSync(
    new URL("../app/api/admin/members/export/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /CardBarcode/);
  assert.match(source, /bgm_member_card_credentials/);
});

test("membership data admin describes CardBarcode and no longer promises generated numbers", () => {
  const source = fs.readFileSync(
    new URL("../components/admin/MembershipDataAdmin.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /CardBarcode/);
  assert.match(source, /Card barcode/i);
  assert.doesNotMatch(source, /Generated .*permanent membership number/s);
  assert.doesNotMatch(source, /MembershipNumber first/);
});
