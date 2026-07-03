export type AppMember = {
  id: string;
  username: string;
  memberNumber: string;
  fullName: string;
  email: string;
  phone?: string;
  status: string;
  membershipExpiry?: string | null;
  tempPasswordMustChange?: boolean;
};

export const MEMBER_SESSION_KEY = "bgmMemberSession";

export function getSavedMember(): AppMember | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem(MEMBER_SESSION_KEY);
    if (!saved) return null;

    return JSON.parse(saved) as AppMember;
  } catch {
    return null;
  }
}

export function saveMember(member: AppMember) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(member));
  window.dispatchEvent(new Event("bgmMemberChanged"));
}

export function clearSavedMember() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(MEMBER_SESSION_KEY);
  window.dispatchEvent(new Event("bgmMemberChanged"));
}
