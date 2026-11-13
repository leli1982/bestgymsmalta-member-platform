import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("HU20 terminal can inspect a TEST enrollment with protected Vercel session but never capture/upload", () => {
  const script = fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-EnrollmentCheck.ps1", "utf8");
  assert.match(script, /Read-PrivateText/);
  assert.match(script, /_vercel_share=/);
  assert.match(script, /-WebSession \$webSession/g);
  assert.match(script, /api\/staff-hu20\/enrollments\/pending/);
  assert.match(script, /fingerprintCaptureEnabled -ne \$false/);
  assert.match(script, /Fingerprint upload and attendance remain DISABLED/);
  assert.match(script, /-MaximumRedirection 0/);
  assert.doesNotMatch(script, /GetImageEx|CreateTemplate|encrypted_template|recordStaffPunch|bgm_staff_record_punch|Invoke-RestMethod.*-Method Post/);
});
