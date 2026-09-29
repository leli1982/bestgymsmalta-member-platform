import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayMaltaDate, isValidCalendarDate, maltaDayUtcRange } from "@/lib/maltaDate";
import { snapshotBarSale, BAR_MAX_PRICE_CENTS, type BarCatalogItem, type BarSalesSnapshotItem } from "@/lib/barSalesCore";
import { requireSystemPermission } from "@/lib/systemAuth";
import {
  canTransitionOrderStatus,
  normalizeOrderItems,
  normalizeOrderType,
  orderPermission,
  type OperationalOrderStatus,
} from "@/lib/operationalOrdersCore";
import { sendOperationalOrderEmail } from "@/lib/operationsMailer";
import { sendOperationalOrderPush } from "@/lib/pushNotifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function writeAudit({
  systemUserId,
  gymId,
  staffName,
  actionKey,
  orderId,
  beforeData,
  afterData,
}: {
  systemUserId: string;
  gymId: string | null;
  staffName: string;
  actionKey: string;
  orderId: string;
  beforeData?: unknown;
  afterData?: unknown;
}) {
  const supabase = getSupabaseAdmin();
  const result = await supabase.from("bgm_audit_log").insert({
    system_user_id: systemUserId,
    context_gym_id: gymId,
    staff_name: staffName,
    action_key: actionKey,
    entity_type: "operational_order",
    entity_id: orderId,
    before_data: beforeData ?? null,
    after_data: afterData ?? null,
  });

  if (result.error) {
    console.error("Could not write operational order audit entry:", result.error);
  }
}

