import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const vercel = read("vercel.json");
const cronRoute = read("app/api/cron/automatic-end-of-day/route.ts");
const helper = read("lib/automaticEndOfDayCore.ts");
const migration = read("supabase/migrations/20261103_124500_automatic_end_of_day.sql");
const eodRoute = read("app/api/system/end-of-day/route.ts");
const adminPage = read("components/staff/EndOfDayAdminPage.tsx");

test("automatic EOD cron is DST-safe and only acts at Malta 23:46", () => {
  assert.match(vercel, /\/api\/cron\/automatic-end-of-day/);
  assert.match(vercel, /46 21,22 \* \* \*/);
  assert.match(cronRoute, /CRON_SECRET/);
  assert.match(cronRoute, /shouldRunAutomaticEndOfDay/);
  assert.match(cronRoute, /bgm_auto_submit_missing_end_of_day/);
  assert.match(helper, /Europe\/Malta/);
  assert.match(helper, /hour\s*===\s*23/);
  assert.match(helper, /minute\s*===\s*46/);
});

test("database fallback checks 22:30 to 23:46 window under the EOD advisory lock", () => {
  assert.match(migration, /submission_source/);
  assert.match(migration, /'staff'/);
  assert.match(migration, /'system'/);
  assert.match(migration, /Automatic — System Submission/);
  assert.match(migration, /22:30/);
  assert.match(migration, /23:46/);
  assert.match(migration, /status\s*=\s*'active'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /bgm-eod:/);
  assert.match(migration, /bgm_auto_submit_missing_end_of_day/);
});

test("Super Admin report API and UI expose automatic submission source clearly", () => {
  assert.match(eodRoute, /submission_source/);
  assert.match(eodRoute, /submissionSource/);
  assert.match(adminPage, /submissionSource/);
  assert.match(adminPage, /Automatic — System Submission/);
});
