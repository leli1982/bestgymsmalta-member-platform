import { NextResponse } from "next/server";
import { getGoogleWalletProviderState } from "@/lib/googleWalletProviderState";

export const dynamic = "force-dynamic";

const TEST_MEMBER_ID = "55a289ff-03a8-4b5c-a7a3-d21c2f626d92";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE });
  }

  try {
    const state = await getGoogleWalletProviderState(TEST_MEMBER_ID);
    return NextResponse.json(state, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet diagnostic failed." },
      { status: 502, headers: NO_STORE },
    );
  }
}
