import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260916_130000_public_membership_enrollment.sql",
  "utf8"
);

test("gyms receive a stable unique public enrollment slug", () => {
  assert.match(sql, /public_enrollment_slug\s+text/i);
  assert.match(sql, /unique\s+index[\s\S]*public_enrollment_slug/i);
  assert.match(sql, /bgm-birkirkara[\s\S]*birkirkara/i);
  assert.match(sql, /bgm-talqroqq[\s\S]*talqroqq/i);
});

test("public applications store server-authoritative price and declaration snapshots", () => {
  for (const field of [
    "application_source",
    "submitted_on_malta",
    "base_price_cents",
    "price_catalog_version_id",
    "gym_rules_version_id",
    "privacy_version_id",
    "health_version_id",
    "declaration_snapshot",
    "document_readiness_ack_at",
  ]) {
    assert.match(sql, new RegExp(field, "i"));
  }
  assert.match(sql, /application_source[\s\S]*staff[\s\S]*tablet[\s\S]*offline_staff/i);
  assert.match(sql, /alter\s+column\s+staff_name\s+drop\s+not\s+null/i);
});

test("participants store guardian, duplicate classification and per-person acceptance", () => {
  for (const field of [
    "town",
    "guardian_name",
    "guardian_id_number",
    "guardian_relationship",
    "guardian_phone",
    "guardian_email",
    "guardian_address",
    "under_18_at_submission",
    "identity_match_state",
    "matched_member_id",
    "duplicate_contact_warning",
    "gym_rules_accepted_at",
    "privacy_accepted_at",
    "health_accepted_at",
  ]) {
    assert.match(sql, new RegExp(field, "i"));
  }
  assert.match(sql, /identity_match_state[\s\S]*clear[\s\S]*active[\s\S]*expired_inactive/i);
});

test("rate limiting has a database bucket keyed without raw IP storage", () => {
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.bgm_public_enrollment_rate_buckets/i);
  assert.match(sql, /rate_key_hash/i);
  assert.match(sql, /window_start/i);
  assert.match(sql, /attempt_count/i);
  assert.doesNotMatch(sql, /\braw_ip\b|\bip_address\b/i);
});

test("atomic public-application RPC creates pending rows only and is service-role only", () => {
  assert.match(sql, /bgm_create_public_membership_application\s*\(\s*p_payload\s+jsonb\s*\)/i);
  assert.match(sql, /security\s+definer/i);
  assert.match(sql, /identity_match_state[\s\S]*active[\s\S]*raise\s+exception/i);
  assert.match(sql, /bgm_membership_applications/i);
  assert.match(sql, /bgm_membership_application_members/i);
  assert.match(sql, /bgm_audit_log/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.bgm_create_public_membership_application\(jsonb\)\s+from\s+(?:public|anon|authenticated)/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.bgm_create_public_membership_application\(jsonb\)\s+to\s+service_role/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.bgm_members\s*\(/i);
  assert.doesNotMatch(sql, /member_number/i);
  assert.doesNotMatch(sql, /card_number|barcode_value|nfc_uid/i);
});

test("public application creation validates participant count and never trusts an active identity match", () => {
  assert.match(sql, /membership_type[\s\S]*couples[\s\S]*2/i);
  assert.match(sql, /jsonb_array_length/i);
  assert.match(sql, /application_source[\s\S]*tablet/i);
  assert.match(sql, /status[\s\S]*submitted/i);
});
