import { NextRequest, NextResponse } from "next/server";
import { calculateEndOfDayTotals, type EndOfDayBarItem, type EndOfDayExpense, type EndOfDayPaymentRow } from "@/lib/endOfDayCore";
import { isValidCalendarDate, todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin, requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function mapReport(row: any) {
  return {
    id: row.id,
    gymId: row.gym_id,
    businessDate: row.business_date,
    staffName: row.staff_name,
    shiftSequence: Number(row.shift_sequence || 1),
    shiftStartedAt: row.shift_started_at || null,
    shiftEndedAt: row.shift_ended_at || row.submitted_at,
    memberships: {
      cashCents: Number(row.memberships_cash_cents || 0),
      cardCents: Number(row.memberships_card_cents || 0),
      otherCents: Number(row.memberships_other_cents || 0),
    },
    renewals: {
      cashCents: Number(row.renewals_cash_cents || 0),
      cardCents: Number(row.renewals_card_cents || 0),
      otherCents: Number(row.renewals_other_cents || 0),
    },
    voucherReimbursementCents: Number(row.voucher_reimbursement_cents || 0),
    barSalesCents: Number(row.bar_sales_cents || 0),
    grossCents: Number(row.gross_cents || 0),
    expensesTotalCents: Number(row.expenses_total_cents || 0),
    dailyTotalCents: Number(row.daily_total_cents || 0),
    submittedAt: row.submitted_at,
  };
}

async function loadReportDetails(supabase: ReturnType<typeof getSupabaseAdmin>, reportId: string) {
  const reportResult = await supabase
    .from("bgm_end_of_day_reports")
    .select("id,gym_id,business_date,staff_name,shift_sequence,shift_started_at,shift_ended_at,memberships_cash_cents,memberships_card_cents,memberships_other_cents,renewals_cash_cents,renewals_card_cents,renewals_other_cents,voucher_reimbursement_cents,bar_sales_cents,gross_cents,expenses_total_cents,daily_total_cents,submitted_at")
    .eq("id", reportId)
    .maybeSingle();
  if (reportResult.error) throw reportResult.error;
  if (!reportResult.data) return null;

  const [gymResult, expensesResult, barItemsResult, vouchersResult] = await Promise.all([
    supabase.from("bgm_gyms").select("id,name,short_name").eq("id", reportResult.data.gym_id).maybeSingle(),
    supabase.from("bgm_end_of_day_expenses")
      .select("id,description,amount_cents,sort_order")
      .eq("report_id", reportId).order("sort_order", { ascending: true }),
    supabase.from("bgm_end_of_day_bar_items")
      .select("id,item_name,quantity,unit_price_cents,line_total_cents,sort_order")
      .eq("report_id", reportId).order("sort_order", { ascending: true }),
    supabase.from("bgm_end_of_day_vouchers")
      .select("id,voucher_code,quantity,reimbursement_total_cents,sort_order")
      .eq("report_id", reportId).order("sort_order", { ascending: true }),
  ]);
  for (const result of [gymResult, expensesResult, barItemsResult, vouchersResult]) {
    if (result.error) throw result.error;
  }

  return {
    ...mapReport(reportResult.data),
    gymName: gymResult.data?.name || gymResult.data?.short_name || reportResult.data.gym_id,
    expenses: (expensesResult.data || []).map((row) => ({
      id: row.id,
      description: row.description,
      amountCents: Number(row.amount_cents || 0),
    })),
    barItems: (barItemsResult.data || []).map((row) => ({
      id: row.id,
      itemName: row.item_name,
      quantity: Number(row.quantity || 0),
      unitPriceCents: Number(row.unit_price_cents || 0),
      lineTotalCents: Number(row.line_total_cents || 0),
    })),
    vouchers: (vouchersResult.data || []).map((row) => ({
      id: row.id,
      voucherCode: row.voucher_code,
      quantity: Number(row.quantity || 0),
      reimbursementTotalCents: Number(row.reimbursement_total_cents || 0),
    })),
  };
}

async function staffPreview(request: NextRequest) {
  const auth = await requireSystemPermission(request, "end_of_day.submit");
  if (auth.error || !auth.context) return auth.error;
  if (auth.context.isSuperAdmin) {
    return jsonError("Use Super Admin End of Day reports for a network account.", 400);
  }
  const gymId = auth.context.gymId;
  if (!gymId) return jsonError("This Staff account is not assigned to a gym.", 400);

  const businessDate = todayMaltaDate();
  const supabase = getSupabaseAdmin();
  const [gymResult, latestGlobalShiftResult, latestTodayShiftResult, barResult] = await Promise.all([
    supabase.from("bgm_gyms").select("id,name,short_name").eq("id", gymId).maybeSingle(),
    supabase.from("bgm_end_of_day_reports")
      .select("shift_ended_at")
      .eq("gym_id", gymId)
      .order("shift_ended_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("bgm_end_of_day_reports")
      .select("shift_sequence")
      .eq("gym_id", gymId).eq("business_date", businessDate)
      .order("shift_sequence", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("bgm_operational_orders")
      .select("id,total_cents,locked_at")
      .eq("order_type", "bar").eq("is_daily_sheet", true)
      .eq("gym_id", gymId)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [gymResult, latestGlobalShiftResult, latestTodayShiftResult, barResult]) {
    if (result.error) throw result.error;
  }

  const shiftSequence = Number(latestTodayShiftResult.data?.shift_sequence || 0) + 1;
  const shiftStartedAt = latestGlobalShiftResult.data?.shift_ended_at || null;
  const shiftStartDate = shiftStartedAt ? todayMaltaDate(new Date(shiftStartedAt)) : businessDate;

  const paymentsResult = await supabase.from("bgm_membership_applications")
    .select("application_kind,payment_method,final_amount_cents,discount_code_snapshot,discount_reimbursement_cents_snapshot,payment_received_at,activated_at,submitted_at")
    .eq("status", "activated")
    .eq("enrollment_gym_id", gymId)
    .gte("payment_business_date", shiftStartDate)
    .lte("payment_business_date", businessDate);
  if (paymentsResult.error) throw paymentsResult.error;

  let barItems: EndOfDayBarItem[] = [];
  if (barResult.data?.id && !barResult.data.locked_at) {
    const itemsResult = await supabase.from("bgm_operational_order_items")
      .select("item_name,quantity,unit_price_cents,line_total_cents,sort_order")
      .eq("order_id", barResult.data.id)
      .order("sort_order", { ascending: true });
    if (itemsResult.error) throw itemsResult.error;
    barItems = (itemsResult.data || []).map((row) => ({
      itemName: row.item_name,
      quantity: Number(row.quantity || 0),
      unitPriceCents: Number(row.unit_price_cents || 0),
      lineTotalCents: Number(row.line_total_cents || 0),
      sortOrder: Number(row.sort_order || 0),
    }));
  }

  const paymentRows: EndOfDayPaymentRow[] = (paymentsResult.data || [])
    .filter((row) => {
      if (!shiftStartedAt) return true;
      const eventTime = row.payment_received_at || row.activated_at || row.submitted_at;
      return Boolean(eventTime && new Date(eventTime).getTime() > new Date(shiftStartedAt).getTime());
    })
    .map((row) => ({
      applicationKind: row.application_kind,
      paymentMethod: row.payment_method,
      finalAmountCents: row.final_amount_cents,
      discountCodeSnapshot: row.discount_code_snapshot,
      discountReimbursementCentsSnapshot: row.discount_reimbursement_cents_snapshot,
    }));
  const totals = calculateEndOfDayTotals(paymentRows, barItems, []);

  return NextResponse.json({
    gymId,
    gymName: gymResult.data?.name || gymResult.data?.short_name || gymId,
    businessDate,
    submitted: false,
    shiftSequence,
    shiftStartedAt,
    barLocked: false,
    barItems,
    ...totals,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

async function adminGet(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  const supabase = getSupabaseAdmin();
  const reportId = clean(request.nextUrl.searchParams.get("reportId"));
  if (reportId) {
    const report = await loadReportDetails(supabase, reportId);
    if (!report) return jsonError("End of Day report not found.", 404);
    return NextResponse.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const gymId = clean(request.nextUrl.searchParams.get("gymId"));
  const businessDate = clean(request.nextUrl.searchParams.get("businessDate"));
  if (businessDate && !isValidCalendarDate(businessDate)) return jsonError("Enter a valid End of Day date.", 400);

  let query = supabase.from("bgm_end_of_day_reports")
    .select("id,gym_id,business_date,staff_name,shift_sequence,shift_started_at,shift_ended_at,daily_total_cents,submitted_at")
    .order("business_date", { ascending: false })
    .order("shift_sequence", { ascending: false })
    .limit(1000);
  if (gymId) query = query.eq("gym_id", gymId);
  if (businessDate) query = query.eq("business_date", businessDate);
  const reportsResult = await query;
  if (reportsResult.error) throw reportsResult.error;

  const gymIds = Array.from(new Set((reportsResult.data || []).map((row) => String(row.gym_id))));
  const gymsResult = gymIds.length
    ? await supabase.from("bgm_gyms").select("id,name,short_name").in("id", gymIds)
    : { data: [], error: null } as any;
  if (gymsResult.error) throw gymsResult.error;
  const gymNames = new Map((gymsResult.data || []).map((gym: any) => [String(gym.id), gym.name || gym.short_name || gym.id]));

  const dailyMap = new Map<string, { gymId: string; gymName: string; businessDate: string; shiftCount: number; dailyTotalCents: number }>();
  for (const row of reportsResult.data || []) {
    const key = `${row.gym_id}|${row.business_date}`;
    const current = dailyMap.get(key) || {
      gymId: String(row.gym_id),
      gymName: String(gymNames.get(String(row.gym_id)) || row.gym_id),
      businessDate: String(row.business_date),
      shiftCount: 0,
      dailyTotalCents: 0,
    };
    current.shiftCount += 1;
    current.dailyTotalCents += Number(row.daily_total_cents || 0);
    dailyMap.set(key, current);
  }
  const dailyTotals = Array.from(dailyMap.values());

  return NextResponse.json({
    dailyTotals,
    reports: (reportsResult.data || []).map((row) => ({
      id: row.id,
      gymId: row.gym_id,
      gymName: gymNames.get(String(row.gym_id)) || row.gym_id,
      staffName: row.staff_name,
      businessDate: row.business_date,
      submittedAt: row.submitted_at,
      shiftSequence: Number(row.shift_sequence || 1),
      shiftStartedAt: row.shift_started_at || null,
      shiftEndedAt: row.shift_ended_at || row.submitted_at,
      dailyTotalCents: Number(row.daily_total_cents || 0),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("admin") === "1" || request.nextUrl.searchParams.has("reportId")) {
      return await adminGet(request);
    }
    return await staffPreview(request);
  } catch (error) {
    console.error("End of Day read failed", error);
    return jsonError("Could not load End of Day.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "end_of_day.submit");
    if (auth.error || !auth.context) return auth.error;
    if (auth.context.isSuperAdmin) return jsonError("End of Day submission requires a gym Staff account.", 400);
    const gymId = auth.context.gymId;
    if (!gymId) return jsonError("This Staff account is not assigned to a gym.", 400);

    const body = await request.json();
    const staffName = clean(body.staffName);
    if (!staffName || staffName.length > 120) return jsonError("Staff Name is required.", 400);
    const rawExpenses = Array.isArray(body.expenses) ? body.expenses : [];
    if (rawExpenses.length > 50) return jsonError("A maximum of 50 expenses is allowed.", 400);
    const expenses: EndOfDayExpense[] = [];
    for (const row of rawExpenses) {
      const description = clean(row?.description);
      const amountCents = Number(row?.amountCents);
      if (!description || description.length > 250 || !Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000) {
        return jsonError("Every expense needs a description and a positive valid value.", 400);
      }
      expenses.push({ description, amountCents });
    }

    const supabase = getSupabaseAdmin();
    const businessDate = todayMaltaDate();
    const result = await supabase.rpc("bgm_submit_end_of_day", {
      p_gym_id: gymId,
      p_system_user_id: auth.context.systemUserId,
      p_staff_name: staffName,
      p_business_date: businessDate,
      p_expenses: expenses,
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/required|invalid|positive|maximum|belongs to another gym/i.test(message)) return jsonError(message, 400);
      throw result.error;
    }

    const reportId = clean(result.data?.reportId);
    const report = reportId ? await loadReportDetails(supabase, reportId) : null;
    return NextResponse.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    console.error("End of Day submission failed", error);
    return jsonError("Could not submit End of Day.", 500);
  }
}
