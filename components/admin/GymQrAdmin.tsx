"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { Copy, QrCode, RefreshCw } from "lucide-react";

type AdminGym = {
  id: string;
  name: string;
  status: string;
  logo?: string;
};

type AdminCheckin = {
  id: string;
  memberId: string;
  gymId: string;
  gymName: string;
  gymLogo?: string;
  checkinAt: string;
};

export default function GymQrAdmin({ pin }: { pin: string }) {
  const [gyms, setGyms] = useState<AdminGym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [checkins, setCheckins] = useState<AdminCheckin[]>([]);
  const [status, setStatus] = useState("");

  const selectedGym = gyms.find((gym) => gym.id === selectedGymId);

  const checkInUrl = useMemo(() => {
    if (typeof window === "undefined" || !selectedGymId) return "";

    return `${window.location.origin}/check-in/${selectedGymId}`;
  }, [selectedGymId]);

  useEffect(() => {
    loadData();
  }, []);

  async function adminFetch(url: string) {
    return fetch(url, {
      headers: {
        "x-admin-pin": pin,
      },
      cache: "no-store",
    });
  }

  async function loadData() {
    setStatus("Loading QR codes…");

    const gymsResponse = await adminFetch("/api/admin/gyms");
    const gymsData = await gymsResponse.json();

    if (gymsResponse.ok) {
      const loadedGyms = gymsData.gyms || [];
      setGyms(loadedGyms);

      if (loadedGyms.length && !selectedGymId) {
        setSelectedGymId(loadedGyms[0].id);
      }
    }

    const checkinsResponse = await adminFetch("/api/admin/checkins");
    const checkinsData = await checkinsResponse.json();

    if (checkinsResponse.ok) {
      setCheckins(checkinsData.checkins || []);
    }

    setStatus("QR codes ready.");
  }

  async function copyLink() {
    if (!checkInUrl) return;

    await navigator.clipboard.writeText(checkInUrl);
    setStatus("Check-in link copied.");
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <QrCode className="text-[#fcb415]" size={26} strokeWidth={3} />
          <h2 className="text-2xl font-black">Gym QR Check-ins</h2>
        </div>

        <p className="mt-3 text-sm font-bold leading-6 text-white/50">
          Members scan the QR code with their phone camera. The QR opens the
          check-in page and stamps their passport.
        </p>

        <button
          type="button"
          onClick={loadData}
          className="mt-5 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black"
        >
          <RefreshCw size={16} strokeWidth={3} />
          Refresh
        </button>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[.18em] text-white/40">
            Select Gym
          </span>

          <select
            value={selectedGymId}
            onChange={(event) => setSelectedGymId(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          >
            {gyms.map((gym) => (
              <option key={gym.id} value={gym.id}>
                {gym.name}
              </option>
            ))}
          </select>
        </label>

        {selectedGym && checkInUrl ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-[2rem] bg-white p-6">
              <QRCode value={checkInUrl} className="h-auto w-full" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
                {selectedGym.name}
              </p>
              <p className="mt-2 break-all text-xs font-bold text-white/45">
                {checkInUrl}
              </p>
            </div>

            <button
              type="button"
              onClick={copyLink}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
            >
              <Copy size={17} strokeWidth={3} />
              Copy Check-in Link
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-2xl font-black">Recent Check-ins</h2>

        <div className="mt-4 space-y-3">
          {checkins.length === 0 ? (
            <p className="text-sm font-bold text-white/45">
              No check-ins yet.
            </p>
          ) : null}

          {checkins.map((checkin) => (
            <div
              key={checkin.id}
              className="rounded-2xl border border-white/10 bg-black/25 p-4"
            >
              <p className="text-sm font-black text-white">
                {checkin.gymName}
              </p>
              <p className="mt-1 text-xs font-bold text-white/45">
                {new Date(checkin.checkinAt).toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[.16em] text-[#fcb415]">
                {checkin.memberId}
              </p>
            </div>
          ))}
        </div>
      </section>

      {status ? (
        <p className="text-center text-sm font-bold text-white/50">{status}</p>
      ) : null}
    </section>
  );
}
