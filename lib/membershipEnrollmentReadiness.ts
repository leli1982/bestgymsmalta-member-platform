export type EnrollmentLaunchDeclarationKey = "gym_rules" | "privacy" | "health";

const REQUIRED_ENROLLMENT_DECLARATIONS: readonly EnrollmentLaunchDeclarationKey[] = [
  "gym_rules",
  "privacy",
  "health",
];

export function getEnrollmentReadiness(
  publishedDeclarations: ReadonlySet<string>
): { ready: boolean; missing: EnrollmentLaunchDeclarationKey[] } {
  const missing = REQUIRED_ENROLLMENT_DECLARATIONS.filter(
    (contentKey) => !publishedDeclarations.has(contentKey)
  );

  return {
    ready: missing.length === 0,
    missing,
  };
}
