export type LegacyPkCustomerMember = {
  id: string;
  member_number: string | null;
  full_name: string | null;
  status: string | null;
  membership_expiry: string | null;
};

export type LegacyPkCustomerResolution =
  | {
      kind: "none";
      member: null;
      matches: LegacyPkCustomerMember[];
      liveMatches: LegacyPkCustomerMember[];
    }
  | {
      kind: "resolved";
      member: LegacyPkCustomerMember;
      matches: LegacyPkCustomerMember[];
      liveMatches: LegacyPkCustomerMember[];
    }
  | {
      kind: "ambiguous";
      member: null;
      matches: LegacyPkCustomerMember[];
      liveMatches: LegacyPkCustomerMember[];
    }
  | {
      kind: "inactive_duplicates";
      member: null;
      matches: LegacyPkCustomerMember[];
      liveMatches: LegacyPkCustomerMember[];
    };

function isLiveMember(member: LegacyPkCustomerMember, today: string) {
  if (member.status !== "active") return false;
  if (member.membership_expiry && member.membership_expiry < today) return false;
  return true;
}

export function resolveLegacyPkCustomerCandidates(
  matches: LegacyPkCustomerMember[],
  today: string
): LegacyPkCustomerResolution {
  if (matches.length === 0) {
    return { kind: "none", member: null, matches, liveMatches: [] };
  }

  if (matches.length === 1) {
    return { kind: "resolved", member: matches[0], matches, liveMatches: [] };
  }

  const liveMatches = matches.filter((candidate) =>
    isLiveMember(candidate, today)
  );

  if (liveMatches.length === 1) {
    return {
      kind: "resolved",
      member: liveMatches[0],
      matches,
      liveMatches,
    };
  }

  if (liveMatches.length > 1) {
    return {
      kind: "ambiguous",
      member: null,
      matches,
      liveMatches,
    };
  }

  return {
    kind: "inactive_duplicates",
    member: null,
    matches,
    liveMatches,
  };
}
