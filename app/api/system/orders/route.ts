import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext, requireSystemPermission } from "@/lib/systemAuth";
import {
  canTransitionOrderStatus,
  normalizeOrderItems,
  normalizeOrderType,
  orderPermission,
  type OperationalOrderStatus,
} from "@/lib/operationalOrdersCore";
import { sendOperationalOrderEmail } from "@/lib/operationsMailer";

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

export async function GET(request: NextRequest) {
  try {
    const orderType = normalizeOrderType(request.nextUrl.searchParams.get("type"));
    if (!orderType) {
      return NextResponse.json({ error: "Order type must be sundries or bar." }, { status: 400 });
    }

    const auth = await requireSystemPermission(
      request,
      orderPermission(orderType, "history")
    );
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("bgm_operational_orders")
      .select(
        "id, order_type, gym_id, staff_name, status, notes, submitted_at, ordered_at, completed_at, cancelled_at, notification_status, notification_sent_at, created_at, updated_at"
      )
      .eq("order_type", orderType)
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (!auth.context.isSuperAdmin) {
      if (!auth.context.gymId) {
        return NextResponse.json({ error: "This account is not assigned to a gym." }, { status: 400 });
      }
      query = query.eq("gym_id", auth.context.gymId);
    } else {
      const requestedGymId = clean(request.nextUrl.searchParams.get("gymId"));
      if (requestedGymId) query = query.eq("gym_id", requestedGymId);
    }

    const orderResult = await query;
    if (orderResult.error) throw orderResult.error;

    const orders = orderResult.data || [];
    const orderIds = orders.map((order) => order.id);
    const gymIds = Array.from(new Set(orders.map((order) => order.gym_id).filter(Boolean)));

    const [itemsResult, gymsResult] = await Promise.all([
      orderIds.length
        ? supabase
            .from("bgm_operational_order_items")
            .select("id, order_id, item_name, quantity, unit, notes, sort_order")
            .in("order_id", orderIds)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      gymIds.length
        ? supabase.from("bgm_gyms").select("id, name, short_name").in("id", gymIds)
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
      (gymsResult.data || []).map((gym) => [gym.id, gym.name || gym.short_name || gym.id])
    );

    return NextResponse.json({
      orders: orders.map((order) => ({
        ...order,
        gym_name: gymById.get(order.gym_id) || order.gym_id,
        items: itemsByOrder.get(order.id) || [],
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load operational orders." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orderType = normalizeOrderType(body.orderType);
    if (!orderType) {
      return NextResponse.json({ error: "Order type must be sundries or bar." }, { status: 400 });
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
    const items = normalizeOrderItems(body.items);

    if (!staffName) {
      return NextResponse.json({ error: "Staff Name is required." }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ error: "Add at least one valid order item." }, { status: 400 });
    }

    const gymId = auth.context.isSuperAdmin
      ? clean(body.gymId)
      : auth.context.gymId || "";

    if (!gymId) {
      return NextResponse.json({ error: "A gym is required for this order." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const gymResult = await supabase
      .from("bgm_gyms")
      .select("id, name, short_name")
      .eq("id", gymId)
      .maybeSingle();

    if (gymResult.error) throw gymResult.error;
    if (!gymResult.data) {
      return NextResponse.json({ error: "Gym not found." }, { status: 404 });
    }

    const orderResult = await supabase
      .from("bgm_operational_orders")
      .insert({
        order_type: orderType,
        gym_id: gymId,
        submitted_by_system_user_id: auth.context.systemUserId,
        staff_name: staffName,
        status: "submitted",
        notes: notes || null,
        notification_status: "pending",
      })
      .select(
        "id, order_type, gym_id, staff_name, status, notes, submitted_at, notification_status"
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
      },
    });

    let notificationStatus: "sent" | "failed" = "sent";
    let notificationError: string | null = null;

    try {
      await sendOperationalOrderEmail({
        orderType,
        orderId: order.id,
        gymName: gymResult.data.name || gymResult.data.short_name || gymId,
        staffName,
        notes: notes || null,
        items,
      });

      const sentAt = new Date().toISOString();
      const notificationResult = await supabase
        .from("bgm_operational_orders")
        .update({
          notification_status: "sent",
          notification_sent_at: sentAt,
          notification_error: null,
          updated_at: sentAt,
        })
        .eq("id", order.id);
      if (notificationResult.error) throw notificationResult.error;
    } catch (mailError) {
      notificationStatus = "failed";
      notificationError =
        mailError instanceof Error ? mailError.message.slice(0, 500) : "Email delivery failed.";

      const failedAt = new Date().toISOString();
      const failureResult = await supabase
        .from("bgm_operational_orders")
        .update({
          notification_status: "failed",
          notification_error: notificationError,
          updated_at: failedAt,
        })
        .eq("id", order.id);

      if (failureResult.error) {
        console.error("Could not record order email failure:", failureResult.error);
      }
      console.error("Operational order email failed:", mailError);
    }

    return NextResponse.json(
      {
        order: {
          ...order,
          gym_name: gymResult.data.name || gymResult.data.short_name || gymId,
          items,
          notification_status: notificationStatus,
        },
        notificationStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not submit operational order." }, { status: 500 });
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
      return NextResponse.json({ error: "Order and valid status are required." }, { status: 400 });
    }

    const staffNameInput = clean(body.staffName);
    const staffName =
      staffNameInput || (auth.context.isSuperAdmin ? "Super Admin" : "");
    if (!staffName) {
      return NextResponse.json({ error: "Staff Name is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("bgm_operational_orders")
      .select("id, order_type, gym_id, status, staff_name")
      .eq("id", orderId);

    if (!auth.context.isSuperAdmin) {
      if (!auth.context.gymId) {
        return NextResponse.json({ error: "This account is not assigned to a gym." }, { status: 400 });
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
        { error: `Cannot change an order from ${currentStatus} to ${nextStatus}.` },
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
        "id, order_type, gym_id, staff_name, status, submitted_at, ordered_at, completed_at, cancelled_at, notification_status"
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
    return NextResponse.json({ error: "Could not update operational order." }, { status: 500 });
  }
}
