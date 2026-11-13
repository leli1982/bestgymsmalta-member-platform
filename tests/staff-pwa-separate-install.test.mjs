import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (path) => fs.readFileSync(path, "utf8");

test("Members keep the root installation while Staff installs separately", () => {
  const member = JSON.parse(read("public/manifest.json"));
  const staff = JSON.parse(read("public/staff-manifest.webmanifest"));
  const memberLayout = read("app/layout.tsx");
  const staffLayout = read("app/staff/layout.tsx");

  assert.equal(member.id, "/");
  assert.equal(member.start_url, "/");
  assert.equal(member.scope, "/");
  assert.equal(staff.id, "/staff");
  assert.equal(staff.start_url, "/staff");
  assert.equal(staff.scope, "/staff");
  assert.equal(staff.display, "standalone");
  assert.notEqual(staff.id, member.id);
  assert.match(memberLayout, /manifest:\s*["']\/manifest\.json["']/);
  assert.match(staffLayout, /manifest:\s*["']\/staff-manifest\.webmanifest["']/);
  assert.match(staffLayout, /BestGymsMalta Staff Portal/);
});

test("Staff offline worker caches its own manifest without deleting other PWA caches", () => {
  const worker = read("public/staff-sw.js");
  assert.match(worker, /bgm-staff-shell-v7/);
  assert.match(worker, /"\/staff-manifest\.webmanifest"/);
  assert.doesNotMatch(worker, /"\/manifest\.json"/);
  assert.match(worker, /key\.startsWith\("bgm-staff-"\)/);
  assert.match(worker, /"\/staff\/offline"/);
  assert.match(worker, /"\/staff\/members\/enroll"/);
});
