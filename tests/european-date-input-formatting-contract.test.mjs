import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync(new URL("../lib/europeanDate.ts", import.meta.url), "utf8");
const input = readFileSync(new URL("../components/ui/EuropeanDateInput.tsx", import.meta.url), "utf8");
const review = readFileSync(new URL("../components/staff/StaffMembershipReviewModal.tsx", import.meta.url), "utf8");

test("shared European date input auto-inserts DD/MM/YYYY separators while typing", () => {
  assert.match(helper, /formatEuropeanDateEntry/);
  assert.match(helper, /replace\(\/\\D\/g, \"\"\)/);
  assert.match(input, /formatEuropeanDateEntry/);
  assert.match(input, /placeholder = \"DD\/MM\/YYYY\"/);
});

test("live membership review date entry uses EuropeanDateInput instead of native date fields", () => {
  assert.doesNotMatch(review, /Field label=\"Date of birth\" type=\"date\"/);
  assert.doesNotMatch(review, /Field label=\"Start date\" type=\"date\"/);
  assert.doesNotMatch(review, /Field label=\"Expiry date\" type=\"date\"/);
  assert.match(review, /EuropeanDateInput/);
});
