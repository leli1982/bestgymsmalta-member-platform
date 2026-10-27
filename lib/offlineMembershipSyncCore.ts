export type OfflineSyncIdentityState = "clear" | "active" | "expired_inactive";
export type OfflineSyncReviewReason =
  | "active_identity"
  | "possible_renewal"
  | "card_conflict"
  | "stale_config"
  | "verification_required";

export type OfflineSyncDecision =
  | { action: "activate" }
  | { action: "review_required"; reason: OfflineSyncReviewReason };

export type OfflineSyncFacts = {
  configVerified: boolean;
  identityStates: OfflineSyncIdentityState[];
  cardConflict: boolean;
  verificationComplete: boolean;
};

export function decideOfflineSyncOutcome(facts: OfflineSyncFacts): OfflineSyncDecision {
  if (!facts.configVerified) return { action: "review_required", reason: "stale_config" };
  if (facts.identityStates.some((state) => state === "active")) {
    return { action: "review_required", reason: "active_identity" };
  }
  if (facts.identityStates.some((state) => state === "expired_inactive")) {
    return { action: "review_required", reason: "possible_renewal" };
  }
  if (facts.cardConflict) return { action: "review_required", reason: "card_conflict" };
  if (!facts.verificationComplete) {
    return { action: "review_required", reason: "verification_required" };
  }
  return { action: "activate" };
}
