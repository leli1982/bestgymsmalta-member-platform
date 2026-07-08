"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  MapPin,
  RefreshCw,
  Search,
  User,
} from "lucide-react";

type AdminCheckin = {
  id: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  memberEmail: string;
  gymId: string;
  gymName: string;
  gymCity: string;
  checkinAt: string;
  source: string;
};

function formatDateTime(value: string) {
  if (!value) return "No date";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export default function AdminCheckinsViewer({ pin }: { pin: string }) {
  const [checkins, setCheckins] = useState<AdminCheckin[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadCheckins();
  }, []);

  async function loadCheckins() {
    try {
      setLoading(true);
      setStatus("");

      const response = await fetch("/api/admin/checkins?limit=300", {
        headers: {
          "x-admin-pin": pin,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load check-ins.");
      }

      setCheckins(data.checkins || []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load check-ins.");
    } finally {
      setLoading(false);
    }
  }

  const filteredCheckins = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return checkins;

    return checkins.filter((checkin) =>
      [
        checkin.memberName,
        checkin.memberNumber,
        checkin.memberEmail,
        checkin.gymName,
        checkin.gymCity,
        checkin.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [checkins, search]);

  const uniqueMembers = new Set(checkins.map((item) => item.memberId)).size;
  const uniqueGyms = new Set(checkins.map((item) => item.gymId)).size;

  function exportVisibleCheckins() {
    const headers = [
      "memberName",
      "memberNumber",
      "memberEmail",
      "gymName",
      "gymCity",
      "checkinAt",
      "source",
    ];

    const rows = filteredCheckins.map((checkin) => [
      checkin.memberName,
      checkin.memberNumber,
      checkin.memberEmail,
      checkin.gymName,
      checkin.gymCity,
      checkin.checkinAt,
      checkin.source,
    ]);

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `bgm-checkins-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Check-ins
          </p>

          <h2 className="mt-1 text-3xl font-black text-white">
            Recent member visits
          </h2>

          <p className="mt-2 text-sm font-bold leading-6 text-white/45">
            View recent QR check-ins across the BGM network.
          </p>
        </div>

        <button
          type="button"
          onClick={loadCheckins}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white"
        >
          <RefreshCw
            size={17}
            strokeWidth={3}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-3xl font-black text-white">{checkins.length}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
            Check-ins
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-3xl font-black text-[#fcb415]">{uniqueMembers}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
            Members
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-3xl font-black text-white">{uniqueGyms}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
            Gyms
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
          <Search className="text-white/30" size={18} strokeWidth={3} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search member, number, email or gym"
            className="w-full bg-transparent text-base font-bold text-white outline-none placeholder:text-white/25"
          />
        </div>

        <button
          type="button"
          onClick={exportVisibleCheckins}
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-3 text-xs font-black uppercase tracking-[.12em] text-white"
        >
          <Download size={15} strokeWidth={3} />
          Export Visible Check-ins
        </button>
      </div>

      {status ? (
        <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">
          {status}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {filteredCheckins.map((checkin) => (
          <article
            key={checkin.id}
            className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fcb415] text-black">
                <User size={22} strokeWidth={3} />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-black text-white">
                  {checkin.memberName}
                </h3>

                <p className="mt-1 text-xs font-black uppercase tracking-[.16em] text-[#fcb415]">
                  {checkin.memberNumber || "No member number"}
                </p>

                <p className="mt-2 flex items-center gap-2 text-sm font-bold text-white/45">
                  <MapPin size={15} strokeWidth={3} />
                  {checkin.gymName}
                  {checkin.gymCity ? ` • ${checkin.gymCity}` : ""}
                </p>

                <p className="mt-1 flex items-center gap-2 text-xs font-bold text-white/35">
                  <CalendarDays size={14} strokeWidth={3} />
                  {formatDateTime(checkin.checkinAt)}
                </p>
              </div>
            </div>
          </article>
        ))}

        {!loading && filteredCheckins.length === 0 ? (
          <div className="rounded-[1.7rem] border border-white/10 bg-black/25 p-6 text-center">
            <p className="text-2xl font-black text-white">
              No check-ins found
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-white/45">
              Try refreshing or changing your search.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
