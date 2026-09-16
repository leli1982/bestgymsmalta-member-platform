import assert from "node:assert/strict";
import test from "node:test";
import {
  discountAmountCents,
  normalizeDiscountCode,
  requiredDeclarationKeys,
  validatePriceMatrix,
} from "../lib/membershipSettingsCore.ts";

const membershipTypes = ["single", "student", "couples"];
const durationKeys = ["1_week", "2_weeks", "1_month", "3_months", "6_months", "1_year"];

function completePriceMatrix() {
  return membershipTypes.flatMap((membershipType) =>
    durationKeys.map((durationKey, index) => ({
      membershipType,
      durationKey,
      amountCents: 1000 + index,
      currency: "EUR",
    })),
  );
}

test("discount codes normalize to trimmed uppercase", () => {
  assert.equal(normalizeDiscountCode("  summer25  "), "SUMMER25");
  assert.equal(normalizeDiscountCode("Staff-10"), "STAFF-10");
});

test("price matrix accepts exactly all 18 membership type and duration combinations", () => {
  assert.deepEqual(validatePriceMatrix(completePriceMatrix()), { ok: true });
});

test("price matrix rejects a missing combination", () => {
  const entries = completePriceMatrix().slice(0, -1);
  const result = validatePriceMatrix(entries);
  assert.equal(result.ok, false);
  assert.match(result.error, /18|missing|combination/i);
});

test("price matrix rejects a duplicate combination", () => {
  const entries = completePriceMatrix();
  entries.push({ ...entries[0] });
  const result = validatePriceMatrix(entries);
  assert.equal(result.ok, false);
  assert.match(result.error, /duplicate|combination/i);
});

test("price matrix rejects non-EUR, negative, and non-integer prices", () => {
  for (const patch of [
    { currency: "USD" },
    { amountCents: -1 },
    { amountCents: 10.5 },
  ]) {
    const entries = completePriceMatrix();
    entries[0] = { ...entries[0], ...patch };
    assert.equal(validatePriceMatrix(entries).ok, false);
  }
});

test("10 percent of 85 EUR is 8.50 EUR", () => {
  assert.equal(discountAmountCents(8500, 10), 850);
});

test("discount calculation rounds to nearest cent with integer-cent result", () => {
  assert.equal(discountAmountCents(999, 15), 150);
  assert.equal(Number.isInteger(discountAmountCents(999, 15)), true);
});

test("discount calculation rejects invalid base price and percentage", () => {
  assert.throws(() => discountAmountCents(-1, 10), /invalid base/i);
  assert.throws(() => discountAmountCents(1000.5, 10), /invalid base/i);
  assert.throws(() => discountAmountCents(1000, 0), /invalid discount/i);
  assert.throws(() => discountAmountCents(1000, 101), /invalid discount/i);
  assert.throws(() => discountAmountCents(1000, 10.5), /invalid discount/i);
});

test("public enrollment requires gym rules, privacy and health declarations", () => {
  assert.deepEqual(requiredDeclarationKeys(), ["gym_rules", "privacy", "health"]);
});
