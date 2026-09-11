"use client";

import { useEffect, useState } from "react";
import OfficialMemberPhotoCapture from "@/components/staff/OfficialMemberPhotoCapture";

type Participant = {
  id: string;
  participantOrder: number;
  fullName: string;
  hasPhoto: boolean;
  photoUrl: string | null;
  reservedBarcode: string | null;
};

type Application = {
  id: string;
  reference: string;
  membershipType: string;
  status: string;
  staffName: string;
  participants: Participant[];
};

export default function PendingMembershipActions() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [openId, setOpenId] = useState("");
  const [barcodes, setBarcodes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/system/members/card/assign", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not load pending memberships.");
        return;
      }
      setApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch {
      setError("Could not load pending memberships.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function reserveCard(applicationMemberId: string) {
    const barcode = (barcodes[applicationMemberId] || "").trim();
    if (!barcode) {
      setError("Scan the preprinted membership card first.");
      return;
    }
    setError("");
    setMessage("");
    const response = await fetch("/api/system/members/card/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationMemberId, barcode }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not reserve membership card.");
      return;
    }
    setMessage(`Card ${data.reservation.barcodeValue} reserved.`);
    setBarcodes((current) => ({ ...current, [applicationMemberId]: "" }));
    await load();
  }

  if (applications.length === 0) return null;

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Membership action required</p>
          <h2 className="mt-1 text-xl font-black">NEW MEMBERSHIP READY — SCAN CARD</h2>
        </div>
        <span className="rounded-full bg-orange-600 px-3 py-1 text-xs font-black text-white">{applications.length}</span>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      <div className="mt-4 space-y-3">
        {applications.map((application) => (
          <div key={application.id} className="rounded-xl border border-orange-200 bg-white p-4">
            <button type="button" onClick={() => setOpenId(openId === application.id ? "" : application.id)} className="flex w-full items-center justify-between gap-4 text-left">
              <div><p className="font-black">{application.reference}</p><p className="text-sm text-zinc-500">{application.participants.map((participant) => participant.fullName).join(" + ")}</p></div>
              <span className="text-sm font-bold text-orange-700">{openId === application.id ? "Close" : "Open"}</span>
            </button>

            {openId === application.id && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {application.participants.map((participant) => (
                  <div key={participant.id} className="rounded-xl border border-zinc-200 p-4">
                    <p className="font-black">{participant.fullName}</p>
                    {participant.hasPhoto && participant.photoUrl ? <img src={participant.photoUrl} alt={`${participant.fullName} official photo`} className="mt-3 aspect-square w-32 rounded-xl object-cover" /> : <div className="mt-3"><OfficialMemberPhotoCapture applicationMemberId={participant.id} staffName={application.staffName} onSaved={() => void load()} /></div>}
                    <div className="mt-4">
                      {participant.reservedBarcode ? <div className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">Card reserved: {participant.reservedBarcode}</div> : <div className="flex gap-2"><input autoFocus inputMode="text" value={barcodes[participant.id] || ""} onChange={(event) => setBarcodes((current) => ({ ...current, [participant.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void reserveCard(participant.id); } }} placeholder="Scan card barcode" className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 font-mono" /><button type="button" onClick={() => void reserveCard(participant.id)} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Reserve Card</button></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
