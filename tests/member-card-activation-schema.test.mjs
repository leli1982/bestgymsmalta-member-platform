import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const s=fs.readFileSync(new URL('../supabase/migrations/20260910_113000_membership_card_activation.sql', import.meta.url),'utf8');
test('new activation requires photo and reserved card and promotes exact barcode atomically',()=>{
 assert.match(s,/official_photo_path/i);
 assert.match(s,/is null[\s\S]*photo/i);
 assert.match(s,/bgm_member_card_credentials/i);
 assert.match(s,/status = 'reserved'/i);
 assert.match(s,/member_number[\s\S]*barcode_value/i);
 assert.match(s,/status = 'active'/i);
 assert.match(s,/application_member_id = null/i);
 assert.match(s,/grant execute[\s\S]*service_role/i);
});
