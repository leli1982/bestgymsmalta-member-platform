import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function clampDays(value: number) {
  if (!Number.isFinite(value)) return 3;
  return Math.min(7, Math.max(1, Math.round(value)));
}

function publicPlan(row: any) {
  if (!row) return null;

  return {
    id: row.id,
    memberId: row.member_id,
    goal: row.goal || "",
    level: row.level || "",
    daysPerWeek: row.days_per_week || 3,
    minutes: row.minutes || 45,
    style: row.style || "",
    limitations: row.limitations || "",
    plan: row.plan_json || null,
    savedAt: row.saved_at,
    updatedAt: row.updated_at,
  };
}

async function getActiveMember(memberId: string) {
  const supabase = getSupabaseAdmin();

  const result = await supabase
    .from("bgm_members")
    .select("id, status, membership_expiry")
    .eq("id", memberId)
    .maybeSingle();

  if (result.error) throw result.error;

  const member = result.data;

  if (!member) {
    return { ok: false, error: "Member account not found." };
  }

  if (member.status !== "active") {
    return {
      ok: false,
      error: "This membership is inactive. Please renew at reception.",
    };
  }

  if (member.membership_expiry && member.membership_expiry < todayString()) {
    return {
      ok: false,
      error: "This membership has expired. Please renew at reception.",
    };
  }

  return { ok: true, error: "" };
}

function repGuide(goal: string, level: string) {
  const lowerGoal = goal.toLowerCase();
  const lowerLevel = level.toLowerCase();

  if (lowerGoal.includes("strong")) {
    return lowerLevel === "beginner"
      ? { main: "3", reps: "6-8", accessory: "2-3", accessoryReps: "10-12" }
      : { main: "4", reps: "4-6", accessory: "3", accessoryReps: "8-10" };
  }

  if (lowerGoal.includes("fat") || lowerGoal.includes("fitness")) {
    return { main: "3", reps: "10-15", accessory: "3", accessoryReps: "12-15" };
  }

  if (lowerGoal.includes("tone") || lowerGoal.includes("health")) {
    return { main: "3", reps: "10-12", accessory: "2-3", accessoryReps: "12-15" };
  }

  return { main: "3-4", reps: "8-12", accessory: "3", accessoryReps: "10-12" };
}

