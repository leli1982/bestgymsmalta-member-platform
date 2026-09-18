"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RegistrationForm from "@/components/membership/RegistrationForm";
import StaffRenewalEnrollmentPage from "@/components/staff/StaffRenewalEnrollmentPage";
import StaffMembershipReviewModal from "@/components/staff/StaffMembershipReviewModal";
import type { PublicEnrollmentConfig, RegistrationDraft } from "@/lib/membershipRegistrationTypes";

function participantFileName(
  participant: RegistrationDraft["participants"][number],
  index: number,
) {
  const first = String(participant.firstName || "member")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-");
  const last = String(participant.lastName || "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-");
  return `${first}-${last || index + 1}.webp`.toLowerCase();
}

export default function MembershipEnrollmentPage() {
  const searchParams = useSearchParams();
  const kind = String(searchParams.get("kind") || "").trim().toLowerCase();
  const memberNumber = String(searchParams.get("memberNumber") || "").trim();

  if (kind !== "new") return <StaffRenewalEnrollmentPage />;
  return <StaffNewMembershipEnrollment memberNumber={memberNumber} />;
}

function StaffNewMembershipEnrollment({ memberNumber }: { memberNumber: string }) {
  const [config, setConfig] = useState<PublicEnrollmentConfig | null>(null);
  const [staffName, setStaffName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    applicationId: string;
    reference: string;
    photoWarnings: string[];
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/system/members/registration", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            payload?.error || "Could not load membership registration settings.",
          );
        }
        if (!active) return;
        setConfig(payload.config || null);
        setStaffName(String(payload.systemUser?.displayName || ""));
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load membership registration settings.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function uploadParticipantPhoto(
    applicationMemberId: string,
    file: File,
    participant: RegistrationDraft["participants"][number],
    index: number,
  ) {
    const formData = new FormData();
    formData.append("applicationMemberId", applicationMemberId);
    formData.append("staffName", staffName.trim());
    formData.append("file", file, participantFileName(participant, index));

    const response = await fetch("/api/system/members/photo", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        payload?.error || `Could not save photo for participant ${index + 1}.`,
      );
    }
  }

  async function completeStaffReview(applicationId: string) {
    const detailResponse = await fetch(`/api/system/members/applications/${encodeURIComponent(applicationId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const detailPayload = await detailResponse.json().catch(() => ({}));
    if (!detailResponse.ok || !detailPayload?.application) {
      throw new Error(detailPayload?.error || "Could not prepare the membership for activation.");
    }
    const application = detailPayload.application;
    const participants = Array.isArray(application.participants) ? application.participants : [];
    const reviewResponse = await fetch(`/api/system/members/applications/${encodeURIComponent(applicationId)}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_review",
        membershipType: application.membershipType,
        durationKey: application.durationKey,
        startDate: application.startDate,
        expiryDate: application.expiryDate,
        sameAddressVerified: application.membershipType === "couples" ? true : application.sameAddressVerified,
        participants: participants.map((participant: any) => ({
          id: participant.id,
          participantOrder: participant.participantOrder,
          firstName: participant.firstName,
          lastName: participant.lastName,
          addressLine1: participant.addressLine1,
          addressLine2: participant.addressLine2,
          postcode: participant.postcode,
          idNumber: participant.idNumber,
          dateOfBirth: participant.dateOfBirth,
          phone: participant.phone,
          email: participant.email,
          nextOfKin: participant.nextOfKin,
          idVerified: true,
          studentEligibilityVerified: application.membershipType === "student" ? true : participant.studentEligibilityVerified,
          guardianPresentVerified: participant.under18AtSubmission ? true : participant.guardianPresentVerified,
          guardianCosignVerified: participant.under18AtSubmission ? true : participant.guardianCosignVerified,
        })),
      }),
    });
    const reviewPayload = await reviewResponse.json().catch(() => ({}));
    if (!reviewResponse.ok) {
      throw new Error(reviewPayload?.error || "Could not prepare the membership for activation.");
    }
    return true;
  }

  async function submitRegistration(draft: RegistrationDraft) {
    if (!config) return;

    setError("");
    setSuccess(null);

    const response = await fetch("/api/system/members/registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enrollmentGymId: config.gym.id,
        draft: { ...draft, photos: undefined },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload?.error || "Could not submit this membership application.";
      setError(message);
      throw new Error(message);
    }

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
        photoWarnings.push(
          `Participant ${index + 1}: application was saved, but the photo could not be linked.`,
        );
        continue;
      }

      try {
        await uploadParticipantPhoto(
          applicationMemberId,
          file,
          draft.participants[index],
          index,
        );
      } catch (photoError) {
        photoWarnings.push(
          photoError instanceof Error
            ? photoError.message
            : `Participant ${index + 1}: application was saved, but the photo could not be saved.`,
        );
      }
    }

    const applicationId = String(payload?.application?.id || "");
    if (!applicationId) throw new Error("Membership application ID was not returned.");

    try {
      await completeStaffReview(applicationId);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not prepare the membership for activation.");
    }

    setSuccess({ applicationId, reference: applicationReference, photoWarnings });
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
          Staff Registration
        </p>
        <h1 className="mt-2 text-3xl font-semibold">New Membership</h1>
        <p className="mt-2 text-sm text-white/60">
          {config.gym.name} · Complete the same registration details used on the
          member tablet. Photos can be taken, uploaded, or added later.
        </p>
        {memberNumber ? (
          <p className="mt-3 text-xs text-amber-200">
            Member lookup reference: {memberNumber}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <p className="font-semibold">
            Application {success.reference} is ready. Continue with card assignment and payment.
          </p>
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

      {!success ? (
        <RegistrationForm
          mode="staff"
          gym={config.gym}
          config={config}
          staffPhotoPolicy="optional"
          onSubmit={submitRegistration}
        />
      ) : null}

      {success ? (
        <StaffMembershipReviewModal
          applicationId={success.applicationId}
          onClose={() => window.location.assign("/staff")}
          onChanged={() => {}}
        />
      ) : null}
    </div>
  );
}
