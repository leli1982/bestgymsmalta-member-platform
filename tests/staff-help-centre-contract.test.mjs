import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Staff layout mounts Help Centre globally", () => {
  const layout = read("app/staff/layout.tsx");
  assert.match(layout, /StaffHelpCentre/);
  assert.match(layout, /<StaffHelpCentre\s*\/>/);
});

test("Help Centre is authenticated, searchable and context aware", () => {
  const source = read("components/staff/StaffHelpCentre.tsx");
  assert.match(source, /\/api\/system\/auth/);
  assert.match(source, /How can we help\?/i);
  assert.match(source, /Search help/i);
  assert.match(source, /getContextStaffHelpTopic/);
  assert.match(source, /Open Full Staff Manual/i);
  assert.match(source, /Escape/);
});

test("Full Staff Help page reuses the same help source", () => {
  const page = read("app/staff/help/page.tsx");
  const manual = read("components/staff/StaffHelpManualPage.tsx");
  assert.match(page, /StaffHelpManualPage/);
  assert.match(manual, /STAFF_HELP_TOPICS/);
  assert.match(manual, /searchStaffHelpTopics/);
  assert.match(manual, /\/api\/system\/auth/);
});

test("Global Help avoids useSearchParams in the shared Staff layout", () => {
  const source = read("components/staff/StaffHelpCentre.tsx");
  assert.doesNotMatch(source, /useSearchParams/);
});
