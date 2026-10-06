import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  collection: "app/api/system/staff-terminals/route.ts",
  detail: "app/api/system/staff-terminals/[terminalId]/route.ts",
  provision: "app/api/system/staff-terminals/[terminalId]/provision/route.ts",
  session: "app/api/staff-punch-clock/session/route.ts",
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
  assert.match(collection, /credential_hash/);
  assert.doesNotMatch(collection, /credentialHash\s*:/);
  assert.doesNotMatch(collection, /credential_hash\s*:/);
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
  const session = await source(files.session);
  assert.match(session, /bgm_staff_terminal|terminalCookieName/);
  assert.match(session, /bgm_staff_terminals/);
  assert.match(session, /credential_hash/);
  assert.match(session, /active/);
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
