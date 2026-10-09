import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const routes = {
  card: "app/api/system/members/card/replace/route.ts",
  enroll: "app/api/system/members/enroll/route.ts",
  profile: "app/api/system/admin/members/[memberId]/route.ts",
  dates: "app/api/system/admin/members/[memberId]/membership-dates/route.ts",
  cancellation: "app/api/system/admin/members/[memberId]/cancellation/route.ts",
  couples: "app/api/system/admin/members/[memberId]/couples-cancellation/route.ts",
  account: "app/api/system/admin/members/[memberId]/account-status/route.ts",
};

function source(key) {
  return readFileSync(join(root, routes[key]), "utf8");
}

function assertPostSuccessHook(key, mutationMarker, expectedMembersPattern) {
  const route = source(key);
  assert.match(
    route,
    /import\s*\{\s*bestEffortSyncGoogleWalletMembers\s*\}\s*from\s*["']@\/lib\/googleWalletSync["']\s*;/,
    `${key} must import the Wallet sync helper`,
  );
  const mutation = route.indexOf(mutationMarker);
  const hook = route.indexOf("bestEffortSyncGoogleWalletMembers", mutation + mutationMarker.length);
  assert.notEqual(mutation, -1, `${key} mutation marker must exist`);
  assert.ok(hook > mutation, `${key} Wallet sync must occur after the canonical BGM mutation`);
  assert.match(route.slice(hook), expectedMembersPattern, `${key} must sync the correct member identities`);
  assert.match(
    route.slice(hook, hook + 500),
    /\.catch\(\(\)\s*=>\s*undefined\)/,
    `${key} must isolate a rejected Wallet sync from the successful BGM mutation`,
  );
}

test("card replacement syncs the replaced member only after replacement succeeds", () => {
  assertPostSuccessHook("card", "bgm_replace_member_card", /bestEffortSyncGoogleWalletMembers\(\[memberId\]\)/);
});

test("activation and renewal sync every member returned by the activation RPC", () => {
  const route = source("enroll");
  assert.match(route, /bestEffortSyncGoogleWalletMembers/);
  const mutation = route.indexOf("bgm_activate_membership_application");
  const errorBranch = route.indexOf("if (activationResult.error)", mutation);
  const hook = route.indexOf("bestEffortSyncGoogleWalletMembers", errorBranch);
  const successResponse = route.indexOf("activation: activationResult.data", hook);
  assert.ok(mutation >= 0 && errorBranch > mutation, "activation RPC and its error branch must exist");
  assert.ok(hook > errorBranch, "Wallet sync must only run after the activation error branch has been cleared");
  assert.ok(successResponse > hook, "activation success response must remain after the Wallet sync hook");
  assert.match(
    route.slice(errorBranch, successResponse),
    /activationResult\.data\?\.members|activationResult\.data\.members/,
    "activation hook must derive member IDs from activationResult.data.members",
  );
  assert.match(route.slice(hook, hook + 700), /\.catch\(\(\)\s*=>\s*undefined\)/,
    "a rejected Wallet sync must not turn an activated membership into an HTTP failure");
});

test("Super Admin profile edits sync the edited member after the audited profile RPC", () => {
  assertPostSuccessHook("profile", "bgm_super_admin_update_member_profile", /bestEffortSyncGoogleWalletMembers\(\[memberId\]\)/);
});

test("membership date corrections sync the edited member after the audited dates RPC", () => {
  assertPostSuccessHook("dates", "bgm_super_admin_correct_member_dates", /bestEffortSyncGoogleWalletMembers\(\[memberId\]\)/);
});

test("individual cancellation changes sync the edited member after the cancellation RPC", () => {
  assertPostSuccessHook("cancellation", "bgm_super_admin_member_cancellation", /bestEffortSyncGoogleWalletMembers\(\[memberId\]\)/);
});

test("couples cancellation syncs both identities only after the joint RPC succeeds", () => {
  assertPostSuccessHook(
    "couples",
    "bgm_super_admin_couples_cancellation",
    /bestEffortSyncGoogleWalletMembers\(\[memberId,\s*validation\.partnerId\]\)/,
  );
});

test("archive and restore sync the edited member after the account-status RPC", () => {
  assertPostSuccessHook("account", "bgm_super_admin_member_archive_restore", /bestEffortSyncGoogleWalletMembers\(\[memberId\]\)/);
});

test("best-effort hooks never provision a pass and isolate per-member failures", () => {
  const sync = readFileSync(join(root, "lib/googleWalletSync.ts"), "utf8");
  const helper = sync.slice(sync.indexOf("export async function bestEffortSyncGoogleWalletMembers"));
  assert.match(helper, /syncGoogleWalletPassForMember\(memberId,\s*\{\s*provision:\s*false\s*\}\)/);
  assert.match(helper, /try\s*\{[\s\S]*?await syncGoogleWalletPassForMember[\s\S]*?\}\s*catch\s*\{/);
  assert.doesNotMatch(helper, /provision:\s*true/);
});
