import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  OLD_SYSTEM_MEMBER_HEADERS,
  deriveLegacyGym,
  statusFromExpiryDate,
} from "../lib/legacyMemberImportCore.ts";
import { parseMemberExchangeXlsx } from "../lib/memberExchangeWorkbook.ts";

test("legacy gym mapping includes numeric and NO/No Tal-Qroqq rules", () => {
  assert.equal(deriveLegacyGym("1234").gym, "Tal-Qroqq");
  assert.equal(deriveLegacyGym("NO176").gym, "Tal-Qroqq");
  assert.equal(deriveLegacyGym("No176").gym, "Tal-Qroqq");
  assert.equal(deriveLegacyGym("B123").gym, "Birkirkara");
  assert.equal(deriveLegacyGym("K123").gym, "Kirkop");
  assert.equal(deriveLegacyGym("M123").gym, "Marsa");
  assert.equal(deriveLegacyGym("N123").gym, "Neptunes");
  assert.equal(deriveLegacyGym("P123").gym, "Pembroke");
  assert.equal(deriveLegacyGym("S123").gym, "Build");
  assert.equal(deriveLegacyGym("T123").gym, "Sliema");
  assert.equal(deriveLegacyGym("z123").gym, "Birżebbuġa");
  assert.equal(deriveLegacyGym("QQ100").gym, null);
});

test("expiry date alone determines active/inactive", () => {
  assert.equal(statusFromExpiryDate("2026-10-01", "2026-10-01"), "active");
  assert.equal(statusFromExpiryDate("2026-10-02", "2026-10-01"), "active");
  assert.equal(statusFromExpiryDate("2026-09-30", "2026-10-01"), "inactive");
  assert.equal(statusFromExpiryDate("", "2026-10-01"), "inactive");
});

test("22-column old-system workbook converts to normalized import row", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers3");
  sheet.addRow([...OLD_SYSTEM_MEMBER_HEADERS]);
  sheet.addRow([
    "No176", "59060154", "BORG", "MARIA", "1 MAIN STREET", "", "NAXXAR",
    "NXR 1000", "MALTA", "FEMALE", new Date(1990, 0, 2), "123456M", "",
    "21234567", "", "99112233", "maria@example.com", new Date(2027, 0, 31),
    "", "Not Valid", "", ""
  ]);

  const parsed = await parseMemberExchangeXlsx(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.mode, "legacy_22");
  assert.equal(parsed.rows.length, 1);
  const row = parsed.rows[0];
  assert.equal(row.values.Gym, "Tal-Qroqq");
  assert.equal(row.values.pkCustomer, "No176");
  assert.equal(row.values.CardBarcode, "59060154");
  assert.equal(row.values.CustomerName, "BORG MARIA");
  assert.equal(row.values.ExpiryDate1, "2027-01-31");
  assert.equal(row.sourceValues?.IDCard, "123456M");
  assert.equal(row.sourceValues?.DOB, "1990-01-02");
  assert.deepEqual(row.issues, []);
});

test("old-system row with unknown PK prefix converts with blank gym for later review", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers3");
  sheet.addRow([...OLD_SYSTEM_MEMBER_HEADERS]);
  const row = Array(OLD_SYSTEM_MEMBER_HEADERS.length).fill("");
  row[0] = "QQ100";
  row[2] = "Grech";
  row[3] = "Maverick";
  row[16] = "maverick@example.com";
  row[17] = new Date(2027, 0, 1);
  sheet.addRow(row);
  const parsed = await parseMemberExchangeXlsx(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.rows[0].values.Gym, "");
  assert.deepEqual(parsed.rows[0].issues, []);
});
