"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RegistrationForm from "@/components/membership/RegistrationForm";
import StaffRenewalEnrollmentPage from "@/components/staff/StaffRenewalEnrollmentPage";
import type {
  PublicEnrollmentConfig,
  RegistrationDraft,
} from "@/lib/membershipRegistrationTypes";
import { todayMaltaDate } from "@/lib/maltaDate";

function participantFileName(participant: RegistrationDraft["participants"][number], index: number) {
  const first = String(participant.firstName || "member").trim().replace(/[^a-z0-9]+/gi, "-");
  const last = String(participant.lastName || "").trim().replace(/[^a-z0-9]+/gi, "-");
  return `${first}-${last || index + 1}.webp`.toLowerCase();
}

export default function MembershipEnrollmentPage() {
  const searchParams = useSearchParams();
  const kind = String(searchParams.get("kind") || "").trim().toLowerCase();
  const memberNumber = String(searchParams.get("memberNumber") || "").trim();

  if (kind !== "new") {
    return <StaffRenewalEnrollmentPage />;
  }

  return <StaffNewMembershipEnrollment memberNumber={memberNumber} />;
}

function StaffNewMembershipEnrollment({ memberNumber }: { memberNumber: string }) {
  const [config, setConfig] = useState<PublicEnrollmentConfig | null>(null);
  const [staffName, setStaffName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    reference: string;
    photoWarnings: string[];
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/system/members/enroll", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Could not load membership registration settings.");
        }
        if (!active) return;
        setConfig(payload.config || null);
        setStaffName(String(payload.systemUser?.displayName || ""));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load membership registration settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const initialStaffName = useMemo(() => staffName.trim(), [staffName]);

  async function uploadParticipantPhoto(applicationId: string, applicationMemberId: string, file: File, participant: RegistrationDraft["participants"][number], index: number) {
    const formData = new FormData();
    formData.append("applicationMemberId", applicationMemberId);
    formData.append("file", file, participantFileName(participant, index));

    const response = await fetch("/api/system/members/photo", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Could not save photo for participant ${index + 1}.`);
    }
  }

  async function submitRegistration(draft: RegistrationDraft) {
    if (!config) return;

    try {
      setSubmitting(true);
      setError("");
      setSuccess(null);

      const response = await fetch("/api/system/members/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create_shared_registration",
          kind: "new",
          staffName: initialStaffName,
          enrollmentGymId: config.gym.id,
          startDate: todayMaltaDate(),
          draft: {
            ...draft,
            photos: undefined,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Could not submit this membership application.");
      }

      const applicationId = String(payload?.application?.id || "");
      const applicationReference = String(payload?.application?.reference || "");
      const applicationMembers = Array.isArray(payload?.application?.members)
        ? payload.application.members
        : [];
      const photoWarnings: string[] = [];

      for (let index = 0; index < draft.participants.length; index += 1) {
        const file = draft.photos[index];
        if (!file) continue;
        const applicationMemberId = String(applicationMembers[index]?.id || "");
        if (!applicationMemberId) {
          photoWarnings.push(`Participant ${index + 1}: application was saved, but the photo could not be linked.`);
          continue;
        }
        try {
          await uploadParticipantPhoto(applicationId, applicationMemberId, file, draft.participants[index], index);
        } catch (photoError) {
          photoWarnings.push(
            photoError instanceof Error
              ? photoError.message
              : `Participant ${index + 1}: application was saved, but the photo could not be saved.`,
          );
        }
      }

      setSuccess({ reference: applicationReference, photoWarnings });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit this membership application.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-white">
        <p className="text-sm text-white/65">Loading membership registration…</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-white">
        <h1 className="text-2xl font-semibold">New Membership</h1>
        <p className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
          {error || "Membership registration settings are not available."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-28 text-white sm:p-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Staff Registration</p>
        <h1 className="mt-2 text-3xl font-semibold">New Membership</h1>
        <p className="mt-2 text-sm text-white/60">
          {config.gym.name} · Complete the same registration details used on the member tablet. Photos can be taken, uploaded, or added later.
        </p>
        {memberNumber ? (
          <p className="mt-3 text-xs text-amber-200">Member lookup reference: {memberNumber}</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <p className="font-semibold">Application {success.reference} saved for staff review.</p>
          {success.photoWarnings.length ? (
            <div className="mt-2 space-y-1 text-amber-100">
              {success.photoWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              <p>Missing photos can be added later and do not cancel the application.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <RegistrationForm
        mode="staff"
        config={config}
        submitting={submitting}
        submitLabel="Save New Membership"
        staffPhotoPolicy="optional"
        onSubmit={submitRegistration}
      />
    </div>
  );
}
