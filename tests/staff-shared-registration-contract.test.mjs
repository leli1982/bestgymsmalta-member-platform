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
const enrollRoute = read("app/api/system/members/enroll/route.ts");
const dashboard = read("components/staff/StaffDashboard.tsx");
const browser = read("components/staff/StaffMemberBrowser.tsx");

test("staff New Membership renders the shared registration form", () => {
  assert.match(enrollment, /RegistrationForm/);
  assert.match(enrollment, /mode=["']staff["']/);
  assert.doesNotMatch(enrollment, /const\s+MEMBERSHIP_TYPES\s*=/);
  assert.doesNotMatch(enrollment, /const\s+DURATIONS\s*=/);
});

test("new and renewal staff entry points remain available", () => {
  assert.match(dashboard, /\/staff\/members\/enroll\?kind=new/);
  assert.match(browser, /kind=renewal&memberNumber=/);
  assert.match(enrollment, /searchParams\.get\(["']kind["']\)/);
  assert.match(enrollment, /searchParams\.get\(["']memberNumber["']\)/);
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

test("staff create path preserves the shared registration domain", () => {
  for (const field of [
    "town",
    "guardian",
    "declarations",
    "base_price_cents",
    "price_catalog_version_id",
    "declaration_snapshot",
    "document_readiness_ack_at",
  ]) {
    assert.match(enrollRoute, new RegExp(field));
  }
  assert.match(enrollRoute, /bgm_classify_membership_identity/);
  assert.match(enrollRoute, /bgm_has_membership_contact_match/);
});

test("staff registration config is authenticated and does not move staff access into public code", () => {
  assert.match(enrollRoute, /export async function GET/);
  assert.match(enrollRoute, /requireSystemPermission[\s\S]*members\.create/);
  assert.match(enrollRoute, /pricing/);
  assert.match(enrollRoute, /declarations/);
  assert.doesNotMatch(registration, /api\/system\/members\/enroll/);
});
