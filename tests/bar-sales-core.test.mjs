import test from "node:test";
import assert from "node:assert/strict";
import { parseEuroCents, snapshotBarSale, formatBarEuro } from "../lib/barSalesCore.ts";

const catalog = [
  { id: "water", name: "Water 500 ml", priceCents: 150, isOther: false, active: true, sortOrder: 0, updatedAt: "2026-09-21" },
  { id: "protein", name: "Protein bar", priceCents: 225, isOther: false, active: true, sortOrder: 10, updatedAt: "2026-09-21" },
  { id: "other", name: "Others", priceCents: null, isOther: true, active: true, sortOrder: 999, updatedAt: "2026-09-21" },
  { id: "old", name: "Archived drink", priceCents: 200, isOther: false, active: false, sortOrder: 30, updatedAt: "2026-09-21" },
];

test("euro prices are parsed exactly in integer cents", () => {
  assert.equal(parseEuroCents("2.50"), 250);
  assert.equal(parseEuroCents("0.05"), 5);
  assert.equal(parseEuroCents("10"), 1000);
  for (const bad of ["", "2.999", "€2.50", "-1.00", "NaN", "Infinity", " 1.234 "]) {
    assert.equal(parseEuroCents(bad), null, bad);
  }
  assert.equal(formatBarEuro(225).includes("2.25"), true);
});

test("server computes priced line totals and zero-quantity rows are left off the list", () => {
  const result = snapshotBarSale([
    { catalogItemId: "water", quantity: 3, expectedPriceCents: 150 },
    { catalogItemId: "protein", quantity: 2, expectedPriceCents: 225 },
    { catalogItemId: "other", quantity: 1, otherName: "Forgotten sports drink", otherPriceCents: 185 },
    { catalogItemId: "water", quantity: 0, expectedPriceCents: 150 },
  ], catalog);
  assert.equal(result.error, null);
  if (result.error) return;
  assert.equal(result.totalCents, 1085);
  assert.deepEqual(result.items.map(({ itemName, quantity, unitPriceCents, lineTotalCents }) =>
    ({ itemName, quantity, unitPriceCents, lineTotalCents })), [
    { itemName: "Water 500 ml", quantity: 3, unitPriceCents: 150, lineTotalCents: 450 },
    { itemName: "Protein bar", quantity: 2, unitPriceCents: 225, lineTotalCents: 450 },
    { itemName: "Forgotten sports drink", quantity: 1, unitPriceCents: 185, lineTotalCents: 185 },
  ]);
});

test("Staff cannot invent catalogue prices or submit archived and duplicate products", () => {
  const cases = [
    [{ catalogItemId: "water", quantity: 1, expectedPriceCents: 1 }],
    [{ catalogItemId: "old", quantity: 1, expectedPriceCents: 200 }],
    [{ catalogItemId: "unknown", quantity: 1, expectedPriceCents: 100 }],
    [{ catalogItemId: "water", quantity: 1, expectedPriceCents: 150 },
      { catalogItemId: "water", quantity: 1, expectedPriceCents: 150 }],
    [{ catalogItemId: "water", quantity: 0, expectedPriceCents: 150 }],
    [{ catalogItemId: "water", quantity: 1.5, expectedPriceCents: 150 }],
    [{ catalogItemId: "water", quantity: -1, expectedPriceCents: 150 }],
    [{ catalogItemId: "other", quantity: 1, otherName: "", otherPriceCents: 100 }],
    [{ catalogItemId: "other", quantity: 1, otherName: "Extra", otherPriceCents: -5 }],
  ];
  for (const entries of cases) {
    const result = snapshotBarSale(entries, catalog);
    assert.notEqual(result.error, null, JSON.stringify(entries));
    assert.equal(result.items.length, 0);
  }
});

test("Others may be entered more than once with independent staff-set prices", () => {
  const r = snapshotBarSale([
    { catalogItemId: "other", quantity: 2, otherName: "Coffee", otherPriceCents: 130 },
    { catalogItemId: "other", quantity: 1, otherName: "Cup", otherPriceCents: 20 },
  ], catalog);
  assert.equal(r.error, null);
  assert.equal(r.totalCents, 280);
});
