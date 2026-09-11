"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  nextOperationalOrderActions,
  orderTypePresentation,
} from "@/lib/operationalOrdersPresentation";
import type {
  OperationalOrderStatus,
  OperationalOrderType,
} from "@/lib/operationalOrdersCore";

type SystemUser = {
  id: string;
  gymId: string | null;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type Gym = {
  id: string;
  name: string;
  status?: string;
};

type OrderItem = {
  id?: string;
  item_name?: string;
  itemName?: string;
  quantity: number | string;
  unit?: string | null;
  notes?: string | null;
};

type Order = {
  id: string;
  order_type: OperationalOrderType;
  gym_id: string;
  gym_name: string;
  staff_name: string;
  status: OperationalOrderStatus;
  notes: string | null;
  submitted_at: string;
  ordered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notification_status: "pending" | "sent" | "failed";
  items: OrderItem[];
};

type DraftItem = {
  itemName: string;
  quantity: string;
  unit: string;
  notes: string;
};

const emptyItem = (): DraftItem => ({
  itemName: "",
  quantity: "1",
  unit: "",
  notes: "",
});

export default function OperationalOrdersPage({
  orderType,
}: {
  orderType: OperationalOrderType;
}) {
  const presentation = orderTypePresentation(orderType);
  const [user, setUser] = useState<SystemUser | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitPermission = `orders.${orderType}.submit`;
  const historyPermission = `orders.${orderType}.history`;

  const canSubmit = Boolean(
    user?.isSuperAdmin || user?.permissions.includes(submitPermission)
  );
  const canViewHistory = Boolean(
    user?.isSuperAdmin || user?.permissions.includes(historyPermission)
  );
  const canManage = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("orders.manage")
  );

  const loadOrders = useCallback(async () => {
    if (!canViewHistory) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ type: orderType });
      if (user?.isSuperAdmin && selectedGymId) {
        params.set("gymId", selectedGymId);
      }
      const response = await fetch(`/api/system/orders?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load order history.");
      setOrders(data.orders || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load order history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [canViewHistory, orderType, selectedGymId, user?.isSuperAdmin]);

  useEffect(() => {
    async function initialise() {
      try {
        const authResponse = await fetch("/api/system/auth", { cache: "no-store" });
        const authData = await authResponse.json();
        if (!authData.authenticated || !authData.user) {
          window.location.href = "/staff";
          return;
        }

        const currentUser = authData.user as SystemUser;
        setUser(currentUser);

        if (currentUser.isSuperAdmin) {
          const gymsResponse = await fetch("/api/gyms", { cache: "no-store" });
          const gymsData = await gymsResponse.json();
          const availableGyms = (gymsData.gyms || []) as Gym[];
          setGyms(availableGyms);
          const firstGym =
            availableGyms.find((gym) => gym.status === "active") || availableGyms[0];
          setSelectedGymId(firstGym?.id || "");
        } else {
          setSelectedGymId(currentUser.gymId || "");
        }
      } catch {
        setError("Could not initialise staff orders.");
      } finally {
        setLoading(false);
      }
    }

    void initialise();
  }, []);

  useEffect(() => {
    if (!loading && user && canViewHistory) void loadOrders();
  }, [canViewHistory, loadOrders, loading, user]);

  const cleanItems = useMemo(
    () =>
      items.filter(
        (item) => item.itemName.trim() && Number(item.quantity) > 0
      ),
    [items]
  );

  function updateItem(index: number, field: keyof DraftItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!user?.isSuperAdmin && !staffName.trim()) {
      setError("Staff Name is required.");
      return;
    }
    if (!cleanItems.length) {
      setError("Add at least one valid item.");
      return;
    }
    if (!selectedGymId) {
      setError("Select a gym.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/system/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          gymId: user?.isSuperAdmin ? selectedGymId : undefined,
          staffName,
          notes,
          items: cleanItems.map((item) => ({
            itemName: item.itemName,
            quantity: Number(item.quantity),
            unit: item.unit,
            notes: item.notes,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit order.");

      setItems([emptyItem()]);
      setNotes("");
      setMessage(
        data.notificationStatus === "sent"
          ? `${presentation.title} submitted and emailed successfully.`
          : `${presentation.title} saved successfully. Email delivery failed and is recorded for follow-up.`
      );
      if (canViewHistory) await loadOrders();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit order.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(orderId: string, status: OperationalOrderStatus) {
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status, staffName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update order.");
      setMessage(`Order marked ${status}.`);
      await loadOrders();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update order.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">
        Loading…
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <a href="/staff" className="text-sm font-semibold text-orange-600">← Staff Home</a>
            <h1 className="mt-2 text-3xl font-bold">{presentation.pluralTitle}</h1>
            <p className="mt-1 text-sm text-zinc-500">{user.displayName}</p>
          </div>
          <a
            href={orderType === "sundries" ? "/staff/bar" : "/staff/sundries"}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            {orderType === "sundries" ? "Open Bar Lists" : "Open Sundries"}
          </a>
        </header>

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {(canSubmit || canManage) && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              {!user.isSuperAdmin && (
                <label className="block text-sm font-semibold">
                  Staff Name
                  <input
                    value={staffName}
                    onChange={(event) => setStaffName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500"
                    placeholder="e.g. Maria Borg"
                  />
                </label>
              )}

              {user.isSuperAdmin && (
                <label className="block text-sm font-semibold">
                  Gym
                  <select
                    value={selectedGymId}
                    onChange={(event) => setSelectedGymId(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3"
                  >
                    {gyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </section>
        )}

        {canSubmit && (
          <form onSubmit={submitOrder} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">New {presentation.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">Add only the items required for this order.</p>
              </div>
              <button
                type="button"
                onClick={() => setItems((current) => [...current, emptyItem()])}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold"
              >
                + Add Item
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-[2fr_0.7fr_1fr_2fr_auto]">
                  <input
                    value={item.itemName}
                    onChange={(event) => updateItem(index, "itemName", event.target.value)}
                    placeholder="Item"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
                  />
                  <input
                    value={item.quantity}
                    onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Qty"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
                  />
                  <input
                    value={item.unit}
                    onChange={(event) => updateItem(index, "unit", event.target.value)}
                    placeholder="Unit"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
                  />
                  <input
                    value={item.notes}
                    onChange={(event) => updateItem(index, "notes", event.target.value)}
                    placeholder="Item notes"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.length === 1
                          ? [emptyItem()]
                          : current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <label className="mt-4 block text-sm font-semibold">
              Order Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3"
                placeholder="Optional notes for the manager"
              />
            </label>

            <button
              disabled={submitting}
              className="mt-5 rounded-xl bg-zinc-900 px-6 py-3 font-bold text-white disabled:opacity-50"
            >
              {submitting ? "Submitting…" : `Submit ${presentation.title}`}
            </button>
          </form>
        )}

        {canViewHistory && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">History</h2>
                <p className="mt-1 text-sm text-zinc-500">Saved orders and their current status.</p>
              </div>
              <button
                onClick={() => void loadOrders()}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold"
              >
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <p className="mt-5 text-sm text-zinc-500">Loading history…</p>
            ) : orders.length === 0 ? (
              <p className="mt-5 text-sm text-zinc-500">No {presentation.pluralTitle.toLowerCase()} yet.</p>
            ) : (
              <div className="mt-5 space-y-4">
                {orders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{order.gym_name}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {new Date(order.submitted_at).toLocaleString()} · Staff: {order.staff_name}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase">
                          {order.status}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                            order.notification_status === "sent"
                              ? "bg-emerald-100 text-emerald-700"
                              : order.notification_status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          Email {order.notification_status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 divide-y divide-zinc-100 rounded-lg bg-zinc-50 px-3">
                      {order.items.map((item) => (
                        <div key={item.id || `${order.id}-${item.item_name}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                          <span>
                            {item.item_name || item.itemName}
                            {item.notes ? <span className="text-zinc-500"> · {item.notes}</span> : null}
                          </span>
                          <strong>
                            {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {order.notes && <p className="mt-3 text-sm text-zinc-600">Notes: {order.notes}</p>}

                    {canManage && nextOperationalOrderActions(order.status).length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {nextOperationalOrderActions(order.status).map((status) => (
                          <button
                            key={status}
                            onClick={() => void updateStatus(order.id, status)}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                              status === "cancelled"
                                ? "border border-red-200 bg-red-50 text-red-700"
                                : "bg-zinc-900 text-white"
                            }`}
                          >
                            Mark {status}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!canSubmit && !canViewHistory && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
            This account does not have permission to use {presentation.pluralTitle.toLowerCase()}.
          </section>
        )}
      </div>
    </main>
  );
}
