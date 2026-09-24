import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PAGE = 1000;
function csvCell(value: unknown) {
  let text = String(value ?? "");
  // Spreadsheet import/export safeguards: never allow user-supplied CSV cells
  // to be interpreted as formulas if opened in Excel.
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g,'""') + '"';
}
export async function GET(request: NextRequest,{params}:{params:Promise<{batchId:string}>}) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;
  const {batchId} = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(batchId))
    return NextResponse.json({error:"Invalid import batch."},{status:400});
  try {
    const db = getSupabaseAdmin();
    const batch = await db.from("bgm_member_import_batches").select("id").eq("id",batchId).maybeSingle();
    if (batch.error) throw batch.error;
    if (!batch.data) return NextResponse.json({error:"Import batch not found."},{status:404});
    const lines = [["Excel row","Issue type","Gym","pkCustomer","Customer name","Reason"].map(csvCell).join(",")];
    for (let offset=0;;offset+=PAGE) {
      const result = await db.from("bgm_member_import_rows")
        .select("row_number,action,gym,pk_customer,customer_name,company_name,issue")
        .eq("batch_id",batchId).in("action",["conflict","invalid"])
        .order("row_number",{ascending:true}).range(offset,offset+PAGE-1);
      if (result.error) throw result.error;
      const page=result.data||[];
      for (const row of page) {
        lines.push([row.row_number,row.action,row.gym,row.pk_customer,
          row.customer_name||row.company_name,row.issue].map(csvCell).join(","));
      }
      if (page.length<PAGE) break;
    }
    return new NextResponse("\uFEFF"+lines.join("\r\n")+"\r\n",{
      headers:{"Content-Type":"text/csv; charset=utf-8",
        "Content-Disposition":'attachment; filename="bgm-import-issues.csv"',"Cache-Control":"no-store"}
    });
  } catch(error) {
    console.error("Import issue report failed",error);
    return NextResponse.json({error:"Could not download import review."},{status:500});
  }
}
