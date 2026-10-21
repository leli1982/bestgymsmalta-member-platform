export type MembershipThemeType = "single" | "student" | "couples";

export type MembershipTheme = {
  type: MembershipThemeType;
  label: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
};

export const MEMBERSHIP_THEMES: Record<MembershipThemeType, MembershipTheme> = {
  single: {
    type: "single",
    label: "Regular",
    background: "#111111",
    foreground: "#FFFFFF",
    muted: "#D4D4D8",
    border: "#27272A",
  },
  student: {
    type: "student",
    label: "Student",
    background: "#166534",
    foreground: "#FFFFFF",
    muted: "#DCFCE7",
    border: "#15803D",
  },
  couples: {
    type: "couples",
    label: "Couples",
    background: "#B91C1C",
    foreground: "#FFFFFF",
    muted: "#FEE2E2",
    border: "#DC2626",
  },
};

const fallback: MembershipTheme = MEMBERSHIP_THEMES.single;

export function normalizeMembershipThemeType(value: unknown): MembershipThemeType | null {
  return value === "single" || value === "student" || value === "couples" ? value : null;
}

export function resolveMembershipTheme(value: unknown): MembershipTheme {
  const type = normalizeMembershipThemeType(value);
  return type ? MEMBERSHIP_THEMES[type] : fallback;
}
