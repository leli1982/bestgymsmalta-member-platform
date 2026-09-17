import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260916_140000_membership_review_activation.sql",
  import.meta.url
);

test("Plan 03 review + activation migration exposes required persistence and RPCs", () => {
  const sql = fs.readFileSync(migrationUrl, "utf8");

  for (const marker of [
    "id_verified_at",
    "student_eligibility_verified_at",
    "guardian_present_verified_at",
    "guardian_cosign_verified_at",
    "same_address_verified_at",
    "discount_code_id",
    "discount_percentage_snapshot",
    "discount_amount_cents",
    "final_amount_cents",
    "payment_method",
    "payment_received_at",
    "bgm_apply_membership_application_review",
    "bgm_activate_membership_application",
  ]) {
    assert.match(sql, new RegExp(marker, "i"));
  }
});

test("new activation allocates a permanent BGM number independently of card barcode", () => {
  const sql = fs.readFileSync(migrationUrl, "utf8");

  assert.match(sql, /bgm_next_member_number\s*\(\s*\)/i);
  assert.match(sql, /'memberNumber'\s*,\s*v_member_number/i);
  assert.match(sql, /'cardBarcode'\s*,\s*v_card_barcode/i);
  assert.doesNotMatch(
    sql,
    /insert\s+into\s+public\.bgm_members[\s\S]{0,800}member_number[\s\S]{0,800}v_card\.barcode_value/i
  );
});

test("card replacement and renewal preserve permanent member number", () => {
  const sql = fs.readFileSync(migrationUrl, "utf8");

  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bgm_replace_member_card/i);
  assert.doesNotMatch(sql, /set\s+member_number\s*=\s*v_new_barcode/i);
  assert.doesNotMatch(sql, /set\s+member_number\s*=\s*v_member_number/i);
});

test("photo is non-blocking at activation", () => {
  const sql = fs.readFileSync(migrationUrl, "utf8");

  assert.doesNotMatch(sql, /official member photo is required before activation/i);
  assert.doesNotMatch(sql, /official member photo is required before renewal activation/i);
  assert.match(sql, /official_photo_path\s*=\s*coalesce/i);
});

test("activation revalidates verification, payment, discount and atomic couples state", () => {
  const sql = fs.readFileSync(migrationUrl, "utf8");

  assert.match(sql, /ID \/ passport verification is required/i);
  assert.match(sql, /Student eligibility verification is required/i);
  assert.match(sql, /Same-address verification is required/i);
  assert.match(sql, /Guardian presence verification is required/i);
  assert.match(sql, /Guardian co-sign verification is required/i);
  assert.match(sql, /payment_method\s+not\s+in\s+\('cash',\s*'card',\s*'other'\)/i);
  assert.match(sql, /successful_uses\s*=\s*successful_uses\s*\+\s*1/i);
  assert.match(sql, /for\s+update/i);
});

test("security-definer RPCs stay server-only", () => {
  const sql = fs.readFileSync(migrationUrl, "utf8");

  assert.match(sql, /revoke all on function public\.bgm_apply_membership_application_review\(jsonb\) from public/i);
  assert.match(sql, /grant execute on function public\.bgm_apply_membership_application_review\(jsonb\) to service_role/i);
  assert.match(sql, /revoke all on function public\.bgm_activate_membership_application\(uuid,\s*text,\s*uuid\) from public/i);
  assert.match(sql, /grant execute on function public\.bgm_activate_membership_application\(uuid,\s*text,\s*uuid\) to service_role/i);
});
