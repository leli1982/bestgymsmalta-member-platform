import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const script = fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-TerminalCheck.ps1", "utf8");

test("HU20 connection helper bootstraps a private same-origin Vercel Share session", () => {
  assert.match(script, /_vercel_share=/);
  assert.match(script, /Read-Host \$promptText -AsSecureString/);
  assert.match(script, /\$webSession = New-Object Microsoft\.PowerShell\.Commands\.WebRequestSession/m);
  assert.match(script, /-WebSession \$webSession/g);
  assert.match(script, /\$shareUri\.Host -notmatch/);
  assert.match(script, /\$shareUri\.Host -ne \$baseUri\.Host/);
  assert.match(script, /Testing the token ONLY against the specified TEST deployment/);
  // A Share token must never cause an HTTP request to the user-pasted host.
  assert.match(script, /\$primeUrl = "\$base\/\?_vercel_share=/);
  assert.doesNotMatch(script, /Invoke-WebRequest -Uri \$shareLink|Invoke-WebRequest -Uri \$shareUri/);
  assert.match(script, /\$prime\.BaseResponse\.ResponseUri\.Host -ne \$baseUri\.Host/);
  assert.match(script, /-MaximumRedirection 0/);
  assert.match(script, /application\/json/);
  assert.doesNotMatch(script, /bgm_staff_record_punch|encrypted_template|private-test\.bgmcred/);
});
