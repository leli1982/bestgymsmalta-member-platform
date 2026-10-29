"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, CircleHelp, Search, X } from "lucide-react";
import {
  STAFF_HELP_TOPICS,
  getContextStaffHelpTopic,
  searchStaffHelpTopics,
  type StaffHelpTopic,
} from "@/lib/staffHelpContent";
import { STAFF_HELP_SCREENSHOTS } from "@/lib/staffHelpScreenshots";

type AuthState = {
  authenticated: boolean;
  isSuperAdmin: boolean;
};

function HelpArticle({ topic }: { topic: StaffHelpTopic }) {
  const screenshot = STAFF_HELP_SCREENSHOTS[topic.id];

  return (
    <article className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Staff Help</p>
        <h3 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">{topic.title}</h3>
        <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{topic.summary}</p>
      </div>

      {screenshot && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshot} alt={`${topic.title} help screenshot`} className="h-auto w-full" />
        </div>
      )}

      <ol className="space-y-3">
        {topic.steps.map((step, index) => (
          <li key={`${topic.id}-${index}`} className="flex gap-3 rounded-2xl bg-zinc-50 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff5a0a] text-sm font-black text-white">{index + 1}</span>
            <p className="pt-1 text-sm font-semibold leading-6 text-zinc-800">{step}</p>
          </li>
        ))}
      </ol>

      {topic.important && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Important</p>
          <p className="mt-1 text-sm font-bold leading-6 text-orange-950">{topic.important}</p>
        </div>
      )}
    </article>
  );
}

export default function StaffHelpCentre() {
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeKey, setRouteKey] = useState(pathname);
  const searchRef = useRef<HTMLInputElement>(null);

  const verifyAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/system/auth", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      setAuth({
        authenticated: Boolean(response.ok && data.authenticated && data.user),
        isSuperAdmin: Boolean(data.user?.isSuperAdmin),
      });
    } catch {
      setAuth({ authenticated: false, isSuperAdmin: false });
    }
  }, []);

  useEffect(() => {
    void verifyAuth();
    const handler = () => void verifyAuth();
    window.addEventListener("bgm-staff-auth-changed", handler);
    return () => window.removeEventListener("bgm-staff-auth-changed", handler);
  }, [verifyAuth]);

  useEffect(() => setRouteKey(pathname), [pathname]);

  const contextTopic = useMemo(() => getContextStaffHelpTopic(routeKey), [routeKey]);
  const results = useMemo(() => searchStaffHelpTopics(query), [query]);
  const selected = useMemo(
    () => STAFF_HELP_TOPICS.find((topic) => topic.id === selectedId) || contextTopic || results[0] || STAFF_HELP_TOPICS[0],
    [selectedId, contextTopic, results]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedId(contextTopic?.id || null);
    setQuery("");
    window.setTimeout(() => searchRef.current?.focus(), 50);
  }, [open, contextTopic?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const hiddenRoute = pathname.startsWith("/staff/admin") || pathname.startsWith("/staff/membership-settings") || pathname.startsWith("/staff/operations");
  if (!auth?.authenticated || hiddenRoute) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Open Staff Help"
        onClick={() => {
          setRouteKey(`${window.location.pathname}${window.location.search}`);
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-[75] inline-flex items-center gap-2 rounded-full bg-[#ff5a0a] px-4 py-3 text-sm font-black text-white shadow-xl shadow-orange-950/20 transition hover:-translate-y-0.5 hover:bg-orange-600 print:hidden"
      >
        <CircleHelp className="h-5 w-5" /> Help
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-5 print:hidden" role="dialog" aria-modal="true" aria-label="Staff Help Centre">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[86vh] sm:rounded-3xl">
            <header className="border-b border-zinc-200 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">BestGymsMalta Staff</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">How can we help?</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close Help" className="rounded-xl border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedId(null);
                  }}
                  placeholder="Search help — e.g. lost card, renew, bar, voucher…"
                  aria-label="Search help"
                  className="w-full rounded-2xl border border-zinc-300 bg-white py-3 pl-12 pr-4 text-base font-semibold text-zinc-950 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="max-h-60 overflow-y-auto border-b border-zinc-200 bg-zinc-50 p-3 md:max-h-none md:border-b-0 md:border-r">
                {!query && contextTopic && (
                  <button type="button" onClick={() => setSelectedId(contextTopic.id)} className="mb-3 w-full rounded-2xl border border-orange-200 bg-orange-50 p-3 text-left">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-700">Help for this screen</span>
                    <span className="mt-1 block text-sm font-black text-zinc-950">{contextTopic.title}</span>
                  </button>
                )}

                <div className="space-y-1.5">
                  {results.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedId(topic.id)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${selected?.id === topic.id ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-white"}`}
                    >
                      {topic.title}
                    </button>
                  ))}
                  {results.length === 0 && <p className="p-3 text-sm font-semibold text-zinc-500">No help topic found. Try a simpler word.</p>}
                </div>
              </aside>

              <main className="min-h-0 overflow-y-auto p-4 sm:p-6 md:p-8">
                {selected && <HelpArticle topic={selected} />}
              </main>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-white px-4 py-3 sm:px-6">
              <p className="text-xs font-semibold text-zinc-500">Press Escape or × to close Help.</p>
              <a href="/staff/help" className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white hover:bg-zinc-800">
                <BookOpen className="h-4 w-4" /> Open Full Staff Manual
              </a>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
