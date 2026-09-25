import { UNDER16_SUPERVISION_CLAUSE } from "@/lib/guardianConsentPolicy";
"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import MembershipA4Sheet, {
  type PrintableApplication,
  type PrintableParticipant,
} from "@/components/staff/MembershipA4Sheet";

export type MembershipPrintMeasurement = {
  fits: boolean;
  measuredHeightPx: number;
  maxHeightPx: number;
};

type Props = {
  declarationBodies: Record<string, string>;
  onResult(result: MembershipPrintMeasurement): void;
};

const participant: PrintableParticipant = {
  id: "print-overflow-preview-participant",
  participantOrder: 1,
  firstName: "Alexandra-Maria",
  lastName: "Long-Surname Example",
  addressLine1: "123 Example Residential Address",
  addressLine2: "Apartment 12, Example Court",
  town: "San Ġwann",
  postcode: "SGN 1234",
  idNumber: "0123456M",
  dateOfBirth: "2011-01-15",
  phone: "+356 7900 0000",
  email: "long.email.address@example.com",
  nextOfKin: "Example Parent +356 7999 9999",
  memberId: null,
  memberNumber: "BGM0000001",
  barcode: "BGM-CARD-0000001",
  photoUrl: null,
  under18AtSubmission: true,
  guardianName: "Christopher Long Guardian Name",
  guardianIdNumber: "7654321M",
  guardianRelationship: "Parent / legal guardian",
  guardianPhone: "+356 7999 9999",
  guardianEmail: "guardian.long.email@example.com",
  guardianAddress: "123 Example Residential Address, San Ġwann SGN 1234",
  idVerified: true,
  studentEligibilityVerified: true,
  guardianPresentVerified: true,
  guardianCosignVerified: true,
};

function previewApplication(
  declarationBodies: Record<string, string>
): PrintableApplication {
  return {
    id: "print-overflow-preview",
    applicationReference: "BGMAPP-PREVIEW-LONG-REFERENCE",
    kind: "new",
    membershipType: "student",
    durationKey: "1_year",
    startDate: "2026-09-18",
    expiryDate: "2027-09-18",
    status: "awaiting_payment",
    submittedAt: "2026-09-18T08:00:00.000Z",
    paymentReceivedAt: "2026-09-18T08:15:00.000Z",
    activatedAt: "2026-09-18T08:15:00.000Z",
    applicationStaffName: "Example Reception Staff",
    activationStaffName: "Example Reception Staff",
    enrollmentGymId: "bgm-preview",
    enrollmentGymName: "BestGymsMalta Example Gym",
    basePriceCents: 10000,
    currency: "EUR",
    discountCode: "WELCOME10",
    discountPercentage: 10,
    discountAmountCents: 1000,
    finalAmountCents: 9000,
    paymentMethod: "card",
    paymentOtherText: null,
    paymentStaffName: "Example Reception Staff",
    declarationSnapshot: {
      gym_rules: {
        versionNo: "preview",
        body: declarationBodies.gym_rules || "",
      },
      legacy_declaration: {
        versionNo: "preview",
        body: declarationBodies.legacy_declaration || "",
      },
      privacy: {
        versionNo: "preview",
        body: declarationBodies.privacy || "",
      },
      health: {
        versionNo: "preview",
        body: declarationBodies.health || "",
      },
      guardian: {
        versionNo: "preview",
        body: declarationBodies.guardian || "",
        supervisionUnder16Orders: [1],
        supervisionUnder16Text: UNDER16_SUPERVISION_CLAUSE,
      },
    },
    sameAddressVerified: true,
    participants: [participant],
  };
}

export default function MembershipPrintOverflowPreview({
  declarationBodies,
  onResult,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const application = useMemo(
    () => previewApplication(declarationBodies),
    [declarationBodies]
  );

  useLayoutEffect(() => {
    let frame = 0;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      const sheet = containerRef.current?.querySelector<HTMLElement>(
        ".bgm-member-a4-sheet"
      );
      if (!sheet) return;

      const measuredHeightPx = sheet.scrollHeight;
      const maxHeightPx = sheet.clientHeight;
      onResult({
        fits: measuredHeightPx <= maxHeightPx + 1,
        measuredHeightPx,
        maxHeightPx,
      });
    };

    frame = window.requestAnimationFrame(measure);
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      if (containerRef.current) observer.observe(containerRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [application, onResult]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-[-10000px] top-0 invisible z-[-1]"
    >
      <MembershipA4Sheet
        application={application}
        participant={participant}
        measurement
      />
    </div>
  );
}
