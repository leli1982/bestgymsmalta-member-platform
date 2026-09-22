import type { AppMember } from "./memberSession";

export type MemberCardState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "unavailable"; message: string }
  | {
      kind: "ready";
      member: AppMember;
      cardLinked: boolean;
      cardBarcode: string | null;
      physicalCardBarcode: string;
    };

type CardPayload = {
  member?: AppMember;
  cardLinked?: boolean;
  cardBarcode?: string | null;
  physicalCardBarcode?: string | null;
};

export function resolveMemberCardResponse(
  status: number,
  data: CardPayload | null
): MemberCardState {
  if (status === 401 || status === 404) return { kind: "signed-out" };
  if (
    status !== 200 ||
    !data?.member?.id ||
    typeof data.cardLinked !== "boolean" ||
    (data.cardLinked && (
      typeof data.cardBarcode !== "string" ||
      !data.cardBarcode.trim() ||
      data.cardBarcode !== data.physicalCardBarcode
    )) ||
    (!data.cardLinked && Boolean(data.cardBarcode))
  ) {
    return {
      kind: "unavailable",
      message: "Your card could not be loaded. Please try again.",
    };
  }

  return {
    kind: "ready",
    member: data.member,
    cardLinked: data.cardLinked,
    cardBarcode: data.cardLinked ? data.cardBarcode || null : null,
    physicalCardBarcode:
      typeof data.physicalCardBarcode === "string"
        ? data.physicalCardBarcode
        : "",
  };
}
