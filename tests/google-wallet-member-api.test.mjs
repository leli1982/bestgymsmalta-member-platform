import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectGoogleWalletMember } from "../lib/googleWalletCore.ts";

const root = new URL("..", import.meta.url).pathname;
const syncPath = join(root, "lib/googleWalletSync.ts");
const routePath = join(root, "app/api/member/google-wallet/route.ts");

function eligibleSnapshot(overrides = {}) {
  return {
    memberId: "11111111-1111-4111-8111-111111111111",
    fullName: "Test Member",
    memberNumber: "BGM26442",
    status: "active",
    membershipExpiry: "2026-10-09",
    cancellationEffectiveDate: null,
    archivedAt: null,
    activeCardBarcode: "CARD-12345",
    ...overrides,
  };
}

test("Wallet eligibility refuses non-access states but keeps expiry day eligible", () => {
  const today = "2026-10-09";
  assert.equal(projectGoogleWalletMember(eligibleSnapshot(), today).eligibleToAdd, true);
  assert.equal(projectGoogleWalletMember(eligibleSnapshot({ archivedAt: "2026-10-01T10:00:00Z" }), today).reason, "archived");
  assert.equal(projectGoogleWalletMember(eligibleSnapshot({ membershipExpiry: "2026-10-08" }), today).reason, "expired");
  assert.equal(projectGoogleWalletMember(eligibleSnapshot({ cancellationEffectiveDate: today }), today).reason, "cancelled");
  assert.equal(projectGoogleWalletMember(eligibleSnapshot({ activeCardBarcode: null }), today).reason, "card_missing");
});

test("Wallet sync loads canonical member state and only the current active card", () => {
  assert.equal(existsSync(syncPath), true, "googleWalletSync.ts must exist");
  const sync = readFileSync(syncPath, "utf8");

  assert.match(sync, /export async function loadGoogleWalletMemberSnapshot/);
  assert.match(sync, /from\(["']bgm_members["']\)/);
  assert.match(sync, /member_number/);
  assert.match(sync, /full_name/);
  assert.match(sync, /status/);
  assert.match(sync, /membership_expiry/);
  assert.match(sync, /cancellation_effective_date/);
  assert.match(sync, /archived_at/);
  assert.match(sync, /from\(["']bgm_member_card_credentials["']\)/);
  assert.match(sync, /\.eq\(["']status["'],\s*["']active["']\)/);
  assert.match(sync, /barcode_value/);
  assert.match(sync, /order\(["']updated_at["'],\s*\{\s*ascending:\s*false\s*\}\)/);
});

test("Wallet sync is idempotent, durable, and never provisions from provision:false", () => {
  const sync = readFileSync(syncPath, "utf8");

  assert.match(sync, /export async function syncGoogleWalletPassForMember/);
  assert.match(sync, /provision:\s*boolean/);
  assert.match(sync, /["']not_provisioned["']/);
  assert.match(sync, /["']unavailable["']/);
  assert.match(sync, /["']synced["']/);
  assert.match(sync, /["']failed["']/);
  assert.match(sync, /googleWalletObjectId\(/);
  assert.match(sync, /\.upsert\(/);
  assert.match(sync, /onConflict:\s*["']member_id["']/);
  assert.match(sync, /sync_status:\s*["']pending["']/);
  assert.match(sync, /sync_status:\s*["']synced["']/);
  assert.match(sync, /sync_status:\s*["']failed["']/);
  assert.match(sync, /safeGoogleWalletError\(/);

  const noProvisionGuard = sync.indexOf('return "not_provisioned"');
  const mappingUpsert = sync.indexOf(".upsert(");
  assert.ok(noProvisionGuard >= 0 && mappingUpsert > noProvisionGuard, "provision:false guard must run before mapping upsert");
});

test("best-effort Wallet sync dedupes members, does not provision, and cannot throw into BGM callers", () => {
  const sync = readFileSync(syncPath, "utf8");

  assert.match(sync, /export async function bestEffortSyncGoogleWalletMembers/);
  assert.match(sync, /new Set\(memberIds/);
  assert.match(sync, /provision:\s*false/);
  assert.match(sync, /try\s*\{/);
  assert.match(sync, /catch\s*\{/);
});

test("member Wallet API is session-bound and exposes only member-safe status/save URL", () => {
  assert.equal(existsSync(routePath), true, "member Google Wallet route must exist");
  const route = readFileSync(routePath, "utf8");

  assert.match(route, /export async function GET\(request:\s*NextRequest\)/);
  assert.match(route, /export async function POST\(request:\s*NextRequest\)/);
  assert.match(route, /getMemberRequestSession\(request\)/);
  assert.match(route, /status:\s*401/);
  assert.doesNotMatch(route, /searchParams|get\(["']memberId["']\)/);

  for (const key of ["available", "eligible", "reason", "provisioned", "syncStatus", "lastSyncedAt"]) {
    assert.match(route, new RegExp(`\\b${key}\\b`));
  }
  assert.match(route, /saveUrl/);
  assert.match(route, /syncGoogleWalletPassForMember\(session\.memberId,\s*\{\s*provision:\s*true\s*\}\)/);
  assert.match(route, /projectGoogleWalletMember\(/);
  assert.match(route, /todayMaltaDate\(\)/);
});

test("member Wallet API never serializes Google credentials or raw provider errors", () => {
  const route = readFileSync(routePath, "utf8");

  assert.doesNotMatch(route, /GOOGLE_WALLET_PRIVATE_KEY|privateKey|serviceAccountEmail|accessToken|last_error/);
  assert.doesNotMatch(route, /error\.message|String\(error\)/);
  assert.match(route, /Google Wallet is unavailable/i);
  assert.match(route, /Could not prepare Google Wallet/i);
});
