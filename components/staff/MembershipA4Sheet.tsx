"use client";

import { isUnder16On } from "@/lib/membershipRegistrationCore";

export type DeclarationPrintSnapshot = {
  id?: string;
  versionNo?: number | string;
  body?: string;
  contentSha256?: string;
  // Present only on applications submitted under the new prospective guardian policy.
  supervisionUnder16Orders?: number[];
  supervisionUnder16Text?: string;
};

export type PrintableParticipant = {
  id: string;
  participantOrder: number;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  idNumber: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  nextOfKin: string;
  memberId: string | null;
  memberNumber: string | null;
  barcode: string | null;
  photoUrl: string | null;
  under18AtSubmission: boolean;
  guardianName: string;
  guardianIdNumber: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianAddress: string;
  idVerified: boolean;
  studentEligibilityVerified: boolean;
  guardianPresentVerified: boolean;
  guardianCosignVerified: boolean;
};

export type PrintableApplication = {
  id: string;
  applicationReference: string;
  kind: string;
  membershipType: string;
  durationKey: string;
  startDate: string;
  expiryDate: string;
  status: string;
  submittedAt: string | null;
  paymentReceivedAt: string | null;
  activatedAt: string | null;
  applicationStaffName: string | null;
  activationStaffName: string | null;
  enrollmentGymId: string;
  enrollmentGymName: string;
  basePriceCents: number | null;
  currency: string;
  discountCode: string | null;
  discountPercentage: number | null;
  discountAmountCents: number | null;
  finalAmountCents: number | null;
  paymentMethod: string | null;
  paymentOtherText: string | null;
  paymentStaffName: string | null;
  declarationSnapshot: Record<string, DeclarationPrintSnapshot> | null;
  sameAddressVerified: boolean;
  participants: PrintableParticipant[];
};

function display(value: string | number | null | undefined) {
  return value !== null && value !== undefined && String(value).trim()
    ? String(value)
    : "—";
}

function money(cents: number | null | undefined, currency = "EUR") {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: currency || "EUR",
  }).format(cents / 100);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function snapshotEntries(snapshot: PrintableApplication["declarationSnapshot"]) {
  if (!snapshot) return [];
  const labels: Record<string, string> = {
    gymRules: "Gym Rules",
    gym_rules: "Gym Rules",
    legacyDeclaration: "Membership Declaration",
    legacy_declaration: "Membership Declaration",
    privacy: "Privacy",
    health: "Health",
    guardian: "Guardian Declaration",
  };
  const order = [
    "gymRules",
    "gym_rules",
    "legacyDeclaration",
    "legacy_declaration",
    "privacy",
    "health",
    "guardian",
  ];
  return Object.entries(snapshot)
    .filter(([, item]) => item && typeof item.body === "string" && item.body.trim())
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    })
    .map(([key, item]) => ({
      key,
      label: labels[key] || key.replaceAll("_", " "),
      versionNo: item.versionNo ?? "—",
      body: item.body || "",
    }));
}

function Info({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | number | null | undefined;
  className?: string;
}) {
  return (
    <div className={`bgm-print-info ${className}`}>
      <div className="bgm-print-label">{label}</div>
      <div className="bgm-print-value">{display(value)}</div>
    </div>
  );
}

function VerificationRow({
  label,
  checked,
}: {
  label: string;
  checked: boolean;
}) {
  return (
    <span className="bgm-verify-item">
      <span aria-hidden="true">{checked ? "✓" : "○"}</span> {label}
    </span>
  );
}

function Signature({
  title,
}: {
  title: string;
}) {
  return (
    <div className="bgm-signature">
      <div className="bgm-signature-line" />
      <div className="bgm-signature-meta">
        <span>{title}</span>
        <span>Date: __________</span>
      </div>
    </div>
  );
}