function dayExercises(focus: string, goal: string, level: string) {
  const guide = repGuide(goal, level);
  const lowerFocus = focus.toLowerCase();

  const plans: Record<string, any[]> = {
    push: [
      { name: "Chest Press Machine", sets: guide.main, reps: guide.reps, notes: "Controlled tempo, full range of motion." },
      { name: "Incline Dumbbell Press", sets: guide.main, reps: guide.reps, notes: "Keep shoulders stable." },
      { name: "Shoulder Press Machine", sets: guide.accessory, reps: guide.accessoryReps, notes: "Do not arch your lower back." },
      { name: "Cable Lateral Raises", sets: guide.accessory, reps: guide.accessoryReps, notes: "Light weight, clean movement." },
      { name: "Triceps Rope Pushdown", sets: guide.accessory, reps: guide.accessoryReps, notes: "Keep elbows close to your sides." },
    ],
    pull: [
      { name: "Lat Pulldown", sets: guide.main, reps: guide.reps, notes: "Pull elbows down, not just hands." },
      { name: "Seated Cable Row", sets: guide.main, reps: guide.reps, notes: "Pause briefly at the squeeze." },
      { name: "Chest-Supported Row", sets: guide.accessory, reps: guide.accessoryReps, notes: "Avoid swinging." },
      { name: "Face Pulls", sets: guide.accessory, reps: guide.accessoryReps, notes: "Great for shoulders and posture." },
      { name: "Dumbbell Biceps Curl", sets: guide.accessory, reps: guide.accessoryReps, notes: "Slow lowering phase." },
    ],
    legs: [
      { name: "Leg Press", sets: guide.main, reps: guide.reps, notes: "Feet stable, controlled depth." },
      { name: "Goblet Squat", sets: guide.main, reps: guide.reps, notes: "Keep chest tall." },
      { name: "Romanian Deadlift", sets: guide.accessory, reps: guide.accessoryReps, notes: "Hinge from the hips." },
      { name: "Leg Curl Machine", sets: guide.accessory, reps: guide.accessoryReps, notes: "Control each rep." },
      { name: "Standing Calf Raise", sets: guide.accessory, reps: "12-18", notes: "Pause at the top." },
    ],
    upper: [
      { name: "Chest Press Machine", sets: guide.main, reps: guide.reps, notes: "Main upper-body push." },
      { name: "Lat Pulldown", sets: guide.main, reps: guide.reps, notes: "Main upper-body pull." },
      { name: "Seated Cable Row", sets: guide.accessory, reps: guide.accessoryReps, notes: "Keep torso still." },
      { name: "Shoulder Press Machine", sets: guide.accessory, reps: guide.accessoryReps, notes: "Controlled reps." },
      { name: "Cable Triceps Pushdown", sets: guide.accessory, reps: guide.accessoryReps, notes: "Finish strong." },
      { name: "Dumbbell Curl", sets: guide.accessory, reps: guide.accessoryReps, notes: "No swinging." },
    ],
    lower: [
      { name: "Leg Press", sets: guide.main, reps: guide.reps, notes: "Main lower-body movement." },
      { name: "Walking Lunges", sets: guide.accessory, reps: "10 each leg", notes: "Take controlled steps." },
      { name: "Romanian Deadlift", sets: guide.accessory, reps: guide.accessoryReps, notes: "Feel the hamstrings." },
      { name: "Leg Extension", sets: guide.accessory, reps: guide.accessoryReps, notes: "Pause at the top." },
      { name: "Plank", sets: "3", reps: "30-45 sec", notes: "Keep hips level." },
    ],
    full: [
      { name: "Leg Press", sets: guide.main, reps: guide.reps, notes: "Start with legs while fresh." },
      { name: "Chest Press Machine", sets: guide.main, reps: guide.reps, notes: "Controlled push." },
      { name: "Lat Pulldown", sets: guide.main, reps: guide.reps, notes: "Controlled pull." },
      { name: "Dumbbell Romanian Deadlift", sets: guide.accessory, reps: guide.accessoryReps, notes: "Hip hinge movement." },
      { name: "Shoulder Press Machine", sets: guide.accessory, reps: guide.accessoryReps, notes: "Keep core tight." },
      { name: "Cable Crunch", sets: "3", reps: "12-15", notes: "Slow and controlled." },
    ],
    conditioning: [
      { name: "Treadmill Incline Walk", sets: "1", reps: "10-15 min", notes: "Moderate pace." },
      { name: "Kettlebell Deadlift", sets: "3", reps: "12", notes: "Keep back neutral." },
      { name: "Battle Ropes", sets: "4", reps: "25 sec", notes: "Rest 45 seconds." },
      { name: "Medicine Ball Slams", sets: "3", reps: "10-12", notes: "Explosive but controlled." },
      { name: "Bike Finisher", sets: "1", reps: "8-10 min", notes: "Steady finish." },
    ],
    recovery: [
      { name: "Easy Bike", sets: "1", reps: "10 min", notes: "Low intensity." },
      { name: "Dynamic Hip Mobility", sets: "2", reps: "8 each side", notes: "Move slowly." },
      { name: "Band Pull-Aparts", sets: "3", reps: "15", notes: "Posture and shoulder health." },
      { name: "Bodyweight Squat", sets: "2", reps: "12", notes: "Easy movement quality." },
      { name: "Stretching", sets: "1", reps: "8-10 min", notes: "Focus on tight areas." },
    ],
  };

  if (lowerFocus.includes("upper")) return plans.upper;
  if (lowerFocus.includes("lower")) return plans.lower;
  if (lowerFocus.includes("strength")) return plans.full;
  if (lowerFocus.includes("conditioning")) return plans.conditioning;

  return plans[focus] || plans.full;
}

function splitForDays(daysPerWeek: number, preferredFocus: string) {
  const lowerFocus = preferredFocus.toLowerCase();

  if (lowerFocus.includes("upper")) {
    return ["upper", "upper", "upper", "upper", "upper", "upper", "recovery"].slice(0, daysPerWeek);
  }

  if (lowerFocus.includes("lower")) {
    return ["lower", "lower", "lower", "lower", "lower", "lower", "recovery"].slice(0, daysPerWeek);
  }

  if (lowerFocus.includes("conditioning")) {
    return ["conditioning", "full", "conditioning", "full", "conditioning", "lower", "recovery"].slice(0, daysPerWeek);
  }

  if (daysPerWeek === 1) return ["full"];
  if (daysPerWeek === 2) return ["upper", "lower"];
  if (daysPerWeek === 3) return ["push", "pull", "legs"];
  if (daysPerWeek === 4) return ["upper", "lower", "upper", "lower"];
  if (daysPerWeek === 5) return ["push", "pull", "legs", "upper", "lower"];
  if (daysPerWeek === 6) return ["push", "pull", "legs", "push", "pull", "legs"];

  return ["push", "pull", "legs", "conditioning", "upper", "lower", "recovery"];
}

