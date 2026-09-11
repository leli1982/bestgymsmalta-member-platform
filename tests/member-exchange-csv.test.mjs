import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMemberExchangeCsv,
  serializeMemberExchangeCsv,
} from "../lib/memberExchangeCsv.ts";

test("CSV round trip preserves exact 16-column values and card barcode text", () => {
  const csv = [
    "CardBarcode,Gym,pkCustomer,CustomerName,CompanyName,Address1,Address2,Town,PostCode,Gender,TelephoneNo1,TelephoneNo2,Mobile,Email,ExpiryDate1,ValidYN",
    '0012345,QROQQ,123,"Borg, John",,"1 Main St",,Naxxar,NXR1234,M,,99112233,,john@example.com,03/09/2027,Valid',
  ].join("\n");

  const parsed = parseMemberExchangeCsv(csv);
  assert.equal(parsed.mode, "exchange_16");
  assert.equal(parsed.rows[0].values.CustomerName, "Borg, John");
  assert.equal(parsed.rows[0].values.CardBarcode, "0012345");

  const roundTrip = parseMemberExchangeCsv(serializeMemberExchangeCsv(parsed.rows));
  assert.equal(roundTrip.rows[0].values.CustomerName, "Borg, John");
  assert.equal(roundTrip.rows[0].values.CardBarcode, "0012345");
});

test("CSV parser preserves quoted embedded newlines and escaped quotes", () => {
  const csv =
    'CardBarcode,Gym,pkCustomer,CustomerName,CompanyName,Address1,Address2,Town,PostCode,Gender,TelephoneNo1,TelephoneNo2,Mobile,Email,ExpiryDate1,ValidYN\r\n' +
    'AbC-007,QROQQ,42,"Borg, ""Johnny""",,"Flat 1\nMain Street",,Naxxar,,,,99112233,,john@example.com,2027-09-03,Valid\r\n';

  const parsed = parseMemberExchangeCsv(csv);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].values.CardBarcode, "AbC-007");
  assert.equal(parsed.rows[0].values.CustomerName, 'Borg, "Johnny"');
  assert.equal(parsed.rows[0].values.Address1, "Flat 1\nMain Street");
});

test("CSV recognizes the exact legacy 15-column contract", () => {
  const csv = [
    "Gym,pkCustomer,CustomerName,CompanyName,Address1,Address2,Town,PostCode,Gender,TelephoneNo1,TelephoneNo2,Mobile,Email,ExpiryDate1,ValidYN",
    "QROQQ,100,John Borg,,,,Naxxar,,,,99112233,,john@example.com,03/09/2027,Valid",
  ].join("\n");

  const parsed = parseMemberExchangeCsv(csv);
  assert.equal(parsed.mode, "legacy_15");
  assert.equal(parsed.rows[0].values.CardBarcode, "");
});

test("CSV rejects reordered or unknown headers", () => {
  const csv = "Gym,CustomerName,pkCustomer\nQROQQ,John Borg,100";
  assert.throws(() => parseMemberExchangeCsv(csv), /header/i);
});
