"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, UserRound, X } from "lucide-react";

type Classification = "active" | "expired" | "inactive";
type Filter = "all" | "active" | "expired";

type StaffMember = {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  classification: Classification;
  membershipExpiry: string;
  mobile: string;
  email: string;
  idNumber: string;
  enrollmentGymId: string | null;
  enrollmentGymName: string;
  legacyPkCustomer: string;
  legacyGym: string;
  photoUrl: string | null;
};

type SearchResponse = {
  candidates?: StaffMember[];
  hasMore?: boolean;
  error?: string;
};

type Props = {
  focusToken?: number;
  canRenew?: boolean;
};

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "ALL" },
  { key: "active", label: "ACTIVE" },
  { key: "expired", label: "EXPIRED" },
];

function statusClass(classification: Classification) {
  if (classification === "active") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  return "bg-red-100 text-red-800 ring-red-200";
}

function statusLabel(classification: Classification) {
  if (classification === "active") return "ACTIVE";
  if (classification === "expired") return "EXPIRED";
  return "INACTIVE";
}

export default function StaffMemberBrowser({ focusToken = 0, canRenew = false }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusToken > 0) searchRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    const refresh = () => setRefreshToken((value) => value + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          status: filter,
          page: "1",
          limit: "50",
        });
        const response = await fetch(`/api/system/members/search?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = (await response.json()) as SearchResponse;
        if (!response.ok) throw new Error(data.error || "Could not load members.");
        setMembers(data.candidates || []);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setMembers([]);
        setError(requestError instanceof Error ? requestError.message : "Could not load members.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, filter, refreshToken]);

  useEffect(() => {
    if (!selected) return;
    const freshSelected = members.find((member) => member.id === selected.id);
    if (freshSelected) setSelected(freshSelected);
  }, [members, selected?.id]);

  const summary = useMemo(() => {
    if (loading) return "Loading members…";
    if (members.length === 1) return "1 member";
    return `${members.length} members`;
  }, [loading, members.length]);

  return (
    <section id="staff-members" className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a0a]">Member browser</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">Members</h2>
            <p className="mt-1 text-sm text-zinc-500">Member lookup for reception and renewal.</p>
          </div>
          <p className="text-sm font-semibold text-zinc-500">{summary}</p>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search members</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, BGM number, card / pkCustomer, ID, phone or email"
              className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 py-3.5 pl-12 pr-4 text-base font-medium outline-none transition focus:border-[#ff5a0a] focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <div className="flex rounded-2xl bg-zinc-100 p-1" aria-label="Member status filter">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-xl px-4 py-2.5 text-xs font-black tracking-wide transition ${
                  filter === item.key ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      </div>

      <div className="divide-y divide-zinc-100">
        {!loading && members.length === 0 && !error && (
          <div className="p-10 text-center text-sm text-zinc-500">No members match this view.</div>
        )}
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => setSelected(member)}
            className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition hover:bg-zinc-50 sm:px-6"
          >
            {member.photoUrl ? (
              <img src={member.photoUrl} alt="" className="h-13 w-13 rounded-2xl bg-zinc-100 object-cover" />
            ) : (
              <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
                <UserRound className="h-6 w-6" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-black text-zinc-950">{member.fullName || `${member.firstName} ${member.lastName}`.trim()}</span>
              <span className="mt-1 block truncate text-sm text-zinc-500">
                {member.memberNumber || "No member number"} · Expiry {member.membershipExpiry || "—"}
              </span>
            </span>
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-black tracking-wide ring-1 ${statusClass(member.classification)}`}>
              {statusLabel(member.classification)}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full overflow-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-4xl sm:rounded-3xl">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute right-0 top-0 z-10 rounded-xl border border-zinc-200 bg-white/95 p-2 text-zinc-500 shadow-sm hover:bg-zinc-50"
                aria-label="Close member detail"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {selected.photoUrl ? (
                  <img
                    src={selected.photoUrl}
                    alt={selected.fullName ? `${selected.fullName} member photo` : "Member photo"}
                    className="h-72 w-full shrink-0 rounded-3xl bg-zinc-100 object-cover sm:h-80 sm:w-80"
                  />
                ) : (
                  <span className="flex h-72 w-full shrink-0 items-center justify-center rounded-3xl bg-zinc-100 text-zinc-400 sm:h-80 sm:w-80">
                    <UserRound className="h-20 w-20" />
                  </span>
                )}
                <div className="min-w-0 pr-12 sm:pt-2">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Member details</p>
                  <h3 className="mt-2 text-3xl font-black leading-tight text-zinc-950">{selected.fullName}</h3>
                  <span className={`mt-3 inline-flex rounded-full px-4 py-1.5 text-xs font-black tracking-wide ring-1 ${statusClass(selected.classification)}`}>
                    {statusLabel(selected.classification)}
                  </span>
                  <p className="mt-4 text-sm font-semibold leading-6 text-zinc-500">
                    Confirm the member photo before allowing access or processing membership changes.
                  </p>
                </div>
              </div>
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["BGM member number", selected.memberNumber || "—"],
                ["Physical card / pkCustomer", selected.legacyPkCustomer || "—"],
                ["ID number", selected.idNumber || "—"],
                ["Membership expiry", selected.membershipExpiry || "—"],
                ["Phone", selected.mobile || "—"],
                ["Email", selected.email || "—"],
                ["Gym", selected.legacyGym || selected.enrollmentGymName || "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-zinc-50 p-4">
                  <dt className="text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</dt>
                  <dd className="mt-1 break-words font-bold text-zinc-900">{value}</dd>
                </div>
              ))}
            </dl>

            {canRenew && selected.memberNumber && (
              <a
                href={`/staff/members/enroll?kind=renewal&memberNumber=${encodeURIComponent(selected.memberNumber)}`}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ff5a0a] px-5 py-4 text-base font-black text-white shadow-sm hover:bg-orange-600"
              >
                <RefreshCw className="h-5 w-5" /> RENEW MEMBERSHIP
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
