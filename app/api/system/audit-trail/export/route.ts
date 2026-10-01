import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { formatEuropeanDateTime } from "@/lib/europeanDate";
import { isValidCalendarDate } from "@/lib/maltaDate";
import { AUDIT_SELECT, actionLabel, applyAuditFilters, jsonText, readAuditFilters } from "@/lib/auditTrail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function fetchRows(request: NextRequest) {
  const db = getSupabaseAdmin();
  const all = request.nextUrl.searchParams.get("all") === "1";
  const filters = readAuditFilters(request.nextUrl.searchParams);
  if (!all && ((filters.from && !isValidCalendarDate(filters.from))
    || (filters.to && !isValidCalendarDate(filters.to))
    || (filters.from && filters.to && filters.from > filters.to))) {
    throw new Error("Choose a valid audit date range.");
  }

  const rows: any[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from("bgm_audit_trail_read")
      .select(AUDIT_SELECT)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (!all) query = applyAuditFilters(query, filters);
    const result = await query;
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
    if ((result.data || []).length < pageSize) break;
    if (rows.length >= 100000) throw new Error("Audit export is too large. Use filters to narrow the export.");
  }
  return { rows, all };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const { rows, all } = await fetchRows(request);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BestGymsMalta";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Audit Trail", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      { header: "Date & Time", key: "date", width: 22 },
      { header: "Staff name", key: "staff", width: 24 },
      { header: "User display name", key: "userDisplay", width: 24 },
      { header: "Username", key: "username", width: 20 },
      { header: "Super Admin", key: "superAdmin", width: 13 },
      { header: "Gym", key: "gym", width: 22 },
      { header: "Action", key: "action", width: 34 },
      { header: "Category", key: "category", width: 16 },
      { header: "Member", key: "member", width: 28 },
      { header: "BGM number", key: "memberNumber", width: 18 },
      { header: "Entity type", key: "entityType", width: 24 },
      { header: "Entity ID", key: "entityId", width: 38 },
      { header: "Before", key: "before", width: 60 },
      { header: "After", key: "after", width: 60 },
      { header: "Audit ID", key: "auditId", width: 38 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: "A1", to: "O1" };

    for (const row of rows) {
      sheet.addRow({
        date: formatEuropeanDateTime(row.created_at, ""),
        staff: row.staff_name || "",
        userDisplay: row.system_display_name || "",
        username: row.system_username || "",
        superAdmin: row.system_is_super_admin ? "Yes" : "No",
        gym: row.context_gym_name || row.context_gym_id || "",
        action: actionLabel(row.action_key || ""),
        category: row.category || "",
        member: row.member_name || "",
        memberNumber: row.member_number || "",
        entityType: row.entity_type || "",
        entityId: row.entity_id || "",
        before: jsonText(row.before_data),
        after: jsonText(row.after_data),
        auditId: row.id,
      });
    }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="BGM-Audit-Trail-${all ? "Full" : "Filtered"}-${stamp}.xlsx"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error && /valid audit date range|too large/i.test(error.message)
      ? error.message : "Could not export the audit trail.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
