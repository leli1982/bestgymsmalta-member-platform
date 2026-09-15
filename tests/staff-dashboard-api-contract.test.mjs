import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const memberSearchPath = join(root, "app/api/system/members/search/route.ts");
const source = readFileSync(memberSearchPath, "utf8");

test("member search remains system-auth protected", () => {
  assert.match(
    source,
    /requireSystemPermission\(request,\s*["']members\.view["']\)/
  );
});

test("staff member search includes ID number and status filter", () => {
  assert.match(source, /id_number/);
  assert.match(source, /searchParams\.get\(["']status["']\)/);
  assert.match(source, /searchParams\.get\(["']page["']\)/);
  assert.match(source, /searchParams\.get\(["']limit["']\)/);
});

test("staff member search supports blank-query browsing and server classifications", () => {
  assert.doesNotMatch(source, /query\.length\s*<\s*2/);
  assert.match(source, /classifyStaffMember/);
  assert.match(source, /classification/);
  assert.match(source, /enrollment_gym_id/);
});
