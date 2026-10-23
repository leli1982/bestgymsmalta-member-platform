import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  collection: "app/api/system/staff-terminals/route.ts",
  detail: "app/api/system/staff-terminals/[terminalId]/route.ts",
  provision: "app/api/system/staff-terminals/[terminalId]/provision/route.ts",
  session: "app/api/staff-punch-clock/session/route.ts",
  terminalRequest: "lib/staffTerminalRequest.ts",
};

async function source(path) {
  return readFile(path, "utf8").catch(() => "");
}

test("terminal management and provisioning are Super Admin only", async () => {
  const [collection, detail, provision] = await Promise.all([
    source(files.collection),
    source(files.detail),
    source(files.provision),
  ]);

  for (const route of [collection, detail, provision]) {
    assert.match(route, /requireSuperAdmin\(request\)/);
  }
});

test("terminal secrets are hashed at rest and never returned by normal listing", async () => {
  const collection = await source(files.collection);
  assert.match(collection, /hashTerminalSecret/);
  assert.match(collection, /credential_hash\s*:\s*credentialHash/);
  assert.match(
    collection,
    /\.select\(["']id, gym_id, name, active, last_seen_at, created_at, updated_at["']\)/
  );
  assert.doesNotMatch(collection, /\.select\([^\n]*credential_hash/);
});

test("provisioning rotates the credential and sets a protected terminal cookie", async () => {
  const provision = await source(files.provision);
  assert.match(provision, /createTerminalSecret/);
  assert.match(provision, /hashTerminalSecret/);
  assert.match(provision, /httpOnly\s*:\s*true/);
  assert.match(provision, /sameSite\s*:\s*["']lax["']/i);
  assert.match(provision, /secure\s*:/);
  assert.match(provision, /staff\.terminal\.credential_rotated/);
});

test("kiosk session derives its gym only from the authenticated terminal cookie", async () => {
  const [session, terminalRequest] = await Promise.all([
    source(files.session),
    source(files.terminalRequest),
  ]);

  assert.match(session, /requireStaffTerminal\(request\)/);
  assert.match(terminalRequest, /terminalCookieName/);
  assert.match(terminalRequest, /bgm_staff_terminals/);
  assert.match(terminalRequest, /credential_hash/);
  assert.match(terminalRequest, /!terminal\.active/);
  assert.match(terminalRequest, /gymId:\s*terminal\.gym_id/);
  assert.doesNotMatch(session, /searchParams\.get\(["']gymId["']\)/);
  assert.doesNotMatch(session, /body\.gymId/);
});

test("terminal create and update actions write the required audit events", async () => {
  const [collection, detail] = await Promise.all([
    source(files.collection),
    source(files.detail),
  ]);
  assert.match(collection, /staff\.terminal\.created/);
  assert.match(detail, /staff\.terminal\.updated/);
  assert.match(detail, /staff\.terminal\.status_changed/);
});
