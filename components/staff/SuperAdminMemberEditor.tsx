"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, BadgeCheck, RefreshCcw, Save, ShieldCheck, UserRound } from "lucide-react";
import { EDITABLE_PROFILE_FIELDS, type MemberProfileDraft } from "@/lib/superAdminMemberProfileCore";

type Member = MemberProfileDraft & {
  id: string; memberNumber: string; fullName: string; status: string;
  membershipExpiry: string | null; enrollmentDate: string | null;
  membershipPeriod: string | null; enrollmentGymId: string | null;
  originalEnrollmentGym: string | null; legacyPkCustomer: string | null;
  photoUrl: string | null; updatedAt: string;
};
type Membership = {
  id: string; role: string; membershipType: string; duration: string;
  startDate: string; expiryDate: string; enrollmentGymId: string;
  status: string; application: {
    application_reference: string; base_price_cents: number | null;
    discount_amount_cents: number | null; final_amount_cents: number | null;
    currency: string; payment_method: string | null;
    payment_other_text: string | null; payment_received_at: string | null;
  } | null;
};
type DateEdit = {
  allowed: boolean;
  reason: string;
  membershipId: string | null;
  expectedMembershipUpdatedAt: string | null;
  startDate: string;
  expiryDate: string;
};
type Detail = {
  member: Member; activeCardNumber: string | null;
  dateEdit: DateEdit;
  gyms: Array<{ id: string; name: string; status: string }>;
  memberships: Membership[];
};
const FIELDS: Array<{ key: keyof MemberProfileDraft; label: string; type?: string; wide?: boolean }> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email", type: "email" },
  { key: "mobile", label: "Mobile / contact number", type: "tel" },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "idNumber", label: "ID / passport number" },
  { key: "addressLine1", label: "Address line 1", wide: true },
  { key: "addressLine2", label: "Address line 2", wide: true },
  { key: "town", label: "Town" },
  { key: "postcode", label: "Postcode" },
  { key: "nextOfKin", label: "Next of kin / emergency contact", wide: true },
];
function profileOf(member: Member): MemberProfileDraft {
  return Object.fromEntries(EDITABLE_PROFILE_FIELDS.map((key) => [key, member[key] || ""])) as MemberProfileDraft;
}
function currency(cents: number | null | undefined, code = "EUR") {
  return cents == null ? "Not recorded" : new Intl.NumberFormat("en-MT", {
    style: "currency", currency: code || "EUR",
  }).format(cents / 100);
}
function gymName(gyms: Detail["gyms"], id: string | null) {
  return gyms.find((gym) => gym.id === id)?.name || id || "Not recorded";
}

