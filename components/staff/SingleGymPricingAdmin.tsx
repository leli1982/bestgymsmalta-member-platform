"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MembershipType = "single" | "student" | "couples";
type DurationKey = "1_session" | "1_week" | "2_weeks" | "1_month" | "3_months" | "6_months" | "1_year";

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
  accessScope: "network" | "single_gym";
  gymId: string | null;
  publishedAt: string | null;
  entries: PriceEntry[];
};

type Gym = {
  id: string;
  name: string;
  status: string;
  singleGymPricingEnabled: boolean;
};

type SettingsPayload = {
  priceCatalogs: PriceCatalog[];
  gyms: Gym[];
};

const membershipTypes: readonly MembershipType[] = ["single", "student", "couples"];
const durations: readonly DurationKey[] = [
  "1_session",
  "1_week",
  "2_weeks",
  "1_month",
  "3_months",
  "6_months",
  "1_year",
];

const typeLabels: Record<MembershipType, string> = {
  single: "Regular",
  student: "Student",
  couples: "Couples",
};

const durationLabels: Record<DurationKey, string> = {
  "1_session": "1 session",
  "1_week": "1 week",
  "2_weeks": "2 weeks",
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
};

function key(type: MembershipType, duration: DurationKey) {
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

export default function SingleGymPricingAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<SettingsPayload>({ priceCatalogs: [], gyms: [] });
  const [selectedGymId, setSelectedGymId] = useState("");
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  const selectedGym = settings.gyms.find((gym) => gym.id === selectedGymId) || null;
  const scopedCatalogs = useMemo(
    () => settings.priceCatalogs.filter(
      (catalog) => catalog.accessScope === "single_gym" && catalog.gymId === selectedGymId
    ),
    [settings.priceCatalogs, selectedGymId]
  );
  const published = scopedCatalogs.find((catalog) => catalog.status === "published") || null;
  const draft = scopedCatalogs.find(
    (catalog) => catalog.status === "draft" && (!published || catalog.versionNo > published.versionNo)
  ) || null;
  const editorSource = draft || published;

  const seedMatrix = useCallback((source: PriceCatalog | null) => {
    const nextPrices: Record<string, string> = {};
    const nextAvailability: Record<string, boolean> = {};
    for (const membershipType of membershipTypes) {
      for (const durationKey of durations) {
        const entry = source?.entries.find(
          (candidate) => candidate.membershipType === membershipType && candidate.durationKey === durationKey
        );
        nextPrices[key(membershipType, durationKey)] = entry ? centsToInput(entry.amountCents) : "0.00";
        nextAvailability[key(membershipType, durationKey)] = entry ? entry.isActive !== false : false;
      }
    }
    setPriceInputs(nextPrices);
    setAvailability(nextAvailability);
  }, []);

  const load = useCallback(async (preferredGymId?: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/membership-settings", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load Individual Gym Pricing.");
      const typed = payload as SettingsPayload;
      setSettings(typed);
      const nextGymId = preferredGymId || selectedGymId ||
        typed.gyms.find((gym) => gym.singleGymPricingEnabled)?.id ||
        typed.gyms[0]?.id || "";
      setSelectedGymId(nextGymId);
      const scoped = typed.priceCatalogs.filter(
        (catalog) => catalog.accessScope === "single_gym" && catalog.gymId === nextGymId
      );
      const scopedPublished = scoped.find((catalog) => catalog.status === "published") || null;
      const scopedDraft = scoped.find(
        (catalog) => catalog.status === "draft" &&
          (!scopedPublished || catalog.versionNo > scopedPublished.versionNo)
      ) || null;
      seedMatrix(scopedDraft || scopedPublished);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Individual Gym Pricing.");
    } finally {
      setLoading(false);
    }
  }, [seedMatrix, selectedGymId]);

  useEffect(() => {
    void load();
    // Initial load only; gym changes seed locally below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectGym(gymId: string) {
    setSelectedGymId(gymId);
    setError("");
    setMessage("");
    const scoped = settings.priceCatalogs.filter(
      (catalog) => catalog.accessScope === "single_gym" && catalog.gymId === gymId
    );
    const nextPublished = scoped.find((catalog) => catalog.status === "published") || null;
    const nextDraft = scoped.find(
      (catalog) => catalog.status === "draft" &&
        (!nextPublished || catalog.versionNo > nextPublished.versionNo)
    ) || null;
    seedMatrix(nextDraft || nextPublished);
  }

  async function post(body: Record<string, unknown>) {
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
      if (!response.ok) throw new Error(payload.error || "Could not save Individual Gym Pricing.");
      await load(selectedGymId);
      return payload;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save Individual Gym Pricing.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(enabled: boolean) {
    if (!selectedGym) return;
    const result = await post({
      action: "set_single_gym_pricing_enabled",
      gymId: selectedGym.id,
      enabled,
    });
    if (result) {
      setMessage(`${selectedGym.name} Single Gym Pricing is now ${enabled ? "enabled" : "disabled"}.`);
    }
  }

  async function saveDraft() {
    if (!selectedGym) return;
    const entries: PriceEntry[] = [];
    for (const membershipType of membershipTypes) {
      for (const durationKey of durations) {
        const amountCents = inputToCents(priceInputs[key(membershipType, durationKey)] || "");
        if (amountCents === null) {
          setError(`Enter a valid price for ${typeLabels[membershipType]} / ${durationLabels[durationKey]}.`);
          return;
        }
        const isActive = availability[key(membershipType, durationKey)] === true;
        if (isActive && amountCents <= 0) {
          setError(`Set a positive price or untick Active for ${typeLabels[membershipType]} / ${durationLabels[durationKey]}.`);
          return;
        }
        entries.push({ membershipType, durationKey, amountCents, currency: "EUR", isActive });
      }
    }
    const result = await post({
      action: "save_price_draft",
      accessScope: "single_gym",
      gymId: selectedGym.id,
      entries,
    });
    if (result) setMessage(`${selectedGym.name} price draft saved. It is not live until published.`);
  }

  async function publishDraft() {
    if (!selectedGym || !draft) return;
    const result = await post({
      action: "publish_price_catalog",
      catalogVersionId: draft.id,
    });
    if (result) setMessage(`${selectedGym.name} Single Gym prices published.`);
  }

  return (
    <section className="bgm-admin-light bg-[#f6f6f6] px-4 pb-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Membership Settings</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Individual Gym Pricing</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Give a gym its own Single Gym membership price list. These prices are completely separate from All Access and are only offered at that gym.
            </p>
          </div>
          {selectedGym && (
            <span className={`rounded-full px-3 py-1 text-xs font-black ${selectedGym.singleGymPricingEnabled ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"}`}>
              {selectedGym.singleGymPricingEnabled ? "ENABLED" : "DISABLED"}
            </span>
          )}
        </div>

        {loading ? (
          <p className="mt-6 text-sm font-bold text-zinc-500">Loading Individual Gym Pricing…</p>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-[minmax(220px,1fr)_auto] md:items-end">
              <label className="text-sm font-black">
                Gym
                <select
                  value={selectedGymId}
                  onChange={(event) => selectGym(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-bold"
                >
                  {settings.gyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>{gym.name}</option>
                  ))}
                </select>
              </label>
              {selectedGym && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void setEnabled(!selectedGym.singleGymPricingEnabled)}
                  className={`rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50 ${selectedGym.singleGymPricingEnabled ? "bg-zinc-700" : "bg-green-700"}`}
                >
                  {selectedGym.singleGymPricingEnabled ? "Disable Single Gym Pricing" : "Enable Single Gym Pricing"}
                </button>
              )}
            </div>

            {selectedGym && !selectedGym.singleGymPricingEnabled ? (
              <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                Single Gym is hidden from Staff, Tablet enrollment and renewals for <strong>{selectedGym.name}</strong>. Existing historical price versions are preserved.
              </div>
            ) : selectedGym ? (
              <>
                <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-zinc-600">
                  <span className="rounded-full bg-zinc-100 px-3 py-1">Published: {published ? `v${published.versionNo}` : "None"}</span>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-800">Draft: {draft ? `v${draft.versionNo}` : "None"}</span>
                </div>

                <div className="mt-5 space-y-5">
                  {membershipTypes.map((membershipType) => (
                    <div key={membershipType} className="rounded-2xl border border-zinc-200 p-4">
                      <h3 className="text-lg font-black">{typeLabels[membershipType]}</h3>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {durations.map((durationKey) => {
                          const matrixKey = key(membershipType, durationKey);
                          const active = availability[matrixKey] === true;
                          return (
                            <div key={durationKey} className={`rounded-xl border p-3 ${active ? "border-orange-200 bg-orange-50/40" : "border-zinc-200 bg-zinc-50"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black">{durationLabels[durationKey]}</span>
                                <label className="flex items-center gap-1 text-xs font-bold text-zinc-600">
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={(event) => setAvailability((current) => ({ ...current, [matrixKey]: event.target.checked }))}
                                  />
                                  Active
                                </label>
                              </div>
                              <label className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2">
                                <span className="font-black">€</span>
                                <input
                                  inputMode="decimal"
                                  value={priceInputs[matrixKey] || "0.00"}
                                  onChange={(event) => setPriceInputs((current) => ({ ...current, [matrixKey]: event.target.value }))}
                                  className="min-w-0 flex-1 bg-transparent text-right font-black outline-none"
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" disabled={saving} onClick={() => void saveDraft()} className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                    Save Draft
                  </button>
                  <button type="button" disabled={saving || !draft} onClick={() => void publishDraft()} className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40">
                    Publish {selectedGym.name} Prices
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {message && <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">{message}</div>}
      </div>
    </section>
  );
}
