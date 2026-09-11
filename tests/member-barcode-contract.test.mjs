import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../components/member/MemberBarcode.tsx", import.meta.url),
  "utf8"
);

test("member barcode uses Code 128 and exact member number", () => {
  assert.match(source, /CODE128/);
  assert.match(source, /memberNumber/);
  assert.doesNotMatch(source, /pkCustomer|cardUid/);
});
