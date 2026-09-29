"use client";

import { useCallback, useEffect, useState } from "react";
import RegistrationForm, {
  type PublicEnrollmentConfig,
  type RegistrationDraft,
} from "./RegistrationForm";

type Props = {
  gymSlug: string;
};

type SuccessState = {
  membershipType: RegistrationDraft["membershipType"];
  hasGuardian: boolean;
};

function safeErrorMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error.trim();
  }
  return fallback;
}

export default function JoinEnrollmentPage({ gymSlug }: Props) {
  const [config, setConfig] = useState<PublicEnrollmentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [online, setOnline] = useState(true);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [formKey, setFormKey] = useState(0);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch(
        `/api/public/membership-enrollment/config?gymSlug=${encodeURIComponent(gymSlug)}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          safeErrorMessage(
            data,
            response.status === 404
              ? "This gym registration page is not available."
              : "Membership registration is temporarily unavailable.",
          ),
        );
      }
      setConfig(data as PublicEnrollmentConfig);
    } catch (error) {
      setConfig(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Membership registration is temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [gymSlug]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const wentOnline = () => setOnline(true);
    const wentOffline = () => setOnline(false);
    window.addEventListener("online", wentOnline);
    window.addEventListener("offline", wentOffline);
    return () => {
      window.removeEventListener("online", wentOnline);
      window.removeEventListener("offline", wentOffline);
    };
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function submitApplication(draft: RegistrationDraft) {
    if (!navigator.onLine) {
      throw new Error(
        "No internet connection. Your form is still on this screen. Reconnect and try again.",
      );
    }

    const formData = new FormData();
    const payload = {
      gymSlug,
      membershipType: draft.membershipType,
      durationKey: draft.durationKey,
      participants: draft.participants,
      declarations: draft.declarations,
      documentReadinessAcknowledged: true,
    };

    formData.append("payload", JSON.stringify(payload));
    draft.photos.forEach((photo, index) => {
      if (!photo) return;
      const photoField = index === 0 ? "photo0" : "photo1";
      formData.append(photoField, photo, `applicant-${index + 1}.webp`);
    });

    let response: Response;
    try {
      response = await fetch("/api/public/membership-enrollment/submit", {
        method: "POST",
        body: formData,
      });
    } catch {
      throw new Error(
        "The application could not reach the server. Your form is still here—check the connection and try again.",
      );
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(safeErrorMessage(data, "Could not submit the application. Please try again."));
    }

    setSuccess({
      membershipType: draft.membershipType,
      hasGuardian: draft.participants.some((participant) => Boolean(participant.guardian)),
    });
  }

  function resetForNextMember() {
    setSuccess(null);
    setFormKey((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <img
            src="/icons/bgm-logo.png"
            alt="BestGymsMalta"
            className="h-12 w-12 rounded-2xl object-contain"
          />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              BestGymsMalta
            </p>
            <p className="truncate text-lg font-black">
              {config?.gym.shortName || "New Member Registration"}
            </p>
          </div>
        </div>
      </header>

      {!online && (
        <div className="border-b border-amber-300 bg-amber-100 px-5 py-3 text-center text-sm font-bold text-amber-950">
          You are offline. Keep this page open—your application has not been submitted.
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {loading && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-950" />
            <p className="mt-4 font-bold text-zinc-700">Loading membership registration…</p>
          </section>
        )}

        {!loading && loadError && (
          <section className="rounded-3xl border border-red-200 bg-white p-7 text-center shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
              Registration unavailable
            </p>
            <h1 className="mt-2 text-2xl font-black text-zinc-950">
              This membership page is not available right now.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadConfig()}
              className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white"
            >
              Try Again
            </button>
          </section>
        )}

        {!loading && config && !success && (
          <>
            <section className="mb-5 rounded-3xl bg-zinc-950 p-6 text-white shadow-lg">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                {config.gym.name}
              </p>
              <h1 className="mt-2 text-3xl font-black">New Member Registration</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                Complete the application below, take the required live photo and then proceed to reception for document verification, signing and payment.
              </p>
            </section>

            <RegistrationForm
              key={formKey}
              mode="tablet"
              gym={{ id: config.gym.id, name: config.gym.name, slug: config.gym.slug }}
              config={config}
              onSubmit={submitApplication}
            />
          </>
        )}

        {!loading && config && success && (
          <section className="rounded-3xl border border-emerald-200 bg-white p-7 shadow-lg sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-black text-emerald-700">
              ✓
            </div>
            <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Submitted successfully
            </p>
            <h1 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-black text-zinc-950">
              Application submitted — please proceed to reception.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-6 text-zinc-600">
              Reception will review the application, verify the required documents and complete the membership process.
            </p>

            <div className="mx-auto mt-6 max-w-2xl rounded-3xl bg-zinc-50 p-5 text-sm leading-6 text-zinc-800">
              <p className="font-black text-zinc-950">Please have the following ready:</p>
              <ul className="mt-3 space-y-2">
                <li>• A valid ID card or passport.</li>
                {success.membershipType === "student" && (
                  <li>• Student members: show your valid student ID or supporting student document.</li>
                )}
                {success.membershipType === "couples" && (
                  <li>• Couples: both applicants must show ID and same-address proof at reception.</li>
                )}
                {success.hasGuardian && (
                  <li>• Under-18 applicant: a parent or legal guardian must be present to co-sign the printed application.</li>
                )}
              </ul>
            </div>

            <button
              type="button"
              onClick={resetForNextMember}
              className="mx-auto mt-7 block w-full max-w-2xl rounded-2xl bg-zinc-950 px-5 py-4 text-base font-black text-white"
            >
              Finish / Reset for next member
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
