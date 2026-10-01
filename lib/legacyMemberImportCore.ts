export const OLD_SYSTEM_MEMBER_HEADERS = [
  "pkCustomer",
  "Scan3",
  "CustomerName",
  "Surname",
  "Address1",
  "Address2",
  "Town",
  "PostCode",
  "Country",
  "Gender",
  "DOB",
  "IDCard",
  "TelephoneNo2",
  "TelephoneNo1",
  "Fax",
  "Mobile",
  "Email",
  "ExpiryDate",
  "Web",
  "ValidYN",
  "Contact",
  "ContactPhone",
] as const;

export type OldSystemMemberHeader = (typeof OLD_SYSTEM_MEMBER_HEADERS)[number];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function oldSystemFullName(customerName: unknown, surname: unknown) {
  return [clean(customerName), clean(surname)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function deriveLegacyGym(pkCustomer: unknown) {
  const value = clean(pkCustomer);
  if (!value) return { gym: null, prefix: "", issue: "pkCustomer is blank; Legacy Gym cannot be derived." };

  if (/^\d+$/.test(value)) {
    return { gym: "Tal-Qroqq", prefix: "", issue: "" };
  }

  if (/^no/i.test(value)) {
    return { gym: "Tal-Qroqq", prefix: "NO", issue: "" };
  }

  const prefix = value.charAt(0).toUpperCase();
  const gymByPrefix: Record<string, string> = {
    B: "Birkirkara",
    K: "Kirkop",
    M: "Marsa",
    N: "Neptunes",
    P: "Pembroke",
    S: "Build",
    T: "Sliema",
    Z: "Birżebbuġa",
  };

  const gym = gymByPrefix[prefix];
  if (gym) return { gym, prefix, issue: "" };

  return {
    gym: null,
    prefix,
    issue: `Unrecognised pkCustomer prefix "${prefix || value}". Legacy Gym requires Super Admin review.`,
  };
}

export function statusFromExpiryDate(
  expiryDate: unknown,
  today: string
): "active" | "inactive" | null {
  const expiry = clean(expiryDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return null;
  return expiry >= today ? "active" : "inactive";
}

export function sourceValidityMismatch(
  validYN: unknown,
  derivedStatus: "active" | "inactive"
) {
  const value = clean(validYN).toLowerCase();
  if (!value) return false;
  if (value === "valid") return derivedStatus !== "active";
  if (value === "not valid") return derivedStatus !== "inactive";
  return true;
}
