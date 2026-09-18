import { normalizeSystemUsername } from "./systemPermissions.ts";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function latinizeMaltese(value: string) {
  return value
    .replace(/[ċĊ]/g, "c")
    .replace(/[ġĠ]/g, "g")
    .replace(/[ħĦ]/g, "h")
    .replace(/[żŻ]/g, "z");
}

export function normalizeGymRouteSlug(value: string) {
  const withoutGenericSuffix = clean(value)
    .replace(/\bfitness\b\s*$/i, "")
    .replace(/\bgym\b\s*$/i, "")
    .trim();

  return latinizeMaltese(withoutGenericSuffix)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildGymProvisioningIdentity({
  name,
  shortName,
}: {
  name: string;
  shortName?: string;
}) {
  const fullName = clean(name);
  const preferredName = clean(shortName) || fullName;
  const routeSlug = normalizeGymRouteSlug(preferredName);

  if (!fullName || !routeSlug) {
    throw new Error("A valid gym name is required.");
  }

  const staffUsername = normalizeSystemUsername(`${routeSlug}fitness`);
  const staffLabel = clean(shortName) || fullName.replace(/\s+Fitness\s*$/i, "").trim() || fullName;

  return {
    gymId: `bgm-${routeSlug}`,
    routeSlug,
    joinPath: `/join/${routeSlug}`,
    staffPath: `/staff/${routeSlug}`,
    staffUsername,
    staffDisplayName: `${staffLabel} Staff`,
  };
}
