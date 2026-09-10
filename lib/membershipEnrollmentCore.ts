export type MembershipEnrollmentKind = "new" | "renewal";

export function buildEnrollmentIdentityAction(input: {
  kind: string;
  existingMemberId?: string | null;
}) {
  const kind = String(input.kind || "").trim().toLowerCase();
  const existingMemberId = String(input.existingMemberId || "").trim();

  if (kind === "new") {
    return { kind: "create_person" } as const;
  }

  if (kind === "renewal") {
    if (!existingMemberId) {
      throw new Error("Renewal requires an existing member.");
    }

    return { kind: "reuse_person", memberId: existingMemberId } as const;
  }

  throw new Error("Enrollment kind must be new or renewal.");
}

export function requireStaffName(value: unknown, label = "Staff Name") {
  const staffName = String(value ?? "").trim();
  if (!staffName) {
    throw new Error(`${label} is required.`);
  }
  return staffName;
}
