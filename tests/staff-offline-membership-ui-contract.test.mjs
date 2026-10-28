import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pagePath = new URL("../components/staff/MembershipEnrollmentPage.tsx", import.meta.url);
const checkoutPath = new URL("../components/staff/OfflineMembershipCheckout.tsx", import.meta.url);
const serviceWorkerPath = new URL("../public/staff-sw.js", import.meta.url);

function read(path, label) {
  assert.ok(fs.existsSync(path), `${label} must exist`);
  return fs.readFileSync(path, "utf8");
}

test("staff enrollment loads cached config and queues a completed registration when offline", () => {
  const page = read(pagePath, "MembershipEnrollmentPage");
  assert.match(page, /cacheOfflineEnrollmentContext/);
  assert.match(page, /loadLatestOfflineEnrollmentContext/);
  assert.match(page, /navigator\.onLine/);
  assert.match(page, /OfflineMembershipCheckout/);
  assert.match(page, /OFFLINE MODE/);
});

test("offline checkout records payment, physical cards and verification before saving", () => {
  const checkout = read(checkoutPath, "OfflineMembershipCheckout");
  assert.match(checkout, /Payment method/i);
  assert.match(checkout, /Physical card/i);
  assert.match(checkout, /Cash/);
  assert.match(checkout, /Card/);
  assert.match(checkout, /ID.*verified|verified.*ID/i);
  assert.match(checkout, /Save Offline/i);
  assert.match(checkout, /enqueueOfflineMembership/);
});

test("offline receipt explicitly permits training but does not pretend central activation already happened", () => {
  const checkout = read(checkoutPath, "OfflineMembershipCheckout");
  assert.match(checkout, /Membership saved offline.*member may train immediately/i);
  assert.match(checkout, /PENDING ONLINE ACTIVATION/);
  assert.match(checkout, /PENDING CONFIRMATION/);
  assert.match(checkout, /No permanent BGM member number has been issued yet/i);
  assert.match(checkout, /OFFLINE-/);
});

test("staff service worker keeps the enrollment shell available without caching API requests", () => {
  const serviceWorker = read(serviceWorkerPath, "staff service worker");
  assert.match(serviceWorker, /\/staff\/members\/enroll/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\(["']\/api\/["']\)/);
  assert.match(serviceWorker, /request\.method !== ["']GET["']/);
});
