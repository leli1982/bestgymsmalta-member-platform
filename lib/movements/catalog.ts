import type { MovementDefinition, MovementType } from "./types.ts";

type MovementSeed = Pick<
  MovementDefinition,
  | "id"
  | "name"
  | "aliases"
  | "type"
  | "bodyRegions"
  | "primaryMuscles"
  | "equipment"
  | "difficulty"
  | "tags"
> &
  Partial<
    Pick<
      MovementDefinition,
      | "description"
      | "startPosition"
      | "movementInstructions"
      | "coachingCues"
      | "commonMistakes"
      | "safetyNotes"
      | "defaultProgramming"
      | "diagramAsset"
    >
  >;

function defineMovement(seed: MovementSeed): MovementDefinition {
  const recovery = ["mobility", "stretch", "warmup", "cooldown"].includes(seed.type);

  return {
    ...seed,
    description:
      seed.description ??
      `${seed.name} is a ${recovery ? "controlled mobility/recovery" : "resistance-training"} movement used in BGM programming.`,
    startPosition:
      seed.startPosition ??
      `Set up in a stable, comfortable starting position for ${seed.name} before beginning the repetition.`,
    movementInstructions:
      seed.movementInstructions ?? [
        "Move through a controlled, comfortable range of motion, then return smoothly to the start position.",
      ],
    coachingCues:
      seed.coachingCues ?? [
        "Use a controlled tempo and steady breathing throughout the movement.",
      ],
    commonMistakes:
      seed.commonMistakes ?? [
        "Rushing the movement or using more range or load than can be controlled.",
      ],
    safetyNotes:
      seed.safetyNotes ?? [
        "Stop if you feel sharp pain, numbness, dizziness or unusual discomfort.",
      ],
  };
}

function trainerMovement(
  id: string,
  name: string,
  type: MovementType,
  bodyRegions: string[],
  primaryMuscles: string[],
  equipment: string[],
  tags: string[],
  aliases: string[] = [],
): MovementSeed {
  return {
    id,
    name,
    aliases,
    type,
    bodyRegions,
    primaryMuscles,
    equipment,
    difficulty: "all",
    tags: ["trainer", ...tags],
  };
}

function mobilityMovement(
  id: string,
  name: string,
  bodyRegions: string[],
  programming: string,
  instructions: string,
  cue: string,
  options: {
    aliases?: string[];
    type?: MovementType;
    equipment?: string[];
    tags?: string[];
  } = {},
): MovementSeed {
  return {
    id,
    name,
    aliases: options.aliases ?? [],
    type: options.type ?? "stretch",
    bodyRegions,
    primaryMuscles: bodyRegions,
    equipment: options.equipment ?? [],
    difficulty: "all",
    description: `${name} is a gentle mobility or stretching movement for ${bodyRegions.join(", ")}.`,
    startPosition: `Set up comfortably for ${name} and keep the position supported and pain-free.`,
    movementInstructions: [instructions],
    coachingCues: [cue],
    commonMistakes: ["Forcing the range instead of moving gradually and under control."],
    safetyNotes: ["Ease out of the movement if you feel pain, numbness, dizziness or sharp discomfort."],
    defaultProgramming: programming,
    tags: ["mobility", ...(options.tags ?? [])],
  };
}

