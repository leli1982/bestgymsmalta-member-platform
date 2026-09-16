import type {
  MembershipDurationKey,
  MembershipType,
} from "@/lib/membershipSettingsCore";

export type RegistrationMode = "tablet" | "staff";
export type IdentityMatchState = "clear" | "active" | "expired_inactive";

export type PriceEntry = {
  membershipType: MembershipType;
  durationKey: MembershipDurationKey;
  amountCents: number;
  currency: "EUR";
};

export type PublishedDeclarationSnapshot = {
  id: string;
  contentKey: "gym_rules" | "privacy" | "health" | "guardian";
  versionNo: number;
  body: string;
  contentSha256: string;
};

export type PublicEnrollmentConfig = {
  gym: {
    id: string;
    name: string;
    shortName: string;
    slug: string;
  };
  pricing: {
    versionId: string;
    entries: PriceEntry[];
  };
  declarations: {
    gymRules: PublishedDeclarationSnapshot;
    privacy: PublishedDeclarationSnapshot;
    health: PublishedDeclarationSnapshot;
    guardian?: PublishedDeclarationSnapshot;
  };
};

export type GuardianDetails = {
  fullName: string;
  idNumber: string;
  relationship: string;
  mobile: string;
  email: string;
  address: string;
};

export type RegistrationParticipant = {
  firstName: string;
  lastName: string;
  idNumber: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  phone: string;
  email: string;
  nextOfKin: string;
  guardian?: GuardianDetails;
};

export type ParticipantDeclarationAcceptance = {
  gymRules: boolean;
  privacy: boolean;
  health: boolean;
};

export type RegistrationDraft = {
  membershipType: MembershipType;
  durationKey: MembershipDurationKey;
  documentReadinessAcknowledged: boolean;
  participants: RegistrationParticipant[];
  declarations: ParticipantDeclarationAcceptance[];
  photos: Array<File | null>;
};

export type OfflineVerificationSnapshot = {
  participantIdVerified: boolean[];
  studentEligibilityVerified: boolean[];
  sameAddressVerified: boolean;
  guardianPresentVerified: boolean[];
  guardianCosignVerified: boolean[];
};
