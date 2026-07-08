"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Trash2, UserPlus, X } from "lucide-react";

type AdminMember = {
  id?: string;
  memberNumber: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  enrollmentDate: string;
  membershipPeriod: string;
  membershipExpiry: string;
  notes: string;
  username?: string;
  appEnrolled?: boolean;
  lastLoginAt?: string | null;
};

const emptyMember: AdminMember = {
  memberNumber: "",
  fullName: "",
  email: "",
  phone: "",
  status: "active",
  enrollmentDate: "",
  membershipPeriod: "",
  membershipExpiry: "",
  notes: "",
};

const membershipPeriods = [
  { label: "Choose duration", value: "" },
  { label: "1 week", value: "1_week" },
  { label: "2 weeks", value: "2_weeks" },
  { label: "1 month", value: "1_month" },
  { label: "3 months", value: "3_months" },
  { label: "6 months", value: "6_months" },
  { label: "1 year", value: "1_year" },
];

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function calculateExpiryDate(startDate: string, period: string) {
  if (!startDate || !period) return "";

  const date = new Date(`${startDate}T00:00:00`);

  if (period === "1_week") date.setDate(date.getDate() + 7);
  if (period === "2_weeks") date.setDate(date.getDate() + 14);
  if (period === "1_month") date.setMonth(date.getMonth() + 1);
  if (period === "3_months") date.setMonth(date.getMonth() + 3);
  if (period === "6_months") date.setMonth(date.getMonth() + 6);
  if (period === "1_year") date.setFullYear(date.getFullYear() + 1);

  return formatDate(date);
}

function calculateStatus(expiryDate: string) {
  if (!expiryDate) return "active";

  const today = new Date().toISOString().slice(0, 10);

  return expiryDate < today ? "inactive" : "active";
}

function isMemberExpired(member: any) {
  if (!member?.membershipExpiry) return false;
  return member.membershipExpiry < new Date().toISOString().slice(0, 10);
}

