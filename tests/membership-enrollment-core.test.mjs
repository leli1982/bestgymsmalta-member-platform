import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEnrollmentIdentityAction,
  requireStaffName,
} from "../lib/membershipEnrollmentCore.ts";

test("new enrollment creates a person without a client-generated membership number", () => {
  assert.deepEqual(
    buildEnrollmentIdentityAction({ kind: "new", existingMemberId: "" }),
    { kind: "create_person" }
  );
});

test("renewal requires and reuses the existing permanent member identity", () => {
  assert.deepEqual(
    buildEnrollmentIdentityAction({ kind: "renewal", existingMemberId: "member-1" }),
    { kind: "reuse_person", memberId: "member-1" }
  );

  assert.throws(
    () => buildEnrollmentIdentityAction({ kind: "renewal", existingMemberId: "" }),
    /existing member/i
  );
});

test("unsupported enrollment kinds are rejected", () => {
  assert.throws(
    () => buildEnrollmentIdentityAction({ kind: "transfer", existingMemberId: "member-1" }),
    /new or renewal/i
  );
});

test("Staff Name is mandatory and normalized for application accountability", () => {
  assert.equal(requireStaffName("  Maria Borg  "), "Maria Borg");
  assert.throws(() => requireStaffName(""), /staff name is required/i);
  assert.throws(() => requireStaffName("   "), /staff name is required/i);
});

test("Activation Staff Name can use the same server-side validator with a distinct label", () => {
  assert.equal(
    requireStaffName("  Joseph Camilleri ", "Activation Staff Name"),
    "Joseph Camilleri"
  );
  assert.throws(
    () => requireStaffName(" ", "Activation Staff Name"),
    /activation staff name is required/i
  );
});
