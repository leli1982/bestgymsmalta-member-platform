import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const staffLayout = read("app/staff/layout.tsx");
const memberLayout = read("app/layout.tsx");
const member = JSON.parse(read("public/manifest.json"));
const staff = JSON.parse(read("public/staff-manifest.webmanifest"));
const serviceWorker = read("public/staff-sw.js");

test("Staff and Members are different installable apps with stable entry URLs", () => {
  assert.equal(member.id, "/");
  assert.equal(member.start_url, "/");
  assert.equal(member.scope, "/");
  assert.equal(staff.id, "/staff");
  assert.equal(staff.start_url, "/staff");
  assert.equal(staff.scope, "/staff/");
  assert.equal(staff.display, "standalone");
  assert.notEqual(staff.id, member.id);
  assert.match(memberLayout, /manifest:\s*["']\/manifest\.json["']/);
  assert.match(staffLayout, /manifest:\s*["']\/staff-manifest\.webmanifest["']/);
  assert.match(staffLayout, /BestGymsMalta Staff Portal/);
  assert.match(staffLayout, /title:\s*["']BGM Staff["']/);
});

test("Staff offline caching uses Staff manifest and preserves other apps' caches", () => {
  assert.match(serviceWorker, /"\/staff-manifest\.webmanifest"/);
  assert.doesNotMatch(serviceWorker, /"\/manifest\.json"/);
  assert.match(serviceWorker, /key\.startsWith\("bgm-staff-"\)/);
  assert.match(serviceWorker, /bgm-staff-auth-v1/);
  assert.match(serviceWorker, /bgm-staff-bar-api-v1/);
});

test("HU20 admin backgrounds and native form fields have contrasting colors", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.bgm-admin-light\s*\{/);
  assert.match(css, /\.bgm-admin-light\s+:is\(input/);
  for (const path of [
    "app/staff/admin/staff/terminals/page.tsx",
    "app/staff/admin/staff/terminals/enrollment/page.tsx",
  ]) {
    const page = read(path);
    assert.match(page, /<main className="bgm-admin-light min-h-screen bg-slate-50 p-5 text-slate-900">/);
    assert.match(page, /<div className="mx-auto max-w-3xl">/);
    assert.match(page, /<\/div><\/main>/);
  }
});
