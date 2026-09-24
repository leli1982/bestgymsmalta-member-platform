"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MembershipPrintOverflowPreview, {
  type MembershipPrintMeasurement,
} from "@/components/staff/MembershipPrintOverflowPreview";

type MembershipType = "single" | "student" | "couples";
type DurationKey = "1_week" | "2_weeks" | "1_month" | "3_months" | "6_months" | "1_year";
type DeclarationKey = "gym_rules" | "legacy_declaration" | "privacy" | "health" | "guardian";

type PriceEntry = {
  membershipType: MembershipType;
  durationKey: DurationKey;
  amountCents: number;
  currency: "EUR";
  isActive: boolean;
};

type PriceCatalog = {
  id: string;
  versionNo: number;
  status: "draft" | "published" | "retired";
  publishedAt: string | null;
  createdAt: string;
  entries: PriceEntry[];
};

type DeclarationVersion = {
  id: string;
  contentKey: DeclarationKey;
  versionNo: number;
  body: string;
  contentSha256: string;
  status: "draft" | "published" | "retired";
  publishedAt: string | null;
  createdAt: string;
};

type DiscountCode = {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  successfulUses: number;
  createdAt: string;
  updatedAt: string;
};

type SettingsPayload = {
  priceCatalogs: PriceCatalog[];
  declarations: DeclarationVersion[];
  discountCodes: DiscountCode[];
};

const membershipTypes: readonly MembershipType[] = ["single", "student", "couples"];
const durations: readonly DurationKey[] = [
  "1_week",
  "2_weeks",
  "1_month",
  "3_months",
  "6_months",
  "1_year",
];
const declarationKeys: readonly DeclarationKey[] = [
  "gym_rules",
  "legacy_declaration",
  "privacy",
  "health",
  "guardian",
];

const typeLabels: Record<MembershipType, string> = {
  single: "Regular",
  student: "Student",
  couples: "Couples",
};

const durationLabels: Record<DurationKey, string> = {
  "1_week": "1 week",
  "2_weeks": "2 weeks",
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
};

const declarationLabels: Record<DeclarationKey, string> = {
  gym_rules: "Gym Rules",
  legacy_declaration: "Legacy Membership Declaration",
  privacy: "Privacy / Data Processing",
  health: "Health Declaration",
  guardian: "Parent / Guardian Declaration",
};

const euroFormatter = new Intl.NumberFormat("en-MT", {
  style: "currency",
  currency: "EUR",
});

