import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const routeUrl = new URL("../app/api/cron/staff-midnight-auto-clock-out/route.ts", import.meta.url);
const routePath = fileURLToPath(routeUrl);
const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";
const vercel = JSON.parse(
  fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);

test("staff midnight auto clock-out cron is secured and scheduled daily without changing the existing reminder cron", () => {
  assert.ok(route.length > 0, "midnight auto clock-out cron route must exist");
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /authorization/);
  assert.match(route, /bgm_staff_auto_close_midnight_sessions/);
  assert.match(route, /p_now/);
  assert.match(route, /Cache-Control/);

  assert.ok(Array.isArray(vercel.crons));

  const midnightCrons = vercel.crons.filter(
    (item) => item.path === "/api/cron/staff-midnight-auto-clock-out",
  );
  assert.equal(midnightCrons.length, 1);
  assert.equal(midnightCrons[0].schedule, "0 0 * * *");

  const reminderCrons = vercel.crons.filter(
    (item) => item.path === "/api/cron/membership-expiry-reminders",
  );
  assert.equal(reminderCrons.length, 1);
  assert.equal(reminderCrons[0].schedule, "15 7 * * *");
});
