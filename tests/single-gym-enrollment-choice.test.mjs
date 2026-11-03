import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("enabled gyms choose access before membership details", () => {
  const wrapper = read("components/membership/AccessScopedRegistrationForm.tsx");
  assert.match(wrapper, /Choose membership access/);
  assert.match(wrapper, />All Access</);
  assert.match(wrapper, />Single Gym</);
  assert.match(wrapper, /if \(hasSingleGymPricing && !accessScope\)/);
  assert.match(wrapper, /accessScope: accessScope \|\| "network"/);
});

test("disabled gyms continue directly with network registration", () => {
  const wrapper = read("components/membership/AccessScopedRegistrationForm.tsx");
  assert.match(wrapper, /hasSingleGymPricing \? "" : "network"/);
  assert.match(wrapper, /config\.singleGymPricing/);
});

test("tablet and staff new membership flows both use access-scoped form", () => {
  const tablet = read("components/membership/JoinEnrollmentPage.tsx");
  const staff = read("components/staff/MembershipEnrollmentPage.tsx");
  assert.match(tablet, /AccessScopedRegistrationForm/);
  assert.match(tablet, /accessScope: draft\.accessScope \|\| "network"/);
  assert.match(staff, /AccessScopedRegistrationForm/);
});