const trainerSeeds: MovementSeed[] = [
  trainerMovement("chest-press-machine", "Chest Press Machine", "machine", ["chest", "shoulders", "arms"], ["pectorals", "triceps", "anterior deltoids"], ["chest press machine"], ["push", "upper-body"]),
  trainerMovement("incline-dumbbell-press", "Incline Dumbbell Press", "dumbbell", ["chest", "shoulders", "arms"], ["upper pectorals", "triceps", "anterior deltoids"], ["dumbbells", "incline bench"], ["push", "upper-body"]),
  trainerMovement("shoulder-press-machine", "Shoulder Press Machine", "machine", ["shoulders", "arms"], ["deltoids", "triceps"], ["shoulder press machine"], ["push", "upper-body"]),
  trainerMovement("cable-lateral-raises", "Cable Lateral Raises", "cable", ["shoulders"], ["lateral deltoids"], ["cable machine"], ["upper-body", "isolation"]),
  trainerMovement("triceps-rope-pushdown", "Triceps Rope Pushdown", "cable", ["arms"], ["triceps"], ["cable machine", "rope attachment"], ["upper-body", "isolation"]),
  trainerMovement("lat-pulldown", "Lat Pulldown", "machine", ["back", "arms"], ["latissimus dorsi", "biceps"], ["lat pulldown machine"], ["pull", "upper-body"]),
  trainerMovement("seated-cable-row", "Seated Cable Row", "cable", ["back", "arms"], ["mid back", "latissimus dorsi", "biceps"], ["cable row machine"], ["pull", "upper-body"]),
  trainerMovement("chest-supported-row", "Chest-Supported Row", "strength", ["back", "arms"], ["mid back", "rear deltoids", "biceps"], ["row machine or dumbbells", "support bench"], ["pull", "upper-body"]),
  trainerMovement("face-pulls", "Face Pulls", "cable", ["shoulders", "upper back"], ["rear deltoids", "upper back"], ["cable machine", "rope attachment"], ["pull", "posture"]),
  trainerMovement("dumbbell-biceps-curl", "Dumbbell Biceps Curl", "dumbbell", ["arms"], ["biceps"], ["dumbbells"], ["upper-body", "isolation"], ["Dumbbell Curl"]),
  trainerMovement("leg-press", "Leg Press", "machine", ["legs", "hips"], ["quadriceps", "glutes", "hamstrings"], ["leg press machine"], ["lower-body", "push"]),
  trainerMovement("goblet-squat", "Goblet Squat", "dumbbell", ["legs", "hips", "core"], ["quadriceps", "glutes"], ["dumbbell or kettlebell"], ["lower-body", "squat"]),
  trainerMovement("romanian-deadlift", "Romanian Deadlift", "strength", ["legs", "hips", "back"], ["hamstrings", "glutes", "back extensors"], ["barbell"], ["lower-body", "hinge"]),
  trainerMovement("leg-curl-machine", "Leg Curl Machine", "machine", ["legs"], ["hamstrings"], ["leg curl machine"], ["lower-body", "isolation"]),
  trainerMovement("standing-calf-raise", "Standing Calf Raise", "strength", ["legs"], ["calves"], ["calf raise machine or bodyweight"], ["lower-body", "isolation"]),
  trainerMovement("cable-triceps-pushdown", "Cable Triceps Pushdown", "cable", ["arms"], ["triceps"], ["cable machine", "bar attachment"], ["upper-body", "isolation"]),
  trainerMovement("walking-lunges", "Walking Lunges", "bodyweight", ["legs", "hips"], ["quadriceps", "glutes", "hamstrings"], [], ["lower-body", "lunge"]),
  trainerMovement("leg-extension", "Leg Extension", "machine", ["legs"], ["quadriceps"], ["leg extension machine"], ["lower-body", "isolation"]),
  trainerMovement("plank", "Plank", "bodyweight", ["core"], ["abdominals", "trunk stabilisers"], [], ["core", "stability"]),
  trainerMovement("dumbbell-romanian-deadlift", "Dumbbell Romanian Deadlift", "dumbbell", ["legs", "hips", "back"], ["hamstrings", "glutes", "back extensors"], ["dumbbells"], ["lower-body", "hinge"]),
  trainerMovement("cable-crunch", "Cable Crunch", "cable", ["core"], ["abdominals"], ["cable machine", "rope attachment"], ["core"]),
  trainerMovement("treadmill-incline-walk", "Treadmill Incline Walk", "conditioning", ["full body", "legs"], ["legs"], ["treadmill"], ["cardio", "conditioning"]),
  trainerMovement("kettlebell-deadlift", "Kettlebell Deadlift", "strength", ["legs", "hips", "back"], ["hamstrings", "glutes", "back extensors"], ["kettlebell"], ["lower-body", "hinge"]),
  trainerMovement("battle-ropes", "Battle Ropes", "conditioning", ["full body", "arms", "shoulders"], ["shoulders", "arms", "core"], ["battle ropes"], ["conditioning"]),
  trainerMovement("medicine-ball-slams", "Medicine Ball Slams", "conditioning", ["full body", "core"], ["core", "shoulders", "legs"], ["medicine ball"], ["conditioning"]),
  trainerMovement("bike-finisher", "Bike Finisher", "conditioning", ["legs", "cardiovascular"], ["legs"], ["stationary bike"], ["cardio", "conditioning"]),
  trainerMovement("easy-bike", "Easy Bike", "warmup", ["legs", "cardiovascular"], ["legs"], ["stationary bike"], ["cardio", "warmup"]),
  trainerMovement("dynamic-hip-mobility", "Dynamic Hip Mobility", "warmup", ["hips", "legs"], ["hips"], [], ["warmup", "mobility"]),
  trainerMovement("band-pull-aparts", "Band Pull-Aparts", "warmup", ["shoulders", "upper back"], ["rear deltoids", "upper back"], ["resistance band"], ["warmup", "posture"]),
  trainerMovement("bodyweight-squat", "Bodyweight Squat", "bodyweight", ["legs", "hips"], ["quadriceps", "glutes"], [], ["warmup", "lower-body"]),
  trainerMovement("stretching", "Stretching", "cooldown", ["full body"], ["full body"], [], ["cooldown", "recovery"]),
];

