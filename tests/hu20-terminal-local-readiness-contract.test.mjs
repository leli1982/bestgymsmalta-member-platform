import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const local = fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-LocalReadiness.ps1", "utf8");
const ci = fs.readFileSync(".github/workflows/phase2-ci.yml", "utf8");
const begin = fs.readFileSync("app/api/staff-hu20/recognition/begin/route.ts", "utf8");
const ui = fs.readFileSync("app/staff/admin/staff/terminals/page.tsx", "utf8");

test("HU20 local diagnostics never collect secrets, scan, or phone home", () => {
  for (const s of ["Hu20-TestTerminal.local.json","ParseFile","sgfplib.dll",
    "Hu20-KIOSK-TEST.cmd","baseUrl","terminalId","sdkAssembly"]) assert.ok(local.includes(s), s);
  assert.doesNotMatch(local,/Read-Host|Invoke-WebRequest|Invoke-RestMethod|HttpClient|GetImageEx|CreateTemplate|OpenDevice|Start-Process|Set-Content|Out-File|Invoke-Expression/);
  assert.match(ci,/Hu20-LocalReadiness\.ps1/);
});

test("authenticated TEST recognition updates fleet contact before roster access", () => {
  const ping = begin.indexOf(".update({ last_seen_at:");
  const roster = begin.indexOf('db.from("bgm_staff_employees")');
  assert.ok(ping>0 && roster>ping);
  assert.match(begin,/eq\("active", true\)/);
  assert.match(begin,/if \(!contact\.data\) return fail\("TEST terminal deactivated\.", 401\)/);
  assert.match(ui,/Refresh terminal contacts/);
  assert.match(ui,/A recent authenticated request does not prove/);
});
