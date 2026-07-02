export type MemberTier = "standard" | "premium" | "vip" | "lifetime";

export type Member = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;

  tier: MemberTier;
  status: "active" | "paused" | "expired";

  memberSince: string;
  homeGymId: string;

  nfcCard: {
    linked: boolean;
    cardId: string;
    status: "active" | "inactive" | "needs_attention";
  };

  fitnessScore: number;
  points: number;
  streak: number;
  gymsVisited: number;
  totalGyms: number;
  totalWorkouts: number;
};

export const currentMember: Member = {
  id: "member-leli-apap",
  firstName: "Leli",
  lastName: "Apap",
  fullName: "Leli Apap",

  tier: "premium",
  status: "active",

  memberSince: "2024",
  homeGymId: "bgm-pembroke",

  nfcCard: {
    linked: true,
    cardId: "BGM-20491",
    status: "active",
  },

  fitnessScore: 86,
  points: 1450,
  streak: 12,
  gymsVisited: 6,
  totalGyms: 11,
  totalWorkouts: 245,
};