import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct member CSV sync has been retired. Use the staged XLSX/CSV preview import instead.",
      previewEndpoint: "/api/admin/members/import/preview",
    },
    { status: 410 }
  );
}
