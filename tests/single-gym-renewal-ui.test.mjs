import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renewal = readFileSync(
  new URL("../components/staff/StaffRenewalEnrollmentPage.tsx", import.meta.url),
  "utf8",
);

test("renewal UI carries member access scope and gym from search results", () => {
  assert.match(renewal, /accessScope\?:\s*"network"\s*\|\s*"single_gym"/);
  assert.match(renewal, /accessGymId\?:\s*string\s*\|\s*null/);
  assert.match(renewal, /accessGymName\?:\s*string/);
});

test("renewal UI preselects the member current access and swaps price matrices", () => {
  assert.match(renewal, /setAccessScope\(candidate\.accessScope === "single_gym" \? "single_gym" : "network"\)/);
  assert.match(renewal, /singleGymEntries/);
  assert.match(renewal, /accessScope === "single_gym" \? singleGymPrices : networkPrices/);
  assert.match(renewal, /All Access/);
  assert.match(renewal, /Single Gym/);
});

test("renewal UI applies a deliberate access conversion before completion", () => {
  assert.match(renewal, /applications\/\$\{encodeURIComponent\(data\.application\.id\)\}\/access-scope/);
  assert.match(renewal, /accessScope/);
  assert.match(renewal, /selectedCurrentAccessScope/);
});
