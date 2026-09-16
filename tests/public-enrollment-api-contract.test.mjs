import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const configPath = new URL("../app/api/public/membership-enrollment/config/route.ts", import.meta.url);
const identityPath = new URL("../app/api/public/membership-enrollment/identity-check/route.ts", import.meta.url);
const securityPath = new URL("../lib/publicEnrollmentSecurity.ts", import.meta.url);

function readRequired(path, label) {
  assert.ok(fs.existsSync(path), `${label} must exist`);
  return fs.readFileSync(path, "utf8");
}

test("public enrollment security hashes rate keys and uses shared-gym-safe limits", () => {
  const source = readRequired(securityPath, "publicEnrollmentSecurity.ts");
  assert.match(source, /PUBLIC_IDENTITY_CHECKS_PER_HOUR\s*=\s*600/);
  assert.match(source, /PUBLIC_SUBMISSIONS_PER_HOUR\s*=\s*120/);
  assert.match(source, /export function hashPublicRateKey/);
  assert.match(source, /createHash\(["']sha256["']\)/);
  assert.match(source, /export function resolveClientIp/);
  assert.match(source, /x-vercel-forwarded-for|x-forwarded-for/i);
});

test("public config is gym-slug scoped and exposes only published enrollment settings", () => {
  const source = readRequired(configPath, "public enrollment config route");
  assert.match(source, /export async function GET/);
  assert.match(source, /public_enrollment_slug/);
  assert.match(source, /status["']?,\s*["']active|\.eq\(["']status["'],\s*["']active["']\)/i);
  assert.match(source, /bgm_membership_price_catalog_versions/);
  assert.match(source, /bgm_membership_price_entries/);
  assert.match(source, /bgm_membership_declaration_versions/);
  assert.match(source, /published/i);
  assert.match(source, /getEnrollmentReadiness/);
  assert.match(source, /Enrollment is not ready\./);
  assert.doesNotMatch(source, /bgm_discount_codes/);
});

test("public identity check returns classification only and uses normalized identity plus Malta date", () => {
  const source = readRequired(identityPath, "public identity-check route");
  assert.match(source, /export async function POST/);
  assert.match(source, /normalizeIdentityDocument/);
  assert.match(source, /public_enrollment_slug/);
  assert.match(source, /membership_expiry/);
  assert.match(source, /Europe\/Malta/);
  assert.match(source, /expired_inactive/);
  assert.match(source, /state/);
  assert.doesNotMatch(source, /memberNumber|member_number\s*:/);
  assert.doesNotMatch(source, /fullName|full_name\s*:/);
  assert.doesNotMatch(source, /email\s*:/);
  assert.doesNotMatch(source, /phone\s*:/);
});
