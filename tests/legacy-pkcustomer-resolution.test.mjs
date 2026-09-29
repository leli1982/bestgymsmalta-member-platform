import test from "node:test";
import assert from "node:assert/strict";
import { resolveLegacyPkCustomerCandidates } from "../lib/legacyPkCustomerResolution.ts";

const active = (id, name, expiry = "2027-12-31") => ({
  id,
  member_number: `BGM${id.padStart(7, "0")}`,
  full_name: name,
  status: "active",
  membership_expiry: expiry,
});
const inactive = (id, name) => ({
  id,
  member_number: `BGM${id.padStart(7, "0")}`,
  full_name: name,
  status: "inactive",
  membership_expiry: "2025-01-01",
});

test("one active duplicate wins over inactive legacy rows without deleting them", () => {
  const result = resolveLegacyPkCustomerCandidates(
    [inactive("1", "Old Inactive"), active("2", "Current Active")],
    "2026-09-18"
  );
  assert.equal(result.kind, "resolved");
  assert.equal(result.member?.full_name, "Current Active");
  assert.equal(result.matches.length, 2);
});

test("multiple active members sharing a manual legacy number remain ambiguous", () => {
  const result = resolveLegacyPkCustomerCandidates(
    [active("1", "Active One"), active("2", "Active Two")],
    "2026-09-18"
  );
  assert.equal(result.kind, "ambiguous");
  assert.deepEqual(
    result.liveMatches.map((member) => member.full_name),
    ["Active One", "Active Two"]
  );
});

test("a single inactive legacy member remains resolvable for a declined scan", () => {
  const result = resolveLegacyPkCustomerCandidates(
    [inactive("1", "Inactive Member")],
    "2026-09-18"
  );
  assert.equal(result.kind, "resolved");
  assert.equal(result.member?.full_name, "Inactive Member");
});

test("multiple inactive duplicates are known but not live", () => {
  const result = resolveLegacyPkCustomerCandidates(
    [inactive("1", "Inactive One"), inactive("2", "Inactive Two")],
    "2026-09-18"
  );
  assert.equal(result.kind, "inactive_duplicates");
  assert.equal(result.matches.length, 2);
});
