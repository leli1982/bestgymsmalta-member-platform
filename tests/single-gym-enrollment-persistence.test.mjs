import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("staff enrollment selects pricing by explicit access scope and persists target gym", () => {
  const route = read("app/api/system/members/registration/route.ts");
  assert.match(route, /accessScopeValue/);
  assert.match(route, /access_scope: accessScope/);
  assert.match(route, /access_gym_id: accessScope === "single_gym" \? gym\.id : null/);
  assert.match(route, /singleGymPricing/);
  assert.match(route, /price_catalog_version_id: selectedCatalog\.versionId/);
});

test("published pricing loader always scopes catalogues by access mode and target gym", () => {
  const helper = read("lib/scopedMembershipPricing.ts");
  assert.match(helper, /\.eq\("access_scope", accessScope\)/);
  assert.match(helper, /catalogQuery = catalogQuery\.is\("gym_id", null\)/);
  assert.match(helper, /catalogQuery = catalogQuery\.eq\("gym_id", gymId\)/);
});

test("single gym pricing has no network fallback", () => {
  const route = read("app/api/system/members/registration/route.ts");
  assert.match(route, /Single Gym membership is not available for this gym/);
  assert.doesNotMatch(route, /singleGymPricing\s*\|\|\s*settings\.config\.pricing/);
});
