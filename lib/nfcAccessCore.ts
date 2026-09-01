export type NfcAccessResult =
  | "granted"
  | "expired"
  | "inactive"
  | "unknown_card"
  | "disabled_card";

type NfcCardState = {
  status?: string | null;
};

type NfcMemberState = {
  status?: string | null;
  membershipExpiry?: string | null;
};

export function evaluateNfcAccess({
  card,
  member,
  today,
}: {
  card: NfcCardState | null;
  member: NfcMemberState | null;
  today: string;
}): { result: NfcAccessResult; granted: boolean } {
  if (!card) {
    return { result: "unknown_card", granted: false };
  }

  if (card.status !== "active") {
    return { result: "disabled_card", granted: false };
  }

  if (!member || member.status !== "active") {
    return { result: "inactive", granted: false };
  }

  if (member.membershipExpiry && member.membershipExpiry < today) {
    return { result: "expired", granted: false };
  }

  return { result: "granted", granted: true };
}
