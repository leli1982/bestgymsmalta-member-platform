import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { evaluateBarcodeAccess } from "../lib/barcodeAccessCore.ts";
import { normalizeBarcodePayload } from "../lib/memberCardCredentialCore.ts";
import { scopedConflictCandidates } from "../lib/scopedCardConflictCandidates.ts";

// Run the actual API handler against an isolated, in-memory database fixture.
// No credentials, real members, or external network are used.
const source = fs.readFileSync(new URL("../app/api/system/barcode/scan/route.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const member = (id, number, extra = {}) => ({ id, member_number: number, full_name: "Fictional " + id, status: "active", membership_expiry: "2028-01-01", access_scope: "network", official_photo_path: "fictional.jpg", ...extra });
const card = (id, barcode_value, member_id, status = "active") => ({ id, barcode_value, member_id, status, application_member_id: null });
function harness() {
  const members = [
    member("a","BGM990001",{ legacy_pk_customer:"p990001" }),
    member("b","BGM990002",{ legacy_pk_customer:"M990002", membership_expiry:"2025-01-01" }),
    member("c","BGM990003",{ legacy_pk_customer:"K990003", access_scope:"single_gym", access_gym_id:"bgm-neptunes" }),
    member("d","BGM990004",{ legacy_pk_customer:"q990004" }),
    member("e","BGM990005",{ legacy_pk_customer:"Q990004" }),
    member("f","BGM990006",{ legacy_pk_customer:"M99_6" }),
    member("g","BGM990007",{ legacy_pk_customer:"M9906" }),
    member("h","BGM990008",{ legacy_pk_customer:"z990008", status:"archived" }),
    member("i","BGM990009"),
    member("j","BGM26850"),
    member("k","BGM26851"),
    member("l","BGM990012",{ legacy_pk_customer:"Q990012", cancellation_effective_date:"2026-01-01" })
  ];
  const tables = {
    bgm_members: members,
    bgm_member_card_credentials: [card("ca","X990001","a"),card("cb","x990002","b"),card("cc","X990003","c"),card("cd","X990004","d"),card("ce","x990004","e"),card("ch","X990009","h","retired"),card("ci","x990009","i")],
    bgm_legacy_card_claims: [{ member_id:"f",scan3:"Z990006",assignment_status:"active" }],
    bgm_pending_legacy_card_verifications: [],
    bgm_gyms: [{id:"bgm-marsascala",name:"Marsascala",status:"active"},{id:"bgm-neptunes",name:"Neptunes",status:"active"}],
    bgm_access_scans: []
  };
  const writes = [], checkins = [];
  class Query {
    constructor(table) { this.table=table; this.rows=[...tables[table]]; this.one=false; }
    select() { return this; }
    eq(k,v) { this.rows=this.rows.filter(r=>r[k]===v); return this; }
    neq(k,v) { this.rows=this.rows.filter(r=>r[k]!==v); return this; }
    is(k,v) { this.rows=this.rows.filter(r=>(r[k]??null)===v); return this; }
    in(k,v) { this.rows=this.rows.filter(r=>v.includes(r[k])); return this; }
    ilike(k,p) {
      // PostgreSQL ILIKE pattern semantics, including escaped wildcards.
      let regex = "^";
      const escape = c=>c.replace(/[.*+?^\${}()|[\]\\]/g,"\\$&");
      for(let i=0;i<p.length;i++){
        const c=p[i];
        if(c==="\\" && i+1<p.length) regex+=escape(p[++i]);
        else if(c==="%") regex+=".*";
        else if(c==="_") regex+=".";
        else regex+=escape(c);
      }
      const pattern=new RegExp(regex+"$","i");
      this.rows=this.rows.filter(r=>typeof r[k]==="string"&&pattern.test(r[k]));
      return this;
    }
    order() { return this; }
    limit(n) { this.rows=this.rows.slice(0,n);return this; }
    maybeSingle() { this.one=true;return this; }
    single() { this.one=true;return this; }
    insert(row) {
      assert.equal(this.table,"bgm_access_scans");
      writes.push(row);
      this.rows=[{...row,id:"scan-"+writes.length,scanned_at:"2026-11-26T17:00:00Z"}];
      return this;
    }
    then(resolve,reject) { return Promise.resolve({data:this.one?this.rows[0]??null:this.rows,error:null}).then(resolve,reject); }
  }
  const modules = {
    "next/server": { NextResponse:{json:(body,options)=>({body,status:options?.status??200})} },
    "@/lib/barcodeAccessCore": {evaluateBarcodeAccess},
    "@/lib/checkinService": {recordCanonicalCheckin:async input=>{checkins.push(input);return {checkinId:"visit-"+checkins.length,duplicate:false};}},
    "@/lib/memberCardCredentialCore": {normalizeBarcodePayload},
    "@/lib/maltaDate": {todayMaltaDate:()=>"2026-11-26"},
    "@/lib/supabaseAdmin": {getSupabaseAdmin:()=>({from:table=>new Query(table)})},
    "@/lib/scopedCardConflictCandidates": {scopedConflictCandidates},
    "@/lib/systemAuth": {requireSystemPermission:async()=>({context:{gymId:"bgm-marsascala",systemUserId:"fictional-staff"}})}
  };
  const exports = {};
  vm.runInNewContext(js, {exports,require:name=>{assert.ok(Object.hasOwn(modules,name),"Unexpected import: "+name);return modules[name];},console});
  async function scan(code, result, owner, kind, source="manual_dialog") {
    const n=checkins.length;
    const response=await exports.POST({json:async()=>({membershipNumber:code,inputSource:source,deviceId:"test-device"})});
    assert.equal(response.status,200);
    assert.equal(response.body.result,result,code);
    assert.equal(response.body.granted,result==="granted",code);
    assert.equal(response.body.member?.id??null,owner,code);
    assert.equal(response.body.credentialKind,kind,code);
    assert.equal(checkins.length-n,result==="granted"?1:0,code);
    const entry=writes.at(-1);
    assert.equal(entry.original_credential_value,code.trim()||null);
    assert.equal(entry.normalized_credential_value,code.trim().toUpperCase()||null);
    assert.equal(entry.scan_input_source,source);
    assert.equal(entry.lookup_kind,kind);
    return response.body;
  }
  return {scan};
}

test("actual scan handler resolves both cases across physical, permanent and legacy numbers", async()=>{
  const {scan}=harness();
  for(const code of ["X990001","x990001"]) await scan(code,"granted","a","physical_card");
  for(const code of ["BGM990001","bgm990001","BgM990001"]) await scan(code,"granted","a","member_number");
  for(const code of ["P990001","p990001"]) await scan(code,"granted","a","legacy_pk_customer");
  for(const code of ["Z990006","z990006"]) await scan(code,"granted","f","physical_card");
  await scan("x990009","granted","i","physical_card");
});

test("case-safe scan still denies expired, restricted, cancelled and archived accounts", async()=>{
  const {scan}=harness();
  await scan("X990002","expired","b","physical_card");
  await scan("x990003","restricted_gym","c","physical_card");
  await scan("q990012","inactive","l","legacy_pk_customer");
  await scan("bgm990008","inactive","h","member_number");
  await scan("z990008","unknown_card",null,null);
});

test("case conflicts and scoped exception candidates never create a check-in", async()=>{
  const {scan}=harness();
  for(const code of ["X990004","x990004","Q990004","q990004"]){
    const kind=code.toUpperCase().startsWith("X")?"physical_card":"legacy_pk_customer";
    const response=await scan(code,"ambiguous_card",null,kind);
    assert.equal(response.cardMatches.length,2);
  }
  const response=await scan("x07977","ambiguous_card",null,"physical_card");
  assert.equal(response.cardMatches.length,2);
  assert.ok(response.cardMatches.every(row=>row.isScopedCandidate));
});

test("literal wildcard escape, unknown input, and input source are preserved",async()=>{
  const {scan}=harness();
  await scan("m99_6","granted","f","legacy_pk_customer","keyboard_burst");
  await scan("M99%","unknown_card",null,null,"keyboard_prefix");
  await scan("X000000000","unknown_card",null,null);
  await scan("","invalid_barcode",null,null);
});
