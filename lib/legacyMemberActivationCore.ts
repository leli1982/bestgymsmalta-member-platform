export type LegacyMemberCandidate = {
  id: string;
  member_number?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  mobile?: string | null;
  phone?: string | null;
  status?: string | null;
  app_enrolled?: boolean | null;
};

export type LegacyResolution =
  | { kind: "matched"; member: LegacyMemberCandidate; shouldUpdateEmail: boolean }
  | { kind: "needs_identity_check" }
  | { kind: "not_verified" };

export function normalizeLegacyEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeLegacyPhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00356")) digits = digits.slice(5);
  else if (digits.startsWith("356") && digits.length === 11) digits = digits.slice(3);
  return digits;
}

function phoneMatches(candidate: LegacyMemberCandidate, suppliedMobile: string) {
  const supplied = normalizeLegacyPhone(suppliedMobile);
  if (supplied.length < 8) return false;
  return [candidate.mobile, candidate.phone]
    .map(normalizeLegacyPhone)
    .some((stored) => stored.length >= 8 && stored === supplied);
}

export function resolveLegacyMemberCandidate(
  candidates: LegacyMemberCandidate[],
  input: { email: string; dateOfBirth?: string; mobile?: string }
): LegacyResolution {
  const email = normalizeLegacyEmail(input.email);
  if (!email) return { kind: "not_verified" };

  const storedEmailMatches = candidates.filter(
    (candidate) => normalizeLegacyEmail(candidate.email) === email
  );

  if (storedEmailMatches.length === 1) {
    return { kind: "matched", member: storedEmailMatches[0], shouldUpdateEmail: false };
  }
  if (storedEmailMatches.length > 1) return { kind: "not_verified" };

  const blankEmailCandidates = candidates.filter(
    (candidate) => !normalizeLegacyEmail(candidate.email)
  );
  if (blankEmailCandidates.length === 0) return { kind: "not_verified" };

  const dateOfBirth = String(input.dateOfBirth || "").trim();
  const mobile = String(input.mobile || "").trim();
  if (!dateOfBirth || !mobile) return { kind: "needs_identity_check" };

  const verified = blankEmailCandidates.filter(
    (candidate) =>
      String(candidate.date_of_birth || "") === dateOfBirth &&
      phoneMatches(candidate, mobile)
  );

  if (verified.length !== 1) return { kind: "not_verified" };
  return { kind: "matched", member: verified[0], shouldUpdateEmail: true };
}
