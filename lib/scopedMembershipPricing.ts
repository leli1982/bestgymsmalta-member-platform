import { validatePriceMatrix, type MembershipDurationKey, type MembershipType } from "@/lib/membershipSettingsCore";

export type EnrollmentAccessScope = "network" | "single_gym";

export type EnrollmentPriceEntry = {
  membershipType: MembershipType;
  durationKey: MembershipDurationKey;
  amountCents: number;
  currency: "EUR";
  isActive: boolean;
};

export type EnrollmentPriceCatalog = {
  versionId: string;
  entries: EnrollmentPriceEntry[];
};

type SupabaseLike = {
  from: (table: string) => any;
};

export function normalizeEnrollmentAccessScope(value: unknown): EnrollmentAccessScope | null {
  if (value === undefined || value === null || value === "") return "network";
  if (value === "network" || value === "single_gym") return value;
  return null;
}

export async function loadPublishedEnrollmentPriceCatalog(
  supabase: SupabaseLike,
  accessScope: EnrollmentAccessScope,
  gymId: string | null,
): Promise<EnrollmentPriceCatalog | null> {
  let catalogQuery = supabase
    .from("bgm_membership_price_catalog_versions")
    .select("id,version_no,status,access_scope,gym_id")
    .eq("status", "published")
    .eq("access_scope", accessScope);

  if (accessScope === "network") {
    catalogQuery = catalogQuery.is("gym_id", null);
  } else {
    if (!gymId) return null;
    catalogQuery = catalogQuery.eq("gym_id", gymId);
  }

  const catalogResult = await catalogQuery
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (catalogResult.error) throw catalogResult.error;
  if (!catalogResult.data) return null;

  const priceResult = await supabase
    .from("bgm_membership_price_entries")
    .select("membership_type,duration_key,amount_cents,currency,is_active")
    .eq("catalog_version_id", catalogResult.data.id);
  if (priceResult.error) throw priceResult.error;

  const entries: EnrollmentPriceEntry[] = (priceResult.data || []).map((row: any) => ({
    membershipType: row.membership_type as MembershipType,
    durationKey: row.duration_key as MembershipDurationKey,
    amountCents: Number(row.amount_cents),
    currency: row.currency as "EUR",
    isActive: row.is_active !== false,
  }));

  const validation = validatePriceMatrix(entries);
  if (!validation.ok) return null;

  return {
    versionId: String(catalogResult.data.id),
    entries: entries.filter((entry) => entry.isActive !== false),
  };
}
