import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (file) => readFileSync(join(root, file), "utf8");

test("standard sundries catalog includes the requested items once, icons and zero-default quantities", () => {
  const catalog = read("components/staff/SundriesCatalogForm.tsx");
  for (const name of [
    "Toilet paper", "Gym tissues", "Hand soap", "Floor liquid",
    "Membership forms", "Bar sales", "Membership sales sheet",
    "Pens", "Pencils", "Markers", "Membership cards",
    "Staples", "Sticky notes",
  ]) {
    assert.match(catalog, new RegExp('name: "' + name + '"'));
  }
  assert.equal((catalog.match(/name: "Staples"/g) || []).length, 1);
  assert.equal((catalog.match(/\{ name: "/g) || []).length, 13);
  assert.match(catalog, /icon: ToiletRollIcon/);
  assert.match(catalog, /function ToiletRollIcon/);
  assert.match(catalog, /quantity: "0"/);
  assert.match(catalog, /min="0"/);
  assert.match(catalog, /Add custom item/);
  assert.match(catalog, /removeCustom/);
});

test("Sundries sends only positive selected items and keeps an editable zero-default catalog", () => {
  const page = read("components/staff/OperationalOrdersPage.tsx");
  assert.match(page, /orderType === "sundries" \? initialSundriesItems\(\)/);
  assert.match(page, /<SundriesCatalogForm/);
  assert.match(page, /item\.itemName\.trim\(\) && Number\(item\.quantity\) > 0/);
  assert.match(page, /Order location: \{locationName\}/);
  assert.match(page, /Review request · \{locationName\}/);
  assert.match(page, /setItems\(orderType === "sundries" \? initialSundriesItems\(\)/);
});

test("Super Admin sees orders across gyms by default and can filter locations dynamically", () => {
  const page = read("components/staff/OperationalOrdersPage.tsx");
  const api = read("app/api/system/orders/route.ts");
  assert.match(page, /historyGymId/);
  assert.match(page, /<option value="">All gyms<\/option>/);
  assert.match(page, /setHistoryGymId\(event\.target\.value\)/);
  assert.match(page, /availableGyms = \(gymsData\.gyms \|\| \[\]\)/);
  assert.match(api, /gym_id: gymId/);
  assert.match(api, /gym_name: gymById\.get\(order\.gym_id\)/);
  assert.match(api, /if \(!auth\.context\.isSuperAdmin\)/);
});
