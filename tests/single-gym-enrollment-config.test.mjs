import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("enrollment config always loads network catalog explicitly", () => {
  const route = read("app/api/public/membership-enrollment/config/route.ts");
  assert.match(route, /eq\("access_scope", "network"\)/);
  assert.match(route, /is\("gym_id", null\)/);
});

test("enabled gym exposes only its own published single-gym catalog", () => {
  const route = read("app/api/public/membership-enrollment/config/route.ts");
  assert.match(route, /single_gym_pricing_enabled/);
  assert.match(route, /eq\("access_scope", "single_gym"\)/);
  assert.match(route, /eq\("gym_id", gym\.id\)/);
  assert.match(route, /singleGymPricing/);
});

test("registration types keep backward-compatible network drafts while supporting explicit scope", () => {
  const types = read("lib/membershipRegistrationTypes.ts");
  assert.match(types, /MembershipAccessScope = "network" \| "single_gym"/);
  assert.match(types, /singleGymPricing\?: PublishedPriceConfig/);
  assert.match(types, /accessScope\?: MembershipAccessScope/);
});
