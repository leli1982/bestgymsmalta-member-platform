export type ShoppingListLine = {
  id?: string;
  item_name: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
};

export type ShoppingListOrder = {
  id: string;
  gym_id: string;
  gym_name: string;
  staff_name: string;
  status: "submitted" | "ordered" | "completed" | "cancelled";
  notes: string | null;
  submitted_at: string;
  items: ShoppingListLine[];
};

export type ShoppingListTotal = { name: string; unit: string | null; quantity: number };
export type ShoppingListGym = {
  gymId: string;
  gymName: string;
  orders: ShoppingListOrder[];
};

export function buildShoppingList(orders: ShoppingListOrder[]) {
  const open = orders.filter((order) => order.status === "submitted" || order.status === "ordered");
  const totals = new Map<string, ShoppingListTotal>();
  const gyms = new Map<string, ShoppingListGym>();
  for (const order of open) {
    let delivery = gyms.get(order.gym_id);
    if (!delivery) {
      delivery = { gymId: order.gym_id, gymName: order.gym_name, orders: [] };
      gyms.set(order.gym_id, delivery);
    }
    delivery.orders.push(order);
    for (const line of order.items) {
      const name = line.item_name.trim().replace(/\s+/g, " ");
      const unit = line.unit?.trim().replace(/\s+/g, " ") || null;
      const quantity = Number(line.quantity);
      if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
      // Item names are case-insensitive, but different units are never merged.
      const key = name.toLocaleLowerCase("en") + "\u001f" + (unit || "").toLocaleLowerCase("en");
      const existing = totals.get(key);
      if (existing) existing.quantity += quantity;
      else totals.set(key, { name, unit, quantity });
    }
  }
  const orderByName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
  return {
    totals: [...totals.values()].sort((a, b) => orderByName(a.name, b.name) || orderByName(a.unit || "", b.unit || "")),
    gyms: [...gyms.values()]
      .map((gym) => ({ ...gym, orders: gym.orders.sort((a, b) =>
        a.submitted_at.localeCompare(b.submitted_at) || orderByName(a.id, b.id)) }))
      .sort((a, b) => orderByName(a.gymName, b.gymName)),
    openOrderCount: open.length,
  };
}
