import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Super Admin membership tools open the privileged member editor", () => {
  const tools = source("components/staff/SuperAdminMembershipTools.tsx");
  const browser = source("components/staff/StaffMemberBrowser.tsx");
  const dashboard = source("components/staff/StaffDashboard.tsx");
  assert.match(tools, /<StaffMemberBrowser canRenew canEdit isSuperAdmin\s*\/>/);
  assert.match(browser, /isSuperAdmin \? `\/staff\/admin\/members\/\$\{encodeURIComponent\(selected\.id\)\}`/);
  assert.match(browser, /: `\/staff\/members\/\$\{encodeURIComponent\(selected\.id\)\}\/edit`/);
  assert.match(dashboard, /isSuperAdmin=\{user\.isSuperAdmin\}/);
});

test("Old staff-edit URLs safely forward Super Admin to existing editor", () => {
  const editor = source("components/staff/StaffMemberPersonalDetailsEditor.tsx");
  const api = source("app/api/system/members/[memberId]/personal-details/route.ts");
  const privilegedPage = source("app/staff/admin/members/[memberId]/page.tsx");
  assert.match(editor, /response\.status === 403 && data\.error === "Use the Super Admin member editor\."/);
  assert.match(editor, /window\.location\.replace\(`\/staff\/admin\/members\/\$\{encodeURIComponent\(memberId\)\}`\)/);
  assert.match(api, /if \(auth\.context\.isSuperAdmin\)/);
  assert.match(api, /Use the Super Admin member editor/);
  assert.match(privilegedPage, /SuperAdminMemberEditor/);
});
