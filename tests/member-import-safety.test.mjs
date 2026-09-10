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
