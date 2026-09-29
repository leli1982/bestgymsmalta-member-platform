import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const read=(p)=>fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('card assignment reserves exact unused barcode for pending participant',()=>{
 const s=read('app/api/system/members/card/assign/route.ts');
 assert.match(s,/requireSystemPermission\(request,\s*["']cards\.assign["']\)/);
 assert.match(s,/normalizeBarcodePayload/);
 assert.match(s,/bgm_member_card_credentials/);
 assert.match(s,/status:\s*["']reserved["']/);
 assert.match(s,/application_member_id/);
 assert.match(s,/enrollment_gym_id/);
 assert.match(s,/delete\(\)[\s\S]*status["']?,\s*["']reserved["']/i);
});
test('pending membership review surfaces the exact physical-card scan action',()=>{
 const s=read('components/staff/StaffMembershipReviewModal.tsx');
 assert.match(s,/SCAN CARD/);
 assert.match(s,/\/api\/system\/members\/card\/assign/);
 assert.match(s,/applicationMemberId/);
 const home=read('components/staff/StaffDashboard.tsx');
 assert.match(home,/StaffMembershipQueue/);
});
