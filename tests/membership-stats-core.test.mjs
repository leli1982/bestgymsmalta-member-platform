import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { maltaActivationDate, summariseNewMemberships } from "../lib/membershipStatsCore.ts";

test("assigns membership activation to Malta day at UTC midnight and DST", () => {
  assert.equal(maltaActivationDate("2026-09-22T22:30:00Z"), "2026-09-23");
  assert.equal(maltaActivationDate("2026-01-01T23:30:00Z"), "2026-01-02");
  assert.equal(maltaActivationDate("2026-03-29T22:30:00Z"), "2026-03-30");
});
test("counts one membership per activated new application, groups gyms/days/types, and names historical gyms", () => {
  const rows = [
    { id: "1", enrollment_gym_id: "bgm-marsa", membership_type: "single", activated_at: "2026-09-22T20:10:00Z" },
    { id: "2", enrollment_gym_id: "bgm-marsa", membership_type: "couples", activated_at: "2026-09-22T22:10:00Z" },
    { id: "3", enrollment_gym_id: "bgm-birkirkara", membership_type: "student", activated_at: "2026-09-22T21:45:00Z" },
    { id: "4", enrollment_gym_id: "bgm-historic", membership_type: "single", activated_at: "2026-09-23T08:15:00Z" },
  ];
  const report = summariseNewMemberships(rows, {
    "bgm-marsa": "Marsa Fitness", "bgm-birkirkara": "Birkirkara Fitness",
  });
  assert.equal(report.total, 4);
  assert.equal(report.gymsWithEnrollments, 3);
  assert.deepEqual(report.byDay, [
    { date: "2026-09-22", count: 2 }, { date: "2026-09-23", count: 2 },
  ]);
  assert.deepEqual(report.byGym, [
    { gymId: "bgm-marsa", gymName: "Marsa Fitness", count: 2 },
    { gymId: "bgm-birkirkara", gymName: "Birkirkara Fitness", count: 1 },
    { gymId: "bgm-historic", gymName: "bgm-historic", count: 1 },
  ]);
  assert.deepEqual(report.byType, { single: 2, couples: 1, student: 1 });
});
test("empty selection yields zero rather than historical or pending membership totals", () => {
  const report = summariseNewMemberships([], {});
  assert.equal(report.total, 0);
  assert.deepEqual(report.byGym, []);
  assert.deepEqual(report.byDay, []);
  assert.deepEqual(report.byType, { single: 0, couples: 0, student: 0 });
});
test("stats API requires Super Admin, filters completed new activations and paginates independent of order history", () => {
  const api = readFileSync(new URL("../app/api/system/membership-stats/route.ts", import.meta.url), "utf8");
  assert.match(api, /requireSuperAdmin\(request\)/);
  assert.match(api, /eq\("application_kind", "new"\)/);
  assert.match(api, /eq\("status", "activated"\)/);
  assert.match(api, /gte\("activated_at", start\)/);
  assert.match(api, /lt\("activated_at", end\)/);
  assert.match(api, /maltaDayUtcRange\(from\)\.start/);
  assert.match(api, /maltaDayUtcRange\(to\)\.end/);
  assert.match(api, /if \(gymId\) query = query\.eq\("enrollment_gym_id", gymId\)/);
  assert.match(api, /offset \+= pageSize/);
  assert.doesNotMatch(api, /\.limit\(200\)/);
});
