import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../app/api/system/members/offline-sync/route.ts", import.meta.url), "utf8");

test("offline sync is authenticated, multipart, and idempotency-first", () => {
  assert.match(route, /requireSystemPermission\(request, ["']members\.create["']\)/);
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /bgm_offline_membership_sync_receipts/);
  assert.match(route, /recoverActivatedApplication/);
});

test("offline sync verifies immutable historical price and declarations", () => {
  assert.match(route, /bgm_membership_price_catalog_versions/);
  assert.match(route, /published_at/);
  assert.match(route, /bgm_membership_price_entries/);
  assert.match(route, /content_sha256/);
  assert.match(route, /\["published", "retired"\]/);
  assert.match(route, /discountCode:\s*["']["']/);
});

test("offline sync rechecks identity and cards and uses the central activation RPC", () => {
  assert.match(route, /bgm_classify_membership_identity/);
  assert.match(route, /bgm_member_card_credentials/);
  assert.match(route, /decideOfflineSyncOutcome/);
  assert.match(route, /bgm_stage_offline_membership_application/);
  assert.match(route, /bgm_apply_membership_application_review/);
  assert.match(route, /bgm_activate_membership_application/);
  assert.doesNotMatch(route, /bgm_next_member_number/);
});

test("offline photo retries use deterministic storage keys", () => {
  assert.match(route, /offline\/\$\{clientSubmissionId\}\/\$\{index \+ 1\}\.webp/);
  assert.match(route, /upsert:\s*true/);
  assert.match(route, /onConflict:\s*["']object_path["']/);
});

test("server only reports local deletion-safe results after a persisted receipt", () => {
  assert.match(route, /persisted:\s*true/);
  assert.match(route, /bgm_record_offline_membership_sync_receipt/);
  assert.match(route, /result:\s*["']review_required["']/);
  assert.match(route, /result:\s*["']activated["']/);
});

test("offline sync binds cached config to the same gym and an active historical price entry", () => {
  assert.match(route, /clean\(context\.gymId\) !== gymId/);
  assert.match(route, /clean\(asRecord\(config\.gym\)\.id\) !== gymId/);
  assert.match(route, /price\.data\.is_active !== true/);
});
