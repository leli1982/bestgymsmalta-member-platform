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

const dashboard = read("components/staff/StaffDashboard.tsx");
const browser = read("components/staff/StaffMemberBrowser.tsx");
const login = read("components/staff/StaffLoginPage.tsx");

test("staff login preserves existing auth endpoints and hands authenticated users to StaffDashboard", () => {
  assert.match(login, /fetch\(["']\/api\/system\/auth["']/);
  assert.match(login, /method:\s*["']POST["']/);
  assert.match(login, /method:\s*["']DELETE["']/);
  assert.match(login, /<StaffDashboard\s+user=\{user\}\s+onLogout=\{logout\}/);
});

test("staff dashboard is icon-first and exposes core reception actions", () => {
  for (const label of ["Members", "New Member", "Card / Reception", "Sundries", "Bar"]) {
    assert.match(dashboard, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(dashboard, /lucide-react/);
  assert.match(dashboard, /#ff5a0a/i);
  assert.match(dashboard, /Realtime|connection/i);
  assert.match(dashboard, /WAITING/);
  assert.doesNotMatch(dashboard, /gym selector/i);
});

test("member browser exposes browse search and All Active Expired filters", () => {
  assert.match(browser, /\/api\/system\/members\/search/);
  assert.match(browser, />ALL</i);
  assert.match(browser, />ACTIVE</i);
  assert.match(browser, />EXPIRED</i);
  assert.match(browser, /AbortController/);
  assert.match(browser, /member number|ID number|phone|email/i);
});

test("member browser is read-only and surfaces canonical status labels", () => {
  assert.match(browser, /ACTIVE/);
  assert.match(browser, /EXPIRED/);
  assert.match(browser, /INACTIVE/);
  assert.match(browser, /read-only|read only/i);
  assert.doesNotMatch(browser, /Save Member|Update Member/);
});