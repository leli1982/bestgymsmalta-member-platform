import type { AppMember } from "./memberSession";

export type MemberCardState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "unavailable"; message: string }
  | {
      kind: "ready";
      member: AppMember;
      cardLinked: boolean;
      cardBarcode: string;
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
    typeof data.cardBarcode !== "string" ||
    !data.cardBarcode
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
    cardBarcode: data.cardBarcode,
    physicalCardBarcode:
      typeof data.physicalCardBarcode === "string"
        ? data.physicalCardBarcode
        : "",
  };
}
