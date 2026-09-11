import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.import");
    if (auth.error) return auth.error;

    const { batchId } = await params;
    const supabase = getSupabaseAdmin();
    const batchResult = await supabase
      .from("bgm_member_import_batches")
      .select(
        "id, filename, file_format, import_mode, status, total_rows, new_rows, update_rows, unchanged_rows, conflict_rows, invalid_rows, applied_at, created_at"
      )
      .eq("id", batchId)
      .maybeSingle();

    if (batchResult.error) throw batchResult.error;
    if (!batchResult.data) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    const issueResult = await supabase
      .from("bgm_member_import_rows")
      .select(
        "row_number, action, card_barcode, customer_name, company_name, gym, pk_customer, issue"
      )
      .eq("batch_id", batchId)
      .in("action", ["conflict", "invalid"])
      .order("row_number", { ascending: true })
      .limit(100);
    if (issueResult.error) throw issueResult.error;

    const batch = batchResult.data;
    return NextResponse.json({
      batch: {
        id: batch.id,
        filename: batch.filename,
        fileFormat: batch.file_format,
        importMode: batch.import_mode,
        status: batch.status,
        totalRows: batch.total_rows,
        newRows: batch.new_rows,
        updateRows: batch.update_rows,
        unchangedRows: batch.unchanged_rows,
        conflictRows: batch.conflict_rows,
        invalidRows: batch.invalid_rows,
        appliedAt: batch.applied_at,
        createdAt: batch.created_at,
      },
      issues: (issueResult.data || []).map((row) => ({
        rowNumber: row.row_number,
        action: row.action,
        cardBarcode: row.card_barcode || "",
        customerName: row.customer_name || row.company_name || "",
        gym: row.gym || "",
        pkCustomer: row.pk_customer || "",
        issue: row.issue || "Review this row before import.",
      })),
    });
  } catch (error) {
    console.error("Could not load membership import batch:", error);
    return NextResponse.json(
      { error: "Could not load the membership import batch." },
      { status: 500 }
    );
  }
}
