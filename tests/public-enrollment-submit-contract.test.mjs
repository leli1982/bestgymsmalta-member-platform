import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routePath = new URL("../app/api/public/membership-enrollment/submit/route.ts", import.meta.url);
const migrationPath = new URL(
  "../supabase/migrations/20260916_131000_public_enrollment_submission.sql",
  import.meta.url
);

function readRequired(path, label) {
  assert.ok(fs.existsSync(path), `${label} must exist`);
  return fs.readFileSync(path, "utf8");
}

test("tablet submit accepts only bounded WebP photos and exact participant count", () => {
  const source = readRequired(routePath, "public enrollment submit route");
  assert.match(source, /export async function POST/);
  assert.match(source, /request\.formData\(\)/);
  assert.match(source, /image\/webp/);
  assert.match(source, /5\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /participantCountForType/);
  assert.match(source, /photo0/);
  assert.match(source, /photo1/);
});

test("tablet submit rebuilds all authoritative values on the server", () => {
  const source = readRequired(routePath, "public enrollment submit route");
  assert.match(source, /normalizeIdentityDocument/);
  assert.match(source, /isUnder18On/);
  assert.match(source, /validateRegistrationParticipant/);
  assert.match(source, /calculateMembershipExpiry/);
  assert.match(source, /bgm_classify_membership_identity/);
  assert.match(source, /bgm_membership_price_catalog_versions/);
  assert.match(source, /bgm_membership_price_entries/);
  assert.match(source, /bgm_membership_declaration_versions/);
  assert.match(source, /Europe\/Malta/);
  assert.match(source, /duplicateContactWarning/);
  assert.match(source, /active[\s\S]*409/i);
  assert.doesNotMatch(source, /payload\.(?:price|startDate|expiryDate|matchedMemberId|under18AtSubmission)/);
});

test("tablet submit rate limits and stores photos only in the private application prefix", () => {
  const source = readRequired(routePath, "public enrollment submit route");
  assert.match(source, /PUBLIC_SUBMISSIONS_PER_HOUR/);
  assert.match(source, /hashPublicRateKey/);
  assert.match(source, /bgm_consume_public_enrollment_rate_limit/);
  assert.match(source, /randomUUID\(\)/);
  assert.match(source, /bgm-member-photos/);
  assert.match(source, /applications\/\$\{applicationId\}\/\$\{participantId\}\/\$\{randomUUID\(\)\}\.webp/);
  assert.match(source, /contentType:\s*["']image\/webp["']/);
  assert.match(source, /upsert:\s*false/);
});

test("tablet submit cleans every uploaded object when database creation fails", () => {
  const source = readRequired(routePath, "public enrollment submit route");
  assert.match(source, /bgm_create_public_membership_application/);
  assert.match(source, /uploadedPaths/);
  assert.match(source, /storage[\s\S]*remove\(uploadedPaths\)/);
  assert.match(source, /applicationId/);
  assert.match(source, /participantId/);
});

test("database creation uses server-generated UUIDs and writes photo provenance atomically", () => {
  const sql = readRequired(migrationPath, "public enrollment submission migration");
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bgm_create_public_membership_application/i);
  assert.match(sql, /applicationId/i);
  assert.match(sql, /participantId/i);
  assert.match(sql, /officialPhotoPath/i);
  assert.match(sql, /insert\s+into\s+public\.bgm_member_official_photos/i);
  assert.match(sql, /application_member_id/i);
  assert.match(sql, /source[\s\S]*new_membership/i);
  assert.match(sql, /membership\.application\.public_submitted/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.bgm_create_public_membership_application\(jsonb\)/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.bgm_create_public_membership_application\(jsonb\)\s+to\s+service_role/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.bgm_members\s*\(/i);
});