function titleForFocus(focus: string) {
  const titles: Record<string, string> = {
    push: "Push Day",
    pull: "Pull Day",
    legs: "Leg Day",
    upper: "Upper Body",
    lower: "Lower Body",
    full: "Full Body",
    conditioning: "Conditioning",
    recovery: "Active Recovery",
  };

  return titles[focus] || "Training Day";
}

function generateWorkoutPlan({
  goal,
  level,
  daysPerWeek,
  minutes,
  style,
  limitations,
}: {
  goal: string;
  level: string;
  daysPerWeek: number;
  minutes: number;
  style: string;
  limitations: string;
}) {
  const days = clampDays(daysPerWeek);
  const sessionMinutes = Number.isFinite(minutes) ? minutes : 45;
  const split = splitForDays(days, style || "Full body");

  const trainingDays = split.map((focus, index) => ({
    day: `Day ${index + 1}`,
    title: titleForFocus(focus),
    focus: titleForFocus(focus),
    exercises: dayExercises(focus, goal, level),
    notes:
      focus === "recovery"
        ? "Keep this day easy. The goal is movement, mobility and recovery."
        : `Aim for around ${sessionMinutes} minutes. Start with 5-8 minutes warm-up and finish with light stretching.`,
  }));

  return {
    title: `${days}-Day ${goal || "Fitness"} Plan`,
    summary: `A ${level || "beginner"} ${days}-day plan focused on ${goal || "general fitness"}. Built for around ${sessionMinutes} minutes per session.`,
    createdAt: new Date().toISOString(),
    days: trainingDays,
    guidance: [
      "Use a weight that allows clean form.",
      "Rest 60-90 seconds between most sets.",
      "If something causes pain, stop and ask a coach.",
      "Try to progress slowly by adding reps, control or weight over time.",
    ],
    limitations: limitations || "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const memberId = clean(request.nextUrl.searchParams.get("memberId"));

    if (!memberId) {
      return NextResponse.json({ savedPlan: null });
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_member_workout_plans")
      .select("*")
      .eq("member_id", memberId)
      .maybeSingle();

    if (result.error) throw result.error;

    return NextResponse.json({
      savedPlan: publicPlan(result.data),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { savedPlan: null, error: "Could not load saved workout plan." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const memberId = clean(body.memberId);
    const goal = clean(body.goal) || "Build muscle";
    const level = clean(body.level || body.experience) || "Beginner";
    const daysPerWeek = clampDays(Number(body.daysPerWeek || 3));
    const minutes = Number(body.minutes || body.sessionTime || 45);
    const style = clean(body.style || body.focus) || "Full body";
    const limitations = clean(body.limitations || body.notes);

    if (!memberId) {
      return NextResponse.json(
        { error: "Please log in before saving your plan." },
        { status: 401 }
      );
    }

    const activeMember = await getActiveMember(memberId);

    if (!activeMember.ok) {
      return NextResponse.json(
        { error: activeMember.error },
        { status: 403 }
      );
    }

    const generatedPlan = generateWorkoutPlan({
      goal,
      level,
      daysPerWeek,
      minutes,
      style,
      limitations,
    });

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const payload = {
      member_id: memberId,
      goal,
      level,
      days_per_week: daysPerWeek,
      minutes,
      style,
      limitations: limitations || null,
      plan_json: generatedPlan,
      saved_at: now,
      updated_at: now,
    };

    const result = await supabase
      .from("bgm_member_workout_plans")
      .upsert(payload, { onConflict: "member_id" })
      .select("*")
      .single();

    if (result.error) throw result.error;

    return NextResponse.json({
      savedPlan: publicPlan(result.data),
      plan: generatedPlan,
      message: "Workout plan saved to your member account.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not save workout plan." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const memberId = clean(request.nextUrl.searchParams.get("memberId"));

    if (!memberId) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_member_workout_plans")
      .delete()
      .eq("member_id", memberId);

    if (result.error) throw result.error;

    return NextResponse.json({
      ok: true,
      message: "Saved workout plan cleared.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not clear workout plan." },
      { status: 500 }
    );
  }
}
