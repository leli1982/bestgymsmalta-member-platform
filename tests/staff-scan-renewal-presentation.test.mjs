import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(path,"utf8");
test("Renewal cue is restricted to granted barcode scans and never changes admission", () => {
  const core=read("lib/staffScanRenewalCore.ts");
  const global=read("components/staff/StaffGlobalScanner.tsx");
  const home=read("components/staff/StaffHomeScanner.tsx");
  const reception=read("components/staff/BarcodeReceptionPage.tsx");
  const banner=read("components/staff/StaffScanRenewalBanner.tsx");
  assert.match(core, /if \(!granted \|\| !expiryDate/);
  assert.match(core, /days >= 0 && days <= 7 \? days : null/);
  for(const component of [global,home,reception]){
    assert.match(component, /getGrantedRenewalDaysRemaining/);
    assert.match(component, /bg-orange-500/);
    assert.match(component, /StaffScanRenewalBanner/);
    assert.match(component, /bg-(emerald|green)-600/);
    assert.match(component, /bg-red-600/);
  }
  assert.match(global, /!result\?\.offline/);
  assert.match(banner, /ACCESS GRANTED\. Please offer this member a renewal/);
  assert.match(banner, /RENEWAL DUE SOON/);
  assert.match(banner, /EXPIRES TODAY/);
  assert.match(banner, /EXPIRES TOMORROW/);
  assert.match(global, /GRANTED_RENEWAL_AUTO_CLOSE_MS = 8000/);
  assert.match(home, /dueDays !== null \? 8000 : 3500/);
  assert.match(reception, /renewalDays !== null \? 8000 : view\.autoResetMs/);
});

test("Existing access core still denies expired, inactive and wrong-gym scans", () => {
  const source=read("lib/barcodeAccessCore.ts");
  assert.match(source, /member\.status !== "active"/);
  assert.match(source, /member\.membershipExpiry < today/);
  assert.match(source, /result: "restricted_gym", granted: false/);
  assert.match(source, /result: "granted", granted: true/);
  const scan=read("app/api/system/barcode/scan/route.ts");
  assert.match(scan, /recordCanonicalCheckin/);
});
