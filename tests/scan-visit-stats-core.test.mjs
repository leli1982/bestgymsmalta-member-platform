import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summariseScanVisits, visitMaltaDate, visitMaltaHour } from "../lib/scanVisitStatsCore.ts";

function visit(id, gym, member, when) {
  return { id, gym_id: gym, member_id: member, checkin_at: when };
}
test("assigns staffed scanner check-in dates and hours using Malta local time including DST", () => {
  assert.equal(visitMaltaDate("2026-09-22T22:30:00Z"), "2026-09-23");
  assert.equal(visitMaltaHour("2026-09-22T22:30:00Z"), 0);
  assert.equal(visitMaltaHour("2026-01-01T23:30:00Z"), 0);
  assert.equal(visitMaltaHour("2026-03-29T01:30:00Z"), 3);
});
test("compares visited gyms, counts check-ins separately from unique members and drills into enrollment origins", () => {
  const rows = [
    visit("1", "birk", "birk-a", "2026-09-22T08:00:00Z"),
    visit("2", "birk", "birk-a", "2026-09-22T12:00:00Z"),
    visit("3", "birk", "qroqq-a", "2026-09-22T09:00:00Z"),
    visit("4", "birk", "naxxar-a", "2026-09-22T22:15:00Z"),
    visit("5", "birk", "naxxar-b", "2026-09-22T10:00:00Z"),
    visit("6", "marsa", "naxxar-a", "2026-09-22T18:00:00Z"),
    visit("7", "marsa", "unknown-a", "2026-09-22T18:30:00Z"),
  ];
  const origins = {
    "birk-a": "birk", "qroqq-a": "qroqq", "naxxar-a": "naxxar",
    "naxxar-b": "naxxar", "unknown-a": null,
  };
  const names = { birk: "Birkirkara", qroqq: "Tal-Qroqq", naxxar: "Naxxar", marsa: "Marsa" };
  const s = summariseScanVisits(rows, origins, names);
  assert.equal(s.visits, 7);
  assert.equal(s.uniqueMembers, 5, "A member visiting two gyms counts once across all gyms");
  assert.equal(s.byGym[0].gymId, "birk");
  assert.equal(s.byGym[0].visits, 5);
  assert.equal(s.byGym[0].uniqueMembers, 4);
  assert.deepEqual(s.byGym[0].origins, [
    { gymId: "birk", gymName: "Birkirkara", visits: 2, uniqueMembers: 1 },
    { gymId: "naxxar", gymName: "Naxxar", visits: 2, uniqueMembers: 2 },
    { gymId: "qroqq", gymName: "Tal-Qroqq", visits: 1, uniqueMembers: 1 },
  ]);
  assert.equal(s.byGym[0].origins.reduce((total, entry) => total + entry.visits, 0), 5);
  assert.deepEqual(s.byDay, [
    { date: "2026-09-22", visits: 6 }, { date: "2026-09-23", visits: 1 },
  ]);
  assert.equal(s.byHour.find((slot) => slot.hour === 0).visits, 1);
  assert.deepEqual(s.byGym[1].origins.find((row) => row.gymId === "unknown"), {
    gymId: "unknown", gymName: "Enrollment gym unknown", visits: 1, uniqueMembers: 1,
  });
});
test("empty range returns zeros with no misleading gym ranking", () => {
  const s = summariseScanVisits([], {}, {});
  assert.equal(s.visits, 0);
  assert.equal(s.uniqueMembers, 0);
  assert.deepEqual(s.byGym, []);
  assert.equal(s.byHour.length, 24);
  assert.ok(s.byHour.every((slot) => slot.visits === 0));
});
test("Super Admin scanner stats API uses canonical successful barcode and NFC check-ins, date filters and complete paging", () => {
  const api = readFileSync(new URL("../app/api/system/scan-visit-stats/route.ts", import.meta.url), "utf8");
  assert.match(api, /requireSuperAdmin\(request\)/);
  assert.match(api, /\.from\("bgm_member_checkins"\)/);
  assert.match(api, /\.in\("source", \["barcode", "nfc"\]\)/);
  assert.match(api, /\.gte\("checkin_at", start\)\.lt\("checkin_at", end\)/);
  assert.match(api, /maltaDayUtcRange\(from\)\.start/);
  assert.match(api, /maltaDayUtcRange\(to\)\.end/);
  assert.match(api, /if \(gymId\) query = query\.eq\("gym_id", gymId\)/);
  assert.match(api, /offset \+= pageSize/);
  assert.match(api, /\.in\("id", memberIds\.slice\(offset, offset \+ memberBatchSize\)\)/);
  assert.match(api, /maxRows/);
});