function formatMemberDate(value?: string) {
  if (!value) return "Not set";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function memberDisplayStatus(member: any) {
  if (isMemberExpired(member)) return "expired";
  return member.status || "active";
}

export default function MembersAdmin({ pin }: { pin: string }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [form, setForm] = useState<AdminMember>(emptyMember);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadMembers();
  }, []);

  async function adminFetch(options?: RequestInit) {
    return fetch("/api/admin/members", {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-pin": pin,
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });
  }

  async function loadMembers() {
    setStatus("Loading members…");

    const response = await adminFetch();
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not load members.");
      return;
    }

    setMembers(data.members || []);
    setStatus("Members loaded.");
  }

  function updateMembershipDates(updates: Partial<AdminMember>) {
    const nextForm = {
      ...form,
      ...updates,
    };

    if (nextForm.enrollmentDate && nextForm.membershipPeriod) {
      const expiry = calculateExpiryDate(
        nextForm.enrollmentDate,
        nextForm.membershipPeriod
      );

      nextForm.membershipExpiry = expiry;
      nextForm.status = calculateStatus(expiry);
    }

    setForm(nextForm);
  }

  function editMember(member: AdminMember) {
    setEditingId(member.id || null);
    setForm({
      id: member.id,
      memberNumber: member.memberNumber || "",
      fullName: member.fullName || "",
      email: member.email || "",
      phone: member.phone || "",
      status: member.status || "active",
      enrollmentDate: member.enrollmentDate || "",
      membershipPeriod: member.membershipPeriod || "",
      membershipExpiry: member.membershipExpiry || "",
      notes: member.notes || "",
      username: member.username || "",
      appEnrolled: Boolean(member.appEnrolled),
      lastLoginAt: member.lastLoginAt,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
    setStatus("Editing member.");
  }

  function clearForm() {
    setEditingId(null);
    setForm(emptyMember);
    setStatus("Ready.");
  }

  async function saveMember() {
    const response = await adminFetch({
      method: "POST",
      body: JSON.stringify({
        mode: editingId ? "update" : "create",
        member: {
          ...form,
          id: editingId,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not save member.");
      return;
    }

    setStatus(editingId ? "Member updated." : "Member added.");
    setEditingId(null);
    setForm(emptyMember);
    loadMembers();
  }

  async function resetAppLogin(member: AdminMember) {
    if (!member.id) return;

    const confirmed = window.confirm(
      "Reset this member's app login? They will need to activate their account again."
    );

    if (!confirmed) return;

    const response = await adminFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "reset_app_login",
        id: member.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not reset app login.");
      return;
    }

    setStatus("App login reset.");
    loadMembers();
  }

  async function deleteMember(member: AdminMember) {
    if (!member.id) return;

    const confirmed = window.confirm(
      "Delete this member? This also removes their linked personal data."
    );

    if (!confirmed) return;

    const response = await adminFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "delete",
        id: member.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not delete member.");
      return;
    }

    setStatus("Member deleted.");
    loadMembers();
  }

  const expiryPreview = form.membershipExpiry;
  const statusPreview = calculateStatus(expiryPreview);


  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();

    return members.filter((member) => {
      const expired = isMemberExpired(member);
      const displayStatus = memberDisplayStatus(member);

      const matchesSearch =
        !query ||
        [
          member.fullName,
          member.memberNumber,
          member.email,
          member.phone,
          member.username,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      if (!matchesSearch) return false;

      if (memberFilter === "active") {
        return displayStatus === "active";
      }

      if (memberFilter === "expired") {
        return expired;
      }

      if (memberFilter === "inactive") {
        return member.status !== "active" && !expired;
      }

      if (memberFilter === "enrolled") {
        return Boolean(member.appEnrolled);
      }

      if (memberFilter === "not_enrolled") {
        return !member.appEnrolled;
      }

      return true;
    });
  }, [members, memberSearch, memberFilter]);

  const activeMembers = members.filter(
    (member) => memberDisplayStatus(member) === "active"
  ).length;

  const expiredMembers = members.filter(isMemberExpired).length;

  const appActivatedMembers = members.filter(
    (member) => member.appEnrolled
  ).length;

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <UserPlus className="text-[#fcb415]" size={26} strokeWidth={3} />
          <h2 className="text-2xl font-black">
            {editingId ? "Edit Member" : "Add Member"}
          </h2>
        </div>

        <p className="mt-3 text-sm font-bold leading-6 text-white/50">
          Add the member here first. Enter the enrolment date and choose the
          membership duration. The expiry date and active/inactive status will
          be calculated automatically.
        </p>

        <div className="mt-5 grid gap-3">
          <input
            value={form.memberNumber}
            onChange={(event) =>
              setForm({
                ...form,
                memberNumber: event.target.value.toUpperCase(),
              })
            }
            placeholder="Member number, example BGM00125"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <input
            value={form.fullName}
            onChange={(event) =>
              setForm({ ...form, fullName: event.target.value })
            }
            placeholder="Full name"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            placeholder="Email"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <input
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value })
            }
            placeholder="Phone optional"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Enrolment Date
              </span>
              <input
                type="date"
                value={form.enrollmentDate || ""}
                onChange={(event) =>
                  updateMembershipDates({
                    enrollmentDate: event.target.value,
                  })
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Duration
              </span>
              <select
                value={form.membershipPeriod || ""}
                onChange={(event) =>
                  updateMembershipDates({
                    membershipPeriod: event.target.value,
                  })
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
              >
                {membershipPeriods.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-[#fcb415]/30 bg-[#fcb415]/10 p-4">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
              Auto Membership Status
            </p>

            <p className="mt-2 text-sm font-bold text-white">
              Expiry: {expiryPreview || "Choose date and duration"}
            </p>

            <p
              className={`mt-1 text-sm font-black uppercase tracking-[.16em] ${
                statusPreview === "active" ? "text-green-300" : "text-red-300"
              }`}
            >
              {statusPreview}
            </p>
          </div>

          <input
            type="date"
            value={form.membershipExpiry || ""}
            onChange={(event) =>
              setForm({
                ...form,
                membershipExpiry: event.target.value,
                status: calculateStatus(event.target.value),
              })
            }
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
            placeholder="Notes optional"
            className="min-h-28 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          {editingId ? (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
                App Login
              </p>
              <p className="mt-2 text-sm font-bold text-white/55">
                {form.appEnrolled
                  ? `Activated as ${form.username || "member"}`
                  : "Not activated yet"}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={saveMember}
              className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
            >
              <Save size={17} strokeWidth={3} />
              {editingId ? "Save Member" : "Add Member"}
            </button>

            <button
              type="button"
              onClick={clearForm}
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
            >
              <X size={17} strokeWidth={3} />
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Members
            </p>

            <h2 className="mt-1 text-3xl font-black text-white">
              Member control centre
            </h2>

            <p className="mt-2 text-sm font-bold leading-6 text-white/45">
              Search, edit and manage member app access from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMembers}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white"
          >
            <RefreshCw size={17} strokeWidth={3} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-3xl font-black text-white">{members.length}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
              Total
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-3xl font-black text-green-300">
              {activeMembers}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
              Active
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-3xl font-black text-[#fcb415]">
              {appActivatedMembers}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
              App users
            </p>
          </div>
        </div>

        {expiredMembers > 0 ? (
          <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm font-black text-red-200">
              {expiredMembers} expired member{expiredMembers === 1 ? "" : "s"} found
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-red-200/60">
              Use the Expired filter to review memberships that may need renewal.
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3">
          <input
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Search name, member number, email, phone or username"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-base font-bold text-white outline-none placeholder:text-white/25"
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              ["all", "All"],
              ["active", "Active"],
              ["expired", "Expired"],
              ["inactive", "Inactive"],
              ["enrolled", "App active"],
              ["not_enrolled", "Not activated"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMemberFilter(value)}
                className={
                  memberFilter === value
                    ? "shrink-0 rounded-full bg-[#fcb415] px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-black"
                    : "shrink-0 rounded-full border border-white/10 bg-black/25 px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-white/45"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {filteredMembers.map((member) => {
            const displayStatus = memberDisplayStatus(member);

            return (
              <article
                key={member.id}
                className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/25"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xl font-black text-white">
                        {member.fullName || "Unnamed member"}
                      </p>

                      <p className="mt-1 text-xs font-black uppercase tracking-[.16em] text-[#fcb415]">
                        {member.memberNumber || "No member number"}
                      </p>

                      <p className="mt-2 break-all text-sm font-bold text-white/45">
                        {member.email || "No email"}
                      </p>

                      {member.phone ? (
                        <p className="mt-1 text-sm font-bold text-white/35">
                          {member.phone}
                        </p>
                      ) : null}
                    </div>

                    <span
                      className={
                        displayStatus === "active"
                          ? "shrink-0 rounded-full bg-green-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-green-300"
                          : displayStatus === "expired"
                            ? "shrink-0 rounded-full bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-red-300"
                            : "shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35"
                      }
                    >
                      {displayStatus}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/30">
                        App Login
                      </p>
                      <p
                        className={
                          member.appEnrolled
                            ? "mt-1 text-sm font-black text-green-300"
                            : "mt-1 text-sm font-black text-white/45"
                        }
                      >
                        {member.appEnrolled ? "Activated" : "Not activated"}
                      </p>

                      {member.appEnrolled && member.username ? (
                        <p className="mt-1 truncate text-xs font-bold text-white/35">
                          {member.username}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/30">
                        Expiry
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {formatMemberDate(member.membershipExpiry)}
                      </p>
                    </div>
                  </div>

                  {member.enrollmentDate ? (
                    <p className="mt-3 text-xs font-bold text-white/35">
                      Enrolled: {formatMemberDate(member.enrollmentDate)}
                    </p>
                  ) : null}

                  {member.notes ? (
                    <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold leading-5 text-white/45">
                      {member.notes}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => editMember(member)}
                      className="rounded-full bg-[#fcb415] px-5 py-3 text-xs font-black text-black"
                    >
                      Edit
                    </button>

                    {member.appEnrolled ? (
                      <button
                        type="button"
                        onClick={() => resetAppLogin(member)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-black text-white"
                      >
                        Reset App Login
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => deleteMember(member)}
                      className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-3 text-xs font-black text-red-300"
                    >
                      <Trash2 size={14} strokeWidth={3} />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {filteredMembers.length === 0 ? (
            <div className="rounded-[1.7rem] border border-white/10 bg-black/25 p-6 text-center">
              <p className="text-2xl font-black text-white">
                No members found
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-white/45">
                Try changing the search text or selected filter.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {status ? (
        <p className="text-center text-sm font-bold text-white/50">{status}</p>
      ) : null}
    </section>
  );
}
