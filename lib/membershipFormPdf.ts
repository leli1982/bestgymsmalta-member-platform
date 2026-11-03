import { buildDeclarationPdf } from "./declarationPdf.ts";
import { isUnder16On } from "./membershipRegistrationCore.ts";
import type { PrintableApplication, PrintableParticipant } from "./printableMembershipApplication.ts";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function money(cents: number | null | undefined, currency: string) {
  if (cents === null || cents === undefined) return "—";
  return `${(cents / 100).toFixed(2)} ${currency || "EUR"}`;
}

function safeFilename(value: unknown, fallback: string) {
  return clean(value).replace(/[^A-Za-z0-9._-]+/g, "-") || fallback;
}

function declarationEntries(application: PrintableApplication, participant: PrintableParticipant) {
  const snapshot = application.declarationSnapshot || {};
  const guardian = snapshot.guardian;
  const prospective = Array.isArray(guardian?.supervisionUnder16Orders);
  const labels: Record<string, string> = {
    gymRules: "Gym Rules",
    gym_rules: "Gym Rules",
    legacyDeclaration: "Membership Declaration",
    legacy_declaration: "Membership Declaration",
    privacy: "Privacy / GDPR",
    health: "Health Declaration",
    guardian: "Guardian Consent",
  };
  const order = ["gymRules", "gym_rules", "legacyDeclaration", "legacy_declaration", "health", "privacy", "guardian"];
  return Object.entries(snapshot)
    .filter(([key, item]) => {
      if (!item?.body?.trim()) return false;
      if (key !== "guardian") return true;
      return prospective
        ? participant.under18AtSubmission
        : isUnder16On(participant.dateOfBirth, application.startDate);
    })
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    })
    .map(([key, item]) => {
      let body = item.body || "";
      if (
        key === "guardian" &&
        prospective &&
        guardian?.supervisionUnder16Orders?.includes(participant.participantOrder) &&
        guardian.supervisionUnder16Text
      ) {
        body = [body, guardian.supervisionUnder16Text].join("\n");
      }
      return { label: labels[key] || key.replaceAll("_", " "), versionNo: item.versionNo ?? "—", body };
    });
}

export function membershipFormPdfFilename(application: PrintableApplication, participant: PrintableParticipant) {
  const reference = safeFilename(application.applicationReference, "Application");
  const memberNumber = safeFilename(participant.memberNumber, `Participant-${participant.participantOrder}`);
  return `BestGymsMalta-Membership-${reference}-${memberNumber}.pdf`;
}

export function buildMembershipFormPdf(application: PrintableApplication, participant: PrintableParticipant) {
  const fullName = `${clean(participant.firstName)} ${clean(participant.lastName)}`.trim();
  const address = [participant.addressLine1, participant.addressLine2, participant.town, participant.postcode]
    .map(clean)
    .filter(Boolean)
    .join(", ");
  const paymentMethod = application.paymentMethod === "other"
    ? `Other — ${clean(application.paymentOtherText) || "—"}`
    : clean(application.paymentMethod) || "—";
  const lines = [
    `Application reference: ${application.applicationReference}`,
    `Application kind: ${application.kind}`,
    `Member: ${fullName}`,
    `BGM membership number: ${clean(participant.memberNumber) || "—"}`,
    `Card / barcode: ${clean(participant.barcode) || "—"}`,
    `Membership: ${application.membershipType} · ${application.durationKey}`,
    `Start date: ${application.startDate}`,
    `Expiry date: ${application.expiryDate}`,
    `Gym / access: ${application.enrollmentGymName}`,
    `Address: ${address || "—"}`,
    `ID number: ${clean(participant.idNumber) || "—"}`,
    `Date of birth: ${clean(participant.dateOfBirth) || "—"}`,
    `Phone: ${clean(participant.phone) || "—"}`,
    `Email: ${clean(participant.email) || "—"}`,
    `Next of kin: ${clean(participant.nextOfKin) || "—"}`,
    `Base price: ${money(application.basePriceCents, application.currency)}`,
    `Discount: ${application.discountPercentage || 0}% · ${money(application.discountAmountCents, application.currency)}${application.discountCode ? ` · ${application.discountCode}` : ""}`,
    `Final amount: ${money(application.finalAmountCents, application.currency)}`,
    `Payment method: ${paymentMethod}`,
    `Payment staff: ${clean(application.paymentStaffName) || "—"}`,
    `Activation staff: ${clean(application.activationStaffName) || "—"}`,
    `ID verified: ${participant.idVerified ? "Yes" : "No"}`,
    `Student eligibility verified: ${participant.studentEligibilityVerified ? "Yes" : "No"}`,
  ];

  if (participant.guardianName) {
    lines.push(
      `Guardian: ${participant.guardianName}`,
      `Guardian ID: ${participant.guardianIdNumber}`,
      `Guardian relationship: ${participant.guardianRelationship}`,
      `Guardian phone: ${participant.guardianPhone}`,
      `Guardian email: ${participant.guardianEmail}`,
      `Guardian address: ${participant.guardianAddress}`,
      `Guardian present verified: ${participant.guardianPresentVerified ? "Yes" : "No"}`,
      `Guardian co-sign verified: ${participant.guardianCosignVerified ? "Yes" : "No"}`,
    );
  }

  lines.push("", "Accepted declarations:");
  for (const entry of declarationEntries(application, participant)) {
    lines.push("", `${entry.label} — Version ${entry.versionNo}`, entry.body);
  }

  return buildDeclarationPdf({
    title: "Completed Membership Form",
    filenameLabel: "Membership-Form",
    sourceKey: "Membership-Form",
    declaration: { body: lines.join("\n") },
  });
}
