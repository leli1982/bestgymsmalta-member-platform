import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const login = readFileSync(new URL("../app/api/member/auth/login/route.ts", import.meta.url), "utf8");
const session = readFileSync(new URL("../app/api/member/auth/session/route.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/ui/AppShell.tsx", import.meta.url), "utf8");
const accessGate = readFileSync(new URL("../components/member/MemberAccessGate.tsx", import.meta.url), "utf8");
const workout = readFileSync(new URL("../app/api/member/workout-plan/route.ts", import.meta.url), "utf8");
const progress = readFileSync(new URL("../app/api/member/progress-photos/route.ts", import.meta.url), "utf8");

test("member login authenticates enrolled accounts and returns shared app access state", () => {
  assert.match(login, /resolveMemberAppAccess/);
  assert.match(login, /access/);
  assert.doesNotMatch(login, /member\.membership_expiry\s*&&\s*member\.membership_expiry\s*<\s*today/);
  assert.doesNotMatch(login, /This membership is inactive\. Please renew at reception/);
});

test("member session returns authoritative app access state", () => {
  assert.match(session, /resolveMemberAppAccess/);
  assert.match(session, /access/);
  assert.match(session, /publicMemberProfile/);
});

test("member shell installs the expiry access gate", () => {
  assert.match(shell, /MemberAccessGate/);
});

test("expiry-day member warning has dedicated copy and a day-specific dismissal key", () => {
  assert.match(accessGate, /Your membership expires today/);
  assert.match(accessGate, /Renew today to avoid interruption to your gym access/);
  assert.match(accessGate, /daysUntilExpiry/);
  assert.match(accessGate, /bgm-member-access-notice/);
});

test("member-only feature APIs permit grace and reject only locked access through the shared rule", () => {
  for (const source of [workout, progress]) {
    assert.match(source, /resolveMemberAppAccess/);
    assert.match(source, /state\s*===\s*["']locked["']/);
    assert.doesNotMatch(source, /membership_expiry\s*&&\s*member\.membership_expiry\s*<\s*todayString\(\)/);
  }
});

test("gym check-in remains outside the app-grace authorization rule", () => {
  const checkin = readFileSync(new URL("../app/api/checkins/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(checkin, /resolveMemberAppAccess/);
  assert.match(checkin, /membership_expiry/);
});
