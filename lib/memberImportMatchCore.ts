export type MemberImportAction =
  | "new"
  | "update"
  | "unchanged"
  | "conflict"
  | "invalid";

export type IncomingMemberForMatch = {
  membershipNumber?: string | null;
  gym?: string | null;
  pkCustomer?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  address1?: string | null;
  address2?: string | null;
  town?: string | null;
  postcode?: string | null;
  gender?: string | null;
  telephoneNo1?: string | null;
  telephoneNo2?: string | null;
  mobile?: string | null;
  email?: string | null;
  expiryDate?: string | null;
  status?: string | null;
};

export type ExistingMemberForMatch = {
  id: string;
  memberNumber?: string | null;
  legacyGym?: string | null;
  legacyPkCustomer?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  address1?: string | null;
  address2?: string | null;
  town?: string | null;
  postcode?: string | null;
  gender?: string | null;
  telephoneNo1?: string | null;
  telephoneNo2?: string | null;
  mobile?: string | null;
  email?: string | null;
  membershipExpiry?: string | null;
  status?: string | null;
};

export type MemberImportClassification = {
  action: MemberImportAction;
  matchedMemberId: string | null;
  issue: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedText(value: unknown) {
  return clean(value).replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function normalizedEmail(value: unknown) {
  return clean(value).toLocaleLowerCase("en");
}

function incomingName(incoming: IncomingMemberForMatch) {
  return clean(incoming.customerName) || clean(incoming.companyName);
}

function sameValue(left: unknown, right: unknown) {
  return normalizedText(left) === normalizedText(right);
}

function materiallyContradicts(
  incoming: IncomingMemberForMatch,
  existing: ExistingMemberForMatch
) {
  let contradictions = 0;

  const incomingNameValue = incomingName(incoming);
  if (
    incomingNameValue &&
    clean(existing.fullName) &&
    !sameValue(incomingNameValue, existing.fullName)
  ) {
    contradictions += 1;
  }

  const incomingEmail = normalizedEmail(incoming.email);
  const existingEmail = normalizedEmail(existing.email);
  if (incomingEmail && existingEmail && incomingEmail !== existingEmail) {
    contradictions += 1;
  }

  const incomingGym = normalizedText(incoming.gym);
  const incomingPk = normalizedText(incoming.pkCustomer);
  const existingGym = normalizedText(existing.legacyGym);
  const existingPk = normalizedText(existing.legacyPkCustomer);
  if (
    incomingGym &&
    incomingPk &&
    existingGym &&
    existingPk &&
    (incomingGym !== existingGym || incomingPk !== existingPk)
  ) {
    contradictions += 1;
  }

  return contradictions >= 2;
}

function hasCompleteComparison(incoming: IncomingMemberForMatch) {
  return (
    incoming.customerName !== undefined &&
    incoming.companyName !== undefined &&
    incoming.gym !== undefined &&
    incoming.pkCustomer !== undefined &&
    incoming.address1 !== undefined &&
    incoming.address2 !== undefined &&
    incoming.town !== undefined &&
    incoming.postcode !== undefined &&
    incoming.gender !== undefined &&
    incoming.telephoneNo1 !== undefined &&
    incoming.telephoneNo2 !== undefined &&
    incoming.mobile !== undefined &&
    incoming.email !== undefined &&
    incoming.expiryDate !== undefined &&
    incoming.status !== undefined
  );
}

function allImportedValuesMatch(
  incoming: IncomingMemberForMatch,
  existing: ExistingMemberForMatch
) {
  if (!hasCompleteComparison(incoming)) return false;

  const pairs: Array<[unknown, unknown]> = [
    [incomingName(incoming), existing.fullName],
    [incoming.companyName, existing.companyName],
    [incoming.gym, existing.legacyGym],
    [incoming.pkCustomer, existing.legacyPkCustomer],
    [incoming.address1, existing.address1],
    [incoming.address2, existing.address2],
    [incoming.town, existing.town],
    [incoming.postcode, existing.postcode],
    [incoming.gender, existing.gender],
    [incoming.telephoneNo1, existing.telephoneNo1],
    [incoming.telephoneNo2, existing.telephoneNo2],
    [incoming.mobile, existing.mobile],
    [incoming.email, existing.email],
    [incoming.expiryDate, existing.membershipExpiry],
    [incoming.status, existing.status],
  ];

  return pairs.every(([left, right]) => sameValue(left, right));
}

function classifyMatched(
  incoming: IncomingMemberForMatch,
  existing: ExistingMemberForMatch
): MemberImportClassification {
  if (materiallyContradicts(incoming, existing)) {
    return {
      action: "conflict",
      matchedMemberId: existing.id,
      issue:
        "The incoming identity details materially conflict with the existing member. Review before importing.",
    };
  }

  return {
    action: allImportedValuesMatch(incoming, existing) ? "unchanged" : "update",
    matchedMemberId: existing.id,
    issue: "",
  };
}

function chooseLegacyCandidate(
  incoming: IncomingMemberForMatch,
  candidates: ExistingMemberForMatch[]
) {
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return null;

  const wantedEmail = normalizedEmail(incoming.email);
  const wantedName = normalizedText(incomingName(incoming));

  const scored = candidates.map((candidate) => {
    let score = 0;
    if (
      wantedEmail &&
      normalizedEmail(candidate.email) &&
      wantedEmail === normalizedEmail(candidate.email)
    ) {
      score += 2;
    }
    if (
      wantedName &&
      normalizedText(candidate.fullName) &&
      wantedName === normalizedText(candidate.fullName)
    ) {
      score += 1;
    }
    return { candidate, score };
  });

  const bestScore = Math.max(...scored.map((entry) => entry.score));
  if (bestScore === 0) return undefined;

  const best = scored.filter((entry) => entry.score === bestScore);
  return best.length === 1 ? best[0].candidate : undefined;
}

export function classifyMemberImportRow({
  incoming,
  byMembershipNumber,
  legacyCandidates,
}: {
  incoming: IncomingMemberForMatch;
  byMembershipNumber: ExistingMemberForMatch[];
  legacyCandidates: ExistingMemberForMatch[];
}): MemberImportClassification {
  if (!incomingName(incoming)) {
    return {
      action: "invalid",
      matchedMemberId: null,
      issue: "CustomerName and CompanyName are both blank.",
    };
  }

  const membershipNumber = clean(incoming.membershipNumber).toUpperCase();
  if (membershipNumber) {
    if (byMembershipNumber.length > 1) {
      return {
        action: "conflict",
        matchedMemberId: null,
        issue: "More than one existing member matched the permanent membership number.",
      };
    }

    if (byMembershipNumber.length === 1) {
      return classifyMatched(incoming, byMembershipNumber[0]);
    }

    return { action: "new", matchedMemberId: null, issue: "" };
  }

  if (legacyCandidates.length === 0) {
    return { action: "new", matchedMemberId: null, issue: "" };
  }

  const candidate = chooseLegacyCandidate(incoming, legacyCandidates);
  if (candidate === undefined) {
    return {
      action: "conflict",
      matchedMemberId: null,
      issue:
        "The legacy gym and pkCustomer reference matches multiple members and the supporting details do not identify exactly one person.",
    };
  }

  if (!candidate) {
    return { action: "new", matchedMemberId: null, issue: "" };
  }

  return classifyMatched(incoming, candidate);
}
