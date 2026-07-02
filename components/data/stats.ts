import { currentMember } from "@/components/data/member";

export const stats = [
  {
    id: "passport",
    icon: "📍",
    value: `${currentMember.passport.gymsVisited}/${currentMember.passport.totalGyms}`,
    label: "Gyms Visited",
  },
  {
    id: "streak",
    icon: "🔥",
    value: currentMember.fitness.streak.toString(),
    label: "Day Streak",
  },
  {
    id: "workouts",
    icon: "🏋️",
    value: currentMember.fitness.totalWorkouts.toString(),
    label: "Workouts",
  },
  {
    id: "stories",
    icon: "📸",
    value: currentMember.social.storiesShared.toString(),
    label: "Stories Shared",
  },
];

// Backwards-compatible export for older components
export const memberStats = stats;