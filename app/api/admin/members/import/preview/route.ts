import { NextRequest, NextResponse } from "next/server";
import { previewMemberImport } from "@/lib/memberImportServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isInputError(message: string) {
  return (
    message.includes("membership file") ||
    message.includes("Membership XLSX") ||
    message.includes("Membership CSV") ||
    message.includes("header") ||
    message.includes(".xlsx") ||
    message.includes(".csv")
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.import");
    if (auth.error) return auth.error;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "An XLSX or CSV membership file is required." },
        { status: 400 }
      );
    }

    const result = await previewMemberImport({
      file,
      systemUserId: auth.context.systemUserId,
      supabase: getSupabaseAdmin(),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error.";
    console.error("Membership import preview failed:", message);
    return NextResponse.json(
      {
        error: isInputError(message)
          ? message
          : "Could not prepare the membership import preview.",
      },
      { status: isInputError(message) ? 400 : 500 }
    );
  }
}
