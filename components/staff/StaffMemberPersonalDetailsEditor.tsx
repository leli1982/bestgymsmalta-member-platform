"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CreditCard, Save, ShieldCheck } from "lucide-react";
import { STAFF_PERSONAL_DETAIL_FIELDS, type StaffPersonalDetails } from "@/lib/staffMemberPersonalDetailsCore";

type MemberRecord = {
  id: string; memberNumber: string; fullName: string; updatedAt: string;
  profile: StaffPersonalDetails;
};

const FIELDS: Array<{ key: keyof StaffPersonalDetails; label: string; type?: string; wide?: boolean }> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Surname" },
  { key: "idNumber", label: "ID card / passport number" },
  { key: "addressLine1", label: "Address", wide: true },
  { key: "addressLine2", label: "Address line 2", wide: true },
  { key: "town", label: "Town / locality" },
  { key: "postcode", label: "Postcode" },
  { key: "country", label: "Country" },
  { key: "mobile", label: "Mobile number", type: "tel" },
  { key: "phone", label: "Telephone", type: "tel" },
  { key: "telephoneNo1", label: "Alternative telephone 1", type: "tel" },
  { key: "telephoneNo2", label: "Alternative telephone 2", type: "tel" },
  { key: "email", label: "Email", type: "email", wide: true },
  { key: "nextOfKin", label: "Next of kin / emergency contact name and number", wide: true },
];

export default function StaffMemberPersonalDetailsEditor({ memberId }: { memberId: string }) {
  const [record, setRecord] = useState<MemberRecord | null>(null);
  const [profile, setProfile] = useState<StaffPersonalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/members/" + encodeURIComponent(memberId) + "/personal-details", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load personal details.");
      setRecord(data.member as MemberRecord);
      setProfile(data.member.profile as StaffPersonalDetails);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load personal details.");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { void load(); }, [load]);

  const changed = useMemo(
    () => !!record && !!profile && STAFF_PERSONAL_DETAIL_FIELDS.some(key =>
      (record.profile[key] || "") !== (profile[key] || "")),
    [record, profile]
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !profile || saving) return;
    if (!changed) { setError("No changes to save."); return; }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/members/" + encodeURIComponent(memberId) + "/personal-details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ expectedUpdatedAt: record.updatedAt, profile }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save these details.");
      await load();
      setMessage("Personal details saved successfully. The change has been recorded in the audit trail.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save these details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5">
          <a href="/staff" className="inline-flex items-center gap-1 text-sm font-black text-orange-700"><ArrowLeft className="h-4 w-4" /> Staff Home</a>
          <h1 className="mt-3 text-2xl font-black">Edit member / replace card</h1>
          <p className="mt-1 text-sm text-zinc-600">Correct personal and contact details only. Membership dates, duration, prices and status are protected.</p>
        </header>
        {loading && <p role="status" className="rounded-2xl bg-white p-5">Loading member details…</p>}
        {!loading && !record && <div role="alert" className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 font-bold text-red-800">{error || "Member not found."}</div>}
        {record && profile && !loading && <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-wide text-orange-700">Permanent member identity</p>
            <h2 className="mt-1 text-xl font-black">{record.fullName}</h2>
            <p className="mt-1 font-mono text-base font-bold text-zinc-700">{record.memberNumber || "No BGM member number recorded"}</p>
            <a href={"/staff/reception/issue-card?memberNumber=" + encodeURIComponent(record.memberNumber)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-400 bg-orange-50 px-4 py-3 text-sm font-black text-orange-900">
              <CreditCard className="h-5 w-5" /> REPLACE PHYSICAL CARD
            </a>
            <p className="mt-2 text-xs text-zinc-600">Card replacement is a separate audited process. The permanent BGM number and membership dates never change.</p>
          </section>
          <form onSubmit={save} className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6" noValidate>
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-orange-600" /><h2 className="text-lg font-black">Personal details</h2></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {FIELDS.map(({ key, label, type, wide }) =>
                <label key={key} className={wide ? "block sm:col-span-2" : "block"}>
                  <span className="block text-sm font-bold text-zinc-700">{label}</span>
                  <input value={profile[key]} onChange={event => { setProfile(old => old ? { ...old, [key]: event.target.value } : old); setError(""); setMessage(""); }}
                    type={type || "text"} required={key === "firstName" || key === "lastName"}
                    maxLength={key === "firstName" || key === "lastName" ? 100 : key === "email" ? 254 : 500}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
                </label>)}
            </div>
            {error && <p role="alert" aria-live="assertive" className="mt-5 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-sm font-black text-red-900">{error}</p>}
            {message && <p role="status" className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p>}
            <button type="submit" disabled={saving || !changed} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb400] px-5 py-4 text-base font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40">
              <Save className="h-5 w-5" /> {saving ? "SAVING…" : "SAVE PERSONAL DETAILS"}
            </button>
            <p className="mt-3 text-center text-xs font-semibold text-zinc-600">Only these personal fields can be saved. All corrections are audited. For membership term corrections, contact Super Admin.</p>
          </form>
        </>}
      </div>
    </main>
  );
}