async function loadOrderNotificationSettings() {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("bgm_notification_settings")
    .select("orders_email, email_enabled, push_enabled")
    .eq("id", "orders")
    .maybeSingle();

  if (result.error) throw result.error;

  return (
    result.data || {
      orders_email: "info@bestgymsmalta.com",
      email_enabled: true,
      push_enabled: true,
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const orderType = normalizeOrderType(request.nextUrl.searchParams.get("type"));
    if (!orderType) {
      return NextResponse.json(
        { error: "Order type must be sundries or bar." },
        { status: 400 }
      );
    }

    const auth = await requireSystemPermission(
      request,
      orderPermission(orderType, "history")
    );
    if (auth.error || !auth.context) return auth.error;

    const requestedDate = clean(request.nextUrl.searchParams.get("businessDate"));
    if (requestedDate && !isValidCalendarDate(requestedDate)) {
      return NextResponse.json({ error: "Invalid Malta order date." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("bgm_operational_orders")
      .select(
        "id, order_type, gym_id, staff_name, status, notes, submitted_at, business_date, total_cents, cash_found_cents, ordered_at, completed_at, cancelled_at, notification_status, notification_sent_at, email_notification_status, email_notification_sent_at, email_notification_error, push_notification_status, push_notification_sent_at, push_notification_error, created_at, updated_at"
      )
      .eq("order_type", orderType)
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (!auth.context.isSuperAdmin) {
      if (!auth.context.gymId) {
        return NextResponse.json(
          { error: "This account is not assigned to a gym." },
          { status: 400 }
        );
      }
      query = query.eq("gym_id", auth.context.gymId);
    } else {
      const requestedGymId = clean(request.nextUrl.searchParams.get("gymId"));
      if (requestedGymId) query = query.eq("gym_id", requestedGymId);
    }

    if (requestedDate) {
      if (orderType === "bar") {
        query = query.eq("business_date", requestedDate);
      } else {
        const { start, end } = maltaDayUtcRange(requestedDate);
        query = query.gte("submitted_at", start).lt("submitted_at", end);
      }
    }

    const orderResult = await query;
    if (orderResult.error) throw orderResult.error;

    const orders = orderResult.data || [];
    const orderIds = orders.map((order) => order.id);
    const gymIds = Array.from(
      new Set(orders.map((order) => order.gym_id).filter(Boolean))
    );

    const [itemsResult, gymsResult] = await Promise.all([
      orderIds.length
        ? supabase
            .from("bgm_operational_order_items")
            .select("id, order_id, item_name, quantity, unit, notes, sort_order, catalog_item_id, unit_price_cents, line_total_cents")
            .in("order_id", orderIds)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      gymIds.length
        ? supabase
            .from("bgm_gyms")
            .select("id, name, short_name")
            .in("id", gymIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (itemsResult.error) throw itemsResult.error;
    if (gymsResult.error) throw gymsResult.error;

    const itemsByOrder = new Map<string, typeof itemsResult.data>();
    for (const item of itemsResult.data || []) {
      const current = itemsByOrder.get(item.order_id) || [];
      current.push(item);
      itemsByOrder.set(item.order_id, current);
    }

    const gymById = new Map(
      (gymsResult.data || []).map((gym) => [
        gym.id,
        gym.name || gym.short_name || gym.id,
      ])
    );

    // The historical daily sum includes all saved Bar Lists (not merely the
    // 200 most recent rows shown in the history panel). Cancelled lists are excluded.
    let todayTotalCents: number | null = null;
    if (orderType === "bar") {
      const today = todayMaltaDate();
      let offset = 0;
      let sum = 0;
      let count = 0;
      while (true) {
        let totalsQuery = supabase.from("bgm_operational_orders")
          .select("total_cents")
          .eq("order_type", "bar")
          .eq("business_date", today)
          .neq("status", "cancelled")
          .range(offset, offset + 499);
        const scopedGymId = auth.context.isSuperAdmin
          ? clean(request.nextUrl.searchParams.get("gymId")) : (auth.context.gymId || "");
        if (scopedGymId) totalsQuery = totalsQuery.eq("gym_id", scopedGymId);
        const totalsResult = await totalsQuery;
        if (totalsResult.error) throw totalsResult.error;
        const rows = totalsResult.data || [];
        for (const row of rows) {
          if (row.total_cents != null) {
            sum += Number(row.total_cents);
            count++;
          }
        }
        if (rows.length < 500) break;
        offset += 500;
      }
      todayTotalCents = count ? sum : 0;
    }

    return NextResponse.json({
      businessDate: orderType === "bar" ? todayMaltaDate() : null,
      todayTotalCents,
      orders: orders.map((order) => ({
        ...order,
        gym_name: gymById.get(order.gym_id) || order.gym_id,
        items: itemsByOrder.get(order.id) || [],
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load operational orders." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orderType = normalizeOrderType(body.orderType);
    if (!orderType) {
      return NextResponse.json(
        { error: "Order type must be sundries or bar." },
        { status: 400 }
      );
    }

    const auth = await requireSystemPermission(
      request,
      orderPermission(orderType, "submit")
    );
    if (auth.error || !auth.context) return auth.error;

    const staffNameInput = clean(body.staffName);
    const staffName =
      staffNameInput || (auth.context.isSuperAdmin ? "Super Admin" : "");
    const notes = clean(body.notes);
    const supabase = getSupabaseAdmin();
    let items: (ReturnType<typeof normalizeOrderItems>[number] | BarSalesSnapshotItem)[] = [];
    let barTotalCents: number | null = null;
    let barCashFoundCents: number | null = null;
    if (orderType === "bar") {
      if (!Number.isSafeInteger(body.cashFoundCents) || body.cashFoundCents < 0 ||
        body.cashFoundCents > BAR_MAX_PRICE_CENTS) {
        return NextResponse.json({ error: "Enter a valid Total Cash Found amount after counting cash." }, { status: 400 });
      }
      barCashFoundCents = body.cashFoundCents;
      const catalogResult = await supabase.from("bgm_bar_catalog_items")
        .select("id,name,price_cents,is_other,active,sort_order,updated_at")
        .eq("active", true);
      if (catalogResult.error) throw catalogResult.error;
      const catalog: BarCatalogItem[] = (catalogResult.data || []).map((row) => ({
        id: row.id, name: row.name, priceCents: row.price_cents,
        isOther: row.is_other, active: row.active, sortOrder: row.sort_order,
        updatedAt: row.updated_at,
      }));
      const snapshot = snapshotBarSale(body.barEntries, catalog);
      if (snapshot.error) return NextResponse.json({ error: snapshot.error }, { status: 409 });
      items = snapshot.items;
      barTotalCents = snapshot.totalCents;
    } else {
      items = normalizeOrderItems(body.items);
    }

    if (!staffName) {
      return NextResponse.json(
        { error: "Staff Name is required." },
        { status: 400 }
      );
    }
    if (!items.length) {
      return NextResponse.json(
        { error: "Add at least one valid order item." },
        { status: 400 }
      );
    }

    const gymId = auth.context.isSuperAdmin
      ? clean(body.gymId)
      : auth.context.gymId || "";

    if (!gymId) {
      return NextResponse.json(
        { error: "A gym is required for this order." },
        { status: 400 }
      );
    }

    const gymResult = await supabase
      .from("bgm_gyms")
      .select("id, name, short_name")
      .eq("id", gymId)
      .maybeSingle();

    if (gymResult.error) throw gymResult.error;
    if (!gymResult.data) {
      return NextResponse.json({ error: "Gym not found." }, { status: 404 });
    }

    const notificationSettings = await loadOrderNotificationSettings();
    const orderResult = await supabase
      .from("bgm_operational_orders")
      .insert({
        order_type: orderType,
        gym_id: gymId,
        submitted_by_system_user_id: auth.context.systemUserId,
        staff_name: staffName,
        status: "submitted",
        notes: notes || null,
        ...(orderType === "bar" ? { business_date: todayMaltaDate(), total_cents: barTotalCents, cash_found_cents: barCashFoundCents } : {}),
        notification_status: "pending",
        email_notification_status: notificationSettings.email_enabled
          ? "pending"
          : "disabled",
        push_notification_status: notificationSettings.push_enabled
          ? "pending"
          : "disabled",
      })
      .select(
        "id, order_type, gym_id, staff_name, status, notes, submitted_at, business_date, total_cents, cash_found_cents, notification_status"
      )
      .single();

    if (orderResult.error) throw orderResult.error;
    const order = orderResult.data;

    const itemResult = await supabase.from("bgm_operational_order_items").insert(
      items.map((item, index) => ({
        order_id: order.id,
        item_name: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes,
        sort_order: index,
        ...(orderType === "bar" && "catalogItemId" in item
          ? {
              catalog_item_id: item.catalogItemId,
              unit_price_cents: item.unitPriceCents,
              line_total_cents: item.lineTotalCents,
            }
          : {}),
      }))
    );

    if (itemResult.error) {
      await supabase.from("bgm_operational_orders").delete().eq("id", order.id);
      throw itemResult.error;
    }

    await writeAudit({
      systemUserId: auth.context.systemUserId,
      gymId,
      staffName,
      actionKey: `orders.${orderType}.submitted`,
      orderId: order.id,
      afterData: {
        orderType,
        gymId,
        staffName,
        itemCount: items.length,
        ...(orderType === "bar" ? { totalCents: barTotalCents, cashFoundCents: barCashFoundCents, businessDate: todayMaltaDate() } : {}),
      },
    });

    const gymName =
      gymResult.data.name || gymResult.data.short_name || gymId;

    let emailStatus: "sent" | "failed" | "disabled" =
      notificationSettings.email_enabled ? "failed" : "disabled";
    let emailSentAt: string | null = null;
    let emailError: string | null = null;

    if (notificationSettings.email_enabled) {
      try {
        await sendOperationalOrderEmail({
          recipient: notificationSettings.orders_email,
          orderType,
          orderId: order.id,
          gymName,
          staffName,
          notes: notes || null,
          items,
          ...(orderType === "bar" ? { barBusinessDate: todayMaltaDate(), barTotalCents, barCashFoundCents } : {}),
        });
        emailStatus = "sent";
        emailSentAt = new Date().toISOString();
      } catch (error) {
        emailStatus = "failed";
        emailError =
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Email delivery failed.";
        console.error("Operational order email failed:", error);
      }
    }

    let pushStatus:
      | "sent"
      | "failed"
      | "disabled"
      | "not_configured" = notificationSettings.push_enabled
      ? "not_configured"
      : "disabled";
    let pushSentAt: string | null = null;
    let pushError: string | null = null;

    if (notificationSettings.push_enabled) {
      try {
        const pushResult = await sendOperationalOrderPush({
          orderType,
          orderId: order.id,
          gymName,
          staffName,
          itemCount: items.length,
        });
        pushStatus = pushResult.status;
        if (pushResult.status === "sent") {
          pushSentAt = new Date().toISOString();
          if (pushResult.failed > 0) {
            pushError = `${pushResult.failed} subscribed device(s) failed.`;
          }
        } else if (pushResult.status === "failed") {
          pushError = "Push delivery failed on all subscribed devices.";
        }
      } catch (error) {
        pushStatus = "failed";
        pushError =
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Push delivery failed.";
        console.error("Operational order push failed:", error);
      }
    }

    const anySent = emailStatus === "sent" || pushStatus === "sent";
    const anyFailure =
      emailStatus === "failed" ||
      pushStatus === "failed" ||
      pushStatus === "not_configured";
    const overallNotificationStatus = anySent
      ? "sent"
      : anyFailure
      ? "failed"
      : "sent";
    const overallError = [
      emailError ? `Email: ${emailError}` : "",
      pushError ? `Push: ${pushError}` : "",
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 500);

    const notificationUpdatedAt = new Date().toISOString();
    const notificationResult = await supabase
      .from("bgm_operational_orders")
      .update({
        notification_status: overallNotificationStatus,
        notification_sent_at: anySent ? notificationUpdatedAt : null,
        notification_error: overallError || null,
        email_notification_status: emailStatus,
        email_notification_sent_at: emailSentAt,
        email_notification_error: emailError,
        push_notification_status: pushStatus,
        push_notification_sent_at: pushSentAt,
        push_notification_error: pushError,
        updated_at: notificationUpdatedAt,
      })
      .eq("id", order.id);

    if (notificationResult.error) {
      console.error(
        "Could not record operational order notification result:",
        notificationResult.error
      );
    }

    return NextResponse.json(
      {
        order: {
          ...order,
          gym_name: gymName,
          items,
          notification_status: overallNotificationStatus,
          email_notification_status: emailStatus,
          push_notification_status: pushStatus,
        },
        notificationStatus: overallNotificationStatus,
        emailNotificationStatus: emailStatus,
        pushNotificationStatus: pushStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not submit operational order." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "orders.manage");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const orderId = clean(body.orderId);
    const nextStatus = clean(body.status).toLowerCase() as OperationalOrderStatus;
    const validStatuses: OperationalOrderStatus[] = [
      "submitted",
      "ordered",
      "completed",
      "cancelled",
    ];

    if (!orderId || !validStatuses.includes(nextStatus)) {
      return NextResponse.json(
        { error: "Order and valid status are required." },
        { status: 400 }
      );
    }

    const staffNameInput = clean(body.staffName);
    const staffName =
      staffNameInput || (auth.context.isSuperAdmin ? "Super Admin" : "");
    if (!staffName) {
      return NextResponse.json(
        { error: "Staff Name is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("bgm_operational_orders")
      .select("id, order_type, gym_id, status, staff_name")
      .eq("id", orderId);

    if (!auth.context.isSuperAdmin) {
      if (!auth.context.gymId) {
        return NextResponse.json(
          { error: "This account is not assigned to a gym." },
          { status: 400 }
        );
      }
      query = query.eq("gym_id", auth.context.gymId);
    }

    const existingResult = await query.maybeSingle();
    if (existingResult.error) throw existingResult.error;
    const existing = existingResult.data;
    if (!existing) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const currentStatus = existing.status as OperationalOrderStatus;
    if (!canTransitionOrderStatus(currentStatus, nextStatus)) {
      return NextResponse.json(
        {
          error: `Cannot change an order from ${currentStatus} to ${nextStatus}.`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: nextStatus,
      status_updated_by_system_user_id: auth.context.systemUserId,
      status_staff_name: staffName,
      updated_at: now,
    };

    if (nextStatus === "ordered") update.ordered_at = now;
    if (nextStatus === "completed") update.completed_at = now;
    if (nextStatus === "cancelled") update.cancelled_at = now;

    const updateResult = await supabase
      .from("bgm_operational_orders")
      .update(update)
      .eq("id", orderId)
      .select(
        "id, order_type, gym_id, staff_name, status, submitted_at, ordered_at, completed_at, cancelled_at, notification_status, email_notification_status, push_notification_status"
      )
      .single();

    if (updateResult.error) throw updateResult.error;

    await writeAudit({
      systemUserId: auth.context.systemUserId,
      gymId: existing.gym_id,
      staffName,
      actionKey: "orders.status_changed",
      orderId,
      beforeData: { status: currentStatus },
      afterData: { status: nextStatus },
    });

    return NextResponse.json({ order: updateResult.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update operational order." },
      { status: 500 }
    );
  }
}
