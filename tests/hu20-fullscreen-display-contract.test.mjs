import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const path = "native/Bgm.SecuGenHu20Probe/Hu20-KioskDisplay.ps1";
const source = fs.readFileSync(path, "utf8");

test("HU20 fullscreen display is only in-process, has a working exit, and shows TEST disclaimer", () => {
  assert.match(source,/System[.]Windows[.]Forms/);
  assert.match(source,/FormBorderStyle/);
  assert.match(source,/Maximized/);
  assert.match(source,/BESTGYMSMALTA/);
  assert.match(source,/FICTIONAL TEST ONLY/);
  assert.match(source,/No real employee punches/);
  assert.match(source,/Add_KeyDown/);
  assert.match(source,/Keys\]::Escape/);
  assert.match(source,/KIOSK_DISPLAY_CLOSED/);
  assert.match(source,/Assert-Hu20KioskDisplay/);
  assert.match(source,/Close-Hu20KioskDisplay/);
  assert.doesNotMatch(source, /HttpListener|NamedPipe|WebClient|Start-Process|Set-Content|Out-File|credential_hash|encrypted_template/);
});

test("display's result is presentation only, never a source of fingerprint or punch authority", () => {
  assert.match(source,/CLOCKED IN/);
  assert.match(source,/CLOCKED OUT/);
  assert.match(source,/NOT RECOGNISED/);
  assert.match(source,/PLEASE WAIT/);
  assert.doesNotMatch(source, /api\/|Invoke-RestMethod|Invoke-WebRequest|GetImage|MatchTemplate|staff_record_punch|record_attendance/);
});
