import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGymProvisioningIdentity,
  normalizeGymRouteSlug,
} from "../lib/gymProvisioningCore.ts";

test("new gym names produce stable URL-safe route slugs", () => {
  assert.equal(normalizeGymRouteSlug("Mellieħa Fitness"), "mellieha");
  assert.equal(normalizeGymRouteSlug("St. Paul's Fitness"), "st-pauls");
  assert.equal(normalizeGymRouteSlug("Tal-Qroqq"), "tal-qroqq");
});

test("gym provisioning derives id, join route, staff route and shared staff username", () => {
  assert.deepEqual(
    buildGymProvisioningIdentity({ name: "Mellieħa Fitness", shortName: "Mellieħa" }),
    {
      gymId: "bgm-mellieha",
      routeSlug: "mellieha",
      joinPath: "/join/mellieha",
      staffPath: "/staff/mellieha",
      staffUsername: "melliehafitness",
      staffDisplayName: "Mellieħa Staff",
    }
  );
});

test("provisioning rejects a name that cannot produce a safe slug", () => {
  assert.throws(() => buildGymProvisioningIdentity({ name: "---", shortName: "" }), /gym name/i);
});

test("new gym URLs derive from the entered gym name, not a different short label", () => {
  assert.deepEqual(
    buildGymProvisioningIdentity({ name: "Naxxar", shortName: "NX" }),
    {
      gymId: "bgm-naxxar",
      routeSlug: "naxxar",
      joinPath: "/join/naxxar",
      staffPath: "/staff/naxxar",
      staffUsername: "naxxarfitness",
      staffDisplayName: "NX Staff",
    }
  );
});
