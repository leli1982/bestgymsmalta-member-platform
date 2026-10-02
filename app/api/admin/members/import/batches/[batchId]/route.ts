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
        "id, filename, file_format, import_mode, status, total_rows, converted_rows, new_rows, update_rows, unchanged_rows, duplicate_rows, redundant_rows, missing_source_rows, warning_rows, rejected_rows, conflict_rows, invalid_rows, applied_at, created_at"
      )
      .eq("id", batchId)
      .maybeSingle();

    if (batchResult.error) throw batchResult.error;
    if (!batchResult.data) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    const issueResult = await supabase
      .from("bgm_member_import_review_items")
      .select(
        "source_row_number, review_type, blocking, member_number, legacy_scan3, customer_name, gym, pk_customer, issue"
      )
      .eq("batch_id", batchId)
      .order("blocking", { ascending: false })
      .order("created_at", { ascending: true })
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
        convertedRows: batch.converted_rows,
        newRows: batch.new_rows,
        updateRows: batch.update_rows,
        unchangedRows: batch.unchanged_rows,
        duplicateRows: batch.duplicate_rows,
        redundantRows: batch.redundant_rows,
        missingSourceRows: batch.missing_source_rows,
        warningRows: batch.warning_rows,
        rejectedRows: batch.rejected_rows,
        conflictRows: batch.conflict_rows,
        invalidRows: batch.invalid_rows,
        appliedAt: batch.applied_at,
        createdAt: batch.created_at,
      },
      issues: (issueResult.data || []).map((row) => ({
        rowNumber: row.source_row_number || 0,
        action: row.review_type,
        blocking: row.blocking,
        memberNumber: row.member_number || "",
        cardBarcode: row.legacy_scan3 || "",
        customerName: row.customer_name || "",
        gym: row.gym || "",
        pkCustomer: row.pk_customer || "",
        issue: row.issue || "Review this item before import.",
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
