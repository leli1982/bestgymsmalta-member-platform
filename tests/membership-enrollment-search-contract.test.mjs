import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routeUrl = new URL(
  "../app/api/system/members/search/route.ts",
  import.meta.url
);

function source() {
  return fs.readFileSync(routeUrl, "utf8");
}

test("renewal member search requires members.view permission", () => {
  assert.match(source(), /requireSystemPermission\(request,\s*["']members\.view["']\)/);
});

test("permanent BGM membership number is searched exactly before fallback fields", () => {
  const route = source();
  assert.match(route, /normalizeMembershipNumber/);
  assert.match(route, /parseMembershipNumber/);
  assert.match(route, /\.eq\(["']member_number["']/);
  assert.match(route, /full_name/);
  assert.match(route, /mobile/);
  assert.match(route, /email/);
  assert.match(route, /legacy_pk_customer/);
});

test("fallback identity search uses separate queries and never assumes legacy PK is unique", () => {
  const route = source();
  const fallbackStart = route.indexOf("const pattern =");
  const fallbackEnd = route.indexOf("const results =", fallbackStart);
  assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
  const fallbackQueries = route.slice(fallbackStart, fallbackEnd);
  assert.doesNotMatch(fallbackQueries, /\.or\(/);
  assert.doesNotMatch(route, /legacy_pk_customer[\s\S]{0,180}\.single\(/i);
  assert.match(route, /new Map|Map</);
});

test("search returns candidate identity details and gates official photos", () => {
  const route = source();
  assert.match(route, /memberNumber/);
  assert.match(route, /firstName/);
  assert.match(route, /lastName/);
  assert.match(route, /fullName/);
  assert.match(route, /membershipExpiry/);
  assert.match(route, /officialPhoto/);
  assert.match(route, /members\.photos\.view/);
});
