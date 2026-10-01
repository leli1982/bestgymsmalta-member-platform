import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("Audit Trail is Super Admin-only and exposes staff plus user identity", () => {
  const api = read("app/api/system/audit-trail/route.ts");
  const ui = read("components/staff/AuditTrailAdmin.tsx");
  assert.match(api, /requireSuperAdmin\(request\)/);
  assert.match(api, /bgm_audit_trail_read/);
  assert.match(ui, /Staff name/);
  assert.match(ui, /User/);
  assert.match(ui, /system_username/);
  assert.match(ui, /system_display_name/);
});

test("Audit Trail supports filters, details and both Excel exports", () => {
  const ui = read("components/staff/AuditTrailAdmin.tsx");
  const exp = read("app/api/system/audit-trail/export/route.ts");
  for (const label of ["From","To","User","Gym","Action","Entity","Search"]) assert.match(ui, new RegExp(label));
  assert.match(ui, /Before/);
  assert.match(ui, /After/);
  assert.match(ui, /Export filtered Excel/);
  assert.match(ui, /Export complete Excel/);
  assert.match(exp, /ExcelJS/);
  assert.match(exp, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(exp, /Staff name/);
  assert.match(exp, /User display name/);
  assert.match(exp, /Username/);
});

test("future audit inserts automatically fill missing staff name from the system user", () => {
  const sql = read("supabase/migrations/20261001_143000_super_admin_audit_trail.sql");
  assert.match(sql, /bgm_audit_fill_staff_name/);
  assert.match(sql, /before insert on public\.bgm_audit_log/);
  assert.match(sql, /u\.display_name/);
  assert.match(sql, /revoke all on public\.bgm_audit_trail_read from public, anon, authenticated/);
});

test("Super Admin home includes the Audit Trail management tile", () => {
  const home = read("components/staff/SuperAdminHome.tsx");
  assert.match(home, /\/staff\/admin\/audit-trail/);
  assert.match(home, /Audit Trail/);
});
