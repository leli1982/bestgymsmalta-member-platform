import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("membership settings exposes gym capabilities and scoped price catalogs", () => {
  const route = read("app/api/system/membership-settings/route.ts");
  assert.match(route, /single_gym_pricing_enabled/);
  assert.match(route, /access_scope/);
  assert.match(route, /gym_id/);
  assert.match(route, /singleGymPricingEnabled/);
});

test("network remains default price scope while single-gym drafts require a gym", () => {
  const route = read("app/api/system/membership-settings/route.ts");
  assert.match(route, /value === "single_gym" \? "single_gym" : "network"/);
  assert.match(route, /accessScope === "single_gym" \? requiredString\(body\.gymId/);
  assert.match(route, /Enable Single Gym Pricing for this gym before saving its prices/);
});

test("publishing compares only the current catalog in the same scope and gym", () => {
  const route = read("app/api/system/membership-settings/route.ts");
  assert.match(route, /eq\("access_scope", draftResult\.data\.access_scope\)/);
  assert.match(route, /eq\("gym_id", draftResult\.data\.gym_id\)/);
  assert.match(route, /is\("gym_id", null\)/);
});

test("single-gym capability changes are Super Admin audited", () => {
  const route = read("app/api/system/membership-settings/route.ts");
  assert.match(route, /set_single_gym_pricing_enabled/);
  assert.match(route, /membership_settings\.single_gym_pricing\.changed/);
});
