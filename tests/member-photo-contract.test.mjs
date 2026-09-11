import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const read=(p)=>fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('photo capture is private, authenticated, and records provenance',()=>{
 const s=read('app/api/system/members/photo/route.ts');
 assert.match(s,/members\.photos\.capture/);
 assert.match(s,/bgm-member-photos/);
 assert.match(s,/official_photo_path/);
 assert.match(s,/bgm_member_official_photos/);
 assert.match(s,/applicationMemberId/);
 assert.match(s,/memberId/);
});
test('secure member photo delivery requires photo-view permission and signed URL',()=>{
 const s=read('app/api/system/members/photo/[memberId]/route.ts');
 assert.match(s,/members\.photos\.view/);
 assert.match(s,/createSignedUrl/);
 assert.doesNotMatch(s,/getPublicUrl/);
});
test('camera component captures webp and offers Use Photo and Retake',()=>{
 const s=read('components/staff/OfficialMemberPhotoCapture.tsx');
 assert.match(s,/getUserMedia/);
 assert.match(s,/image\/webp/);
 assert.match(s,/Use Photo/);
 assert.match(s,/Retake/);
});
