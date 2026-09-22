import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildShoppingList } from "../lib/shoppingListCore.ts";

function order(id, gymId, gymName, status, items) {
  return {
    id, gym_id: gymId, gym_name: gymName, staff_name: "TEST",
    status, notes: null, submitted_at: "2026-09-22T10:00:00.000Z",
    items: items.map(([name, quantity, unit = null]) => ({
      id: name + quantity, item_name: name, quantity, unit, notes: null,
    })),
  };
}
test("adds outstanding Sundries quantities across gyms, collapses case and whitespace, preserves different units", () => {
  const data = buildShoppingList([
    order("a", "marsa", "Marsa", "submitted", [["Toilet paper", 6], ["Gym tissues", 2], ["Soap", 2, "bottles"]]),
    order("b", "birk", "Birkirkara", "ordered", [[" toilet   PAPER ", 4], ["Soap", 1, "boxes"]]),
    order("c", "marsa", "Marsa", "completed", [["Toilet paper", 100]]),
    order("d", "marsa", "Marsa", "cancelled", [["Gym tissues", 20]]),
  ]);
  assert.deepEqual(data.totals, [
    { name: "Gym tissues", unit: null, quantity: 2 },
    { name: "Soap", unit: "bottles", quantity: 2 },
    { name: "Soap", unit: "boxes", quantity: 1 },
    { name: "Toilet paper", unit: null, quantity: 10 },
  ]);
  assert.deepEqual(data.gyms.map((gym) => [gym.gymName, gym.orders.map((record) => record.id)]), [
    ["Birkirkara", ["b"]], ["Marsa", ["a"]],
  ]);
  assert.equal(data.openOrderCount, 2);
});
test("delivering one request removes only its quantities, retaining other requests for same gym", () => {
  const orders = [
    order("a", "birk", "Birkirkara", "submitted", [["Toilet paper", 6]]),
    order("b", "birk", "Birkirkara", "ordered", [["Toilet paper", 4]]),
    order("c", "marsa", "Marsa", "ordered", [["Gym tissues", 2]]),
  ];
  const before = buildShoppingList(orders);
  assert.equal(before.totals.find((total) => total.name === "Toilet paper").quantity, 10);
  orders[0].status = "completed";
  const after = buildShoppingList(orders);
  assert.equal(after.totals.find((total) => total.name === "Toilet paper").quantity, 4);
  assert.deepEqual(after.gyms.find((gym) => gym.gymId === "birk").orders.map((record) => record.id), ["b"]);
  assert.equal(after.openOrderCount, 2);
});

test("shopping list API restricts actions to Super Admin, reads all dates and atomically completes an open Sundries request", () => {
  const source = readFileSync(new URL("../app/api/system/shopping-list/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireSuperAdmin\(request\)/);
  assert.match(source, /eq\("order_type", "sundries"\)/);
  assert.match(source, /in\("status", \[\.\.\.pendingStatuses\]\)/);
  assert.match(source, /offset \+= batchSize/);
  assert.match(source, /offset \+= itemBatchSize/);
  assert.match(source, /eq\("status", existing\.status\)/);
  assert.match(source, /status: "completed"/);
  assert.match(source, /completed_at: now/);
  assert.match(source, /orders\.delivered/);
});
