"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/ui/AppShell";

type Stretch = {
  name: string;
  area: string;
  hold: string;
  instructions: string;
  note: string;
};

type StretchCategory = {
  label: string;
  intro: string;
  stretches: Stretch[];
};

const stretchCategories: Record<string, StretchCategory> = {
  fullBody: {
    label: "Full Body",
    intro: "A balanced routine to loosen up the main areas before or after training.",
    stretches: [
      {
        name: "World’s Greatest Stretch",
        area: "Hips, hamstrings, spine and chest",
        hold: "20–30 seconds per side",
        instructions:
          "Step into a deep lunge, place one hand on the floor, then gently rotate your chest open towards the front leg.",
        note: "Move slowly and avoid forcing the twist.",
      },
      {
        name: "Standing Forward Fold",
        area: "Hamstrings and lower back",
        hold: "20–30 seconds",
        instructions:
          "Stand tall, soften your knees and slowly fold forward from the hips. Let your arms relax towards the floor.",
        note: "Keep the stretch comfortable, not painful.",
      },
      {
        name: "Cat-Cow Stretch",
        area: "Spine and upper back",
        hold: "8–12 slow reps",
        instructions:
          "On all fours, gently round your back up, then lower your belly and lift your chest.",
        note: "Do not rush the movement.",
      },
      {
        name: "Child’s Pose",
        area: "Back, shoulders and hips",
        hold: "30 seconds",
        instructions:
          "Kneel down, sit your hips back towards your heels and reach your arms forward.",
        note: "Place a towel under the knees if needed.",
      },
    ],
  },

  chest: {
    label: "Chest",
    intro: "Good after pressing exercises, push-ups, bench press or long hours sitting.",
    stretches: [
      {
        name: "Doorway Chest Stretch",
        area: "Chest and front shoulders",
        hold: "20–30 seconds per side",
        instructions:
          "Place your forearm against a doorway and slowly turn your body away until you feel a stretch across the chest.",
        note: "Do not force the shoulder joint.",
      },
      {
        name: "Wall Chest Opener",
        area: "Chest",
        hold: "20–30 seconds per side",
        instructions:
          "Place one palm flat against a wall at shoulder height and gently rotate your body away from the wall.",
        note: "Keep the shoulder relaxed.",
      },
      {
        name: "Hands-Behind-Back Chest Stretch",
        area: "Chest and shoulders",
        hold: "20–30 seconds",
        instructions:
          "Clasp your hands behind your back, gently straighten your arms and lift your chest.",
        note: "Avoid over-arching your lower back.",
      },
    ],
  },

  back: {
    label: "Back",
    intro: "Useful after pulling exercises, rows, deadlifts or general stiffness.",
    stretches: [
      {
        name: "Child’s Pose Lat Reach",
        area: "Lats and upper back",
        hold: "20–30 seconds per side",
        instructions:
          "From child’s pose, walk both hands slightly to one side until you feel a stretch through the opposite side of your back.",
        note: "Keep breathing slowly.",
      },
      {
        name: "Thread the Needle",
        area: "Upper back and shoulders",
        hold: "20–30 seconds per side",
        instructions:
          "On all fours, slide one arm under your body and gently lower your shoulder towards the floor.",
        note: "Stop if there is shoulder discomfort.",
      },
    ],
  },

  shoulders: {
    label: "Shoulders",
    intro: "Great after upper-body training or when shoulders feel tight.",
    stretches: [
      {
        name: "Cross-Body Shoulder Stretch",
        area: "Rear shoulder",
        hold: "20–30 seconds per side",
        instructions:
          "Bring one arm across your chest and gently pull it closer with the opposite arm.",
        note: "Keep the shoulder down and relaxed.",
      },
      {
        name: "Overhead Shoulder Stretch",
        area: "Shoulders and triceps",
        hold: "20–30 seconds per side",
        instructions:
          "Lift one arm overhead, bend the elbow and gently guide it back with the opposite hand.",
        note: "Do not push the neck forward.",
      },
      {
        name: "Wall Angels",
        area: "Shoulder mobility",
        hold: "8–12 slow reps",
        instructions:
          "Stand with your back near a wall and slowly move your arms up and down like making a snow angel.",
        note: "Only move through a comfortable range.",
      },
    ],
  },

  arms: {
    label: "Arms",
    intro: "Simple stretches for biceps, triceps and forearms.",
    stretches: [
      {
        name: "Biceps Wall Stretch",
        area: "Biceps and front shoulder",
        hold: "20–30 seconds per side",
        instructions:
          "Place your palm against a wall with your arm straight and gently turn your body away.",
        note: "Keep the movement gentle.",
      },
      {
        name: "Overhead Triceps Stretch",
        area: "Triceps",
        hold: "20–30 seconds per side",
        instructions:
          "Raise one arm overhead, bend your elbow and gently pull the elbow back with the other hand.",
        note: "Avoid pulling hard on the elbow.",
      },
      {
        name: "Forearm Stretch",
        area: "Forearms and wrists",
        hold: "15–25 seconds per side",
        instructions:
          "Hold one arm out with your palm facing up, then gently pull your fingers back with the opposite hand.",
        note: "Ease off if you feel wrist pain.",
      },
    ],
  },

  legs: {
    label: "Legs",
    intro: "Good after squats, leg press, running or lower-body training.",
    stretches: [
      {
        name: "Standing Quad Stretch",
        area: "Front thigh",
        hold: "20–30 seconds per side",
        instructions:
          "Stand tall, hold one foot behind you and gently bring your heel towards your glute.",
        note: "Keep your knees close and avoid arching your back.",
      },
      {
        name: "Hamstring Stretch",
        area: "Back thigh",
        hold: "20–30 seconds per side",
        instructions:
          "Place one heel slightly forward, keep the leg mostly straight and hinge from your hips.",
        note: "Do not bounce.",
      },
      {
        name: "Calf Wall Stretch",
        area: "Calves",
        hold: "20–30 seconds per side",
        instructions:
          "Place your hands on a wall, step one foot back and press the heel down gently.",
        note: "Keep the back knee soft, not locked.",
      },
    ],
  },

  hips: {
    label: "Hips",
    intro: "Ideal for tight hips, sitting all day or lower-body workouts.",
    stretches: [
      {
        name: "Half-Kneeling Hip Flexor Stretch",
        area: "Hip flexors",
        hold: "20–30 seconds per side",
        instructions:
          "Kneel on one knee, tuck your pelvis slightly and gently shift forward until you feel the front of the hip stretch.",
        note: "Do not over-arch your lower back.",
      },
      {
        name: "Figure Four Stretch",
        area: "Glutes and hips",
        hold: "20–30 seconds per side",
        instructions:
          "Lie on your back, cross one ankle over the opposite thigh and gently pull the leg towards you.",
        note: "Keep the neck relaxed.",
      },
      {
        name: "90/90 Hip Switch",
        area: "Hip mobility",
        hold: "8–10 slow reps",
        instructions:
          "Sit with both knees bent at 90 degrees and slowly rotate your knees from one side to the other.",
        note: "Use your hands for support if needed.",
      },
    ],
  },

  neck: {
    label: "Neck",
    intro: "Simple gentle stretches for stiffness from desk work or stress.",
    stretches: [
      {
        name: "Side Neck Stretch",
        area: "Side of neck",
        hold: "15–20 seconds per side",
        instructions:
          "Sit tall and gently tilt one ear towards the same-side shoulder.",
        note: "Do not pull hard on your head.",
      },
      {
        name: "Chin Tucks",
        area: "Neck posture",
        hold: "8–12 slow reps",
        instructions:
          "Sit tall and gently draw your chin back as if making a double chin, then relax.",
        note: "Keep the movement small and controlled.",
      },
      {
        name: "Upper Trap Stretch",
        area: "Neck and shoulders",
        hold: "15–20 seconds per side",
        instructions:
          "Tilt your head slightly to one side and let the opposite shoulder relax down.",
        note: "Stop if you feel sharp pain or tingling.",
      },
    ],
  },

  postWorkout: {
    label: "Post-Workout",
    intro: "A calm cooldown routine to relax the body after training.",
    stretches: [
      {
        name: "Child’s Pose",
        area: "Back and hips",
        hold: "30 seconds",
        instructions:
          "Sit your hips back towards your heels and reach your arms forward.",
        note: "Breathe slowly and relax into the position.",
      },
      {
        name: "Quad Stretch",
        area: "Front thigh",
        hold: "20–30 seconds per side",
        instructions:
          "Hold one foot behind you and gently bring the heel towards your glute.",
        note: "Keep balance by holding a wall if needed.",
      },
      {
        name: "Chest Opener",
        area: "Chest and shoulders",
        hold: "20–30 seconds",
        instructions:
          "Clasp your hands behind your back and gently lift your chest.",
        note: "Avoid forcing the shoulders.",
      },
      {
        name: "Forward Fold",
        area: "Hamstrings and lower back",
        hold: "20–30 seconds",
        instructions:
          "Fold forward from the hips with soft knees and relaxed arms.",
        note: "Come back up slowly.",
      },
    ],
  },

  desk: {
    label: "Desk / Stiffness",
    intro: "Quick movements for members who sit for long periods.",
    stretches: [
      {
        name: "Seated Chest Opener",
        area: "Chest and posture",
        hold: "20 seconds",
        instructions:
          "Sit tall, clasp your hands behind your back and gently open your chest.",
        note: "Keep your ribs down and avoid arching hard.",
      },
      {
        name: "Wrist and Forearm Stretch",
        area: "Wrists and forearms",
        hold: "15–20 seconds per side",
        instructions:
          "Extend one arm forward and gently pull the fingers back with the other hand.",
        note: "Ease off if there is wrist pain.",
      },
      {
        name: "Neck Reset",
        area: "Neck",
        hold: "8–10 slow reps",
        instructions:
          "Gently tuck your chin back, pause briefly, then relax.",
        note: "Keep the movement small.",
      },
    ],
  },
};

