"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import StaffMembershipReviewModal from "@/components/staff/StaffMembershipReviewModal";
import { calculateMembershipExpiry } from "@/lib/membershipEnrollmentCore";
import { isUnder16On, isUnder18On } from "@/lib/membershipRegistrationCore";
import { UNDER16_SUPERVISION_CLAUSE } from "@/lib/guardianConsentPolicy";
import type { MembershipDurationKey } from "@/lib/membershipSettingsCore";

type SystemUser = {
  id: string;
  gymId: string | null;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type Gym = {
  id: string;
  name: string;
  status: string;
};

type Candidate = {
  id: string;
  memberNumber: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  status: string;
  membershipExpiry: string;
  mobile: string;
  phone?: string;
  email: string;
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  postcode?: string;
  idNumber?: string;
  dateOfBirth?: string;
  nextOfKin?: string;
  legacyPkCustomer: string;
  legacyGym: string;
  officialPhotoPath?: string | null;
  photoUrl?: string | null;
};

type ParticipantForm = {
  existingMemberId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  idNumber: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  nextOfKin: string;
  officialPhotoPath: string;
  guardian: {
    fullName: string; idNumber: string; relationship: string;
    mobile: string; email: string; address: string;
  };
  guardianDeclarationPresented: boolean;
};

type GuardianDeclaration = { id: string; versionNo: number; body: string; contentSha256: string };

type AvailablePriceEntry = { membershipType: string; durationKey: string; amountCents: number };

type ApplicationSummary = {
  id: string;
  reference: string;
  status: string;
  kind: "new" | "renewal";
  membershipType: string;
  durationKey: string;
  startDate: string;
  expiryDate: string;
  staffName: string;
  enrollmentGym: { id: string; name: string };
};

const MEMBERSHIP_TYPES = [
  { value: "single", label: "Single" },
  { value: "couples", label: "Couples" },
  { value: "student", label: "Student" },
];

const DURATIONS = [
  { value: "1_week", label: "1 week" },
  { value: "2_weeks", label: "2 weeks" },
  { value: "1_month", label: "1 month" },
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "1_year", label: "1 year" },
];

function blankParticipant(): ParticipantForm {
  return {
    existingMemberId: "",
    memberNumber: "",
    firstName: "",
    lastName: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    idNumber: "",
    dateOfBirth: "",
    phone: "",
    email: "",
    nextOfKin: "",
    officialPhotoPath: "",
    guardian: { fullName: "", idNumber: "", relationship: "", mobile: "", email: "", address: "" },
    guardianDeclarationPresented: false,
  };
}

