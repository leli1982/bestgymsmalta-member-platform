import type { NfcAccessResult } from "@/lib/nfcAccessCore";

export type NfcReceptionPresentation = {
  title: string;
  tone: "success" | "warning";
  severity: "success" | "danger";
  autoResetMs: number | null;
};

export function nfcReceptionPresentation(
  result: NfcAccessResult,
  accessGymName?: string | null,
): NfcReceptionPresentation {
  if (result === "granted") {
    return {
      title: "ACTIVE",
      tone: "success",
      severity: "success",
      autoResetMs: 4500,
    };
  }

  const restrictedTitle = accessGymName?.trim()
    ? `${accessGymName.trim().toUpperCase()} ACCESS ONLY`
    : "SINGLE GYM ACCESS ONLY";
  const titleMap: Record<Exclude<NfcAccessResult, "granted">, string> = {
    expired: "EXPIRED",
    inactive: "INACTIVE",
    restricted_gym: restrictedTitle,
    unknown_card: "UNKNOWN CARD",
    disabled_card: "CARD DISABLED",
  };

  return {
    title: titleMap[result],
    tone: "warning",
    severity: "danger",
    autoResetMs: null,
  };
}
