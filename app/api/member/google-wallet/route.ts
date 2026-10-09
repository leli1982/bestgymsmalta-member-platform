import { NextRequest, NextResponse } from "next/server";
import { getMemberRequestSession } from "@/lib/memberAuth";
import {
  googleWalletObjectId,
  projectGoogleWalletMember,
} from "@/lib/googleWalletCore";
import {
  buildGoogleWalletSaveUrl,
  getGoogleWalletConfig,
} from "@/lib/googleWalletServer";
import {
  getGoogleWalletPassStatus,
  loadGoogleWalletMemberSnapshot,
  syncGoogleWalletPassForMember,
} from "@/lib/googleWalletSync";
import { todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
};

function unavailableStatus() {
  return {
    available: false,
    eligible: false,
    reason: "unavailable",
    provisioned: false,
    syncStatus: null,
    lastSyncedAt: null,
  };
}

export async function GET(request: NextRequest) {
  const session = getMemberRequestSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Member session required. Please log in again." },
      { status: 401, headers: PRIVATE_NO_STORE },
    );
  }

  let config;
  try {
    config = getGoogleWalletConfig();
  } catch {
    return NextResponse.json(unavailableStatus(), { headers: PRIVATE_NO_STORE });
  }

  if (!config) {
    return NextResponse.json(unavailableStatus(), { headers: PRIVATE_NO_STORE });
  }

  try {
    const snapshot = await loadGoogleWalletMemberSnapshot(session.memberId);
    if (!snapshot) {
      return NextResponse.json(unavailableStatus(), { headers: PRIVATE_NO_STORE });
    }

    const projection = projectGoogleWalletMember(snapshot, todayMaltaDate());
    const passStatus = await getGoogleWalletPassStatus(session.memberId);

    return NextResponse.json(
      {
        available: true,
        eligible: projection.eligibleToAdd,
        reason: projection.reason,
        provisioned: passStatus.provisioned,
        syncStatus: passStatus.syncStatus,
        lastSyncedAt: passStatus.lastSyncedAt,
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch {
    return NextResponse.json(unavailableStatus(), { headers: PRIVATE_NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  const session = getMemberRequestSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Member session required. Please log in again." },
      { status: 401, headers: PRIVATE_NO_STORE },
    );
  }

  let config;
  try {
    config = getGoogleWalletConfig();
  } catch {
    return NextResponse.json(
      { error: "Google Wallet is unavailable." },
      { status: 503, headers: PRIVATE_NO_STORE },
    );
  }

  if (!config) {
    return NextResponse.json(
      { error: "Google Wallet is unavailable." },
      { status: 503, headers: PRIVATE_NO_STORE },
    );
  }

  try {
    const snapshot = await loadGoogleWalletMemberSnapshot(session.memberId);
    if (!snapshot) {
      return NextResponse.json(
        { error: "Could not prepare Google Wallet." },
        { status: 502, headers: PRIVATE_NO_STORE },
      );
    }

    const projection = projectGoogleWalletMember(snapshot, todayMaltaDate());
    if (!projection.eligibleToAdd) {
      return NextResponse.json(
        {
          error: "This membership is not eligible for Google Wallet.",
          reason: projection.reason,
        },
        { status: 409, headers: PRIVATE_NO_STORE },
      );
    }

    const result = await syncGoogleWalletPassForMember(session.memberId, { provision: true });
    if (result === "unavailable") {
      return NextResponse.json(
        { error: "Google Wallet is unavailable." },
        { status: 503, headers: PRIVATE_NO_STORE },
      );
    }
    if (result !== "synced") {
      return NextResponse.json(
        { error: "Could not prepare Google Wallet." },
        { status: 502, headers: PRIVATE_NO_STORE },
      );
    }

    const objectId = googleWalletObjectId(
      config.issuerId,
      session.memberId,
      config.objectPrefix,
    );
    const saveUrl = buildGoogleWalletSaveUrl(objectId, config);

    return NextResponse.json({ saveUrl }, { headers: PRIVATE_NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "Could not prepare Google Wallet." },
      { status: 502, headers: PRIVATE_NO_STORE },
    );
  }
}
