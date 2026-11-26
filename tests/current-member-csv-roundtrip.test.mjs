import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  CURRENT_CSV_SCHEMA,CURRENT_CSV_COLUMNS,CURRENT_CSV_HEADERS,CURRENT_CSV_SCALAR_COLUMNS,HISTORY_COLUMNS,
  currentCsvCell,currentCsvDisplay,parseCurrentMemberCsv,parseCurrentCsvBaseline,getCurrentCsvScalarPatch,
  normalizeCurrentCsvDate,
} from "../lib/currentMemberCsvCore.ts";

const digest=v=>createHash("sha256").update(v).digest("hex");
function fixture(){
  const row=Object.fromEntries(CURRENT_CSV_COLUMNS.map(k=>[k,""]));
  Object.assign(row,{ExportSchema:CURRENT_CSV_SCHEMA,BGMNumber:"BGM9999912",MemberId:"00000000-0000-4000-8000-000000000012",UpdatedAt:"2026-11-26T14:00:00+00:00",FullName:"Fictional, CSV \"Member\"",Notes:"first line\nsecond line",LegacyPkCustomer:"00042",Mobile:currentCsvDisplay("+35699123456"),MemberExpiryDate:"2027-01-31",Status:"Active"});
  for(const field of HISTORY_COLUMNS)row[field]="[]";
  const baseline=JSON.stringify({schema:CURRENT_CSV_SCHEMA,project:"TEST",values:CURRENT_CSV_SCALAR_COLUMNS.map(k=>row[k]),histories:HISTORY_COLUMNS.map(k=>digest(row[k])),termUpdatedAt:null});
  return {row,baseline,signature:"a".repeat(64)};
}
const line=f=>[...CURRENT_CSV_COLUMNS.map(k=>f.row[k]),f.baseline,f.signature].map(currentCsvCell).join(",");
const file=(...rows)=>"\uFEFF"+CURRENT_CSV_HEADERS.map(currentCsvCell).join(",")+"\r\n"+rows.map(line).join("\r\n")+"\r\n";
test("complete CSV round trip preserves UTF-8, quotes, multiline values and identifiers; unchanged export is a no-op",()=>{
  const f=fixture(),[parsed]=parseCurrentMemberCsv(file(f));
  assert.deepEqual(parsed.row,f.row);
  assert.deepEqual(getCurrentCsvScalarPatch(parsed.row,parseCurrentCsvBaseline(parsed.baseline)),{});
  assert.equal(parsed.row.LegacyPkCustomer,"00042");
});
test("only explicit edits are passed; full European date normalized and original phone unchanged",()=>{
  const f=fixture();f.row.Notes="new text";f.row.MemberExpiryDate="01/02/2027";f.row.Mobile="+35699123456";
  const [parsed]=parseCurrentMemberCsv(file(f));
  assert.deepEqual(getCurrentCsvScalarPatch(parsed.row,parseCurrentCsvBaseline(parsed.baseline)),{Notes:"new text",MemberExpiryDate:"2027-02-01"});
});
test("reject immutable identity edits, duplicate rows, missing columns and protected metadata",()=>{
  const f=fixture();assert.throws(()=>parseCurrentMemberCsv(file(f,f)),/Duplicate member/);
  const a=fixture();a.row.BGMNumber="BGM9999913";assert.throws(()=>parseCurrentMemberCsv(file(a)),/Permanent member identity/);
  assert.throws(()=>parseCurrentMemberCsv("BGMNumber,Notes\r\nBGM9999912,new"),/complete BGM/);
  const b=fixture();b.row.PhysicalCard="X00001";const [parsed]=parseCurrentMemberCsv(file(b));
  assert.throws(()=>getCurrentCsvScalarPatch(parsed.row,parseCurrentCsvBaseline(parsed.baseline)),/protected/);
  assert.throws(()=>normalizeCurrentCsvDate("31/02/2027"),/Invalid calendar date/);
});
test("batch apply is update-only and checks current revisions and staged completeness",()=>{
  const sql=readFileSync(new URL("../supabase/migrations/20261126223000_current_member_csv_update_only.sql",import.meta.url),"utf8");
  assert.doesNotMatch(sql,/delete\s+from\s+public\.bgm_members\b|truncate\s+(?:table\s+)?public\.bgm_members\b|insert\s+into\s+public\.bgm_members\b/i);
  assert.match(sql,/m\.updated_at is distinct from/);
  assert.match(sql,/bgm_super_admin_correct_member_dates/);
  assert.match(sql,/n<>b\.expected_edits/);
  assert.match(sql,/member\.current_csv\.update/);
  assert.match(sql,/b\.status='applied'/);
  assert.match(sql,/membership_period=case when v_kind and v_links>0/);
});
test("server verifies signed original and database environment; protected histories cannot be submitted as fields",()=>{
  const sig=readFileSync(new URL("../lib/currentMemberCsvSignature.ts",import.meta.url),"utf8");
  const api=readFileSync(new URL("../app/api/admin/members/current-csv/route.ts",import.meta.url),"utf8");
  assert.match(sig,/timingSafeEqual/);
  assert.match(sig,/baseline\.project!==project/);
  assert.match(api,/verifyCurrentCsvSnapshot/);
  assert.match(api,/!allowed\.has\(key\)/);
  assert.match(api,/auth\.context\?\.isSuperAdmin/);
  assert.match(api,/body\.confirmed!==true/);
});
