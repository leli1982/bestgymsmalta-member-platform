import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("staff enrollment selects pricing by explicit access scope and persists target gym", () => {
  const route = read("app/api/system/members/registration/route.ts");
  assert.match(route, /accessScopeValue/);
  assert.match(route, /\.eq\("access_scope", accessScope\)/);
  assert.match(route, /\.eq\("gym_id", gymId\)/);
  assert.match(route, /access_scope: accessScope/);
  assert.match(route, /access_gym_id: accessScope === "single_gym" \? gym\.id : null/);
  assert.match(route, /singleGymPricing/);
});

test("network pricing is explicitly scoped and cannot fall through to a gym catalogue", () => {
  const route = read("app/api/system/members/registration/route.ts");
  assert.match(route, /\.eq\("access_scope", "network"\)/);
  assert.match(route, /\.is\("gym_id", null\)/);
});

test("single gym pricing has no network fallback", () => {
  const route = read("app/api/system/members/registration/route.ts");
  assert.match(route, /Single Gym membership is not available for this gym/);
  assert.doesNotMatch(route, /singleGymPricing\s*\|\|\s*settings\.config\.pricing/);
});
