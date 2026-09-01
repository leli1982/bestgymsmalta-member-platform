import test from "node:test";
import assert from "node:assert/strict";
import {
  orderTypePresentation,
  nextOperationalOrderActions,
} from "../lib/operationalOrdersPresentation.ts";

test("presents sundries and bar orders with distinct titles and routes", () => {
  assert.deepEqual(orderTypePresentation("sundries"), {
    title: "Sundries Order",
    pluralTitle: "Sundries Orders",
    href: "/staff/sundries",
  });
  assert.deepEqual(orderTypePresentation("bar"), {
    title: "Bar List",
    pluralTitle: "Bar Lists",
    href: "/staff/bar",
  });
});

test("only exposes valid next order actions", () => {
  assert.deepEqual(nextOperationalOrderActions("submitted"), ["ordered", "cancelled"]);
  assert.deepEqual(nextOperationalOrderActions("ordered"), ["completed", "cancelled"]);
  assert.deepEqual(nextOperationalOrderActions("completed"), []);
  assert.deepEqual(nextOperationalOrderActions("cancelled"), []);
});
