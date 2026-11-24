/**
 * Exception-only recovery list derived from the 32 CURRENT, VALID, cardless
 * BestGymsMalta members in the 24 November 2026 reconciliation.
 *
 * This is deliberately NOT a general card linking feature.
 * Rows with no verified source Scan3 have no scan-trigger candidate.
 * Any new card/other member requires the existing Super Admin workflow.
 */
export const SCOPED_CARD_CONFLICT_MEMBERS = [
  "BGM1000","BGM1001","BGM1002","BGM1003","BGM26507","BGM26565",
  "BGM26585","BGM26592","BGM26619","BGM26632","BGM26654",
  "BGM26729","BGM26734","BGM26830","BGM26832","BGM26836",
  "BGM26847","BGM26848","BGM26850","BGM26851","BGM26854",
  "BGM26855","BGM26953","BGM26970","BGM26972","BGM27010",
  "BGM27011","BGM27088","BGM27092","BGM27462","BGM27564",
  "BGM27591",
] as const;

const memberSourceCards: Record<string, readonly string[]> = {
  BGM1002: ["X06842"], BGM1003: ["X03249"],
  BGM26565: ["X09972"], BGM26585: ["X08638"],
  BGM26592: ["X10013"], BGM26619: ["3369"], BGM26632: ["X08638"],
  BGM26654: ["4458"], BGM26729: ["X06264"], BGM26734: ["X01929"],
  BGM26830: ["K2140","X02500","X03887"], BGM26832: ["X03887"],
  BGM26836: ["X03908","X08688"],
  BGM26847: ["X07993"], BGM26848: ["X07993"],
  BGM26850: ["X07977"], BGM26851: ["X07977"],
  BGM26854: ["X07876","X07974"], BGM26855: ["X07876","X07974"],
  BGM26953: ["X06493"], BGM26970: ["X06796"], BGM26972: ["X06796"],
  BGM27010: ["X08173"], BGM27011: ["X08173"],
  BGM27088: ["X09089"], BGM27092: ["X09089"],
  BGM27462: ["X08562"], BGM27564: ["X03288","X03504"],
  BGM27591: ["X03439","Z378"],
};

const allowed = new Set<string>(SCOPED_CARD_CONFLICT_MEMBERS);
export function isScopedConflictMember(memberNumber: string) {
  return allowed.has(memberNumber);
}
export function scopedConflictCandidates(scannedCode: string): string[] {
  const code = scannedCode.trim().toUpperCase();
  if (!code) return [];
  return Object.entries(memberSourceCards)
    .filter(([memberNumber, cards]) => allowed.has(memberNumber) && cards.includes(code))
    .map(([memberNumber]) => memberNumber);
}
export function isScopedConflictPair(memberNumber: string, scannedCode: string) {
  return isScopedConflictMember(memberNumber) &&
    scopedConflictCandidates(scannedCode).includes(memberNumber);
}
