"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Dumbbell,
  MapPinned,
  QrCode,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { Gym } from "@/components/data/gyms";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

function getGymLogo(gym: Gym) {
  return gym.logo || `/gym-logos/${gym.id}.png`;
}

function extractGymIdFromQr(value: string, gyms: Gym[]) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return "";

  const directGym = gyms.find(
    (gym: any) =>
      gym.id === cleanValue ||
      gym.qrCodeId === cleanValue ||
      gym.qr_code_id === cleanValue
  );

  if (directGym) return directGym.id;

  try {
    const url = new URL(cleanValue, window.location.origin);

    const queryGymId =
      url.searchParams.get("gymId") ||
      url.searchParams.get("gym") ||
      url.searchParams.get("id");

    if (queryGymId) return queryGymId;

    const parts = url.pathname.split("/").filter(Boolean);
    const checkInIndex = parts.findIndex((part) => part === "check-in");

    if (checkInIndex >= 0 && parts[checkInIndex + 1]) {
      return parts[checkInIndex + 1];
    }
  } catch {
    // Not a URL. Try matching below.
  }

  const matchedGym = gyms.find((gym) => cleanValue.includes(gym.id));

  return matchedGym?.id || "";
}

export default function ScanGymQrPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const [member, setMember] = useState<AppMember | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMember(getSavedMember());
    loadGyms();

    return () => stopScanner();
  }, []);

  async function loadGyms() {
    try {
      setLoading(true);

      const response = await fetch("/api/gyms", {
        cache: "no-store",
      });

      const data = await response.json();

      setGyms(data.gyms || []);
    } catch {
      setGyms([]);
    } finally {
      setLoading(false);
    }
  }

  function goToGymCheckin(gymId: string) {
    if (!gymId) return;
    window.location.href = `/check-in?gymId=${encodeURIComponent(gymId)}`;
  }

  function handleQrValue(value: string) {
    const gymId = extractGymIdFromQr(value, gyms);

    if (!gymId) {
      setScannerMessage("QR scanned, but it does not match a BGM gym.");
      return;
    }

    stopScanner();
    goToGymCheckin(gymId);
  }

  async function startScanner() {
    try {
      setScannerMessage("");

      if (!window.BarcodeDetector) {
        setScannerMessage(
          "QR scanning is not supported by this browser. Use the gym list below instead."
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({
        formats: ["qr_code"],
      });

      setScannerActive(true);

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);

          if (codes?.[0]?.rawValue) {
            handleQrValue(codes[0].rawValue);
          }
        } catch {
          // Keep scanning quietly.
        }
      }, 700);
    } catch {
      setScannerMessage(
        "Could not open the camera. You can still select the gym manually below."
      );
      stopScanner();
    }
  }

  function stopScanner() {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setScannerActive(false);
  }

  const visibleGyms = gyms
    .filter((gym) => (gym.status || "active") === "active")
    .filter((gym) =>
      [gym.name, gym.city, gym.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.3rem] border border-white/10 bg-gradient-to-br from-[#fcb415]/20 via-white/[0.04] to-black p-6 shadow-2xl">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#fcb415]/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
                Passport Check-in
              </p>

              <h1 className="mt-4 text-4xl font-black leading-tight text-white">
                Scan Gym QR
              </h1>

              <p className="mt-3 text-sm font-bold leading-6 text-white/55">
                Scan the QR code at the gym to collect your passport stamp.
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#fcb415] text-black">
              <QrCode size={34} strokeWidth={3} />
            </div>
          </div>
        </div>
      </section>

      {!member ? (
        <section className="rounded-[2rem] border border-[#fcb415]/30 bg-[#fcb415]/10 p-5 text-center">
          <h2 className="text-2xl font-black text-white">Login required</h2>
          <p className="mt-3 text-sm font-bold leading-6 text-white/55">
            Please log in first so the check-in can be saved to your passport.
          </p>

          <a
            href="/member-login"
            className="mt-5 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            Login / Activate
          </a>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#fcb415]/10 text-[#fcb415]">
              <Camera size={38} strokeWidth={3} />
            </div>

            <h2 className="mt-5 text-2xl font-black text-white">
              Camera scanner
            </h2>

            <p className="mt-2 text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
              {member.fullName || member.username} · {member.memberNumber}
            </p>
          </div>

          <div
            className={
              scannerActive
                ? "mt-5 overflow-hidden rounded-[1.7rem] border border-[#fcb415]/30 bg-black"
                : "mt-5 hidden"
            }
          >
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-[3/4] w-full object-cover"
            />
          </div>

          {scannerMessage ? (
            <p className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm font-bold leading-6 text-white/55">
              {scannerMessage}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            {!scannerActive ? (
              <button
                type="button"
                onClick={startScanner}
                className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
              >
                <Camera size={17} strokeWidth={3} />
                Start Scan
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanner}
                className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
              >
                <X size={17} strokeWidth={3} />
                Stop
              </button>
            )}

            <a
              href="/passport"
              className="flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
            >
              Passport
            </a>
          </div>
        </section>
      )}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
              Manual fallback
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              Select your gym
            </h2>
          </div>

          <Dumbbell className="text-[#fcb415]" size={28} strokeWidth={3} />
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
          <Search className="text-white/30" size={18} strokeWidth={3} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search gym"
            className="w-full bg-transparent text-base font-bold text-white outline-none placeholder:text-white/25"
          />
        </div>

        {loading ? (
          <div className="mt-5 flex items-center gap-3 text-white/45">
            <RefreshCw size={18} className="animate-spin" />
            <p className="text-sm font-bold">Loading gyms…</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {visibleGyms.map((gym) => (
              <button
                key={gym.id}
                type="button"
                onClick={() => goToGymCheckin(gym.id)}
                className="flex w-full items-center gap-4 rounded-[1.5rem] border border-white/10 bg-black/25 p-4 text-left"
              >
                <img
                  src={getGymLogo(gym)}
                  alt=""
                  className="h-16 w-16 shrink-0 object-contain drop-shadow-2xl"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black text-white">
                    {gym.name}
                  </p>

                  <p className="mt-1 flex items-center gap-2 text-xs font-bold text-white/40">
                    <MapPinned size={14} strokeWidth={3} />
                    {gym.city || gym.address || "BestGymsMalta"}
                  </p>
                </div>
              </button>
            ))}

            {visibleGyms.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center text-sm font-bold text-white/45">
                No active gyms found.
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