export default function MobilityStretchPage() {
  const [selectedCategory, setSelectedCategory] = useState("fullBody");

  const category = useMemo(() => {
    return stretchCategories[selectedCategory] ?? stretchCategories.fullBody;
  }, [selectedCategory]);

  return (
    <AppShell>
      <div className="min-h-screen bg-neutral-950 px-4 pb-28 pt-5 text-white">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <section className="relative overflow-hidden rounded-[2rem] border border-orange-500/20 bg-neutral-900 shadow-2xl">
            <img
              src="/images/mobility-stretch-card.png"
              alt="Mobility and Stretch"
              className="h-64 w-full object-cover opacity-85"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-black/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                <HeartPulse className="h-4 w-4" />
                Recovery guide
              </div>

              <h1 className="text-3xl font-black tracking-tight">
                Mobility & Stretch
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-neutral-200">
                Stretch smarter, move better and recover faster with simple routines by body area.
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-[1.5rem] border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
            <div className="mb-2 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Important
            </div>
            These are general stretching suggestions. Stop if you feel pain, numbness, dizziness or sharp discomfort. Always consult with a medical professional before starting any stretching or exercise routine, especially if you have an injury, medical condition or ongoing pain.
          </section>

          <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <label className="mb-2 block text-sm font-semibold text-neutral-200">
              Choose stretch area
            </label>

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-orange-500"
            >
              {Object.entries(stretchCategories).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </section>

          <section className="mt-5">
            <div className="mb-4">
              <h2 className="text-2xl font-black">{category.label}</h2>
              <p className="mt-1 text-sm text-neutral-400">{category.intro}</p>
            </div>

            <div className="grid gap-4">
              {category.stretches.map((stretch) => (
                <article
                  key={stretch.name}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black">{stretch.name}</h3>
                      <p className="mt-1 text-sm text-orange-300">
                        {stretch.area}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 rounded-full bg-orange-500/15 px-3 py-1 text-sm font-bold text-orange-200">
                      <Clock className="h-4 w-4" />
                      {stretch.hold}
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-neutral-300">
                    {stretch.instructions}
                  </p>

                  <div className="mt-4 flex gap-2 rounded-2xl border border-orange-500/15 bg-orange-500/10 p-3 text-xs leading-5 text-orange-100">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                    {stretch.note}
                  </div>
                </article>
              ))}
            </div>
          </section>

        </div>
      </div>
    </AppShell>
  );
}
