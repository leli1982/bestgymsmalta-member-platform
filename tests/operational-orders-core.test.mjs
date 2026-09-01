import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrderType,
  orderPermission,
  normalizeOrderItems,
  canTransitionOrderStatus,
} from "../lib/operationalOrdersCore.ts";

test("supports only sundries and bar operational orders", () => {
  assert.equal(normalizeOrderType("Sundries"), "sundries");
  assert.equal(normalizeOrderType(" BAR "), "bar");
  assert.equal(normalizeOrderType("stock"), null);
});

test("maps each order type to submit and history permissions", () => {
  assert.equal(orderPermission("sundries", "submit"), "orders.sundries.submit");
  assert.equal(orderPermission("sundries", "history"), "orders.sundries.history");
  assert.equal(orderPermission("bar", "submit"), "orders.bar.submit");
  assert.equal(orderPermission("bar", "history"), "orders.bar.history");
});

test("normalizes order items and rejects blank or non-positive rows", () => {
  assert.deepEqual(
    normalizeOrderItems([
      { itemName: "  Paper Towels ", quantity: 4, unit: "rolls", notes: "  large  " },
      { itemName: "", quantity: 2 },
      { itemName: "Water", quantity: 0 },
      { itemName: "Cups", quantity: "3" },
    ]),
    [
      { itemName: "Paper Towels", quantity: 4, unit: "rolls", notes: "large" },
      { itemName: "Cups", quantity: 3, unit: null, notes: null },
    ]
  );
});

test("allows only sensible operational-order status transitions", () => {
  assert.equal(canTransitionOrderStatus("submitted", "ordered"), true);
  assert.equal(canTransitionOrderStatus("submitted", "cancelled"), true);
  assert.equal(canTransitionOrderStatus("ordered", "completed"), true);
  assert.equal(canTransitionOrderStatus("ordered", "cancelled"), true);
  assert.equal(canTransitionOrderStatus("submitted", "completed"), false);
  assert.equal(canTransitionOrderStatus("completed", "ordered"), false);
  assert.equal(canTransitionOrderStatus("cancelled", "submitted"), false);
});
