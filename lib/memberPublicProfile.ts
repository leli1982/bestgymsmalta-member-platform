import type { AppMember } from "./memberSession";
import { todayMaltaDate } from "./maltaDate";
import { isCancellationEffective } from "./memberCancellationCore";

export const MEMBER_PROFILE_COLUMNS =
  "id, username, member_number, full_name, email, phone, status, membership_expiry, cancellation_effective_date, temp_password_must_change";

type MemberRow = {
  id: string;
  username?: string | null;
  member_number?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  membership_expiry?: string | null;
  cancellation_effective_date?: string | null;
  temp_password_must_change?: boolean | null;
};

export function publicMemberProfile(member: MemberRow): AppMember {
  return {
    id: member.id,
    username: member.username || "",
    memberNumber: member.member_number || "",
    fullName: member.full_name || "",
    email: member.email || "",
    phone: member.phone || "",
    status: isCancellationEffective(member.cancellation_effective_date, todayMaltaDate()) ? "inactive" : member.status || "inactive",
    membershipExpiry: member.membership_expiry || null,
    tempPasswordMustChange: Boolean(member.temp_password_must_change),
  };
}
