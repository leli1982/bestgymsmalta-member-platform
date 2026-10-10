export type MovementType =
  | "strength"
  | "machine"
  | "dumbbell"
  | "cable"
  | "bodyweight"
  | "conditioning"
  | "mobility"
  | "stretch"
  | "warmup"
  | "cooldown";

export type MovementDefinition = {
  id: string;
  name: string;
  aliases: string[];
  type: MovementType;
  bodyRegions: string[];
  primaryMuscles: string[];
  equipment: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | "all";
  description: string;
  startPosition: string;
  movementInstructions: string[];
  coachingCues: string[];
  commonMistakes: string[];
  safetyNotes: string[];
  defaultProgramming?: string;
  diagramAsset?: string;
  tags: string[];
};

export type MobilityGroup = {
  id: string;
  label: string;
  intro: string;
  entries: Array<{ movementId: string; programming?: string }>;
};
