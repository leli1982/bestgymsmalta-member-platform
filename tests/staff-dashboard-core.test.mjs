import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyStaffMember,
  matchesStaffMemberFilter,
  sortPendingApplicationsNewestFirst,
  formatMaltaDateTime,
} from "../lib/staffDashboardCore.ts";

test("staff member classification matches reception access rules", () => {
  assert.equal(
    classifyStaffMember({
      status: "active",
      membershipExpiry: "2026-09-15",
      today: "2026-09-15",
    }),
    "active"
  );
  assert.equal(
    classifyStaffMember({
      status: "active",
      membershipExpiry: "2026-09-14",
      today: "2026-09-15",
    }),
    "expired"
  );
  assert.equal(
    classifyStaffMember({
      status: "inactive",
      membershipExpiry: "2027-01-01",
      today: "2026-09-15",
    }),
    "inactive"
  );
});

test("active and expired filters do not mislabel inactive members", () => {
  assert.equal(matchesStaffMemberFilter("active", "active"), true);
  assert.equal(matchesStaffMemberFilter("expired", "expired"), true);
  assert.equal(matchesStaffMemberFilter("inactive", "expired"), false);
  assert.equal(matchesStaffMemberFilter("inactive", "all"), true);
});

test("pending applications sort newest first", () => {
  const sorted = sortPendingApplicationsNewestFirst([
    {
      id: "old",
      submittedAt: "2026-09-15T08:00:00Z",
      createdAt: "2026-09-15T08:00:00Z",
    },
    {
      id: "new",
      submittedAt: "2026-09-15T09:00:00Z",
      createdAt: "2026-09-15T09:00:00Z",
    },
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["new", "old"]
  );
});

test("Malta timestamp formatter is stable and non-editable display data", () => {
  assert.match(
    formatMaltaDateTime("2026-09-15T12:32:00Z"),
    /15 Sep 2026/
  );
});
