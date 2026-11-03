import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("membership settings page renders dedicated Individual Gym Pricing editor", () => {
  const page = read("app/staff/membership-settings/page.tsx");
  assert.match(page, /SingleGymPricingAdmin/);
});

test("Individual Gym Pricing editor is gym-scoped and does not copy network prices", () => {
  const ui = read("components/staff/SingleGymPricingAdmin.tsx");
  assert.match(ui, /Individual Gym Pricing/);
  assert.match(ui, /accessScope: "single_gym"/);
  assert.match(ui, /gymId: selectedGym\.id/);
  assert.match(ui, /set_single_gym_pricing_enabled/);
  assert.match(ui, /Save Draft/);
  assert.match(ui, /Publish \{selectedGym\.name\} Prices/);
  assert.doesNotMatch(ui, /Copy All Access|fallback/i);
});

test("disabled gym preserves history but hides editing", () => {
  const ui = read("components/staff/SingleGymPricingAdmin.tsx");
  assert.match(ui, /hidden from Staff, Tablet enrollment and renewals/);
  assert.match(ui, /historical price versions are preserved/);
});
