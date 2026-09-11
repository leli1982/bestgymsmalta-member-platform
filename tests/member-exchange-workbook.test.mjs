import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import test from "node:test";
import {
  buildMemberExchangeXlsx,
  parseMemberExchangeXlsx,
} from "../lib/memberExchangeWorkbook.ts";

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

test("XLSX recognizes the 15-column legacy contract and real dates", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers");
  sheet.addRow(legacyHeaders);
  sheet.addRow([
    "QROQQ",
    "100",
    "John Borg",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "99112233",
    "",
    "",
    new Date("2027-09-03T00:00:00Z"),
    "Valid",
  ]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed = await parseMemberExchangeXlsx(buffer);
  assert.equal(parsed.mode, "legacy_15");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].values.CardBarcode, "");
  assert.equal(parsed.rows[0].values.ExpiryDate1, "2027-09-03");
});

test("formula cells are flagged instead of executed or trusted", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers");
  sheet.addRow(exchangeHeaders);
  const row = sheet.addRow([
    "0012345",
    "QROQQ",
    "100",
    "John Borg",
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
    "",
    "Valid",
  ]);
  row.getCell(12).value = { formula: "1804-366-8555", result: -7117 };

  const parsed = await parseMemberExchangeXlsx(
    Buffer.from(await workbook.xlsx.writeBuffer())
  );

  assert.equal(parsed.rows[0].values.TelephoneNo2, "");
  assert.equal(parsed.rows[0].issues[0].kind, "formula_cell");
  assert.equal(parsed.rows[0].issues[0].column, "TelephoneNo2");
});

test("XLSX writer preserves CardBarcode as text and expiry as a date", async () => {
  const rows = [
    {
      rowNumber: 2,
      issues: [],
      values: {
        CardBarcode: "0012345",
        Gym: "QROQQ",
        pkCustomer: "100",
        CustomerName: "John Borg",
        CompanyName: "",
        Address1: "",
        Address2: "",
        Town: "Naxxar",
        PostCode: "NXR1234",
        Gender: "M",
        TelephoneNo1: "",
        TelephoneNo2: "99112233",
        Mobile: "",
        Email: "john@example.com",
        ExpiryDate1: "2027-09-03",
        ValidYN: "Valid",
      },
    },
  ];

  const output = await buildMemberExchangeXlsx(rows);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(output);
  const sheet = workbook.worksheets[0];

  assert.deepEqual(sheet.getRow(1).values.slice(1), exchangeHeaders);
  assert.equal(sheet.getCell("A2").value, "0012345");
  assert.equal(sheet.getCell("A2").numFmt, "@");
  assert.ok(sheet.getCell("O2").value instanceof Date);
  assert.equal(sheet.getCell("O2").numFmt, "dd/mm/yyyy");
});

test("XLSX rejects incorrect header order", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers");
  sheet.addRow(["Gym", "CustomerName", "pkCustomer"]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(() => parseMemberExchangeXlsx(buffer), /header/i);
});
