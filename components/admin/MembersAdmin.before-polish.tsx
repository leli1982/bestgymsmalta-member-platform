"use client";

import { useEffect, useState } from "react";
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

export default function MembersAdmin({ pin }: { pin: string }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Members</h2>

          <button
            type="button"
            onClick={loadMembers}
            className="rounded-full border border-white/10 bg-white/[0.04] p-3"
          >
            <RefreshCw size={16} strokeWidth={3} />
          </button>
        </div>

        {members.map((member) => (
          <div
            key={member.id}
            className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-white">
                  {member.fullName}
                </p>
                <p className="mt-1 text-xs font-black uppercase tracking-[.16em] text-[#fcb415]">
                  {member.memberNumber}
                </p>
                <p className="mt-1 text-sm font-bold text-white/45">
                  {member.email}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] ${
                  member.status === "active"
                    ? "bg-green-400/10 text-green-300"
                    : "bg-red-400/10 text-red-300"
                }`}
              >
                {member.status}
              </span>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs font-bold text-white/45">
                App:{" "}
                {member.appEnrolled
                  ? `Activated as ${member.username}`
                  : "Not activated"}
              </p>

              {member.enrollmentDate ? (
                <p className="mt-1 text-xs font-bold text-white/35">
                  Enrolled: {member.enrollmentDate}
                </p>
              ) : null}

              {member.membershipExpiry ? (
                <p className="mt-1 text-xs font-bold text-white/35">
                  Expiry: {member.membershipExpiry}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => editMember(member)}
                className="rounded-full bg-[#fcb415] px-4 py-2 text-xs font-black text-black"
              >
                Edit
              </button>

              {member.appEnrolled ? (
                <button
                  type="button"
                  onClick={() => resetAppLogin(member)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-black"
                >
                  Reset App Login
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => deleteMember(member)}
                className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-300"
              >
                <Trash2 size={14} strokeWidth={3} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      {status ? (
        <p className="text-center text-sm font-bold text-white/50">{status}</p>
      ) : null}
    </section>
  );
}