function addOneDayIso(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function maltaTodayIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function renewalStartForCandidates(candidates: Candidate[]) {
  const today = maltaTodayIso();
  const activeExpiries = candidates
    .filter(
      (candidate) =>
        candidate.status === "active" &&
        Boolean(candidate.membershipExpiry) &&
        candidate.membershipExpiry >= today,
    )
    .map((candidate) => candidate.membershipExpiry)
    .sort();

  const latestActiveExpiry = activeExpiries.at(-1);
  return latestActiveExpiry ? addOneDayIso(latestActiveExpiry) : "";
}

function participantFromCandidate(candidate: Candidate): ParticipantForm {
  const nameParts = candidate.fullName.trim().split(/\s+/).filter(Boolean);
  const fallbackFirstName = nameParts[0] || "";
  const fallbackLastName = nameParts.slice(1).join(" ");

  return {
    existingMemberId: candidate.id,
    memberNumber: candidate.memberNumber,
    firstName: candidate.firstName || fallbackFirstName,
    lastName: candidate.lastName || fallbackLastName,
    addressLine1: candidate.addressLine1 || "",
    addressLine2: candidate.addressLine2 || "",
    town: candidate.town || "",
    postcode: candidate.postcode || "",
    idNumber: candidate.idNumber || "",
    dateOfBirth: candidate.dateOfBirth || "",
    phone: candidate.phone || candidate.mobile || "",
    email: candidate.email || "",
    nextOfKin: candidate.nextOfKin || "",
    officialPhotoPath: candidate.officialPhotoPath || "",
    guardian: { fullName: "", idNumber: "", relationship: "", mobile: "", email: "", address: "" },
    guardianDeclarationPresented: false,
  };
}

export default function MembershipEnrollmentPage() {
  const searchParams = useSearchParams();
  const presetHandled = useRef(false);
  const [user, setUser] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [availablePrices, setAvailablePrices] = useState<AvailablePriceEntry[]>([]);
  const [guardianDeclaration, setGuardianDeclaration] = useState<GuardianDeclaration | null>(null);
  const [kind, setKind] = useState<"new" | "renewal" | null>(null);
  const [membershipType, setMembershipType] = useState("single");
  const [durationKey, setDurationKey] = useState("1_month");
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [enrollmentGymId, setEnrollmentGymId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [participants, setParticipants] = useState<ParticipantForm[]>([
    blankParticipant(),
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedRenewalCandidates, setSelectedRenewalCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [authResponse, gymsResponse, pricingResponse] = await Promise.all([
          fetch("/api/system/auth", { cache: "no-store" }),
          fetch("/api/gyms", { cache: "no-store" }),
          fetch("/api/system/members/available-prices", { cache: "no-store" }),
        ]);
        const authData = await authResponse.json();
        const gymsData = await gymsResponse.json();
        const pricingData = await pricingResponse.json().catch(() => ({}));
        if (!pricingResponse.ok || !Array.isArray(pricingData.entries)) {
          throw new Error(pricingData.error || "Could not load the current published membership rates.");
        }
        setAvailablePrices(pricingData.entries);
        setGuardianDeclaration(pricingData.guardianDeclaration || null);
        setUser(authData.authenticated ? authData.user : null);
        setGyms(
          Array.isArray(gymsData.gyms)
            ? gymsData.gyms.filter((gym: Gym) => gym.status === "active")
            : []
        );
        if (authData.user?.gymId) setEnrollmentGymId(authData.user.gymId);
      } catch {
        setError("Could not load membership tools.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const canCreate = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("members.create")
  );
  const canRenew = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("members.renew")
  );
  const canSearch = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("members.view")
  );
  const availableDurations = DURATIONS.filter((duration) => availablePrices.some(
    (entry) => entry.membershipType === membershipType && entry.durationKey === duration.value,
  ));
  const availableMembershipTypes = MEMBERSHIP_TYPES.filter((type) => availablePrices.some(
    (entry) => entry.membershipType === type.value,
  ));
  const selectedPrice = availablePrices.find(
    (entry) => entry.membershipType === membershipType && entry.durationKey === durationKey,
  );
  const expectedParticipants = membershipType === "couples" ? 2 : 1;
  const submissionDay = useMemo(() => maltaTodayIso(), []);
  const renewalSelections = useMemo(
    () => participants.filter((participant) => participant.existingMemberId),
    [participants]
  );
  const automaticRenewalStart = useMemo(
    () => renewalStartForCandidates(selectedRenewalCandidates),
    [selectedRenewalCandidates]
  );

  useEffect(() => {
    if (availableDurations.some((duration) => duration.value === durationKey)) return;
    const first = availableDurations[0]?.value || "";
    setDurationKey(first);
    if (startDate) {
      setExpiryDate(first ? calculateMembershipExpiry(startDate, first as MembershipDurationKey) : "");
    }
  }, [availablePrices, membershipType, durationKey, startDate]);

  function resetWorkflow() {
    setKind(null);
    setMembershipType("single");
    setDurationKey("1_month");
    setStartDate("");
    setExpiryDate("");
    setStaffName("");
    setParticipants([blankParticipant()]);
    setSearchQuery("");
    setCandidates([]);
    setSelectedRenewalCandidates([]);
    setApplication(null);
    setMessage("");
    setError("");
  }

  function chooseKind(nextKind: "new" | "renewal") {
    setKind(nextKind);
    setMembershipType("single");
    setParticipants(nextKind === "new" ? [blankParticipant()] : []);
    setApplication(null);
    setStaffName("");
    setCandidates([]);
    setSelectedRenewalCandidates([]);
    setSearchQuery("");
    setMessage("");
    setError("");
  }

  function changeMembershipType(nextType: string) {
    setMembershipType(nextType);
    const matching = DURATIONS.filter((duration) => availablePrices.some(
      (entry) => entry.membershipType === nextType && entry.durationKey === duration.value,
    ));
    const nextDuration = matching.some((duration) => duration.value === durationKey)
      ? durationKey : matching[0]?.value || "";
    setDurationKey(nextDuration);
    if (startDate) {
      setExpiryDate(nextDuration ? calculateMembershipExpiry(startDate, nextDuration as MembershipDurationKey) : "");
    }
    const nextCount = nextType === "couples" ? 2 : 1;

    if (kind === "new") {
      setParticipants((current) => {
        const next = current.slice(0, nextCount);
        while (next.length < nextCount) next.push(blankParticipant());
        return next;
      });
      return;
    }

    if (kind === "renewal" && nextCount === 1) {
      setParticipants((current) => current.slice(0, 1));
      setSelectedRenewalCandidates((current) => current.slice(0, 1));
    }
  }

  function updateGuardian(index: number, field: keyof ParticipantForm["guardian"], value: string) {
    setParticipants((current) => current.map((participant, i) => i === index
      ? { ...participant, guardian: { ...participant.guardian, [field]: value } }
      : participant));
  }

  function updateParticipant(
    index: number,
    field: keyof ParticipantForm,
    value: string | boolean
  ) {
    setParticipants((current) =>
      current.map((participant, participantIndex) =>
        participantIndex === index ? { ...participant, [field]: value } : participant
      )
    );
  }

  async function searchMembers(event: React.FormEvent) {
    event.preventDefault();
    if (!canSearch) {
      setError("This account does not have permission to search members.");
      return;
    }

    const query = searchQuery.trim();
    if (query.length < 2) {
      setError("Enter at least 2 characters or scan the member barcode.");
      return;
    }

    setSearching(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/system/members/search?q=${encodeURIComponent(query)}&status=all&limit=50`,
        { cache: "no-store", credentials: "same-origin" }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not search members.");
        return;
      }
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      if (!data.candidates?.length) setMessage("No matching members found.");
    } catch {
      setError("Could not search members.");
    } finally {
      setSearching(false);
    }
  }

  function selectRenewalMember(candidate: Candidate) {
    setError("");
    setMessage("");
    setParticipants((current) => {
      if (current.some((participant) => participant.existingMemberId === candidate.id)) {
        return current;
      }
      const limit = membershipType === "couples" ? 2 : 1;
      if (current.length >= limit) {
        return [...current.slice(0, limit - 1), participantFromCandidate(candidate)];
      }
      return [...current, participantFromCandidate(candidate)];
    });
    setSelectedRenewalCandidates((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== candidate.id);
      const limit = membershipType === "couples" ? 2 : 1;
      const next =
        withoutDuplicate.length >= limit
          ? [...withoutDuplicate.slice(0, limit - 1), candidate]
          : [...withoutDuplicate, candidate];
      const automaticStart = renewalStartForCandidates(next);
      if (automaticStart) {
        setStartDate(automaticStart);
        setExpiryDate(
          calculateMembershipExpiry(
            automaticStart,
            durationKey as MembershipDurationKey,
          ),
        );
      } else {
        setStartDate("");
        setExpiryDate("");
      }
      return next;
    });
    setCandidates([]);
    setSearchQuery("");
  }

  useEffect(() => {
    if (loading || !user || presetHandled.current) return;

    const presetKind = searchParams.get("kind");
    if (presetKind !== "new" && presetKind !== "renewal") {
      presetHandled.current = true;
      return;
    }

    presetHandled.current = true;
    if (presetKind === "new") {
      if (!canCreate) {
        setError("This account does not have permission to create memberships.");
        return;
      }
      chooseKind("new");
      return;
    }

    if (!canRenew || !canSearch) {
      setError("This account does not have permission to renew memberships.");
      return;
    }

    chooseKind("renewal");
    const memberNumber = String(searchParams.get("memberNumber") || "").trim();
    if (!memberNumber) return;

    setSearching(true);
    void fetch(
      `/api/system/members/search?q=${encodeURIComponent(memberNumber)}&status=all&limit=10`,
      { cache: "no-store", credentials: "same-origin" }
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load the selected member.");
        const candidates = Array.isArray(data.candidates) ? data.candidates as Candidate[] : [];
        const selected = candidates.find((candidate) => candidate.memberNumber === memberNumber) || candidates[0];
        if (!selected) {
          setSearchQuery(memberNumber);
          throw new Error("That member could not be found. Search again below.");
        }
        selectRenewalMember(selected);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Could not load the selected member.");
      })
      .finally(() => setSearching(false));
  }, [loading, user, searchParams, canCreate, canRenew, canSearch]);

  function removeRenewalMember(memberId: string) {
    setParticipants((current) =>
      current.filter((participant) => participant.existingMemberId !== memberId)
    );
    setSelectedRenewalCandidates((current) => {
      const next = current.filter((candidate) => candidate.id !== memberId);
      const automaticStart = renewalStartForCandidates(next);
      if (automaticStart) {
        setStartDate(automaticStart);
        setExpiryDate(
          calculateMembershipExpiry(
            automaticStart,
            durationKey as MembershipDurationKey,
          ),
        );
      } else {
        setStartDate("");
        setExpiryDate("");
      }
      return next;
    });
  }

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault();
    if (!kind) return;

    if (!availablePrices.some((entry) => entry.membershipType === membershipType && entry.durationKey === durationKey)) {
      setError("This membership duration is not currently available. Refresh the page to load published rates.");
      return;
    }

    if (!staffName.trim()) {
      setError("Staff Name is required so this membership can be traced to the responsible staff member.");
      return;
    }

    if (!startDate || !expiryDate) {
      setError("Membership start date and expiry date are required.");
      return;
    }

    if (expiryDate < startDate) {
      setError("Membership expiry date cannot be before the start date.");
      return;
    }

    if (kind === "renewal" && renewalSelections.length !== expectedParticipants) {
      setError(
        membershipType === "couples"
          ? "Select exactly two existing members for this Couples renewal."
          : "Select the existing member before submitting the renewal."
      );
      return;
    }

    if (participants.length !== expectedParticipants) {
      setError("Complete the required participant details before submitting.");
      return;
    }

    for (const [index, participant] of participants.entries()) {
      if (!participant.dateOfBirth) {
        setError(`Applicant ${index + 1}: A valid date of birth is required.`);
        return;
      }
      try {
        const under18 = isUnder18On(participant.dateOfBirth, submissionDay);
        if (under18 && membershipType === "couples") {
          setError("Couples membership requires two adults aged at least 18.");
          return;
        }
        if (under18 && (!guardianDeclaration || !participant.guardianDeclarationPresented ||
          Object.values(participant.guardian).some((value) => !value.trim()))) {
          setError(`Applicant ${index + 1}: Published guardian consent, complete guardian details and confirmation that the guardian has read the declaration are required.`);
          return;
        }
      } catch {
        setError(`Applicant ${index + 1}: Date of birth is invalid.`);
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/members/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_application",
          kind,
          membershipType,
          durationKey,
          startDate,
          expiryDate,
          enrollmentGymId: user?.isSuperAdmin ? enrollmentGymId : undefined,
          staffName: staffName.trim(),
          guardianDeclarationVersionId: guardianDeclaration?.id || null,
          participants,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not submit membership application.");
        return;
      }
      setApplication(data.application);
      setMessage(
        "Renewal prepared. Continue below with card verification, mandatory printing, payment and activation."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not submit membership application.");
    } finally {
      setSubmitting(false);
    }
  }


  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">
        Loading membership tools…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Staff login required</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Sign in with the gym&apos;s operational account before managing memberships.
          </p>
          <a
            href="/staff"
            className="mt-5 inline-flex rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white"
          >
            Go to Staff Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">
              BestGymsMalta · Membership Operations
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">
              {kind === "renewal"
                ? "RENEWAL"
                : kind === "new"
                  ? "NEW MEMBERSHIP"
                  : "Memberships"}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Signed in as {user.displayName}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            {kind && !application && (
              <button
                type="button"
                onClick={resetWorkflow}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold"
              >
                Start over
              </button>
            )}
            <a
              href="/staff"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold"
            >
              Staff Home
            </a>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800 print:hidden">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800 print:hidden">
            {message}
          </div>
        )}

        {!kind && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">What are you processing?</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Choose the correct path before entering membership details.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => chooseKind("new")}
                className="min-h-36 rounded-2xl border-2 border-zinc-900 bg-zinc-900 p-6 text-left text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                <span className="block text-2xl font-black">NEW MEMBERSHIP</span>
                <span className="mt-2 block text-sm text-zinc-300">
                  A genuinely new BGM member. Permanent number is created only after payment activation.
                </span>
              </button>
              <button
                type="button"
                disabled={!canRenew || !canSearch}
                onClick={() => chooseKind("renewal")}
                className="min-h-36 rounded-2xl border-2 border-orange-500 bg-orange-50 p-6 text-left text-orange-950 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <span className="block text-2xl font-black">RENEWAL</span>
                <span className="mt-2 block text-sm text-orange-900/70">
                  Find the existing member first. Their permanent BGM number stays the same; the physical card is verified or replaced during completion.
                </span>
              </button>
            </div>
          </section>
        )}

        {kind === "renewal" && !application && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm print:hidden">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">1. Find the existing member</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Scan/search the BGM number first. Name, ID number, mobile and email searches may show several candidates.
                </p>
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-800">
                NO NEW MEMBER NUMBER
              </span>
            </div>

            {renewalSelections.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {renewalSelections.map((participant) => (
                  <div
                    key={participant.existingMemberId}
                    className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"
                  >
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      Confirmed existing member
                    </p>
                    <p className="mt-1 text-xl font-black">
                      {participant.firstName} {participant.lastName}
                    </p>
                    <p className="mt-1 font-mono text-lg font-black text-zinc-900">
                      {participant.memberNumber}
                    </p>
                    <p className="mt-2 text-sm font-bold text-emerald-900">
                      Stored member details and permanent number have been carried forward.
                    </p>
                    <button
                      type="button"
                      onClick={() => removeRenewalMember(participant.existingMemberId)}
                      className="mt-3 text-xs font-bold text-red-700 underline"
                    >
                      Remove selection
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(membershipType === "couples"
              ? renewalSelections.length < 2
              : renewalSelections.length < 1) && (
              <form onSubmit={searchMembers} className="mt-5 flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  data-bgm-scan-input="true"
                  placeholder="Member number, name, ID number, mobile or email"
                  className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-950 placeholder:text-zinc-400 caret-zinc-950 outline-none focus:border-orange-500"
                />
                <button
                  disabled={searching}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {searching ? "Searching…" : "Search"}
                </button>
              </form>
            )}

            {candidates.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  Confirm the correct person
                </p>
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => selectRenewalMember(candidate)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left hover:border-orange-400"
                  >
                    <span>
                      <span className="block font-black">{candidate.fullName}</span>
                      <span className="mt-1 block font-mono text-sm font-bold">
                        {candidate.memberNumber}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        Status: {candidate.status} · Expiry: {candidate.membershipExpiry || "—"}
                        {candidate.mobile ? ` · ${candidate.mobile}` : ""}
                        {candidate.legacyPkCustomer
                          ? ` · Legacy ${candidate.legacyGym || "?"}/${candidate.legacyPkCustomer}`
                          : ""}
                      </span>
                    </span>
                    <span className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white">
                      Use for renewal
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {kind && !application && (kind === "new" || renewalSelections.length > 0) && (
          <form onSubmit={submitApplication} className="space-y-5">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">
                {kind === "renewal" ? "2. Renewal details" : "1. New membership details"}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Membership Type">
                  <select
                    value={membershipType}
                    onChange={(event) => changeMembershipType(event.target.value)}
                    className={inputClass}
                  >
                    {availableMembershipTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Duration">
                  <select
                    value={durationKey}
                    onChange={(event) => {
                      const nextDuration = event.target.value;
                      setDurationKey(nextDuration);
                      if (startDate) {
                        setExpiryDate(
                          calculateMembershipExpiry(
                            startDate,
                            nextDuration as MembershipDurationKey,
                          ),
                        );
                      }
                    }}
                    className={inputClass}
                  >
                    {availableDurations.map((duration) => (
                      <option key={duration.value} value={duration.value}>
                        {duration.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {user.isSuperAdmin && (
                  <Field label="Enrollment Gym">
                    <select
                      required
                      value={enrollmentGymId}
                      onChange={(event) => setEnrollmentGymId(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select gym</option>
                      {gyms.map((gym) => (
                        <option key={gym.id} value={gym.id}>
                          {gym.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Starting Date">
                  <input
                    required
                    type="date"
                    value={startDate}
                    readOnly={kind === "renewal" && Boolean(automaticRenewalStart)}
                    onChange={(event) => {
                      const nextStart = event.target.value;
                      setStartDate(nextStart);
                      if (nextStart) {
                        setExpiryDate(
                          calculateMembershipExpiry(
                            nextStart,
                            durationKey as MembershipDurationKey,
                          ),
                        );
                      }
                    }}
                    className={`${inputClass} ${
                      kind === "renewal" && automaticRenewalStart
                        ? "cursor-not-allowed bg-zinc-100 font-black text-emerald-800"
                        : ""
                    }`}
                  />
                </Field>
                <Field label="Expiry Date">
                  <input
                    required
                    type="date"
                    min={startDate || undefined}
                    value={expiryDate}
                    onChange={(event) => setExpiryDate(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" role="status" aria-live="polite">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
                  {kind === "renewal" ? "Current published renewal price" : "Current published membership price"}
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-950">
                  {selectedPrice
                    ? new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" }).format(selectedPrice.amountCents / 100)
                    : "Choose an available duration"}
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  {membershipType === "couples" ? "Total for both members. " : ""}
                  Before any applicable discount. The recorded amount is confirmed when the application is submitted.
                </p>
              </div>
              {kind === "renewal" && automaticRenewalStart ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  Current membership is still active. Renewal starts automatically on {automaticRenewalStart}, the day after the current membership expires.
                </p>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">
                  Starting and expiry dates are explicit so the exact membership period is visible and auditable before payment.
                </p>
              )}
            </section>

            {kind === "renewal" && membershipType === "couples" && renewalSelections.length < 2 && (
              <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <p className="font-black text-orange-900">Couples renewal needs two confirmed existing members.</p>
                <p className="mt-1 text-sm text-orange-800">
                  Use the member search above to select the second permanent identity before submission.
                </p>
              </section>
            )}

            <section className="space-y-4">
              {participants.map((participant, index) => (
                <ParticipantEditor
                  key={participant.existingMemberId || `new-${index}`}
                  participant={participant}
                  index={index}
                  kind={kind}
                  onChange={updateParticipant}
                  onGuardianChange={updateGuardian}
                  guardianDeclaration={guardianDeclaration}
                  membershipType={membershipType}
                  submissionDay={submissionDay}
                />
              ))}
            </section>

            <section className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-5 shadow-sm">
              <label className="block text-sm font-black text-orange-950">
                Staff Name <span className="text-red-600">*</span>
                <input
                  required
                  value={staffName}
                  onChange={(event) => setStaffName(event.target.value)}
                  placeholder="Enter the staff member responsible for this application"
                  className="mt-2 w-full rounded-xl border border-orange-300 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-orange-600"
                />
              </label>
              <p className="mt-2 text-xs font-semibold text-orange-900/75">
                Required for {kind === "renewal" ? "RENEWAL" : "NEW MEMBERSHIP"}. This name is saved with the membership application so management can identify who handled it if a problem needs investigation.
              </p>
            </section>

            <button
              disabled={
                submitting ||
                (kind === "renewal" && renewalSelections.length !== expectedParticipants)
              }
              className="w-full rounded-2xl bg-zinc-900 px-5 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Saving application…" : "SUBMIT MEMBERSHIP APPLICATION"}
            </button>
            <p className="text-center text-xs font-semibold text-zinc-500">
              After submission, continue here: verify the member card, print and confirm the membership form, then take payment and activate.
            </p>
          </form>
        )}

        {application ? (
          <StaffMembershipReviewModal
            applicationId={application.id}
            completionMode
            onClose={resetWorkflow}
            onChanged={() => {}}
          />
        ) : null}
      </div>
    </main>
  );
}

const inputClass =
  "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-orange-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-zinc-800">
      {label}
      {children}
    </label>
  );
}

function ParticipantEditor({
  participant,
  index,
  kind,
  onChange,
  onGuardianChange,
  guardianDeclaration,
  membershipType,
  submissionDay,
}: {
  participant: ParticipantForm;
  index: number;
  kind: "new" | "renewal";
  onChange: (index: number, field: keyof ParticipantForm, value: string | boolean) => void;
  onGuardianChange: (index: number, field: keyof ParticipantForm["guardian"], value: string) => void;
  guardianDeclaration: GuardianDeclaration | null;
  membershipType: string;
  submissionDay: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black">
          {kind === "renewal" ? "Confirmed member details" : `Participant ${index + 1}`}
        </h2>
        {participant.memberNumber && (
          <span className="rounded-lg bg-zinc-900 px-3 py-2 font-mono text-sm font-black text-white">
            {participant.memberNumber}
          </span>
        )}
      </div>
      {participant.memberNumber && (
        <p className="mt-2 text-sm font-bold text-emerald-700">
          This permanent BGM number stays with this member. The current physical card is verified or replaced in the next step.
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="First Name">
          <input
            required
            value={participant.firstName}
            onChange={(event) => onChange(index, "firstName", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Surname">
          <input
            required
            value={participant.lastName}
            onChange={(event) => onChange(index, "lastName", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Address Line 1">
          <input
            value={participant.addressLine1}
            onChange={(event) => onChange(index, "addressLine1", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Address Line 2">
          <input
            value={participant.addressLine2}
            onChange={(event) => onChange(index, "addressLine2", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Town / Locality">
          <input
            value={participant.town}
            onChange={(event) => onChange(index, "town", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Postcode">
          <input
            value={participant.postcode}
            onChange={(event) => onChange(index, "postcode", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="ID Number">
          <input
            value={participant.idNumber}
            onChange={(event) => onChange(index, "idNumber", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Date of Birth">
          <input
            type="date"
            value={participant.dateOfBirth}
            onChange={(event) => onChange(index, "dateOfBirth", event.target.value)}
            readOnly={kind === "renewal"}
            className={inputClass}
          />
        </Field>
        <Field label="Telephone / Mobile">
          <input
            value={participant.phone}
            onChange={(event) => onChange(index, "phone", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={participant.email}
            onChange={(event) => onChange(index, "email", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Next of Kin">
          <input
            value={participant.nextOfKin}
            onChange={(event) => onChange(index, "nextOfKin", event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      {participant.dateOfBirth && (() => {
        let under18 = false;
        let under16 = false;
        try {
          under18 = isUnder18On(participant.dateOfBirth, submissionDay);
          under16 = isUnder16On(participant.dateOfBirth, submissionDay);
        } catch { return null; }
        if (!under18) return null;
        if (membershipType === "couples") return (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">
            Couples membership requires both applicants to be at least 18.
          </div>
        );
        return (
          <div className="mt-4 space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="font-black text-violet-950">Parent / legal guardian — required for every member under 18</p>
            <p className="text-sm text-violet-900">The guardian must attend reception and sign the printed renewal declaration before activation.</p>
            {!guardianDeclaration ? (
              <p role="alert" className="text-sm font-bold text-red-700">A published guardian declaration is unavailable. This application cannot be submitted.</p>
            ) : (
              <div className="whitespace-pre-line rounded-xl bg-white p-3 text-sm leading-6 text-violet-950">
                <p className="mb-2 font-black">Parent / Guardian Declaration · v{guardianDeclaration.versionNo}</p>
                {guardianDeclaration.body}
                {under16 ? <p className="mt-2 font-bold">{UNDER16_SUPERVISION_CLAUSE}</p> : null}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["fullName", "Guardian full name"], ["idNumber", "Guardian ID / passport number"],
                ["relationship", "Relationship"], ["mobile", "Guardian mobile"],
                ["email", "Guardian email"], ["address", "Guardian address"],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-sm font-bold text-violet-950">{label}
                  <input required value={participant.guardian[field]}
                    onChange={(event) => onGuardianChange(index, field, event.target.value)}
                    className={inputClass} />
                </label>
              ))}
            </div>
            <label className="flex items-start gap-3 text-sm font-semibold text-violet-950">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={participant.guardianDeclarationPresented}
                onChange={(event) => onChange(index, "guardianDeclarationPresented", event.target.checked)} />
              I confirm that the parent / legal guardian has reviewed the declaration above. They must attend and co-sign the printed form before activation.
            </label>
          </div>
        );
      })()}
      <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
        Official member-photo capture remains separate from personal progress photos and will use the dedicated private-photo workflow.
      </p>
    </section>
  );
}
