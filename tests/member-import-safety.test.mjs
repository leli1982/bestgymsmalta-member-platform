import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const previewRouteUrl = new URL(
  "../app/api/admin/members/import/preview/route.ts",
  import.meta.url
);
const legacyRouteUrl = new URL(
  "../app/api/admin/members/import/route.ts",
  import.meta.url
);
const batchRouteUrl = new URL(
  "../app/api/admin/members/import/batches/[batchId]/route.ts",
  import.meta.url
);
const ciWorkflowUrl = new URL(
  "../.github/workflows/phase2-ci.yml",
  import.meta.url
);

test("preview import never deletes omitted members", () => {
  const route = fs.readFileSync(previewRouteUrl, "utf8");
  assert.doesNotMatch(route, /\.from\(["']bgm_members["']\)\s*\.delete\(/s);
  assert.doesNotMatch(route, /membersToDelete|idsToDelete/);
});

test("legacy direct sync route contains no member deletion path", () => {
  const route = fs.readFileSync(legacyRouteUrl, "utf8");
  assert.doesNotMatch(route, /\.from\(["']bgm_members["']\)\s*\.delete\(/s);
  assert.doesNotMatch(route, /membersToDelete|idsToDelete|removedMemberNumbers/);
});

test("preview route requires the dedicated members.import permission", () => {
  const route = fs.readFileSync(previewRouteUrl, "utf8");
  assert.match(route, /requireSystemPermission\(request,\s*["']members\.import["']\)/);
});

test("import batch review exposes CardBarcode instead of legacy MembershipNumber", () => {
  const route = fs.readFileSync(batchRouteUrl, "utf8");
  assert.match(route, /card_barcode/);
  assert.match(route, /cardBarcode:\s*row\.card_barcode/);
  assert.doesNotMatch(route, /membershipNumber:\s*row\.membership_number/);
});

test("CI verifies pull requests to main and pushes to main", () => {
  const workflow = fs.readFileSync(ciWorkflowUrl, "utf8");
  assert.match(workflow, /pull_request:\s*\n\s*branches:\s*\n\s*- main/);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n(?:\s*- .*\n)*\s*- main/);
});
