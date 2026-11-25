import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyStaffMember } from "../lib/staffDashboardCore.ts";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("admin list uses two display states while preserving the stored status and write path", () => {
  const ui = read("components/admin/MembersAdmin.tsx");
  const api = read("app/api/admin/members/route.ts");
  assert.match(ui, /membershipDisplayStatus/);
  assert.match(ui, /return memberDisplayStatus\(member\) === "expired"/);
  assert.doesNotMatch(ui, /\["inactive", "Inactive"\]/);
  assert.match(api, /membershipDisplayStatus: classifyStaffMember/);
  assert.match(api, /cancellationEffectiveDate: member.cancellation_effective_date/);
  assert.match(api, /status: calculateStatus\(incomingStatus, membershipExpiry\)/);
});

test("membership classification respects saved expiry and cancellation", () => {
  const display = input => classifyStaffMember({today:"2026-11-25", ...input}) === "active" ? "ACTIVE" : "EXPIRED";
  assert.equal(display({status:"active", membershipExpiry:"2026-11-25"}), "ACTIVE");
  assert.equal(display({status:"active", membershipExpiry:"2026-11-24"}), "EXPIRED");
  assert.equal(display({status:"inactive", membershipExpiry:"2026-11-24"}), "EXPIRED");
  assert.equal(display({status:"inactive", membershipExpiry:"2026-12-25"}), "EXPIRED");
  assert.equal(display({status:"active", membershipExpiry:"2026-12-25", cancellationEffectiveDate:"2026-11-25"}), "EXPIRED");
  assert.equal(display({status:"inactive", membershipExpiry:null}), "EXPIRED");
});

test("conflict and duplicate review lists use effective membership labels", () => {
  assert.match(read("components/staff/CardConflictReview.tsx"), /membershipLabel\(item\)/);
  assert.match(read("components/staff/CardConflictReview.tsx"), /membershipLabel\(m\)/);
  assert.match(read("components/staff/SourceDuplicateReview.tsx"), /classifyStaffMember\(\{\.\.\.member/);
});
