import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL("../"+p, import.meta.url),"utf8");
const scan=read("app/api/system/barcode/scan/route.ts");
const ui=read("components/staff/CardConflictCards.tsx");
const api=read("app/api/system/card-conflicts/assign/route.ts");
const sql=read("supabase/migrations/20261125_003300_resolve_explicitly_flagged_card.sql");
test("shared legacy claims enable staff confirmation outside frozen exceptions",()=>{
 assert.match(scan,/canResolveSharedLegacy: \(activeLegacyClaimCount > 1 \|\| pendingLegacyIds.length > 0\) && \(!card \|\| pendingModernEligible\)/);
 assert.match(ui,/members.every\(member => member.canResolveSharedLegacy\)/);
 assert.match(api,/!candidateNumbers.length && !sharedLegacy/);
 assert.match(api,/bgm_staff_resolve_shared_legacy_card/);
 assert.match(ui,/expectedMemberIds: sharedLegacy \? members.map/);
});
test("only exact current shared legacy claims may be changed",()=>{
 assert.match(sql,/v_ids is distinct from v_expected/);
 assert.match(sql,/member_id<>p_member_id/);
 assert.match(sql,/where scan3=v_code and assignment_status='active'/);
 assert.match(sql,/Existing modern or NFC credential requires Super Admin review/);
 assert.doesNotMatch(sql,/update public.bgm_members\b|delete from public.bgm_members\b/i);
 assert.match(sql,/update public.bgm_card_conflict_reviews set status='resolved'/);
 assert.match(sql,/insert into public.bgm_audit_log/);
 assert.match(sql,/security invoker/);
 assert.match(sql,/from public,anon,authenticated/);
});
