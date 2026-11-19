import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const preview = read("app/api/system/members/applications/[applicationId]/price-preview/route.ts");
const modal = read("components/staff/StaffMembershipReviewModal.tsx");
const pricing = read("lib/scopedMembershipPricing.ts");
const snapshot = read("supabase/migrations/20261111_120000_fix_staff_price_catalog_scope_triggers.sql");

test("payment price preview is read-only, scoped to the application gym and authenticated staff", () => {
  assert.match(preview, /export async function GET/);
  assert.doesNotMatch(preview, /export async function (POST|PATCH|DELETE)/);
  assert.match(preview, /requireSystemPermission\(request, "members.create"\)/);
  assert.match(preview, /auth\.context\.gymId !== application\.enrollment_gym_id/);
  assert.match(preview, /\["submitted", "awaiting_payment"\]/);
  assert.match(preview, /normalizeEnrollmentAccessScope\(application\.access_scope\)/);
  assert.match(preview, /application\.access_gym_id/);
  assert.match(preview, /loadPublishedEnrollmentPriceCatalog\(db, accessScope, gymId\)/);
  assert.match(pricing, /\.eq\("status", "published"\)/);
  assert.match(pricing, /\.filter\(\(entry\) => entry\.isActive !== false\)/);
  assert.doesNotMatch(preview, /\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(preview, /request\.json\(\)|basePriceCents\s*=\s*request/);
});

test("unchanged selections preserve historical price snapshot; changed ones use current scoped published rate", () => {
  assert.match(preview, /membershipType === application\.membership_type/);
  assert.match(preview, /durationKey === application\.duration_key/);
  assert.match(preview, /basePriceCents: application\.base_price_cents/);
  assert.match(preview, /priceCatalogVersionId: application\.price_catalog_version_id/);
  assert.match(preview, /source: "saved"/);
  assert.match(preview, /basePriceCents: match\.amountCents/);
  assert.match(preview, /priceCatalogVersionId: catalog!\.versionId/);
  assert.match(preview, /source: "current"/);
  assert.match(preview, /if \(!match/);
  assert.match(snapshot, /Preserve the captured rate on edits that do not change the selected product/);
  assert.match(snapshot, /new\.base_price_cents := v_amount_cents/);
});

test("changing type or duration updates payment quote and never shows a stale price", () => {
  assert.match(modal, /pricePreview/);
  assert.match(modal, /form\?\.membershipType, form\?\.durationKey/);
  assert.match(modal, /new AbortController\(\)/);
  assert.match(modal, /signal: controller\.signal/);
  assert.match(modal, /if \(!controller\.signal\.aborted\) setPricePreview/);
  assert.match(modal, /pricePreview\.membershipType === form\.membershipType/);
  assert.match(modal, /pricePreview\.durationKey === form\.durationKey/);
  assert.match(modal, /pricePreview\.snapshotKey === priceSnapshotKey/);
  assert.match(modal, /quotedBaseCents/);
  assert.match(modal, /label="Base Price"/);
  assert.match(modal, /label="Final Total"/);
  assert.match(modal, /Payment is temporarily disabled/);
  assert.match(modal, /!priceReady \|\| !discountCode\.trim\(\)/);
  assert.match(modal, /!priceReady \|\|\s*!staffName\.trim\(\)/);
  assert.match(modal, /setDiscountPreview\(null\)/);
});

test("duration recalculates expiry; final payment is reconfirmed server-side after saving", () => {
  assert.match(modal, /calculateMembershipExpiry\(current\.startDate, value as MembershipDurationKey\)/);
  assert.match(modal, /if \(field === "durationKey"\)/);
  assert.match(modal, /if \(confirmed\.basePriceCents !== quotedBaseCents\)/);
  assert.match(modal, /Review the new total before confirming payment/);
  assert.match(modal, /bgm-membership-print/);
  assert.doesNotMatch(modal, /body: JSON\.stringify\(\{[\s\S]*?(?:basePriceCents|finalAmountCents): quotedBaseCents/);
});
