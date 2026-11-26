import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { CURRENT_CSV_EDITABLE, originalCurrentCsvValue, normalizeCurrentCsvDate, type CurrentCsvEditable } from "@/lib/currentMemberCsvCore";
import { verifyCurrentCsvSnapshot } from "@/lib/currentMemberCsvSignature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const allowed = new Set<string>(CURRENT_CSV_EDITABLE);
const dates = new Set(["DateOfBirth","MembershipStartDate","MembershipEndDate","MemberExpiryDate","EnrollmentDate"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(message:string,status=400) {
  return NextResponse.json({error:message},{status});
}
function buildStagedEdit(input:unknown) {
  if(!input || typeof input!=="object")throw new Error("Invalid edited CSV row.");
  const e=input as Record<string,unknown>;
  if(!Number.isInteger(e.rowNumber)||Number(e.rowNumber)<2||typeof e.baseline!=="string"||e.baseline.length>100000||typeof e.signature!=="string")
    throw new Error("Invalid row or original snapshot.");
  const b=verifyCurrentCsvSnapshot(e.baseline,e.signature);
  if(!e.patch||typeof e.patch!=="object"||Array.isArray(e.patch))throw new Error("Missing row edits.");
  const patch:Record<string,string>={},before:Record<string,string>={};
  for(const [key,value] of Object.entries(e.patch)){
    if(!allowed.has(key)||typeof value!=="string"||value.length>500)throw new Error("Invalid or protected edit: "+key);
    const original=originalCurrentCsvValue(b,key as CurrentCsvEditable);
    const rawOriginal=/^'[\s]*[=+@-]/.test(original)||/^'[\t\r\n]/.test(original)?original.slice(1):original;
    const normalized=dates.has(key)?normalizeCurrentCsvDate(value):value;
    if(normalized===rawOriginal)continue;
    patch[key]=normalized;before[key]=rawOriginal;
  }
  if(!Object.keys(patch).length)throw new Error("No changed editable fields on row "+String(e.rowNumber)+".");
  return {
    memberId:originalCurrentCsvValue(b,"MemberId"),
    memberNumber:originalCurrentCsvValue(b,"BGMNumber"),
    expectedUpdatedAt:originalCurrentCsvValue(b,"UpdatedAt"),
    expectedTermId:originalCurrentCsvValue(b,"CurrentMembershipId")||null,
    expectedTermUpdatedAt:b.termUpdatedAt,
    rowNumber:e.rowNumber,patch,before,
  };
}

export async function GET(request:NextRequest) {
  try{
    const auth=await requireSystemPermission(request,"members.import");
    if(auth.error)return auth.error;
    if(!auth.context?.isSuperAdmin)return errorResponse("Super Admin access required.",403);
    const batchId=request.nextUrl.searchParams.get("batchId")||"";
    const offset=Math.max(0,Number(request.nextUrl.searchParams.get("offset")||0));
    if(!uuid.test(batchId)||!Number.isSafeInteger(offset))return errorResponse("Invalid preview request.");
    const db=getSupabaseAdmin();
    const batch=await db.from("bgm_current_csv_batches").select("id,source_rows,expected_edits,status,created_at").eq("id",batchId).eq("created_by",auth.context.systemUserId).maybeSingle();
    if(batch.error)throw batch.error;
    if(!batch.data)return errorResponse("CSV preview not found.",404);
    const [page,issues]=await Promise.all([
      db.from("bgm_current_csv_edits").select("row_number,member_number,edit,issue",{count:"exact"}).eq("batch_id",batchId).order("row_number",{ascending:true}).range(offset,offset+99),
      db.from("bgm_current_csv_edits").select("member_id",{count:"exact",head:true}).eq("batch_id",batchId).not("issue","is",null),
    ]);
    if(page.error)throw page.error;if(issues.error)throw issues.error;
    return NextResponse.json({batchId,sourceRows:batch.data.source_rows,expectedEdits:batch.data.expected_edits,
      staged:page.count||0,issues:issues.count||0,status:batch.data.status,
      rows:(page.data||[]).map(r=>({rowNumber:r.row_number,memberNumber:r.member_number,
        before:r.edit?.before||{},patch:r.edit?.patch||{},issue:r.issue||null}))},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("Current CSV preview read failed",error);return errorResponse("Could not read the CSV preview.",500);}
}

export async function POST(request:NextRequest){
  try{
    const auth=await requireSystemPermission(request,"members.import");
    if(auth.error)return auth.error;
    if(!auth.context?.isSuperAdmin)return errorResponse("Super Admin access required.",403);
    const body=await request.json().catch(()=>null);
    if(!body||typeof body!=="object")return errorResponse("Invalid CSV request.");
    const db=getSupabaseAdmin(),staff=auth.context.systemUserId;
    if(body.action==="start"){
      const source=body.sourceRows,changed=body.expectedEdits;
      if(!Number.isInteger(source)||!Number.isInteger(changed)||source<1||source>100000||changed<1||changed>source)
        return errorResponse("Invalid source or edit count.");
      const result=await db.from("bgm_current_csv_batches").insert({created_by:staff,source_rows:source,expected_edits:changed}).select("id").single();
      if(result.error)throw result.error;
      return NextResponse.json({batchId:result.data.id});
    }
    const batchId=String(body.batchId||"");
    if(!uuid.test(batchId))return errorResponse("Invalid CSV preview ID.");
    if(body.action==="append"){
      if(!Array.isArray(body.edits)||body.edits.length<1||body.edits.length>100)return errorResponse("Invalid CSV preview chunk.");
      let edits;
      try{edits=body.edits.map(buildStagedEdit);}catch(error){return errorResponse(error instanceof Error?error.message:"Invalid edited CSV row.");}
      const r=await db.rpc("bgm_stage_current_csv_edits",{p_batch_id:batchId,p_staff_id:staff,p_edits:edits});
      if(r.error)return errorResponse(r.error.message||"CSV preview could not be staged.",409);
      return NextResponse.json(r.data);
    }
    if(body.action==="apply"){
      if(body.confirmed!==true)return errorResponse("Explicit approval of the preview is required.");
      const r=await db.rpc("bgm_apply_current_csv_batch",{p_batch_id:batchId,p_staff_id:staff});
      if(r.error)return errorResponse((r.error.message||"CSV changes could not be applied.")+" No batch changes were committed.",409);
      return NextResponse.json(r.data);
    }
    return errorResponse("Unknown CSV operation.");
  }catch(error){console.error("Current CSV update failed",error);return errorResponse("Could not process the CSV update. Check the preview status before retrying.",500);}
}
