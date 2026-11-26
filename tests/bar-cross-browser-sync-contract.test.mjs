import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync("components/staff/BarSalesPage.tsx", "utf8");

test("Bar detects EOD on the reused order even across a different browser", () => {
  assert.match(ui, /BAR_SYNC_INTERVAL_MS = 5000/);
  assert.match(ui, /window\.setInterval\(refresh, BAR_SYNC_INTERVAL_MS\)/);
  assert.match(ui, /left\.updatedAt === right\.updatedAt/);
  assert.match(ui, /cache: "no-store"/);
  assert.match(ui, /!sameSheetRevision\(sheet, next\)/);
  assert.match(ui, /applySheet\(next, catalog\)/);
  assert.match(ui, /window\.addEventListener\("online", refresh\)/);
  assert.match(ui, /window\.addEventListener\("focus", refresh\)/);
  assert.match(ui, /controller\.abort\(\)/);
});

test("background refresh never applies over a local edit or in-flight save", () => {
  assert.match(ui, /if \(controller\.signal\.aborted \|\| pendingEditRef\.current \|\| savingRef\.current/);
  assert.match(ui, /interactionRef\.current !== interaction/);
  assert.match(ui, /payload\.gymId !== location/);
  assert.match(ui, /if \(pendingEditRef\.current === token\) \{\s*pendingEditRef\.current = 0;\s*setDirtyToken\(0\)/);
});

test("stale full-sheet snapshots are stopped when a newer server revision is observed", () => {
  const preflight = ui.indexOf("const current = await readOpenSheet(gymId)");
  const conflict = ui.indexOf("if (!sameSheetRevision(sheet, current))");
  const write = ui.indexOf('method: "PUT"');
  assert.ok(preflight >= 0 && preflight < conflict && conflict < write);
  assert.match(ui, /conflictRef\.current = true/);
  assert.match(ui, /pendingEditRef\.current !== token \|\| savingRef\.current/);
});
