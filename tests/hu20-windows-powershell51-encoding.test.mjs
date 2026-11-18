import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const nativeDir = "native/Bgm.SecuGenHu20Probe";
test("All Windows PowerShell 5.1 native scripts are ASCII-safe without BOM", () => {
  const names = fs.readdirSync(nativeDir).filter(name => name.endsWith(".ps1"));
  assert.ok(names.length >= 19, "Keep the full native HU20 script suite covered");
  for (const name of names) {
    const bytes = fs.readFileSync(path.join(nativeDir,name));
    // The Windows PowerShell 5.1 parser interprets BOM-less UTF-8 as the
    // system ANSI code page; even a single non-ASCII punctuation character
    // can corrupt a following quote and make a kiosk unusable.
    for (const value of bytes) {
      assert.ok(value < 128, name + " contains non-ASCII; use ASCII or save with an appropriate BOM");
    }
  }
});
test("Real-staff kiosk display mode retains its distinct TEST wording", () => {
  const src = fs.readFileSync(path.join(nativeDir,"Hu20-KioskDisplay.ps1"),"ascii");
  assert.match(src,/STAFF PILOT TEST - NOT PRODUCTION/);
  assert.match(src,/FICTIONAL TEST ONLY/);
});
