import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL("../"+p, import.meta.url),"utf8");
const scan=read("app/api/system/barcode/scan/route.ts");
const ui=read("components/staff/CardConflictCards.tsx");
const api=read("app/api/system/card-conflicts/assign/route.ts");
const sql=read("supabase/migrations/20261125_003300_resolve_explicitly_flagged_card.sql");
test("shared legacy claims enable staff confirmation outside frozen exceptions",()=>{
 assert.match(scan,/canResolveSharedLegacy: legacyResolutionSafe && \(activeLegacyClaimCount > 1 \|\| pendingLegacyIds.length > 0\) && !card/);
 assert.match(ui,/members.every\(member => member.canResolveSharedLegacy\)/);
 assert.match(api,/!candidateNumbers.length && !sharedLegacy/);
 assert.match(api,/bgm_staff_resolve_scanner_card_conflict/);
 assert.match(ui,/expectedMemberIds: verifiedConflict \? members.map/);
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

const prioritySql=read("supabase/migrations/20261126220000_scanner_priority_conflict_resolution.sql");
test("verified resolver preserves unrelated accounts and rejects stale candidates",()=>{
  assert.match(prioritySql,/v_ids is distinct from v_expected/);
  assert.match(prioritySql,/status='retired'/);
  assert.match(prioritySql,/insert into public\.bgm_member_card_credentials/);
  assert.match(prioritySql,/member_id<>p_member_id/);
  assert.match(prioritySql,/lookup_kind is distinct from 'physical_card'/);
  assert.match(prioritySql,/from public, anon, authenticated/);
  assert.doesNotMatch(prioritySql,/update public\.bgm_members\b|delete from public\.bgm_members\b/i);
  assert.match(scan,/canResolveCurrentConflict: currentConflictResolvable/);
  assert.match(ui,/I verified — assign this card/);
});
