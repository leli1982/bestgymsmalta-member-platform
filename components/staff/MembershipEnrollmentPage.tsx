"use client";

import { useEffect, useMemo, useState } from "react";

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
  email: string;
  legacyPkCustomer: string;
  legacyGym: string;
  officialPhotoPath?: string | null;
};

type ParticipantForm = {
  existingMemberId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  idNumber: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  nextOfKin: string;
  officialPhotoPath: string;
};

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

type ActivationMember = {
  memberId: string;
  memberNumber: string;
  role: string;
};

type ActivationSummary = {
  applicationId: string;
  membershipId: string;
  applicationKind: string;
  members: ActivationMember[];
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
    postcode: "",
    idNumber: "",
    dateOfBirth: "",
    phone: "",
    email: "",
    nextOfKin: "",
    officialPhotoPath: "",
  };
}

function participantFromCandidate(candidate: Candidate): ParticipantForm {
  const nameParts = candidate.fullName.trim().split(/\s+/).filter(Boolean);
  const fallbackFirstName = nameParts[0] || "";
  const fallbackLastName = nameParts.slice(1).join(" ");

  return {
    ...blankParticipant(),
    existingMemberId: candidate.id,
    memberNumber: candidate.memberNumber,
    firstName: candidate.firstName || fallbackFirstName,
    lastName: candidate.lastName || fallbackLastName,
    phone: candidate.mobile || "",
    email: candidate.email || "",
    officialPhotoPath: candidate.officialPhotoPath || "",
  };
}

