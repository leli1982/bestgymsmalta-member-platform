export type OperationalOrderType = "sundries" | "bar";
export type OperationalOrderStatus = "submitted" | "ordered" | "completed" | "cancelled";
export type OperationalOrderPermissionMode = "submit" | "history";

export type OperationalOrderItem = {
  itemName: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeOrderType(value: unknown): OperationalOrderType | null {
  const normalized = clean(value).toLowerCase();
  return normalized === "sundries" || normalized === "bar" ? normalized : null;
}

export function orderPermission(
  orderType: OperationalOrderType,
  mode: OperationalOrderPermissionMode
) {
  return `orders.${orderType}.${mode}` as const;
}

export function normalizeOrderItems(value: unknown): OperationalOrderItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const itemName = clean(row.itemName);
    const quantity = Number(row.quantity);

    if (!itemName || !Number.isFinite(quantity) || quantity <= 0) return [];

    const unit = clean(row.unit);
    const notes = clean(row.notes);

    return [
      {
        itemName,
        quantity,
        unit: unit || null,
        notes: notes || null,
      },
    ];
  });
}

export function canTransitionOrderStatus(
  currentStatus: OperationalOrderStatus,
  nextStatus: OperationalOrderStatus
) {
  const transitions: Record<OperationalOrderStatus, OperationalOrderStatus[]> = {
    submitted: ["ordered", "cancelled"],
    ordered: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  return transitions[currentStatus].includes(nextStatus);
}
