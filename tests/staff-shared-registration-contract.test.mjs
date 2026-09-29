import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
function read(path) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return "";
  }
}

const enrollment = read("components/staff/MembershipEnrollmentPage.tsx");
const registration = read("components/membership/RegistrationForm.tsx");
const photoControls = read("components/staff/StaffRegistrationPhotoControls.tsx");
const registrationRoute = read("app/api/system/members/registration/route.ts");
const dashboard = read("components/staff/StaffDashboard.tsx");
const browser = read("components/staff/StaffMemberBrowser.tsx");
const maltaDate = read("lib/maltaDate.ts");

test("staff New Membership renders the shared registration form", () => {
  assert.match(enrollment, /RegistrationForm/);
  assert.match(enrollment, /mode=["']staff["']/);
  assert.match(enrollment, /gym=\{config\.gym\}/);
  assert.doesNotMatch(enrollment, /submitting=/);
  assert.doesNotMatch(enrollment, /submitLabel=/);
  assert.doesNotMatch(enrollment, /const\s+MEMBERSHIP_TYPES\s*=/);
  assert.doesNotMatch(enrollment, /const\s+DURATIONS\s*=/);
});

test("new and renewal staff entry points remain available", () => {
  assert.match(dashboard, /\/staff\/members\/enroll\?kind=new/);
  assert.match(browser, /kind=renewal&memberNumber=/);
  assert.match(enrollment, /searchParams\.get\(["']kind["']\)/);
  assert.match(enrollment, /searchParams\.get\(["']memberNumber["']\)/);
  assert.match(enrollment, /StaffRenewalEnrollmentPage/);
});

test("staff registration exposes Take Photo, Upload Image and Photo Later", () => {
  assert.match(photoControls, /Take Photo/);
  assert.match(photoControls, /Upload Image/);
  assert.match(photoControls, /Photo Later/);
  assert.match(photoControls, /image\/jpeg/);
  assert.match(photoControls, /image\/png/);
  assert.match(photoControls, /image\/webp/);
  assert.match(photoControls, /canvas\.toBlob[\s\S]*image\/webp/);
});

test("tablet keeps camera-only photo capture while staff uses staff photo controls", () => {
  assert.match(registration, /mode\s*===\s*["']tablet["'][\s\S]*LivePhotoCapture/);
  assert.match(registration, /mode\s*===\s*["']staff["'][\s\S]*StaffRegistrationPhotoControls/);
  assert.match(registration, /onPhotoLater/);
});

test("authenticated staff create path preserves the shared registration domain", () => {
  for (const field of [
    "town",
    "guardian",
    "declarations",
    "base_price_cents",
    "price_catalog_version_id",
    "declaration_snapshot",
    "document_readiness_ack_at",
    "application_source",
    "matched_member_id",
    "duplicate_contact_warning",
  ]) {
    assert.match(registrationRoute, new RegExp(field));
  }
  assert.match(registrationRoute, /bgm_classify_membership_identity/);
  assert.match(registrationRoute, /bgm_has_membership_contact_match/);
  assert.match(registrationRoute, /existing_member_id:\s*null/);
  assert.match(registrationRoute, /state\s*===\s*["']active["']/);
});

test("staff registration config and submit are authenticated through the dedicated route", () => {
  assert.match(registrationRoute, /export async function GET/);
  assert.match(registrationRoute, /export async function POST/);
  assert.match(registrationRoute, /requireSystemPermission[\s\S]*members\.create/);
  assert.match(registrationRoute, /pricing/);
  assert.match(registrationRoute, /declarations/);
  assert.match(enrollment, /\/api\/system\/members\/registration/);
  assert.doesNotMatch(registration, /api\/system\/members\/registration/);
});

test("staff registration uses the shared Malta business-date helper", () => {
  assert.match(registrationRoute, /todayMaltaDate/);
  assert.match(registrationRoute, /addMembershipDurationDate/);
  assert.match(maltaDate, /Europe\/Malta/);
  assert.doesNotMatch(maltaDate, /toISOString\(\)\.slice/);
});
