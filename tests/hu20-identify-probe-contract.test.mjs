import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("HU20 local 1:N requires private credentials, rejects ambiguity and cannot record attendance", () => {
  const code = fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-IdentifyProbe.ps1", "utf8");
  assert.match(code, /Get-ChildItem -LiteralPath \$folder -Filter '\*\.bgmcred' -File/);
  assert.match(code, /Read-EncryptedCredential/);
  assert.match(code, /Unlock-Credential/);
  assert.match(code, /Get-TransientTemplate \$manager/);
  assert.match(code, /MatchTemplate/);
  assert.match(code, /ONE_MATCH:/);
  assert.match(code, /AMBIGUOUS:/);
  assert.match(code, /NO_MATCH:/);
  assert.match(code, /Clear-Bytes \$live/);
  assert.match(code, /Clear-Bytes \$item\.Template/);
  assert.doesNotMatch(code, /Invoke-RestMethod|Invoke-WebRequest|bgm_staff_record_punch|recordStaffPunch/);
});
