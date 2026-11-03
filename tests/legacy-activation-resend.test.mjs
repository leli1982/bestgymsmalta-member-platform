import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../app/api/system/admin/members/[memberId]/resend-activation-email/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../components/staff/SuperAdminMemberAccountActions.tsx", import.meta.url), "utf8");
const mailer = readFileSync(new URL("../lib/welcomeMailer.ts", import.meta.url), "utf8");
test("resend requires Super Admin and targets the saved email only", () => {
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /member\.member_number !== body\.confirmedMemberNumber/);
  assert.match(route, /member\.updated_at !== body\.expectedUpdatedAt/);
  assert.match(route, /member\.legacy_pk_customer/);
  assert.match(route, /member\.app_enrolled !== true/);
  assert.match(route, /member\.password_hash/);
  assert.match(route, /recipient = String\(member\.email/);
  assert.doesNotMatch(route, /body\.email|body\.recipient/);
  assert.doesNotMatch(route, /\.update\(|\.upsert\(/);
});
test("resend uses branded mailer, cooldown, and audit; UI confirms recipient", () => {
  assert.match(route, /sendLegacyActivationConfirmationEmail/);
  assert.match(route, /RESEND_COOLDOWN_MS/);
  assert.match(route, /member\.legacy_activation_email\.resent/);
  assert.match(route, /bgm_audit_log/);
  assert.match(ui, /Resend activation confirmation/);
  assert.match(ui, /window\.confirm/);
  assert.match(mailer, /replyTo: "info@bestgymsmalta\.com"/);
  assert.match(mailer, /bgmEmailFooterHtml\(\)/);
});
