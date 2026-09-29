import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const forgot = fs.readFileSync("app/api/member/auth/forgot-password/route.ts", "utf8");
const change = fs.readFileSync("app/api/member/auth/change-password/route.ts", "utf8");
const login = fs.readFileSync("components/member-auth/MemberLoginPage.tsx", "utf8");
const ui = fs.readFileSync("components/member-auth/ChangePasswordPage.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260928_113500_member_password_resets.sql", "utf8");

test("forgot password token storage exists and is private", () => {
  assert.match(migration, /create table if not exists public\.bgm_member_password_resets/i);
  assert.match(migration, /token_hash text not null unique/i);
  assert.match(migration, /expires_at timestamptz not null/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.bgm_member_password_resets from anon, authenticated/i);
  assert.match(forgot, /bgm_member_password_resets/);
});

test("member change password verifies the current hash and replaces it securely", () => {
  assert.match(change, /getMemberRequestSession\(request\)/);
  assert.match(change, /bcrypt\.compare\(/);
  assert.match(change, /bcrypt\.hash\(newPassword, 10\)/);
  assert.match(change, /password_hash: passwordHash/);
  assert.match(change, /temp_password_must_change: false/);
  assert.match(change, /bgm_member_password_resets/);
});

test("member tools expose a self-service change password screen", () => {
  assert.match(login, /label: "Change Password"/);
  assert.match(login, /href: "\/change-password"/);
  assert.match(ui, /Current password/);
  assert.match(ui, /New password/);
  assert.match(ui, /Confirm new password/);
  assert.match(ui, /newPassword !== confirmPassword/);
});
