/**
 * Snapshot of duplicate legacy pkCustomer values in the user-reviewed
 * ValidCustomersBGM EDIT(2).xlsx (23 Nov 2026).
 *
 * Only NON-PERSONAL source keys and counts belong in Git.
 * Source names, identities and contact details must never be committed.
 *
 * A repeated pkCustomer is NOT proof that two people are duplicates:
 * old numbers can have been reused. Physical Scan3 safety remains separate.
 */
export const SOURCE_DUPLICATE_SNAPSHOT = "ValidCustomersBGM EDIT(2).xlsx — 2026-11-23";

const sourceKeys = ["1119","1148","1188","122","129","130","1302","1387","1388","141","1411","1422","1427","150","152","1527","1595","1741","1777","1805","1830","1850","1867","196","2","2010","2023","2065","2142","2194","2242","2447","2524","2529","258","2590","2662","272","2935","3000","308","3267","3341","3388","3464","348","3546","355","3554","3618","3755","3811","3850","4033","4041","4130","4165","4407","4410","4493","481","489","4941","500","5003","5054","5055","5420","552","5828","5830","5922","60","6033","612","63","662","665","680","703","71","7117","717","8","857","b11240","b12154","b8073","b8279","b8323","k1000","k105","k1100","k112","k1210","k1257","k1425","k1426","k194","k20","k2045","k2061","k2140","k2164","k2257","k2276","k2279","k2282","k2285","k2294","k2307","k282","k339","k353","k367","k371","k378","k388","k47","k486","k571","k578","k61","k610","k755","k83","k847","k88","m2428","m3150","m3238","m34","m565","m86","n1060","n1255","n936","p1943","p2315","p2812","p2831","p3008","p827","s1698","s1869","s1987","s2082","s2149","s22","s2326","s2372","s2394","s2431","s2512","s2762","s2853","s2874","s2875","s29","s2945","s3000","s3024","s304","s3069","s58","s609","s666","s711","s904","t1007","t1171","t1218","t1248","t1259","t1421","t458","t996","z347"];
const samePersonCandidates = new Set(["1388","1741","1867","2524","3341","3554","3850","4041","4165","4407","5420","5830","7117","b8073","k2061","k2294","k2307","k578","m2428","m3150","m565","s1869","s2082","s2853","s2874","s3000","t1171","t1218"]);
const manuallyExcluded = new Set(["122","129","150","152","258","348","355","s3069"]);
const confidentlyExcluded = new Set(["129","258","348","s3069"]);
const tripleSourceRows = new Set(["481","1741","3267","3546","3755","k105","k2140"]);

export type SourceDuplicateGroup = {
  pk: string;
  sourceCount: number;
  sourceKind: "repeated_in_source" | "manually_removed";
  assessment: "review_required" | "same_person_candidate";
};

export const sourceDuplicateGroups: readonly SourceDuplicateGroup[] = sourceKeys.map((pk) => {
  const removed = manuallyExcluded.has(pk);
  return {
    pk,
    sourceCount: removed ? 1 : tripleSourceRows.has(pk) ? 3 : 2,
    sourceKind: removed ? "manually_removed" : "repeated_in_source",
    assessment: samePersonCandidates.has(pk) || confidentlyExcluded.has(pk)
      ? "same_person_candidate" : "review_required",
  };
});

export const sourceReviewTotals = {
  sourceRows: 7276,
  sourceRepeatGroups: 170,
  sourceRepeatRows: 347,
  manuallyRemoved: 8,
  samePersonCandidates: 32,
  manualReviewRequired: 146,
} as const;

export function normalizeLegacyPk(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}