const mobilitySeeds: MovementSeed[] = [
  mobilityMovement("worlds-greatest-stretch", "World’s Greatest Stretch", ["hips", "hamstrings", "spine", "chest"], "20–30 seconds per side", "Step into a deep lunge, place one hand on the floor, then gently rotate your chest open towards the front leg.", "Move slowly and avoid forcing the twist."),
  mobilityMovement("standing-forward-fold", "Standing Forward Fold", ["hamstrings", "lower back"], "20–30 seconds", "Stand tall, soften your knees and slowly fold forward from the hips. Let your arms relax towards the floor.", "Keep the stretch comfortable, not painful."),
  mobilityMovement("cat-cow", "Cat-Cow", ["spine", "upper back"], "8–12 slow reps", "On all fours, gently round your back up, then lower your belly and lift your chest.", "Do not rush the movement.", { aliases: ["Cat-Cow Stretch"], type: "mobility" }),
  mobilityMovement("childs-pose", "Child’s Pose", ["back", "shoulders", "hips"], "30 seconds", "Kneel down, sit your hips back towards your heels and reach your arms forward.", "Place a towel under the knees if needed."),
  mobilityMovement("doorway-chest-stretch", "Doorway Chest Stretch", ["chest", "front shoulders"], "20–30 seconds per side", "Place your forearm against a doorway and slowly turn your body away until you feel a stretch across the chest.", "Do not force the shoulder joint.", { equipment: ["doorway"] }),
  mobilityMovement("wall-chest-opener", "Wall Chest Opener", ["chest"], "20–30 seconds per side", "Place one palm flat against a wall at shoulder height and gently rotate your body away from the wall.", "Keep the shoulder relaxed.", { equipment: ["wall"] }),
  mobilityMovement("hands-behind-back-chest-stretch", "Hands-Behind-Back Chest Stretch", ["chest", "shoulders"], "20–30 seconds", "Clasp your hands behind your back, gently straighten your arms and lift your chest.", "Avoid over-arching your lower back."),
  mobilityMovement("childs-pose-lat-reach", "Child’s Pose Lat Reach", ["lats", "upper back"], "20–30 seconds per side", "From child’s pose, walk both hands slightly to one side until you feel a stretch through the opposite side of your back.", "Keep breathing slowly."),
  mobilityMovement("thread-the-needle", "Thread the Needle", ["upper back", "shoulders"], "20–30 seconds per side", "On all fours, slide one arm under your body and gently lower your shoulder towards the floor.", "Stop if there is shoulder discomfort.", { type: "mobility" }),
  mobilityMovement("cross-body-shoulder-stretch", "Cross-Body Shoulder Stretch", ["rear shoulder"], "20–30 seconds per side", "Bring one arm across your chest and gently pull it closer with the opposite arm.", "Keep the shoulder down and relaxed."),
  mobilityMovement("overhead-shoulder-stretch", "Overhead Shoulder Stretch", ["shoulders", "triceps"], "20–30 seconds per side", "Lift one arm overhead, bend the elbow and gently guide it back with the opposite hand.", "Do not push the neck forward."),
  mobilityMovement("wall-angels", "Wall Angels", ["shoulders", "upper back"], "8–12 slow reps", "Stand with your back near a wall and slowly move your arms up and down like making a snow angel.", "Only move through a comfortable range.", { type: "mobility", equipment: ["wall"] }),
  mobilityMovement("biceps-wall-stretch", "Biceps Wall Stretch", ["biceps", "front shoulder"], "20–30 seconds per side", "Place your palm against a wall with your arm straight and gently turn your body away.", "Keep the movement gentle.", { equipment: ["wall"] }),
  mobilityMovement("overhead-triceps-stretch", "Overhead Triceps Stretch", ["triceps"], "20–30 seconds per side", "Raise one arm overhead, bend your elbow and gently pull the elbow back with the other hand.", "Avoid pulling hard on the elbow."),
  mobilityMovement("forearm-stretch", "Forearm Stretch", ["forearms", "wrists"], "15–25 seconds per side", "Hold one arm out with your palm facing up, then gently pull your fingers back with the opposite hand.", "Ease off if you feel wrist pain."),
  mobilityMovement("standing-quad-stretch", "Standing Quad Stretch", ["front thigh"], "20–30 seconds per side", "Stand tall, hold one foot behind you and gently bring your heel towards your glute.", "Keep your knees close and avoid arching your back."),
  mobilityMovement("hamstring-stretch", "Hamstring Stretch", ["back thigh"], "20–30 seconds per side", "Place one heel slightly forward, keep the leg mostly straight and hinge from your hips.", "Do not bounce."),
  mobilityMovement("calf-wall-stretch", "Calf Wall Stretch", ["calves"], "20–30 seconds per side", "Place your hands on a wall, step one foot back and press the heel down gently.", "Keep the back knee soft, not locked.", { equipment: ["wall"] }),
  mobilityMovement("half-kneeling-hip-flexor-stretch", "Half-Kneeling Hip Flexor Stretch", ["hip flexors"], "20–30 seconds per side", "Kneel on one knee, tuck your pelvis slightly and gently shift forward until you feel the front of the hip stretch.", "Do not over-arch your lower back."),
  mobilityMovement("figure-four-stretch", "Figure Four Stretch", ["glutes", "hips"], "20–30 seconds per side", "Lie on your back, cross one ankle over the opposite thigh and gently pull the leg towards you.", "Keep the neck relaxed."),
  mobilityMovement("90-90-hip-switch", "90/90 Hip Switch", ["hips"], "8–10 slow reps", "Sit with both knees bent at 90 degrees and slowly rotate your knees from one side to the other.", "Use your hands for support if needed.", { type: "mobility" }),
  mobilityMovement("side-neck-stretch", "Side Neck Stretch", ["side of neck"], "15–20 seconds per side", "Sit tall and gently tilt one ear towards the same-side shoulder.", "Do not pull hard on your head."),
  mobilityMovement("chin-tucks", "Chin Tucks", ["neck", "posture"], "8–12 slow reps", "Sit tall and gently draw your chin back as if making a double chin, then relax.", "Keep the movement small and controlled.", { type: "mobility" }),
  mobilityMovement("upper-trap-stretch", "Upper Trap Stretch", ["neck", "shoulders"], "15–20 seconds per side", "Tilt your head slightly to one side and let the opposite shoulder relax down.", "Stop if you feel sharp pain or tingling."),
  mobilityMovement("quad-stretch", "Quad Stretch", ["front thigh"], "20–30 seconds per side", "Hold one foot behind you and gently bring the heel towards your glute.", "Keep balance by holding a wall if needed."),
  mobilityMovement("chest-opener", "Chest Opener", ["chest", "shoulders"], "20–30 seconds", "Clasp your hands behind your back and gently lift your chest.", "Avoid forcing the shoulders."),
  mobilityMovement("forward-fold", "Forward Fold", ["hamstrings", "lower back"], "20–30 seconds", "Fold forward from the hips with soft knees and relaxed arms.", "Come back up slowly."),
  mobilityMovement("seated-chest-opener", "Seated Chest Opener", ["chest", "posture"], "20 seconds", "Sit tall, clasp your hands behind your back and gently open your chest.", "Keep your ribs down and avoid arching hard."),
  mobilityMovement("wrist-and-forearm-stretch", "Wrist and Forearm Stretch", ["wrists", "forearms"], "15–20 seconds per side", "Extend one arm forward and gently pull the fingers back with the other hand.", "Ease off if there is wrist pain."),
  mobilityMovement("neck-reset", "Neck Reset", ["neck"], "8–10 slow reps", "Gently tuck your chin back, pause briefly, then relax.", "Keep the movement small.", { type: "mobility" }),
];

export const movementCatalog: MovementDefinition[] = [
  ...trainerSeeds.map(defineMovement),
  ...mobilitySeeds.map(defineMovement),
];
