import type { MobilityGroup } from "./types.ts";

export const mobilityGroups: MobilityGroup[] = [
  {
    id: "fullBody",
    label: "Full Body",
    intro: "A balanced routine to loosen up the main areas before or after training.",
    entries: [
      { movementId: "worlds-greatest-stretch", programming: "20–30 seconds per side" },
      { movementId: "standing-forward-fold", programming: "20–30 seconds" },
      { movementId: "cat-cow", programming: "8–12 slow reps" },
      { movementId: "childs-pose", programming: "30 seconds" },
    ],
  },
  {
    id: "chest",
    label: "Chest",
    intro: "Good after pressing exercises, push-ups, bench press or long hours sitting.",
    entries: [
      { movementId: "doorway-chest-stretch", programming: "20–30 seconds per side" },
      { movementId: "wall-chest-opener", programming: "20–30 seconds per side" },
      { movementId: "hands-behind-back-chest-stretch", programming: "20–30 seconds" },
    ],
  },
  {
    id: "back",
    label: "Back",
    intro: "Useful after pulling exercises, rows, deadlifts or general stiffness.",
    entries: [
      { movementId: "childs-pose-lat-reach", programming: "20–30 seconds per side" },
      { movementId: "thread-the-needle", programming: "20–30 seconds per side" },
    ],
  },
  {
    id: "shoulders",
    label: "Shoulders",
    intro: "Great after upper-body training or when shoulders feel tight.",
    entries: [
      { movementId: "cross-body-shoulder-stretch", programming: "20–30 seconds per side" },
      { movementId: "overhead-shoulder-stretch", programming: "20–30 seconds per side" },
      { movementId: "wall-angels", programming: "8–12 slow reps" },
    ],
  },
  {
    id: "arms",
    label: "Arms",
    intro: "Simple stretches for biceps, triceps and forearms.",
    entries: [
      { movementId: "biceps-wall-stretch", programming: "20–30 seconds per side" },
      { movementId: "overhead-triceps-stretch", programming: "20–30 seconds per side" },
      { movementId: "forearm-stretch", programming: "15–25 seconds per side" },
    ],
  },
  {
    id: "legs",
    label: "Legs",
    intro: "Good after squats, leg press, running or lower-body training.",
    entries: [
      { movementId: "standing-quad-stretch", programming: "20–30 seconds per side" },
      { movementId: "hamstring-stretch", programming: "20–30 seconds per side" },
      { movementId: "calf-wall-stretch", programming: "20–30 seconds per side" },
    ],
  },
  {
    id: "hips",
    label: "Hips",
    intro: "Ideal for tight hips, sitting all day or lower-body workouts.",
    entries: [
      { movementId: "half-kneeling-hip-flexor-stretch", programming: "20–30 seconds per side" },
      { movementId: "figure-four-stretch", programming: "20–30 seconds per side" },
      { movementId: "90-90-hip-switch", programming: "8–10 slow reps" },
    ],
  },
  {
    id: "neck",
    label: "Neck",
    intro: "Simple gentle stretches for stiffness from desk work or stress.",
    entries: [
      { movementId: "side-neck-stretch", programming: "15–20 seconds per side" },
      { movementId: "chin-tucks", programming: "8–12 slow reps" },
      { movementId: "upper-trap-stretch", programming: "15–20 seconds per side" },
    ],
  },
  {
    id: "postWorkout",
    label: "Post-Workout",
    intro: "A calm cooldown routine to relax the body after training.",
    entries: [
      { movementId: "childs-pose", programming: "30 seconds" },
      { movementId: "quad-stretch", programming: "20–30 seconds per side" },
      { movementId: "chest-opener", programming: "20–30 seconds" },
      { movementId: "forward-fold", programming: "20–30 seconds" },
    ],
  },
  {
    id: "desk",
    label: "Desk / Stiffness",
    intro: "Quick movements for members who sit for long periods.",
    entries: [
      { movementId: "seated-chest-opener", programming: "20 seconds" },
      { movementId: "wrist-and-forearm-stretch", programming: "15–20 seconds per side" },
      { movementId: "neck-reset", programming: "8–10 slow reps" },
    ],
  },
];
