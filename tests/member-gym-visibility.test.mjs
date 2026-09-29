import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const list = fs.readFileSync("components/gyms/LiveGymsPage.tsx", "utf8");
const detail = fs.readFileSync("components/gyms/LiveGymDetailPage.tsx", "utf8");
const tour = fs.readFileSync("components/gyms/GymTourPage.tsx", "utf8");

test("member gym list only includes active and coming-soon locations", () => {
  assert.match(list, /gym\.status === "active" \|\| gym\.status === "coming_soon"/);
  assert.match(list, /gyms\.filter\(isMemberVisibleGym\)/);
  assert.match(list, /memberVisibleGyms\.length/);
  assert.doesNotMatch(list, /status === "inactive"\) return "Inactive"/);
});

test("inactive gym detail and tour routes are hidden from member-facing pages", () => {
  assert.match(detail, /item\.id === gymId && isMemberVisibleGym\(item\)/);
  assert.match(tour, /item\.id === gymId && isMemberVisibleGym\(item\)/);
});
