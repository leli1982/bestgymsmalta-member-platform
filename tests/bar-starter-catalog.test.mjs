import assert from "node:assert/strict";
import test from "node:test";
import { BAR_STARTER_SHEET, BAR_STARTER_REVIEW_NOTES } from "../../lib/barStarterCatalog.ts";

test("two-page printed Bar Sales sheet is complete and priced in integer cents", () => {
  assert.equal(BAR_STARTER_SHEET.length, 69);
  assert.equal(new Set(BAR_STARTER_SHEET.map((item) => item.name.toLowerCase())).size, 69);
  assert.ok(BAR_STARTER_SHEET.every((item) =>
    item.name.length > 0 && item.name.length <= 120 &&
    Number.isSafeInteger(item.priceCents) && item.priceCents >= 0 &&
    Number.isInteger(item.sortOrder)
  ));
  assert.equal(BAR_STARTER_SHEET.find((item) => item.name === "Isotonic")?.priceCents, 200);
  assert.equal(BAR_STARTER_SHEET.find((item) => item.name === "Daily Membership")?.priceCents, 900);
  assert.equal(BAR_STARTER_SHEET.find((item) => item.name === "Big Orbit Gum")?.priceCents, 449);
  assert.equal(BAR_STARTER_SHEET.find((item) => item.name === "Weider Mega Mass4000 7kg")?.priceCents, 7600);
  assert.ok(BAR_STARTER_REVIEW_NOTES.some((note) => note.includes("handwritten")));
});
