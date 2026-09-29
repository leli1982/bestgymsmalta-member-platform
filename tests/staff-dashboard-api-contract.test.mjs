import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
function read(path) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return "";
  }
}

const memberSearchPath = "app/api/system/members/search/route.ts";
const source = read(memberSearchPath);
const queueSource = read("app/api/system/members/applications/route.ts");
const detailSource = read(
  "app/api/system/members/applications/[applicationId]/route.ts"
);
const enrollSource = read("app/api/system/members/enroll/route.ts");
const cardAssignSource = read("app/api/system/members/card/assign/route.ts");
const realtimeSource = read("lib/staffRealtime.ts");
const realtimeRoute = read("app/api/system/staff/realtime/route.ts");
const realtimeBridge = read("components/staff/StaffRealtimeBridge.tsx");

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

test("pending application queue is authenticated and gym scoped server side", () => {
  assert.match(queueSource, /requireSystemPermission|getSystemContext/);
  assert.match(queueSource, /enrollment_gym_id/);
  assert.match(queueSource, /auth\.context\.gymId/);
  assert.doesNotMatch(
    queueSource,
    /searchParams\.get\(["']gymId["']\)/
  );
  assert.match(queueSource, /submitted/);
  assert.match(queueSource, /awaiting_payment/);
});

test("application review enforces gym ownership before returning or correcting details", () => {
  assert.match(detailSource, /enrollment_gym_id/);
  assert.match(detailSource, /context\.gymId/);
  assert.match(detailSource, /gymScopeError\(application,\s*auth\.context\)/);
  assert.match(detailSource, /another gym|belongs to another gym/i);
  assert.match(detailSource, /bgm_correct_membership_application/);
  assert.doesNotMatch(detailSource, /body\.enrollmentGymId/);
});

test("original membership submission audit preserves the complete sanitized form", () => {
  assert.match(enrollSource, /membership\.application\.submit/);
  assert.match(enrollSource, /after_data/);
  assert.match(enrollSource, /participants\.map/);
  assert.match(enrollSource, /idNumber|id_number/);
  assert.match(enrollSource, /nextOfKin|next_of_kin/);
});

test("staff realtime topic is derived server-side and payload carries no member data", () => {
  assert.match(realtimeSource, /createHmac/);
  assert.match(realtimeSource, /membership-queue-changed/);
  assert.match(realtimeSource, /refresh:\s*true/);
  assert.doesNotMatch(
    realtimeSource,
    /fullName|email|phone|idNumber|photoUrl|memberNumber/
  );
});

test("realtime config is authenticated, gym-scoped, and never returns service-role credentials", () => {
  assert.match(realtimeRoute, /requireSystemPermission|getSystemContext/);
  assert.match(realtimeRoute, /gymId/);
  assert.match(realtimeRoute, /staffMembershipTopic/);
  assert.match(realtimeRoute, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(realtimeRoute, /searchParams\.get\(["']gym/);
  assert.doesNotMatch(realtimeRoute, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("staff realtime bridge treats broadcasts as refresh-only signals", () => {
  assert.match(realtimeBridge, /membership-queue-changed/);
  assert.match(realtimeBridge, /onQueueChanged/);
  assert.match(realtimeBridge, /SUBSCRIBED/);
  assert.match(realtimeBridge, /CHANNEL_ERROR|TIMED_OUT|CLOSED/);
  assert.doesNotMatch(
    realtimeBridge,
    /payload\.(fullName|email|phone|idNumber|photoUrl|memberNumber)/
  );
});

test("membership mutations broadcast refresh only after successful persistence", () => {
  assert.match(enrollSource, /broadcastStaffMembershipRefresh/);
  assert.match(cardAssignSource, /broadcastStaffMembershipRefresh/);
  assert.match(detailSource, /broadcastStaffMembershipRefresh/);
});
