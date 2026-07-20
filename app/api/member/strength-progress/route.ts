import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type StrengthEntryInput = {
  exerciseName?: string;
  exercise_name?: string;
  progressDate?: string;
  progress_date?: string;
  weightKg?: string | number;
  weight_kg?: string | number;
  sets?: string | number;
  reps?: string | number;
  notes?: string;
};

type StrengthProgressInsert = {
  member_id: string;
  exercise_name: string;
  progress_date: string;
  weight_kg: number;
  sets: number;
  reps: number;
  notes: string | null;
};

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export async function GET(request: NextRequest) {
  try {
    const memberId = request.nextUrl.searchParams.get("memberId") || "";
    const exerciseName = request.nextUrl.searchParams.get("exerciseName") || "";

    if (!memberId) {
      return NextResponse.json({
        entries: [],
      });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("bgm_strength_progress")
      .select("*")
      .eq("member_id", memberId)
      .order("progress_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(250);

    if (exerciseName) {
      query = query.eq("exercise_name", exerciseName);
    }

    const result = await query;

    if (result.error) throw result.error;

    return NextResponse.json({
      entries: result.data || [],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        entries: [],
        error: "Could not load strength progress.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const memberId = cleanText(body.memberId);
    const entries: StrengthEntryInput[] = Array.isArray(body.entries)
      ? body.entries
      : [];

    if (!memberId) {
      return NextResponse.json(
        { error: "Please log in before saving progress." },
        { status: 401 }
      );
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Add at least one exercise." },
        { status: 400 }
      );
    }

    const payload: StrengthProgressInsert[] = entries
      .map((entry: StrengthEntryInput) => {
        const exerciseName = cleanText(entry.exerciseName || entry.exercise_name);
        const progressDate = cleanText(entry.progressDate || entry.progress_date);
        const weightKg = toNumber(entry.weightKg || entry.weight_kg);
        const sets = Math.round(toNumber(entry.sets));
        const reps = Math.round(toNumber(entry.reps));
        const notes = cleanText(entry.notes);

        return {
          member_id: memberId,
          exercise_name: exerciseName,
          progress_date: progressDate || new Date().toISOString().slice(0, 10),
          weight_kg: weightKg,
          sets,
          reps,
          notes: notes || null,
        };
      })
      .filter((entry: StrengthProgressInsert) => {
        return (
          entry.exercise_name &&
          entry.weight_kg > 0 &&
          entry.sets > 0 &&
          entry.reps > 0
        );
      });

    if (payload.length === 0) {
      return NextResponse.json(
        {
          error:
            "Please choose an exercise and enter weight, sets and repetitions.",
        },
        { status: 400 }
      );
    }

    const insertResult = await supabase
      .from("bgm_strength_progress")
      .insert(payload)
      .select("*");

    if (insertResult.error) throw insertResult.error;

    return NextResponse.json({
      entries: insertResult.data || [],
      message: "Strength progress saved.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not save strength progress." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));

    const memberId =
      cleanText(body.memberId) || request.nextUrl.searchParams.get("memberId") || "";
    const entryId =
      cleanText(body.entryId) || request.nextUrl.searchParams.get("entryId") || "";

    if (!memberId || !entryId) {
      return NextResponse.json(
        { error: "Missing progress entry details." },
        { status: 400 }
      );
    }

    const deleteResult = await supabase
      .from("bgm_strength_progress")
      .delete()
      .eq("id", entryId)
      .eq("member_id", memberId);

    if (deleteResult.error) throw deleteResult.error;

    return NextResponse.json({
      message: "Progress entry deleted.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not delete progress entry." },
      { status: 500 }
    );
  }
}
