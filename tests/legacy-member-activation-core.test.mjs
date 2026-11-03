import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLegacyEmail,
  normalizeLegacyPhone,
  resolveLegacyMemberCandidate,
} from "../lib/legacyMemberActivationCore.ts";

const base = {
  id: "member-1",
  member_number: "BGM0012345",
  status: "active",
  app_enrolled: false,
  date_of_birth: "1982-02-07",
  mobile: "+356 7999 1234",
  phone: null,
};

test("normalizes legacy email and Maltese phone formats", () => {
  assert.equal(normalizeLegacyEmail("  TEST@Example.COM "), "test@example.com");
  assert.equal(normalizeLegacyPhone("+356 7999 1234"), "79991234");
  assert.equal(normalizeLegacyPhone("00356 7999 1234"), "79991234");
  assert.equal(normalizeLegacyPhone("7999-1234"), "79991234");
});

test("matches exactly one candidate by stored email", () => {
  const result = resolveLegacyMemberCandidate(
    [{ ...base, email: "Member@Example.com" }],
    { email: " member@example.COM " }
  );
  assert.equal(result.kind, "matched");
  assert.equal(result.shouldUpdateEmail, false);
});

test("requires extra identity checks when legacy record has no email", () => {
  const result = resolveLegacyMemberCandidate(
    [{ ...base, email: null }],
    { email: "new@example.com" }
  );
  assert.deepEqual(result, { kind: "needs_identity_check" });
});

test("matches no-email record only with exact DOB and normalized mobile", () => {
  const result = resolveLegacyMemberCandidate(
    [{ ...base, email: null }],
    { email: "new@example.com", dateOfBirth: "1982-02-07", mobile: "79991234" }
  );
  assert.equal(result.kind, "matched");
  assert.equal(result.shouldUpdateEmail, true);
});

test("does not accept wrong DOB, wrong phone or short phone", () => {
  for (const input of [
    { email: "new@example.com", dateOfBirth: "1982-02-08", mobile: "79991234" },
    { email: "new@example.com", dateOfBirth: "1982-02-07", mobile: "79990000" },
    { email: "new@example.com", dateOfBirth: "1982-02-07", mobile: "1234" },
  ]) {
    assert.equal(resolveLegacyMemberCandidate([{ ...base, email: null }], input).kind, "not_verified");
  }
});

test("duplicate matching legacy identities remain ambiguous", () => {
  const result = resolveLegacyMemberCandidate(
    [
      { ...base, id: "member-1", email: null },
      { ...base, id: "member-2", email: null },
    ],
    { email: "new@example.com", dateOfBirth: "1982-02-07", mobile: "79991234" }
  );
  assert.equal(result.kind, "not_verified");
});
