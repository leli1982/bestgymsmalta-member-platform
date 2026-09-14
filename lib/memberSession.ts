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

let pendingLogout: Promise<void> | null = null;

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

// This is only a display cache. Protected requests always use the signed cookie.
export function cacheVerifiedMember(member: AppMember) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(member));
  } catch {
    // A valid server session still works when browser storage is unavailable.
  }
}

export function saveMember(member: AppMember) {
  if (typeof window === "undefined") return;
  cacheVerifiedMember(member);
  window.dispatchEvent(new Event("bgmMemberChanged"));
}

// A rejected session must not send a delayed logout that could erase a new login.
export function forgetSavedMember() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MEMBER_SESSION_KEY);
  } catch {
    // The caller still clears its in-memory view.
  }
  window.dispatchEvent(new CustomEvent("bgmMemberChanged", { detail: { signedOut: true } }));
}

export function waitForMemberLogout() {
  return pendingLogout;
}

export function clearSavedMember() {
  if (typeof window === "undefined") return Promise.resolve();
  if (pendingLogout) return pendingLogout;
  pendingLogout = fetch("/api/member/auth/logout", {
    method: "DELETE",
    credentials: "same-origin",
    keepalive: true,
  }).then(() => undefined).catch(() => undefined).finally(() => {
    pendingLogout = null;
  });
  forgetSavedMember();
  return pendingLogout;
}
