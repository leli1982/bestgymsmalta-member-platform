// Batch 3 contract: light More, Goals, Check-in and QR scanner surfaces while preserving member/check-in behavior.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const moreRoutePath = join(root, "app/more/page.tsx");
const morePath = join(root, "components/more/MorePage.tsx");
const goalsPath = join(root, "app/goals/page.tsx");
const checkInRoutePath = join(root, "app/check-in/page.tsx");
const scanRoutePath = join(root, "app/scan-gym-qr/page.tsx");
const checkInPath = join(root, "components/checkins/CheckInPage.tsx");
const scanPath = join(root, "components/checkins/ScanGymQrPage.tsx");

test("Batch 3 routes use the approved light member shell", () => {
  const moreRoute = readFileSync(moreRoutePath, "utf8");
  const goals = readFileSync(goalsPath, "utf8");
  const checkInRoute = readFileSync(checkInRoutePath, "utf8");
  const scanRoute = readFileSync(scanRoutePath, "utf8");

  assert.match(moreRoute, /<AppShell\s+theme=["']light["']/);
  assert.match(goals, /<AppShell\s+theme=["']light["']/);
  assert.match(checkInRoute, /<AppShell\s+theme=["']light["']/);
  assert.match(scanRoute, /<AppShell\s+theme=["']light["']/);
});

test("More becomes a light account hub without changing member session and logout behavior", () => {
  const more = readFileSync(morePath, "utf8");

  assert.match(more, /data-member-surface=["']more-light["']/);
  assert.match(more, /bg-white/);
  assert.match(more, /border-zinc-200/);
  assert.match(more, /text-zinc-950/);
  assert.match(more, /getSavedMember\(\)/);
  assert.match(more, /clearSavedMember\(\)/);
  assert.match(more, /bgmMemberChanged/);
  assert.match(more, /https:\/\/m\.me\/bestgymsmalta/);
});

test("Goals uses a compact light goal presentation without inventing new persistence", () => {
  const goals = readFileSync(goalsPath, "utf8");

  assert.match(goals, /data-member-surface=["']goals-light["']/);
  assert.match(goals, /Current goal/);
  assert.match(goals, /Build strength and stay consistent\./);
  assert.match(goals, /bg-white/);
  assert.match(goals, /border-zinc-200/);
  assert.doesNotMatch(goals, /fetch\(/);
});

test("Check-in uses light working states while preserving API and passport logic", () => {
  const checkIn = readFileSync(checkInPath, "utf8");

  assert.match(checkIn, /data-member-surface=["']checkin-light["']/);
  assert.match(checkIn, /\/api\/gyms/);
  assert.match(checkIn, /\/api\/checkins\?memberId=/);
  assert.match(checkIn, /fetch\(["']\/api\/checkins["']/);
  assert.match(checkIn, /method:\s*["']POST["']/);
  assert.match(checkIn, /gym\.status !== ["']active["']/);
  assert.match(checkIn, /bg-white/);
  assert.match(checkIn, /border-zinc-200/);
  assert.match(checkIn, /text-zinc-950/);
});

test("QR scanner goes light around a dark camera viewport and preserves scan fallback behavior", () => {
  const scan = readFileSync(scanPath, "utf8");

  assert.match(scan, /data-member-surface=["']qr-light["']/);
  assert.match(scan, /window\.BarcodeDetector/);
  assert.match(scan, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(scan, /facingMode:\s*["']environment["']/);
  assert.match(scan, /\/check-in\?gymId=/);
  assert.match(scan, /Use the gym list below instead\./);
  assert.match(scan, /bg-black/);
  assert.match(scan, /bg-white/);
  assert.match(scan, /border-zinc-200/);
});