export default function MembershipEnrollmentPage() {
  const [user, setUser] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState<Gym[]>([]);
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
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [activationStaffName, setActivationStaffName] = useState("");
  const [activating, setActivating] = useState(false);
  const [activation, setActivation] = useState<ActivationSummary | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [authResponse, gymsResponse] = await Promise.all([
          fetch("/api/system/auth", { cache: "no-store" }),
          fetch("/api/gyms", { cache: "no-store" }),
        ]);
        const authData = await authResponse.json();
        const gymsData = await gymsResponse.json();
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
  const canActivate = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("membership.activate")
  );

  const expectedParticipants = membershipType === "couples" ? 2 : 1;
  const renewalSelections = useMemo(
    () => participants.filter((participant) => participant.existingMemberId),
    [participants]
  );

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
    setApplication(null);
    setActivationStaffName("");
    setActivation(null);
    setMessage("");
    setError("");
  }

  function chooseKind(nextKind: "new" | "renewal") {
    setKind(nextKind);
    setMembershipType("single");
    setParticipants(nextKind === "new" ? [blankParticipant()] : []);
    setApplication(null);
    setActivation(null);
    setActivationStaffName("");
    setStaffName("");
    setCandidates([]);
    setSearchQuery("");
    setMessage("");
    setError("");
  }

  function changeMembershipType(nextType: string) {
    setMembershipType(nextType);
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
    }
  }

  function updateParticipant(
    index: number,
    field: keyof ParticipantForm,
    value: string
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
        `/api/system/members/search?q=${encodeURIComponent(query)}`,
        { cache: "no-store" }
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
    setCandidates([]);
    setSearchQuery("");
  }

  function removeRenewalMember(memberId: string) {
    setParticipants((current) =>
      current.filter((participant) => participant.existingMemberId !== memberId)
    );
  }

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault();
    if (!kind) return;

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
        "Application saved. It is awaiting payment and has NOT been activated."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not submit membership application.");
    } finally {
      setSubmitting(false);
    }
  }

  async function activateApplication() {
    if (!application) return;
    if (!activationStaffName.trim()) {
      setError("Activation Staff Name is required before payment can be confirmed.");
      return;
    }

    setActivating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/members/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate",
          applicationId: application.id,
          activationStaffName: activationStaffName.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not activate membership.");
        return;
      }
      setActivation(data.activation);
      setMessage("Payment confirmed and membership activated successfully.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not activate membership.");
    } finally {
      setActivating(false);
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
                  Find the existing member first and keep their permanent number and barcode.
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
                  Scan/search the BGM number first. Name, mobile, email and legacy PK searches may show several candidates.
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
                      This number and barcode stay with this member.
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
                  placeholder="BGM0000001, name, mobile, email or legacy PK"
                  className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500"
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
                    {MEMBERSHIP_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Duration">
                  <select
                    value={durationKey}
                    onChange={(event) => setDurationKey(event.target.value)}
                    className={inputClass}
                  >
                    {DURATIONS.map((duration) => (
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
                    onChange={(event) => setStartDate(event.target.value)}
                    className={inputClass}
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
              <p className="mt-3 text-xs text-zinc-500">
                Starting and expiry dates are explicit so the exact membership period is visible and auditable before payment.
              </p>
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
              Submitting creates an awaiting-payment application only. It does not activate membership access.
            </p>
          </form>
        )}

        {application && !activation && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">
                  Membership application
                </p>
                <h2 className="mt-1 text-2xl font-black">{application.reference}</h2>
                <p className="mt-1 text-sm font-semibold text-zinc-500">
                  {application.kind === "renewal" ? "RENEWAL" : "NEW MEMBERSHIP"} · {application.membershipType.toUpperCase()}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-black text-amber-900">
                AWAITING PAYMENT
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Summary label="Duration" value={application.durationKey.replaceAll("_", " ")} />
              <Summary label="Starting Date" value={application.startDate} />
              <Summary label="Expiry Date" value={application.expiryDate} />
              <Summary label="Application Staff Name" value={application.staffName} emphasize />
            </div>

            <div className="mt-5 space-y-3">
              {participants.map((participant, index) => (
                <div key={participant.existingMemberId || index} className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                    {participants.length > 1 ? `Participant ${index + 1}` : "Member"}
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {participant.firstName} {participant.lastName}
                  </p>
                  {participant.memberNumber && (
                    <>
                      <p className="mt-1 font-mono font-black">{participant.memberNumber}</p>
                      <p className="mt-1 text-xs font-bold text-emerald-700">
                        This number and barcode stay with this member.
                      </p>
                    </>
                  )}
                  <p className="mt-2 text-sm text-zinc-600">
                    {participant.email || "No email"}{participant.phone ? ` · ${participant.phone}` : ""}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 print:hidden">
              <p className="font-black text-blue-900">Printing does not activate this membership.</p>
              <p className="mt-1 text-sm text-blue-800">
                The permanent BGM number for a new member is not issued until payment is confirmed below.
              </p>
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-3 rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-black text-blue-900"
              >
                Print Application
              </button>
            </div>

            <div className="mt-6 border-t-2 border-zinc-200 pt-6 print:hidden">
              <h3 className="text-xl font-black">Payment & activation</h3>
              <p className="mt-1 text-sm text-zinc-600">
                A second staff attribution is required. Enter the name of the person actually receiving payment and activating this membership.
              </p>

              {!canActivate ? (
                <div className="mt-4 rounded-xl border border-zinc-300 bg-zinc-100 p-4 text-sm font-semibold text-zinc-600">
                  This account can prepare the application but does not have the `membership.activate` permission. A permitted staff account must complete payment activation.
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5">
                  <label className="block text-sm font-black text-emerald-950">
                    Activation Staff Name <span className="text-red-600">*</span>
                    <input
                      required
                      value={activationStaffName}
                      onChange={(event) => setActivationStaffName(event.target.value)}
                      placeholder="Staff member confirming payment"
                      className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-emerald-600"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={activating || !activationStaffName.trim()}
                    onClick={activateApplication}
                    className="mt-4 w-full rounded-xl bg-emerald-700 px-5 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {activating ? "Activating…" : "PAYMENT RECEIVED — ACTIVATE"}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {application && activation && (
          <section className="rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Membership active
            </p>
            <h2 className="mt-1 text-3xl font-black text-emerald-950">ACTIVATED</h2>
            <p className="mt-2 text-sm font-semibold text-emerald-900">
              Payment was confirmed by {activationStaffName.trim()}.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(activation.members || []).map((member) => (
                <div key={member.memberId} className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase text-zinc-500">{member.role}</p>
                  <p className="mt-1 font-mono text-2xl font-black text-zinc-950">
                    {member.memberNumber}
                  </p>
                  <p className="mt-2 text-sm font-bold text-emerald-700">
                    {application.kind === "renewal"
                      ? "Permanent member number retained."
                      : "Permanent member number issued."}
                  </p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={resetWorkflow}
              className="mt-6 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-black text-white"
            >
              Process Another Membership
            </button>
          </section>
        )}
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

function Summary({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${emphasize ? "bg-orange-50" : "bg-zinc-50"}`}>
      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 font-bold ${emphasize ? "text-orange-900" : "text-zinc-900"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function ParticipantEditor({
  participant,
  index,
  kind,
  onChange,
}: {
  participant: ParticipantForm;
  index: number;
  kind: "new" | "renewal";
  onChange: (index: number, field: keyof ParticipantForm, value: string) => void;
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
          This number and barcode stay with this member.
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
      <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
        Official member-photo capture remains separate from personal progress photos and will use the dedicated private-photo workflow.
      </p>
    </section>
  );
}
