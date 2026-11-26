// A purely local, account-specific presentation preference. Never sent to a server.
export const MEMBER_DISPLAY_NAME_CHANGED = "bgmMemberDisplayNameChanged";
const PREFIX = "bgm:member-display-name:";
export const MAX_DISPLAY_NAME_LENGTH = 30;

export function normalizeMemberDisplayName(value: string): string {
  const name = value.trim().replace(/ +/g, " ");
  if (/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)) {
    throw new Error("Please enter a name without control characters.");
  }
  if (Array.from(name).length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error("Use a display name of up to 30 characters.");
  }
  return name;
}

export function memberDisplayNameKey(memberId: string): string {
  return PREFIX + memberId;
}

export function getMemberDisplayName(memberId: string | null | undefined): string {
  if (!memberId || typeof window === "undefined") return "";
  try {
    return normalizeMemberDisplayName(window.localStorage.getItem(memberDisplayNameKey(memberId)) || "");
  } catch {
    return "";
  }
}

export function setMemberDisplayName(memberId: string, value: string): string {
  if (!memberId || typeof window === "undefined") throw new Error("Sign in to your member account first.");
  const name = normalizeMemberDisplayName(value);
  try {
    const key = memberDisplayNameKey(memberId);
    if (name) window.localStorage.setItem(key, name);
    else window.localStorage.removeItem(key);
  } catch {
    throw new Error("This device could not save your display name. Check your browser storage settings.");
  }
  window.dispatchEvent(new Event(MEMBER_DISPLAY_NAME_CHANGED));
  return name;
}
