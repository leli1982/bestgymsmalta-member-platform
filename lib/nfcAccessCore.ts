export type NfcAccessResult =
  | "granted"
  | "expired"
  | "inactive"
  | "restricted_gym"
  | "unknown_card"
  | "disabled_card";

type NfcCardState = {
  status?: string | null;
};

type NfcMemberState = {
  status?: string | null;
  membershipExpiry?: string | null;
  cancellationEffectiveDate?: string | null;
  accessScope?: string | null;
};

const NEPTUNES_GYM_ID = "bgm-neptunes";

export function evaluateNfcAccess({
  card,
  member,
  today,
  gymId,
}: {
  card: NfcCardState | null;
  member: NfcMemberState | null;
  today: string;
  gymId?: string | null;
}): { result: NfcAccessResult; granted: boolean } {
  if (!card) {
    return { result: "unknown_card", granted: false };
  }

  if (card.status !== "active") {
    return { result: "disabled_card", granted: false };
  }

  if (!member || member.status !== "active" ||
    (member.cancellationEffectiveDate && member.cancellationEffectiveDate <= today)) {
    return { result: "inactive", granted: false };
  }

  if (member.membershipExpiry && member.membershipExpiry < today) {
    return { result: "expired", granted: false };
  }

  if (
    member.accessScope === "neptunes_only" &&
    gymId &&
    gymId !== NEPTUNES_GYM_ID
  ) {
    return { result: "restricted_gym", granted: false };
  }

  return { result: "granted", granted: true };
}
