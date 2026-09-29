import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pagePath = new URL("../app/join/[gymSlug]/page.tsx", import.meta.url);
const manifestPath = new URL("../app/join/[gymSlug]/manifest.webmanifest/route.ts", import.meta.url);
const joinPagePath = new URL("../components/membership/JoinEnrollmentPage.tsx", import.meta.url);
const pwaRegistrationPath = new URL("../components/membership/JoinPwaRegistration.tsx", import.meta.url);
const serviceWorkerPath = new URL("../public/join-sw.js", import.meta.url);

function readRequired(path, label) {
  assert.ok(fs.existsSync(path), `${label} must exist`);
  return fs.readFileSync(path, "utf8");
}

test("gym join page links a gym-specific manifest and renders the tablet enrollment surface", () => {
  const source = readRequired(pagePath, "gym-specific join page");
  assert.match(source, /generateMetadata/);
  assert.match(source, /manifest\.webmanifest/);
  assert.match(source, /gymSlug/);
  assert.match(source, /JoinEnrollmentPage/);
  assert.match(source, /JoinPwaRegistration/);
});

test("dynamic manifest starts on the exact gym route in standalone mode with existing BGM icons", () => {
  const source = readRequired(manifestPath, "dynamic enrollment manifest");
  assert.match(source, /BestGymsMalta/);
  assert.match(source, /BGM Registration/);
  assert.match(source, /start_url/);
  assert.match(source, /\/join\/\$\{gymSlug\}/);
  assert.match(source, /scope:\s*["']\/join\/["']/);
  assert.match(source, /display:\s*["']standalone["']/);
  assert.match(source, /\/icons\/icon-192\.png/);
  assert.match(source, /\/icons\/icon-512\.png/);
  assert.match(source, /192x192/);
  assert.match(source, /512x512/);
});

test("tablet join surface loads public config and uses the shared RegistrationForm in tablet mode", () => {
  const source = readRequired(joinPagePath, "JoinEnrollmentPage");
  assert.match(source, /\/api\/public\/membership-enrollment\/config\?gymSlug=/);
  assert.match(source, /RegistrationForm/);
  assert.match(source, /mode=["']tablet["']/);
  assert.match(source, /gymSlug/);
  assert.match(source, /unavailable|not found|not available/i);
});

test("tablet submission uses multipart photos and only clears applicant state after confirmed server success", () => {
  const source = readRequired(joinPagePath, "JoinEnrollmentPage");
  assert.match(source, /new FormData\(\)/);
  assert.match(source, /formData\.append\(["']payload["']/);
  assert.match(source, /photo0/);
  assert.match(source, /\/api\/public\/membership-enrollment\/submit/);
  assert.match(source, /response\.ok/);
  assert.match(source, /Application submitted/i);
  assert.match(source, /Finish\s*\/\s*Reset for next member/i);
  assert.match(source, /student/i);
  assert.match(source, /same-address|same address/i);
  assert.match(source, /guardian/i);
});

test("PWA registration installs only the network-only join service worker", () => {
  const source = readRequired(pwaRegistrationPath, "JoinPwaRegistration");
  assert.match(source, /navigator\.serviceWorker\.register\(["']\/join-sw\.js["']\)/);
});

test("join service worker never caches applicant data or queues requests offline", () => {
  const source = readRequired(serviceWorkerPath, "join service worker");
  assert.match(source, /install/);
  assert.match(source, /activate/);
  assert.doesNotMatch(source, /caches\.open|caches\.match|CacheStorage|indexedDB|localStorage|sync/i);
  if (/addEventListener\(["']fetch["']/.test(source)) {
    assert.match(source, /fetch\(event\.request\)/);
  }
});
