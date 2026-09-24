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

const exchangeHeaders = ["MembershipNumber", ...legacyHeaders];
const migrationUrl = new URL(
  "../supabase/migrations/20260910_115000_member_import_card_barcode.sql",
  import.meta.url
);

test("the 16-column exchange contract begins with permanent BGM MembershipNumber", () => {
  assert.deepEqual([...MEMBER_EXCHANGE_HEADERS], exchangeHeaders);
  assert.equal(MEMBER_EXCHANGE_HEADERS[0], "MembershipNumber");
  assert.equal(MEMBER_EXCHANGE_HEADERS.includes("CardBarcode"), false);
});

test("CSV preserves the permanent BGM number separately from pkCustomer", () => {
  const csv = [
    exchangeHeaders.join(","),
    "BGM0000123,QROQQ,0012345,John Borg,,,,,,,,,,,2027-09-03,Valid",
  ].join("\n");

  const parsed = parseMemberExchangeCsv(csv);
  assert.equal(parsed.mode, "exchange_16");
  assert.equal(parsed.rows[0].values.MembershipNumber, "BGM0000123");
  assert.equal(parsed.rows[0].values.pkCustomer, "0012345");

  const roundTrip = parseMemberExchangeCsv(serializeMemberExchangeCsv(parsed.rows));
  assert.equal(roundTrip.rows[0].values.MembershipNumber, "BGM0000123");
  assert.equal(roundTrip.rows[0].values.pkCustomer, "0012345");
});

test("CSV accepts blank permanent BGM number for new legacy members", () => {
  const csv = [
    exchangeHeaders.join(","),
    ",QROQQ,124,Mary Vella,,,,,,,,,,,2027-09-03,Valid",
  ].join("\n");

  const parsed = parseMemberExchangeCsv(csv);
  assert.equal(parsed.rows[0].values.MembershipNumber, "");
});

test("XLSX preserves MembershipNumber and old physical card barcode separately", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers");
  sheet.addRow(exchangeHeaders);
  sheet.addRow([
    "BGM0000125",
    "QROQQ",
    "0012345",
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
  assert.equal(parsed.rows[0].values.MembershipNumber, "BGM0000125");
  assert.equal(parsed.rows[0].values.pkCustomer, "0012345");
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

test("TEST import allocates BGM numbers for new members without overwriting existing ones", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260924_150000_safe_add_only_legacy_member_import.sql", import.meta.url), "utf8");
  assert.match(sql, /RETURNING id,member_number INTO/);
  assert.doesNotMatch(sql, /UPDATE public[.]bgm_members SET/i);
  assert.match(sql, /legacy_pk_customer/);
});

test("member export derives CardBarcode from the active credential lifecycle", () => {
  const source = fs.readFileSync(
    new URL("../app/api/admin/members/export/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /CardBarcode/);
  assert.match(source, /bgm_member_card_credentials/);
});

test("membership data admin explains legacy pkCustomer cards and permanent BGM numbers", () => {
  const source = fs.readFileSync(
    new URL("../components/admin/MembershipDataAdmin.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /pkCustomer/);
  assert.match(source, /existing scanned membership\/card number/i);
  assert.match(source, /duplicate historical values are preserved/i);
  assert.match(source, /permanent BGM number/i);
  assert.doesNotMatch(source, /MembershipNumber first/);
});
