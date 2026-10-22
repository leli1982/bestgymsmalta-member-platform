import assert from "node:assert/strict";
import test from "node:test";

const barSalesCore = await import("../lib/barSalesCore.ts");

test("Bar product filter narrows by partial product name while typing", () => {
  assert.equal(typeof barSalesCore.filterBarProducts, "function", "filterBarProducts must be exported");

  const products = [
    { id: "water", name: "Water 500ml" },
    { id: "protein", name: "Protein bar" },
    { id: "drink", name: "Protein drink" },
  ];

  assert.deepEqual(
    barSalesCore.filterBarProducts(products, "pro").map((item) => item.id),
    ["protein", "drink"],
    "partial text should narrow results immediately",
  );
  assert.deepEqual(
    barSalesCore.filterBarProducts(products, "PROTEIN BAR").map((item) => item.id),
    ["protein"],
    "matching should be case-insensitive",
  );
  assert.deepEqual(
    barSalesCore.filterBarProducts(products, "").map((item) => item.id),
    ["water", "protein", "drink"],
    "clearing the filter should restore all products",
  );
});
