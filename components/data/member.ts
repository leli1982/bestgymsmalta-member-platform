export type MemberTier = "standard" | "premium" | "vip" | "lifetime";

export type MemberStatus = "active" | "paused" | "expired";

export type NfcCardStatus = "active" | "inactive" | "needs_attention";

export type FitnessGoalType =
  | "build_strength"
  | "lose_weight"
  | "improve_fitness"
  | "build_muscle"
  | "stay_consistent";

export type Member = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;

  tier: MemberTier;
  status: MemberStatus;

  memberSince: string;
  membershipNumber: string;
  membershipLabel: string;
  membershipExpiry: string;
  homeGymId: string;

  nfcCard: {
    linked: boolean;
    cardId: string;
    status: NfcCardStatus;
  };

  passport: {
    gymsVisited: number;
    totalGyms: number;
    visitedGymIds: string[];
    nextGymId: string;
  };

  fitness: {
    score: number;
    streak: number;
    totalWorkouts: number;
    currentGoal: {
      type: FitnessGoalType;
      label: string;
      progress: number;
    };
  };

  social: {
    storiesShared: number;
    preferredTags: string[];
  };
};

export const currentMember: Member = {
  id: "member-leli-apap",
  firstName: "Leli",
  lastName: "Apap",
  fullName: "Leli Apap",

  tier: "premium",
  status: "active",

  memberSince: "2024",
  membershipNumber: "BGM-20491",
  membershipLabel: "Premium Member",
  membershipExpiry: "Active Membership",
  homeGymId: "bgm-pembroke",

  nfcCard: {
    linked: true,
    cardId: "BGM-20491",
    status: "active",
  },

  passport: {
    gymsVisited: 6,
    totalGyms: 10,
    visitedGymIds: [
      "bgm-pembroke",
      "bgm-marsa",
      "bgm-birkirkara",
      "bgm-sliema",
      "bgm-neptunes",
      "bgm-tal-qroqq",
    ],
    nextGymId: "bgm-marsascala",
  },

  fitness: {
    score: 86,
    streak: 12,
    totalWorkouts: 245,
    currentGoal: {
      type: "build_strength",
      label: "Build strength and stay consistent",
      progress: 68,
    },
  },

  social: {
    storiesShared: 18,
    preferredTags: ["#BestGymsMalta", "#beyourbestbeattherest"],
  },
};
