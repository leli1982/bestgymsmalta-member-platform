import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const coreUrl = new URL("../lib/googleWalletCore.ts", import.meta.url);
const maltaUrl = new URL("../lib/maltaDate.ts", import.meta.url);
assert.ok(existsSync(fileURLToPath(coreUrl)), "googleWalletCore.ts must exist before C4 behavior can pass");

const {
  googleWalletClassId,
  googleWalletObjectId,
  googleWalletValidityEnd,
  projectGoogleWalletMember,
} = await import(coreUrl.href);
const { maltaDayUtcRange, maltaMidnightUtc } = await import(maltaUrl.href);

const memberId = "123e4567-e89b-12d3-a456-426614174000";
const base = {
  memberId,
  fullName: "Wallet Test Member",
  memberNumber: "BGM26442",
  status: "active",
  membershipExpiry: "2026-10-09",
  cancellationEffectiveDate: null,
  archivedAt: null,
  activeCardBarcode: "CARD-123",
};

test("Wallet class and object IDs are deterministic and ignore mutable BGM numbers", () => {
  assert.equal(googleWalletClassId("123456789", "bgm_membership_test_v1"), "123456789.bgm_membership_test_v1");
  const first = googleWalletObjectId("123456789", memberId, "test_");
  const changedBusinessNumber = googleWalletObjectId("123456789", memberId, "test_");
  assert.equal(first, `123456789.test_member_${memberId}`);
  assert.equal(changedBusinessNumber, first);
});

test("active expiry-day member projects the current physical card as CODE_128 and keeps BGM number display-only", () => {
  const projection = projectGoogleWalletMember(base, "2026-10-09");
  assert.equal(projection.eligibleToAdd, true);
  assert.equal(projection.reason, null);
  assert.equal(projection.genericType, "GENERIC_GYM_MEMBERSHIP");
  assert.equal(projection.state, "ACTIVE");
  assert.deepEqual(projection.barcode, {
    type: "CODE_128",
    value: "CARD-123",
    alternateText: "CARD-123",
  });
  assert.equal(projection.memberNumber, "BGM26442");
  assert.notEqual(projection.barcode.value, projection.memberNumber);
  assert.equal(projection.expiryDisplay, "09/10/2026");
  assert.equal(projection.validTimeIntervalEnd, "2026-10-09T22:00:00.000Z");
});

test("future cancellation shortens Wallet validity to the start of the effective Malta date", () => {
  const snapshot = {
    ...base,
    membershipExpiry: "2026-10-31",
    cancellationEffectiveDate: "2026-10-20",
  };
  assert.equal(googleWalletValidityEnd(snapshot.membershipExpiry, snapshot.cancellationEffectiveDate), "2026-10-19T22:00:00.000Z");
  const projection = projectGoogleWalletMember(snapshot, "2026-10-09");
  assert.equal(projection.state, "ACTIVE");
  assert.equal(projection.eligibleToAdd, true);
  assert.equal(projection.validTimeIntervalEnd, "2026-10-19T22:00:00.000Z");
});

test("effective cancellation becomes inactive and replaces the old scannable credential", () => {
  const projection = projectGoogleWalletMember({ ...base, cancellationEffectiveDate: "2026-10-09" }, "2026-10-09");
  assert.equal(projection.eligibleToAdd, false);
  assert.equal(projection.reason, "cancelled");
  assert.equal(projection.state, "INACTIVE");
  assert.equal(projection.barcode.type, "TEXT_ONLY");
  assert.notEqual(projection.barcode.value, "CARD-123");
  assert.equal("alternateText" in projection.barcode, false);
});

test("expired membership becomes expired and grace never preserves a scannable credential", () => {
  const projection = projectGoogleWalletMember({ ...base, membershipExpiry: "2026-10-08" }, "2026-10-09");
  assert.equal(projection.eligibleToAdd, false);
  assert.equal(projection.reason, "expired");
  assert.equal(projection.state, "EXPIRED");
  assert.equal(projection.barcode.type, "TEXT_ONLY");
  assert.notEqual(projection.barcode.value, "CARD-123");
});

test("archived inactive and cardless members are non-scannable with specific eligibility reasons", () => {
  const archived = projectGoogleWalletMember({ ...base, archivedAt: "2026-10-01T08:00:00.000Z" }, "2026-10-09");
  assert.equal(archived.reason, "archived");
  assert.equal(archived.state, "INACTIVE");
  assert.equal(archived.barcode.type, "TEXT_ONLY");

  const inactive = projectGoogleWalletMember({ ...base, status: "inactive" }, "2026-10-09");
  assert.equal(inactive.reason, "inactive");
  assert.equal(inactive.state, "INACTIVE");

  const cardless = projectGoogleWalletMember({ ...base, activeCardBarcode: null }, "2026-10-09");
  assert.equal(cardless.reason, "card_missing");
  assert.equal(cardless.state, "INACTIVE");
  assert.equal(cardless.barcode.value, "Card unavailable");
});

test("Malta midnight and expiry boundaries remain correct across both DST transition days", () => {
  assert.equal(maltaMidnightUtc("2026-03-29"), "2026-03-28T23:00:00.000Z");
  assert.deepEqual(maltaDayUtcRange("2026-03-29"), {
    start: "2026-03-28T23:00:00.000Z",
    end: "2026-03-29T22:00:00.000Z",
  });
  assert.equal(googleWalletValidityEnd("2026-03-29", null), "2026-03-29T22:00:00.000Z");

  assert.equal(maltaMidnightUtc("2026-10-25"), "2026-10-24T22:00:00.000Z");
  assert.deepEqual(maltaDayUtcRange("2026-10-25"), {
    start: "2026-10-24T22:00:00.000Z",
    end: "2026-10-25T23:00:00.000Z",
  });
  assert.equal(googleWalletValidityEnd("2026-10-25", null), "2026-10-25T23:00:00.000Z");
});