function matrixKey(type: MembershipType, duration: DurationKey) {
  return `${type}:${duration}`;
}

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function inputToCents(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function formatDate(value: string | null) {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function SectionTitle({ title, copy }: { title: string; copy: string }) {
  return (
    <div>
      <h2 className="text-xl font-black tracking-tight text-zinc-950">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{copy}</p>
    </div>
  );
}

export default function MembershipSettingsAdmin() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<SettingsPayload>({
    priceCatalogs: [],
    declarations: [],
    discountCodes: [],
  });
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [priceAvailability, setPriceAvailability] = useState<Record<string, boolean>>({});
  const [declarationBodies, setDeclarationBodies] = useState<Record<DeclarationKey, string>>({
    gym_rules: "",
    legacy_declaration: "",
    privacy: "",
    health: "",
    guardian: "",
  });
  const [printMeasurement, setPrintMeasurement] = useState<MembershipPrintMeasurement | null>(null);
  const [discountDraft, setDiscountDraft] = useState({
    id: "",
    code: "",
    percentage: "",
    validFrom: "",
    validUntil: "",
    maxUses: "",
    active: true,
  });

  const activeCatalog = useMemo(
    () =>
      settings.priceCatalogs.find((catalog) => catalog.status === "draft") ||
      settings.priceCatalogs.find((catalog) => catalog.status === "published") ||
      null,
    [settings.priceCatalogs]
  );

  const latestDraftCatalog = useMemo(
    () => settings.priceCatalogs.find((catalog) => catalog.status === "draft") || null,
    [settings.priceCatalogs]
  );

  const printOverflow = Boolean(printMeasurement && !printMeasurement.fits);
  const handlePrintMeasurement = useCallback((result: MembershipPrintMeasurement) => {
    setPrintMeasurement((current) =>
      current &&
      current.fits === result.fits &&
      current.measuredHeightPx === result.measuredHeightPx &&
      current.maxHeightPx === result.maxHeightPx
        ? current
        : result
    );
  }, []);

  const seedEditors = useCallback((payload: SettingsPayload) => {
    const source =
      payload.priceCatalogs.find((catalog) => catalog.status === "draft") ||
      payload.priceCatalogs.find((catalog) => catalog.status === "published") ||
      null;

    const nextPrices: Record<string, string> = {};
    const nextAvailability: Record<string, boolean> = {};
    for (const type of membershipTypes) {
      for (const duration of durations) {
        const entry = source?.entries.find(
          (candidate) => candidate.membershipType === type && candidate.durationKey === duration
        );
        nextPrices[matrixKey(type, duration)] = entry ? centsToInput(entry.amountCents) : "0.00";
        nextAvailability[matrixKey(type, duration)] = entry?.isActive !== false;
      }
    }
    setPriceInputs(nextPrices);
    setPriceAvailability(nextAvailability);

    const nextBodies = {} as Record<DeclarationKey, string>;
    for (const key of declarationKeys) {
      const version =
        payload.declarations.find((item) => item.contentKey === key && item.status === "draft") ||
        payload.declarations.find((item) => item.contentKey === key && item.status === "published");
      nextBodies[key] = version?.body || "";
    }
    setDeclarationBodies(nextBodies);
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/membership-settings", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Could not load membership settings.");
      }
      const typed = payload as SettingsPayload;
      setSettings(typed);
      seedEditors(typed);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load membership settings.");
    } finally {
      setLoading(false);
    }
  }, [seedEditors]);

  useEffect(() => {
    let cancelled = false;
    async function resolveAuth() {
      try {
        const response = await fetch("/api/system/auth", { cache: "no-store" });
        const payload = await response.json();
        if (cancelled) return;
        const superAdmin = Boolean(payload.authenticated && payload.user?.isSuperAdmin);
        setIsSuperAdmin(superAdmin);
        if (superAdmin) await loadSettings();
      } catch {
        if (!cancelled) setError("Could not verify the system session.");
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    }
    void resolveAuth();
    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  async function postAction(body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/membership-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save membership settings.");
      await loadSettings();
      return payload;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save membership settings.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function savePriceDraft() {
    const entries: PriceEntry[] = [];
    for (const membershipType of membershipTypes) {
      for (const durationKey of durations) {
        const amountCents = inputToCents(priceInputs[matrixKey(membershipType, durationKey)] || "");
        if (amountCents === null) {
          setError(`Enter a valid non-negative price for ${typeLabels[membershipType]} / ${durationLabels[durationKey]}.`);
          return;
        }
        const isActive = priceAvailability[matrixKey(membershipType, durationKey)] !== false;
        if (isActive && amountCents === 0) {
          setError(`Set a positive price or untick Active for ${typeLabels[membershipType]} / ${durationLabels[durationKey]}.`);
          return;
        }
        entries.push({ membershipType, durationKey, amountCents, currency: "EUR", isActive });
      }
    }
    const result = await postAction({ action: "save_price_draft", entries });
    if (result) setMessage("Price draft saved. Nothing changes publicly until you publish it.");
  }

  async function publishPrices() {
    if (!latestDraftCatalog) {
      setError("Save a complete price draft before publishing.");
      return;
    }
    const result = await postAction({
      action: "publish_price_catalog",
      catalogVersionId: latestDraftCatalog.id,
    });
    if (result) setMessage("Prices published. New applications will use this catalog; existing submitted applications keep their snapshots.");
  }

  async function saveDiscountCode() {
    const percentage = Number(discountDraft.percentage);
    const maxUses = discountDraft.maxUses.trim() ? Number(discountDraft.maxUses) : null;
    const result = await postAction({
      action: "save_discount_code",
      id: discountDraft.id || undefined,
      code: discountDraft.code,
      percentage,
      active: discountDraft.active,
      validFrom: discountDraft.validFrom || null,
      validUntil: discountDraft.validUntil || null,
      maxUses,
    });
    if (result) {
      setDiscountDraft({ id: "", code: "", percentage: "", validFrom: "", validUntil: "", maxUses: "", active: true });
      setMessage("Discount code saved.");
    }
  }

  async function setDiscountActive(discount: DiscountCode, active: boolean) {
    const result = await postAction({ action: "set_discount_active", id: discount.id, active });
    if (result) setMessage(`${discount.code} is now ${active ? "active" : "inactive"}.`);
  }

  function editDiscount(discount: DiscountCode) {
    setDiscountDraft({
      id: discount.id,
      code: discount.code,
      percentage: String(discount.percentage),
      validFrom: discount.validFrom || "",
      validUntil: discount.validUntil || "",
      maxUses: discount.maxUses === null ? "" : String(discount.maxUses),
      active: discount.active,
    });
    document.getElementById("discount-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveDeclarationDraft(contentKey: DeclarationKey) {
    const result = await postAction({
      action: "save_declaration_draft",
      contentKey,
      body: declarationBodies[contentKey],
    });
    if (result) setMessage(`${declarationLabels[contentKey]} draft saved.`);
  }

  async function publishDeclaration(contentKey: DeclarationKey) {
    const draft = settings.declarations.find(
      (item) => item.contentKey === contentKey && item.status === "draft"
    );
    if (!draft) {
      setError(`Save a ${declarationLabels[contentKey]} draft before publishing.`);
      return;
    }
    const result = await postAction({
      action: "publish_declaration",
      declarationVersionId: draft.id,
    });
    if (result) setMessage(`${declarationLabels[contentKey]} published as a new immutable version.`);
  }

  if (checkingAuth) {
    return <main className="min-h-screen bg-[#f6f6f6] p-6 text-sm font-bold text-zinc-500">Checking Super Admin access…</main>;
  }

  if (!isSuperAdmin) {
    return (
      <main className="min-h-screen bg-[#f6f6f6] px-4 py-10 text-zinc-950">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">Restricted area</p>
          <h1 className="mt-2 text-2xl font-black">Super Admin access required</h1>
          <p className="mt-2 text-sm text-zinc-500">Membership pricing, discount codes and legal wording can only be managed by a Super Admin.</p>
          <a href="/staff" className="mt-5 inline-flex rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">Return to Staff Portal</a>
        </div>
      </main>
    );
  }

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] text-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-3xl bg-zinc-950 px-6 py-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7a38]">BestGymsMalta · Super Admin</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Membership Settings</h1>
              <p className="mt-2 max-w-3xl text-sm text-zinc-300">Manage the authoritative prices, discount codes, Gym Rules and declarations used by new and renewed memberships.</p>
            </div>
            <a href="/staff" className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-black text-white hover:bg-zinc-900">Back to Staff Portal</a>
          </div>
        </header>

        {(error || message) && (
          <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {error || message}
          </div>
        )}

        {loading ? (
          <div className="mt-5 rounded-3xl border border-zinc-200 bg-white p-6 text-sm font-bold text-zinc-500">Loading membership settings…</div>
        ) : (
          <div className="mt-5 grid gap-5">
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionTitle title="Pricing" copy="Set a price and Active checkbox for every duration. Inactive options stay saved but cannot be selected for new memberships or renewals. Save a draft, review all 18 combinations, then publish." />
                <div className="rounded-2xl bg-zinc-100 px-4 py-3 text-right text-xs font-bold text-zinc-600">
                  <div>Editor source</div>
                  <div className="mt-1 text-sm font-black text-zinc-950">{activeCatalog ? `v${activeCatalog.versionNo} · ${activeCatalog.status}` : "No catalog yet"}</div>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-zinc-200 p-3 text-left text-xs font-black uppercase tracking-wide text-zinc-500">Membership</th>
                      {durations.map((duration) => (
                        <th key={duration} className="border-b border-zinc-200 p-3 text-left text-xs font-black uppercase tracking-wide text-zinc-500">{durationLabels[duration]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {membershipTypes.map((membershipType) => (
                      <tr key={membershipType}>
                        <th className="border-b border-zinc-100 p-3 text-left font-black">{typeLabels[membershipType]} <span className="sr-only">{membershipType}</span></th>
                        {durations.map((duration) => {
                          const key = matrixKey(membershipType, duration);
                          const cents = inputToCents(priceInputs[key] || "") || 0;
                          return (
                            <td key={duration} className="border-b border-zinc-100 p-2">
                              <label className="block" data-price-cell={`${membershipType}-${duration}`}>
                                <span className="mb-2 flex items-center gap-2 text-xs font-black text-zinc-800">
                                  <input type="checkbox" aria-label={`${typeLabels[membershipType]} ${durationLabels[duration]} Active`} checked={priceAvailability[key] !== false} onChange={(event) => setPriceAvailability((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-orange-600" />
                                  {priceAvailability[key] === false ? "Inactive" : "Active"}
                                </span>
                                <span className="sr-only">{membershipType} {duration}</span>
                                <input
                                  inputMode="decimal"
                                  value={priceInputs[key] || ""}
                                  onChange={(event) => setPriceInputs((current) => ({ ...current, [key]: event.target.value }))}
                                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-bold outline-none focus:border-orange-400"
                                />
                                <span className="mt-1 block text-[11px] font-bold text-zinc-400">{euroFormatter.format(cents / 100)}</span>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs font-semibold text-zinc-600">€0 is not an inactive switch. Untick Active to remove a duration from future choices; its saved price is retained. Published rates do not change earlier application or payment snapshots.</p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={saving} onClick={() => void savePriceDraft()} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black disabled:opacity-50">Save Price Draft</button>
                <button type="button" disabled={saving || !latestDraftCatalog} onClick={() => void publishPrices()} className="rounded-xl bg-[#ff5a0a] px-4 py-3 text-sm font-black text-white disabled:opacity-40">Publish Prices</button>
              </div>
            </section>

            <section id="discount-editor" className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle title="Discount Codes" copy="Create controlled percentage discounts. Successful use counts are incremented only by paid activation, never by this editor." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <label className="text-xs font-black text-zinc-600">Discount code
                  <input value={discountDraft.code} onChange={(event) => setDiscountDraft((current) => ({ ...current, code: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-bold text-zinc-950" placeholder="WELCOME10" />
                </label>
                <label className="text-xs font-black text-zinc-600">Percentage
                  <input inputMode="numeric" value={discountDraft.percentage} onChange={(event) => setDiscountDraft((current) => ({ ...current, percentage: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-bold text-zinc-950" placeholder="10" />
                </label>
                <label className="text-xs font-black text-zinc-600">Valid from
                  <input type="date" value={discountDraft.validFrom} onChange={(event) => setDiscountDraft((current) => ({ ...current, validFrom: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-bold text-zinc-950" />
                </label>
                <label className="text-xs font-black text-zinc-600">Valid until
                  <input type="date" value={discountDraft.validUntil} onChange={(event) => setDiscountDraft((current) => ({ ...current, validUntil: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-bold text-zinc-950" />
                </label>
                <label className="text-xs font-black text-zinc-600">Maximum successful uses
                  <input inputMode="numeric" value={discountDraft.maxUses} onChange={(event) => setDiscountDraft((current) => ({ ...current, maxUses: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-bold text-zinc-950" placeholder="Unlimited" />
                </label>
                <label className="flex items-center gap-2 self-end rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-black text-zinc-700">
                  <input type="checkbox" checked={discountDraft.active} onChange={(event) => setDiscountDraft((current) => ({ ...current, active: event.target.checked }))} /> Active
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {discountDraft.id && <button type="button" onClick={() => setDiscountDraft({ id: "", code: "", percentage: "", validFrom: "", validUntil: "", maxUses: "", active: true })} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-black">Cancel edit</button>}
                <button type="button" disabled={saving} onClick={() => void saveDiscountCode()} className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{discountDraft.id ? "Update Discount" : "Save Discount"}</button>
              </div>

              <div className="mt-5 grid gap-3">
                {settings.discountCodes.length === 0 ? (
                  <div className="rounded-2xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">No discount codes yet.</div>
                ) : settings.discountCodes.map((discount) => (
                  <div key={discount.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="font-black">{discount.code}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${discount.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{discount.active ? "ACTIVE" : "INACTIVE"}</span></div>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">{discount.percentage}% · {discount.successfulUses}{discount.maxUses ? ` / ${discount.maxUses}` : ""} successful uses · {discount.validFrom || "No start"} → {discount.validUntil || "No expiry"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => editDiscount(discount)} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black">Edit</button>
                      <button type="button" onClick={() => void setDiscountActive(discount, !discount.active)} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black">{discount.active ? "Deactivate" : "Activate"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="rules-declarations" className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle title="Rules & Declarations" copy="Published wording is immutable. Editing always creates a new draft/version, preserving the exact historical wording already accepted by members." />
              <MembershipPrintOverflowPreview
                declarationBodies={declarationBodies}
                onResult={handlePrintMeasurement}
              />
              {printOverflow && (
                <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800">
                  <p>This wording will overflow the one-page A4 membership form</p>
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    Shorten the Rules / Declaration wording before publishing. Current measured height: {Math.ceil(printMeasurement?.measuredHeightPx || 0)}px; maximum: {Math.floor(printMeasurement?.maxHeightPx || 0)}px.
                  </p>
                  <button
                    type="button"
                    onClick={() => document.getElementById("rules-declarations")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="mt-3 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-800"
                  >
                    Return to editing
                  </button>
                </div>
              )}
              <div className="mt-5 grid gap-5">
                {declarationKeys.map((contentKey) => {
                  const versions = settings.declarations.filter((item) => item.contentKey === contentKey);
                  const published = versions.find((item) => item.status === "published");
                  const draft = versions.find((item) => item.status === "draft");
                  return (
                    <div key={contentKey} className="rounded-2xl border border-zinc-200 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{declarationLabels[contentKey]} <span className="sr-only">{contentKey}</span></h3>
                          <p className="mt-1 text-xs font-semibold text-zinc-500">Published: {published ? `v${published.versionNo} · ${formatDate(published.publishedAt)}` : "None"}{draft ? ` · Draft v${draft.versionNo}` : ""}</p>
                        </div>
                        {published && <div className="max-w-md text-right text-[10px] font-bold text-zinc-400">SHA: {published.contentSha256}</div>}
                      </div>
                      <textarea value={declarationBodies[contentKey]} onChange={(event) => setDeclarationBodies((current) => ({ ...current, [contentKey]: event.target.value }))} className="mt-4 min-h-40 w-full rounded-2xl border border-zinc-200 p-4 text-sm leading-6 outline-none focus:border-orange-400" placeholder={`Enter ${declarationLabels[contentKey]} wording`} />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-zinc-400">{published ? `Published at ${published.publishedAt || "—"} · contentSha256 ${published.contentSha256}` : "No published version yet."}</div>
                        <div className="flex gap-2">
                          <button type="button" disabled={saving} onClick={() => void saveDeclarationDraft(contentKey)} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black disabled:opacity-50">Save Draft</button>
                          <button type="button" disabled={saving || !draft || printOverflow} onClick={() => void publishDeclaration(contentKey)} className="rounded-xl bg-[#ff5a0a] px-3 py-2 text-xs font-black text-white disabled:opacity-40">Publish Declaration</button>
                        </div>
                      </div>
                      {versions.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {versions.map((version) => <span key={version.id} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-black text-zinc-600">v{version.versionNo} · {version.status}</span>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