export default function MembershipA4Sheet({
  application,
  participant,
  measurement = false,
}: {
  application: PrintableApplication;
  participant: PrintableParticipant;
  measurement?: boolean;
}) {
  // Preserve historical snapshots. New applications record consent for all under-18
  // applicants and store the under-16 supervision sentence per participant.
  const guardianSnapshot = application.declarationSnapshot?.guardian;
  const hasProspectiveGuardianPolicy = Array.isArray(guardianSnapshot?.supervisionUnder16Orders);
  const declarations = snapshotEntries(application.declarationSnapshot)
    .filter((entry) => entry.key !== "guardian" || (
      hasProspectiveGuardianPolicy
        ? participant.under18AtSubmission
        : isUnder16On(participant.dateOfBirth, application.startDate)
    ))
    .map((entry) => entry.key === "guardian" &&
      hasProspectiveGuardianPolicy &&
      guardianSnapshot?.supervisionUnder16Orders?.includes(participant.participantOrder) &&
      guardianSnapshot.supervisionUnder16Text
        ? { ...entry, body: [entry.body, guardianSnapshot.supervisionUnder16Text ].join("\n") }
        : entry);
  const paymentMethod =
    application.paymentMethod === "other"
      ? `Other — ${application.paymentOtherText || "—"}`
      : application.paymentMethod;
  const discount = application.discountPercentage
    ? `${application.discountPercentage}% (${money(application.discountAmountCents, application.currency)})${application.discountCode ? ` · ${application.discountCode}` : ""}`
    : "No discount";
  const address = [
    participant.addressLine1,
    participant.addressLine2,
    participant.town,
    participant.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <style jsx global>{`
        @page { size: A4 portrait; margin: 8mm; }
        .bgm-member-a4-sheet {
          width: 194mm;
          height: 281mm;
          overflow: hidden;
          break-after: page;
          box-sizing: border-box;
          background: #fff;
          color: #18181b;
          padding: 4.2mm 5.5mm 4mm;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 8.1pt;
          line-height: 1.22;
          position: relative;
        }
        .bgm-member-a4-sheet:last-child { break-after: auto; }
        .bgm-print-header { display:flex; justify-content:space-between; gap:4mm; border-bottom:1mm solid #ff5a0a; padding-bottom:1.5mm; }
        .bgm-print-brand { font-size:8pt; font-weight:900; letter-spacing:.13em; text-transform:uppercase; color:#ff5a0a; }
        .bgm-print-title { margin-top:1mm; font-size:15pt; line-height:1; font-weight:900; letter-spacing:-.02em; }
        .bgm-print-subtle { color:#71717a; font-size:7.2pt; }
        .bgm-print-ref { text-align:right; font-size:7.5pt; max-width:65mm; }
        .bgm-print-grid { display:grid; gap:1mm; }
        .bgm-print-grid-4 { grid-template-columns:repeat(4,minmax(0,1fr)); }
        .bgm-print-grid-3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .bgm-print-info { min-width:0; border:0.2mm solid #e4e4e7; border-radius:1.4mm; padding:.65mm 1mm; }
        .bgm-print-label { color:#71717a; font-size:6.4pt; font-weight:900; text-transform:uppercase; letter-spacing:.04em; }
        .bgm-print-value { margin-top:.25mm; font-weight:700; overflow-wrap:anywhere; }
        .bgm-section-title { font-size:7pt; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:#52525b; margin-bottom:.7mm; }
        .bgm-member-block { display:grid; grid-template-columns:23mm minmax(0,1fr); gap:2mm; }
        .bgm-photo { width:23mm; height:27mm; border:0.2mm solid #d4d4d8; border-radius:1.8mm; object-fit:cover; }
        .bgm-photo-placeholder { width:23mm; height:27mm; display:flex; align-items:center; justify-content:center; border:.25mm dashed #a1a1aa; border-radius:1.8mm; color:#a1a1aa; font-size:7pt; font-weight:800; }
        .bgm-member-name { font-size:13.5pt; line-height:1.04; font-weight:900; }
        .bgm-data-grid { display:grid; grid-template-columns:1fr 1fr; gap:.65mm 3mm; margin-top:1mm; }
        .bgm-data-line { min-width:0; overflow-wrap:anywhere; }
        .bgm-data-line b { color:#71717a; }
        .bgm-verification { display:flex; flex-wrap:wrap; gap:1.2mm 3mm; border:.2mm solid #e4e4e7; border-radius:1.5mm; padding:1.2mm; }
        .bgm-verify-item { white-space:nowrap; font-size:7.3pt; font-weight:700; }
        .bgm-declaration-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.8mm; align-items:start; }
        .bgm-declaration { break-inside:avoid; border:.2mm solid #e4e4e7; border-radius:1.4mm; padding:.85mm 1.1mm; margin-bottom:.65mm; }
        .bgm-declaration-title { font-size:6.7pt; font-weight:900; text-transform:uppercase; color:#3f3f46; }
        .bgm-declaration-body { white-space:pre-line; margin-top:.4mm; font-size:7.15pt; line-height:1.17; color:#27272a; overflow-wrap:anywhere; }
        .bgm-guardian { border:.25mm solid #c4b5fd; background:#faf5ff; border-radius:1.5mm; padding:1.2mm; }
        .bgm-signatures { display:grid; grid-template-columns:1fr 1fr; gap:6mm; margin-top:1mm; }
        .bgm-signature-line { height:7.5mm; border-bottom:.25mm solid #52525b; }
        .bgm-signature-meta { display:flex; justify-content:space-between; gap:3mm; margin-top:1mm; font-size:6.8pt; font-weight:800; color:#52525b; }
        .bgm-print-footer { position:absolute; left:6mm; right:6mm; bottom:3mm; display:flex; justify-content:space-between; gap:4mm; border-top:.2mm solid #e4e4e7; padding-top:1mm; font-size:6pt; color:#a1a1aa; }
        .bgm-print-section { margin-top:1.4mm; }
        @media screen {
          .bgm-member-a4-sheet { margin:0 auto 8mm; box-shadow:0 10px 35px rgba(0,0,0,.12); }
          .bgm-print-measure .bgm-member-a4-sheet { margin:0; box-shadow:none; }
        }
        @media print {
          .bgm-member-a4-sheet { margin:0 !important; box-shadow:none !important; }
        }
      `}</style>

      <article
        className={`bgm-member-a4-sheet${measurement ? " bgm-print-measure-sheet" : ""}`}
        data-participant-order={participant.participantOrder}
      >
        <header className="bgm-print-header">
          <div>
            <div className="bgm-print-brand">BestGymsMalta</div>
            <div className="bgm-print-title">Membership Application</div>
            <div className="bgm-print-subtle">Final reviewed member record</div>
          </div>
          <div className="bgm-print-ref">
            <div className="bgm-print-label">Application reference</div>
            <strong>{application.applicationReference}</strong>
            <div className="bgm-print-subtle">Submitted {formatDateTime(application.submittedAt)}</div>
            <div className="bgm-print-subtle">{application.enrollmentGymName}</div>
          </div>
        </header>

        <section className="bgm-print-section bgm-member-block">
          {participant.photoUrl ? (
            <img className="bgm-photo" src={participant.photoUrl} alt="" />
          ) : (
            <div className="bgm-photo-placeholder">PHOTO</div>
          )}
          <div>
            <div className="bgm-print-label">Participant {participant.participantOrder}</div>
            <div className="bgm-member-name">
              {participant.firstName} {participant.lastName}
            </div>
            <div className="bgm-data-grid">
              <div className="bgm-data-line"><b>ID number:</b> {display(participant.idNumber)}</div>
              <div className="bgm-data-line"><b>Date of birth:</b> {display(participant.dateOfBirth)}</div>
              <div className="bgm-data-line"><b>Phone:</b> {display(participant.phone)}</div>
              <div className="bgm-data-line"><b>Email:</b> {display(participant.email)}</div>
              <div className="bgm-data-line"><b>Next of kin:</b> {display(participant.nextOfKin)}</div>
              <div className="bgm-data-line"><b>Address:</b> {display(address)}</div>
            </div>
          </div>
        </section>

        <section className="bgm-print-section">
          <div className="bgm-print-grid bgm-print-grid-4">
            <Info label="Member number" value={participant.memberNumber} />
            <Info label="Card number" value={participant.barcode} />
            <Info label="Membership type" value={application.membershipType} />
            <Info label="Duration" value={application.durationKey.replaceAll("_", " ")} />
            <Info label="Start date" value={application.startDate} />
            <Info label="Expiry date" value={application.expiryDate} />
            <Info label="Application" value={application.kind === "renewal" ? "Renewal" : "New membership"} />
            <Info label="Status" value={application.status} />
          </div>
        </section>

        <section className="bgm-print-section">
          <div className="bgm-section-title">Payment</div>
          <div className="bgm-print-grid bgm-print-grid-4">
            <Info label="Base price" value={money(application.basePriceCents, application.currency)} />
            <Info label="Discount" value={discount} />
            <Info label="Final total" value={money(application.finalAmountCents ?? application.basePriceCents, application.currency)} />
            <Info label="Payment method" value={paymentMethod} />
            <Info label="Payment staff" value={application.paymentStaffName || application.activationStaffName} />
            <Info label="Payment received" value={formatDateTime(application.paymentReceivedAt)} />
            <Info label="Application staff" value={application.applicationStaffName} />
            <Info label="Activated" value={formatDateTime(application.activatedAt)} />
          </div>
        </section>

        <section className="bgm-print-section">
          <div className="bgm-section-title">Verification</div>
          <div className="bgm-verification">
            <VerificationRow label="ID / passport verified" checked={participant.idVerified} />
            {application.membershipType === "student" && (
              <VerificationRow label="Student eligibility verified" checked={participant.studentEligibilityVerified} />
            )}
            {application.membershipType === "couples" && (
              <VerificationRow label="Same-address evidence verified" checked={application.sameAddressVerified} />
            )}
            {participant.under18AtSubmission && (
              <>
                <VerificationRow label="Guardian present verified" checked={participant.guardianPresentVerified} />
                <VerificationRow label="Guardian co-sign verified" checked={participant.guardianCosignVerified} />
              </>
            )}
          </div>
        </section>

        {participant.under18AtSubmission && (
          <section className="bgm-print-section bgm-guardian">
            <div className="bgm-section-title">Guardian</div>
            <div className="bgm-data-grid">
              <div className="bgm-data-line"><b>Name:</b> {display(participant.guardianName)}</div>
              <div className="bgm-data-line"><b>ID:</b> {display(participant.guardianIdNumber)}</div>
              <div className="bgm-data-line"><b>Relationship:</b> {display(participant.guardianRelationship)}</div>
              <div className="bgm-data-line"><b>Phone:</b> {display(participant.guardianPhone)}</div>
              <div className="bgm-data-line"><b>Email:</b> {display(participant.guardianEmail)}</div>
              <div className="bgm-data-line"><b>Address:</b> {display(participant.guardianAddress)}</div>
            </div>
          </section>
        )}

        <section className="bgm-print-section">
          <div className="bgm-section-title">Historical rules & declarations</div>
          {declarations.length ? (
            <div className="bgm-declaration-grid">
              <div>
                {declarations
                  .filter((entry) => /gym/i.test(entry.key) || /legacy/i.test(entry.key))
                  .map((entry) => (
                    <div className="bgm-declaration" key={entry.key}>
                      <div className="bgm-declaration-title">{entry.label} · v{entry.versionNo}</div>
                      <div className="bgm-declaration-body">{entry.body}</div>
                    </div>
                  ))}
              </div>
              <div>
                {declarations
                  .filter((entry) => !/gym/i.test(entry.key) && !/legacy/i.test(entry.key))
                  .map((entry) => (
                    <div className="bgm-declaration" key={entry.key}>
                      <div className="bgm-declaration-title">{entry.label} · v{entry.versionNo}</div>
                      <div className="bgm-declaration-body">{entry.body}</div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="bgm-print-subtle">
              Historical declaration snapshot was not recorded on this application.
            </div>
          )}
        </section>

        <section className="bgm-signatures">
          <Signature title="Member Signature" />
          <Signature title="Staff Signature" />
        </section>

        {participant.under18AtSubmission && (
          <section className="bgm-signatures" style={{ gridTemplateColumns: "1fr" }}>
            <Signature title="Guardian Signature" />
          </section>
        )}

        <footer className="bgm-print-footer">
          <span>{application.applicationReference} · Participant {participant.participantOrder}</span>
          <span>BestGymsMalta · Historical application record</span>
        </footer>
      </article>
    </>
  );
}
