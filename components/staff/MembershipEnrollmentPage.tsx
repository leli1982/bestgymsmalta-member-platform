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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [gyms, setGyms] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingGym, setLoadingGym] = useState(false);
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
        setIsSuperAdmin(payload.systemUser?.isSuperAdmin === true);
        setGyms(Array.isArray(payload.gyms) ? payload.gyms : []);
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

  useEffect(() => {
    if (!isSuperAdmin || !selectedGymId) return;
    let active = true;
    async function loadSelectedGym() {
      setLoadingGym(true);
      setError("");
      setConfig(null);
      try {
        const response = await fetch(
          `/api/system/members/registration?gymId=${encodeURIComponent(selectedGymId)}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.config) {
          throw new Error(payload.error || "Could not load this gym's enrollment settings.");
        }
        if (active) setConfig(payload.config);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load enrollment settings.");
        }
      } finally {
        if (active) setLoadingGym(false);
      }
    }
    void loadSelectedGym();
    return () => { active = false; };
  }, [isSuperAdmin, selectedGymId]);

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
          town: participant.town,
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
    if (!config || (isSuperAdmin && (!selectedGymId || selectedGymId !== config.gym.id))) {
      throw new Error("Choose an enrollment gym before submitting the membership.");
    }

    setError("");
    setSuccess(null);

    const response = await fetch("/api/system/members/registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enrollmentGymId: isSuperAdmin ? selectedGymId : config.gym.id,
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

  if (isSuperAdmin && (!selectedGymId || !config)) {
    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-7 text-zinc-950 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-700">New membership · Step 1</p>
          <h1 className="mt-2 text-2xl font-black">Choose an enrollment gym</h1>
          <p className="mt-2 text-sm text-zinc-600">Select the gym where this membership is being enrolled. The selected gym will be recorded on the application.</p>
          <label htmlFor="super-admin-enrollment-gym" className="mt-6 block text-sm font-bold">Enrollment gym</label>
          <select
            id="super-admin-enrollment-gym"
            value={selectedGymId}
            onChange={(event) => setSelectedGymId(event.target.value)}
            disabled={loadingGym}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 focus:border-orange-500 focus:outline-2 focus:outline-orange-200 disabled:opacity-60"
          >
            <option value="">Select gym</option>
            {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
          </select>
          {loadingGym ? <p role="status" className="mt-4 text-sm text-zinc-600">Loading selected gym…</p> : null}
          {!gyms.length && !loadingGym ? <p className="mt-4 text-sm text-amber-800">No active gyms are available. Check the gym locations in Super Admin.</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        </div>
      </main>
    );
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-white">
        <h1 className="text-2xl font-semibold">New Membership</h1>
        <p role="alert" className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
          {error || "Membership registration settings are not available."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-28 text-white sm:p-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
          {isSuperAdmin ? "New membership · Step 2" : "Staff Registration"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">New Membership</h1>
        <p className="mt-2 text-sm text-white/60">
          {config.gym.name} · Complete the same registration details used on the
          member tablet. Photos can be taken, uploaded, or added later.
        </p>
        {isSuperAdmin ? (
          <button type="button" onClick={() => {
            if (window.confirm("Change the enrollment gym? Any unsaved applicant details will be cleared.")) {
              setSelectedGymId("");
              setConfig(null);
              setError("");
            }
          }} className="mt-4 rounded-xl border border-orange-300/40 px-4 py-2 text-sm font-bold text-orange-100 hover:bg-orange-400/10">
            Change enrollment gym
          </button>
        ) : null}
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
          key={config.gym.id}
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
