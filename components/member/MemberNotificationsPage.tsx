"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight, RefreshCw } from "lucide-react";

type MemberNotification = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function MemberNotificationsPage() {
  const [items, setItems] = useState<MemberNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<MemberNotification | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/member/notifications", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign("/member-login");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Could not load notifications.");
      setItems(data.notifications || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    function refreshOnReturn() {
      void load();
    }

    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [load]);

  async function openNotification(item: MemberNotification) {
    let opened = item;

    if (!item.read_at) {
      setBusy(item.id);
      try {
        const response = await fetch("/api/member/notifications", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
        if (!response.ok) throw new Error("Could not mark notification as read.");

        opened = { ...item, read_at: new Date().toISOString() };
        setItems((current) => current.map((row) => row.id === item.id ? opened : row));
        window.dispatchEvent(new CustomEvent("bgmNotificationsChanged"));
      } catch (readError) {
        setError(readError instanceof Error ? readError.message : "Could not update notification.");
      } finally {
        setBusy("");
      }
    }

    setSelected(opened);
  }

  async function markAllRead() {
    setBusy("all");
    try {
      const response = await fetch("/api/member/notifications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });
      if (!response.ok) throw new Error("Could not mark notifications as read.");
      const now = new Date().toISOString();
      setItems((current) => current.map((row) => ({ ...row, read_at: row.read_at || now })));
      window.dispatchEvent(new CustomEvent("bgmNotificationsChanged"));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not update notifications.");
    } finally {
      setBusy("");
    }
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="space-y-4 text-zinc-950">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]">
              <Bell size={24} strokeWidth={3} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Notifications</p>
              <h1 className="mt-1 text-2xl font-black">Your BGM updates</h1>
              <p className="mt-1 text-xs font-bold text-zinc-500">{unread} unread</p>
            </div>
          </div>
          {unread > 0 ? (
            <button
              type="button"
              disabled={busy === "all"}
              onClick={() => void markAllRead()}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-black text-zinc-700 disabled:opacity-50"
            >
              <CheckCheck size={15} strokeWidth={3} /> Mark all read
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-[2rem] border border-zinc-200 bg-white p-10 text-zinc-500">
          <RefreshCw className="animate-spin" size={22} />
        </div>
      ) : items.length === 0 ? (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <Bell className="mx-auto text-zinc-300" size={38} strokeWidth={2.5} />
          <h2 className="mt-4 text-xl font-black">You’re all caught up</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">Membership reminders and other important BGM updates will appear here.</p>
        </section>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={busy === item.id}
              onClick={() => void openNotification(item)}
              className={`w-full rounded-[1.6rem] border p-4 text-left shadow-sm transition active:scale-[0.99] ${item.read_at ? "border-zinc-200 bg-white" : "border-orange-200 bg-orange-50"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read_at ? "bg-zinc-200" : "bg-[#ff5a0a]"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-black text-zinc-950">{item.title}</h2>
                    <span className="shrink-0 text-[10px] font-bold text-zinc-400">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold leading-5 text-zinc-600">{item.body}</p>
                </div>
                {item.href ? <ChevronRight className="mt-1 shrink-0 text-zinc-400" size={18} strokeWidth={3} /> : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/45 p-4 backdrop-blur-sm sm:items-center">
          <section className="relative mx-auto w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white p-5 text-zinc-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-lg font-black text-zinc-500"
              aria-label="Close notification"
            >
              ×
            </button>

            <div className="pr-12">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff5a0a]">BGM Notification</p>
              <h2 className="mt-2 text-2xl font-black">{selected.title}</h2>
              <p className="mt-2 text-xs font-bold text-zinc-400">{formatDate(selected.created_at)}</p>
            </div>

            <p className="mt-5 text-sm font-semibold leading-6 text-zinc-700">{selected.body}</p>

            <div className="mt-6 grid gap-2">
              {selected.href ? (
                <button
                  type="button"
                  onClick={() => window.location.assign(selected.href!)}
                  className="w-full rounded-full bg-[#ff5a0a] px-5 py-3 text-sm font-black text-white"
                >
                  Open related page
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-full rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