export default function SuperAdminMemberEditor({ memberId }: { memberId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [profile, setProfile] = useState<MemberProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gymSelection, setGymSelection] = useState("");
  const [gymSaving, setGymSaving] = useState(false);
  const [gymMessage, setGymMessage] = useState("");
  const [gymError, setGymError] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateExpiry, setDateExpiry] = useState("");
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState("");
  const [dateMessage, setDateMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/system/admin/members/${encodeURIComponent(memberId)}`, {
        cache: "no-store", credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load member.");
      const dateEdit: DateEdit = result.dateEdit || {
        allowed: false, reason: "Reload this member to verify the current membership.",
        membershipId: null, expectedMembershipUpdatedAt: null,
        startDate: result.member.enrollmentDate || "",
        expiryDate: result.member.membershipExpiry || "",
      };
      setDetail({ ...(result as Detail), dateEdit });
      setProfile(profileOf(result.member));
      setGymSelection(result.member.enrollmentGymId || "");
      setDateStart(dateEdit.startDate);
      setDateExpiry(dateEdit.expiryDate);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load member.");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !profile || saving || gymSaving || dateSaving || gymChanged || dateChanged) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/system/admin/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: detail.member.updatedAt, profile }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save member.");
      await load();
      setMessage("Personal details saved and audited.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save member.");
    } finally {
      setSaving(false);
    }
  }

  async function saveGym() {
    if (!detail || gymSaving || saving || dateSaving || !gymSelection || changed || dateChanged) return;
    setGymSaving(true);
    setGymError("");
    setGymMessage("");
    try {
      const response = await fetch(`/api/system/admin/members/${encodeURIComponent(memberId)}/enrollment-gym`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentGymId: gymSelection,
          expectedUpdatedAt: detail.member.updatedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not change the enrollment gym.");
      await load();
      setGymMessage(result.changed
        ? "Current enrollment gym changed and audited. Future visits will use this gym."
        : "The selected gym is already assigned to this member.");
    } catch (caught) {
      setGymError(caught instanceof Error ? caught.message : "Could not change the enrollment gym.");
    } finally {
      setGymSaving(false);
    }
  }

  async function saveDates() {
    if (!detail || !detail.dateEdit.allowed || dateSaving || saving || gymSaving || changed || gymChanged || !dateChanged) return;
    setDateSaving(true);
    setDateError("");
    setDateMessage("");
    try {
      const response = await fetch(`/api/system/admin/members/${encodeURIComponent(memberId)}/membership-dates`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedMemberUpdatedAt: detail.member.updatedAt,
          membershipId: detail.dateEdit.membershipId,
          expectedMembershipUpdatedAt: detail.dateEdit.expectedMembershipUpdatedAt,
          startDate: dateStart || null,
          expiryDate: dateExpiry,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not correct the membership dates.");
      await load();
      setDateMessage(result.changed
        ? "Membership dates corrected and audited. Current expiry updated; original payment history was not changed."
        : "The selected membership dates are already saved.");
    } catch (caught) {
      setDateError(caught instanceof Error ? caught.message : "Could not correct the membership dates.");
    } finally {
      setDateSaving(false);
    }
  }

  const member = detail?.member;
  const changed = Boolean(member && profile && JSON.stringify(profile) !== JSON.stringify(profileOf(member)));
  const gymChanged = Boolean(member && gymSelection && gymSelection !== (member.enrollmentGymId || ""));
  const dateChanged = Boolean(detail && (dateStart !== detail.dateEdit.startDate || dateExpiry !== detail.dateEdit.expiryDate));

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7">
          <a href="/staff/admin/membership-tools?tool=members" className="inline-flex items-center gap-2 text-sm font-bold text-orange-700">
            <ArrowLeft size={17} /> Member browser
          </a>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-orange-700">Super Admin / Member management</p>
              <h1 className="mt-1 text-3xl font-black">Member editor</h1>
              <p className="mt-2 text-sm text-zinc-600">Personal details are editable below. Membership, card and payment records are shown separately.</p>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading || saving || gymSaving || dateSaving}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-bold disabled:opacity-50">
              <RefreshCcw size={16} /> Reload
            </button>
          </div>
        </header>
        {loading && !detail && <section className="rounded-3xl bg-white p-8">Loading member details…</section>}
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
        {message && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>}
        {member && detail && profile && (
          <>
            <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-5 sm:grid-cols-[112px_minmax(0,1fr)] sm:p-7">
              {member.photoUrl
                ? <img src={member.photoUrl} alt={member.fullName + " official member photo"} className="h-28 w-28 rounded-2xl bg-zinc-100 object-cover" />
                : <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400"><UserRound size={42}/></div>}
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-orange-700">Permanent BGM membership number</p>
                <p className="mt-1 break-all font-mono text-3xl font-black">{member.memberNumber}</p>
                <p className="mt-2 text-lg font-bold">{member.fullName || "Member name not recorded"}</p>
                <p className="mt-1 text-sm text-zinc-600">Current card: <strong>{detail.activeCardNumber || "Card not assigned"}</strong> · Status: <strong>{member.status}</strong></p>
                <p className="mt-1 text-sm text-zinc-600">Original pkCustomer: <strong>{member.legacyPkCustomer || "Not recorded"}</strong> (Super Admin only)</p>
                <p className="mt-2 text-xs text-zinc-500">Member photo is managed through the authorised staff photo-capture flow, not Excel or this editor.</p>
              </div>
            </section>
            <form onSubmit={(event) => void save(event)} className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7">
              <div className="flex items-center gap-2"><ShieldCheck className="text-orange-700" size={22}/><h2 className="text-xl font-black">Personal details</h2></div>
              <p className="mt-2 text-sm text-zinc-500">Only these fields are changed by Save. BGM number, original Excel values, assigned card, membership dates and payment history are not changed.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {FIELDS.map(({ key, label, type, wide }) => (
                  <label key={key} className={wide ? "block sm:col-span-2" : "block"}>
                    <span className="mb-1.5 block text-sm font-bold">{label}</span>
                    <input type={type || "text"} value={profile[key]}
                      onChange={(event) => { setProfile((old) => old ? { ...old, [key]: event.target.value } : old); setMessage(""); }}
                      required={key === "firstName" || key === "lastName"}
                      maxLength={key === "firstName" || key === "lastName" ? 100 : key === "email" ? 254 : 500}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100" />
                  </label>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">
                <button disabled={!changed || gymChanged || dateChanged || saving || loading || gymSaving || dateSaving} type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300">
                  <Save size={17} /> {saving ? "Saving…" : "Save personal details"}
                </button>
                {changed && <span className="text-sm font-medium text-amber-700">You have unsaved changes.</span>}
                {(gymChanged || dateChanged) && <span className="text-sm font-medium text-amber-700">Save or discard your gym or membership date changes before saving personal details.</span>}
              </div>
            </form>
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7">
              <div className="flex items-center gap-2"><BadgeCheck size={22} className="text-orange-700"/><h2 className="text-xl font-black">Gym and membership</h2></div>
              <p className="mt-2 text-sm text-zinc-600">All memberships give access to every BGM gym. Enrollment gym is not changed by visiting another location.</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {([
                  ["Original enrollment gym (Excel)", member.originalEnrollmentGym || "Not recorded"],
                  ["Current enrollment gym", gymName(detail.gyms, member.enrollmentGymId)],
                  ["Recorded member start date", member.enrollmentDate || "Unknown — not provided in original Excel"],
                  ["Current membership expiry (ExpiryDate1)", member.membershipExpiry || "Not recorded"],
                ] as Array<[string, string]>).map(([label, value]) => <div key={label} className="rounded-xl bg-zinc-50 p-4">
                  <dt className="text-xs font-bold uppercase text-zinc-500">{label}</dt><dd className="mt-1 break-words font-bold">{value}</dd>
                </div>)}
              </dl>
              <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <h3 className="text-base font-black text-orange-950">Reassign current enrollment gym</h3>
                <p className="mt-2 text-sm text-orange-950">This changes only this member’s current gym, affecting future check-in attribution. Existing visit snapshots, the original Excel gym and shared couples membership records stay unchanged. Visits recorded before snapshots existed have unverified historical origin.</p>
                <label className="mt-4 block text-sm font-bold text-zinc-900" htmlFor="member-current-enrollment-gym">New enrollment gym</label>
                <select id="member-current-enrollment-gym" value={gymSelection}
                  onChange={(event) => { setGymSelection(event.target.value); setGymMessage(""); setGymError(""); }}
                  disabled={gymSaving || saving || dateSaving || loading}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 disabled:opacity-60">
                  <option value="">Select an active gym</option>
                  {member.enrollmentGymId && !detail.gyms.some((gym) => gym.id === member.enrollmentGymId && gym.status === "active") && (
                    <option value={member.enrollmentGymId} disabled>Current gym (inactive): {gymName(detail.gyms, member.enrollmentGymId)}</option>
                  )}
                  {detail.gyms.filter((gym) => gym.status === "active").map((gym) => (
                    <option key={gym.id} value={gym.id}>{gym.name}</option>
                  ))}
                </select>
                {(changed || dateChanged) && <p className="mt-2 text-sm font-bold text-amber-800">Save or discard your unsaved personal details and membership date changes before changing the gym.</p>}
                {gymError && <p role="alert" className="mt-2 text-sm font-bold text-red-800">{gymError}</p>}
                {gymMessage && <p role="status" className="mt-2 text-sm font-bold text-emerald-800">{gymMessage}</p>}
                <button type="button" onClick={() => void saveGym()}
                  disabled={!gymChanged || changed || dateChanged || saving || gymSaving || dateSaving || loading}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300">
                  <Save size={17}/>{gymSaving ? "Saving gym…" : "Save enrollment gym"}
                </button>
              </div>
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-base font-black text-zinc-950">Correct current membership dates</h3>
                <p className="mt-2 text-sm text-zinc-600">This is a correction of an existing membership, not a renewal or payment. Changing expiry can change scanner access for an active member. Inactive or cancelled status will not be reactivated. Past visits, application/payment snapshots and the original Excel gym stay unchanged.</p>
                <p className="mt-2 text-sm font-semibold text-zinc-700">{detail.dateEdit.reason}</p>
                <p className="mt-2 text-xs text-zinc-600">A shared membership requires a separate joint correction; this form will not change the other member’s dates.</p>
                {detail.dateEdit.membershipId && <p className="mt-2 text-xs text-zinc-500">Editing the current individual membership record. Previously purchased membership periods and transactions remain historical records.</p>}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-bold text-zinc-900">
                    {detail.dateEdit.membershipId ? "Current membership start date" : "Verified start date (optional for legacy imports)"}
                    <input type="date" value={dateStart}
                      disabled={!detail.dateEdit.allowed || saving || gymSaving || dateSaving || loading}
                      onChange={(event) => { setDateStart(event.target.value); setDateMessage(""); setDateError(""); }}
                      className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 disabled:opacity-60"/>
                  </label>
                  <label className="block text-sm font-bold text-zinc-900">
                    Current membership expiry
                    <input type="date" value={dateExpiry} required
                      disabled={!detail.dateEdit.allowed || saving || gymSaving || dateSaving || loading}
                      onChange={(event) => { setDateExpiry(event.target.value); setDateMessage(""); setDateError(""); }}
                      className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 disabled:opacity-60"/>
                  </label>
                </div>
                {!detail.dateEdit.membershipId && detail.dateEdit.allowed &&
                  <p className="mt-2 text-xs text-zinc-600">If the original Excel record did not provide a start date, leave it blank unless the actual date has been verified. No date is calculated from membership duration.</p>}
                {(changed || gymChanged) && <p className="mt-2 text-sm font-bold text-amber-800">Save or discard unsaved personal details and gym changes before correcting membership dates.</p>}
                {dateError && <p role="alert" className="mt-2 text-sm font-bold text-red-800">{dateError}</p>}
                {dateMessage && <p role="status" className="mt-2 text-sm font-bold text-emerald-800">{dateMessage}</p>}
                <button type="button" onClick={() => void saveDates()}
                  disabled={!detail.dateEdit.allowed || !dateChanged || !dateExpiry || (Boolean(dateStart) && dateStart > dateExpiry)
                    || changed || gymChanged || saving || gymSaving || dateSaving || loading}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300">
                  <Save size={17}/>{dateSaving ? "Saving membership dates…" : "Save membership dates"}
                </button>
              </div>
              <p className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">Membership cancellation and status changes are separate actions and are not saved by the personal-details, enrollment-gym or date-correction buttons.</p>
            </section>
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7">
              <h2 className="text-xl font-black">Membership and payment records</h2>
              <p className="mt-2 text-sm text-zinc-600">Read-only current records. Couples may share one membership. Historical Excel members may have no linked payment record.</p>
              {detail.memberships.length === 0
                ? <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm">No linked membership transaction is recorded for this member. Their imported expiry date is shown above; no start date or payment has been invented.</p>
                : <div className="mt-4 space-y-3">{detail.memberships.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap justify-between gap-2"><strong className="capitalize">{item.membershipType} · {item.duration.replaceAll("_", " ")}</strong>
                      <span className="text-sm font-bold">{item.status} · {item.role}</span></div>
                    <p className="mt-2 text-sm">From {item.startDate} until {item.expiryDate} · Enrollment: {gymName(detail.gyms, item.enrollmentGymId)}</p>
                    {item.application
                      ? <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div>Recorded price: <strong>{currency(item.application.base_price_cents, item.application.currency)}</strong></div>
                          <div>Recorded discount: <strong>{currency(item.application.discount_amount_cents, item.application.currency)}</strong></div>
                          <div>Recorded final amount: <strong>{currency(item.application.final_amount_cents, item.application.currency)}</strong></div>
                          <div>Payment method: <strong>{item.application.payment_method || "Not recorded"}</strong></div>
                          <div>Payment received: <strong>{item.application.payment_received_at || "Not recorded"}</strong></div>
                          <div>Outstanding balance: <strong>Not tracked in this record</strong></div>
                        </dl>
                      : <p className="mt-2 text-sm text-zinc-500">No linked payment application.</p>}
                  </article>
                ))}</div>}
              <p className="mt-4 text-xs text-zinc-500">Payment corrections and outstanding balances require a separate audited ledger; this editor does not overwrite existing transactions.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
