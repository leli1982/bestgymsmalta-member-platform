import { NextRequest, NextResponse } from "next/server";

const BROKEN_HELP_IMAGES = new Set([
  "/staff-help/new-member.webp",
  "/staff-help/waiting-applications.webp",
  "/staff-help/renew-membership.webp",
  "/staff-help/sundries.webp",
]);

function helpVisual(pathname: string) {
  const topic = pathname.split("/").pop()?.replace(".webp", "") ?? "";
  const config: Record<string, { title: string; action: string; note: string }> = {
    "new-member": {
      title: "Add a new member",
      action: "Press New Member",
      note: "Start here to create a new membership.",
    },
    "waiting-applications": {
      title: "Review and activate",
      action: "Check the application, then press Continue",
      note: "Confirm the member details and photo before activation.",
    },
    "renew-membership": {
      title: "Renew a membership",
      action: "Press Renew Membership",
      note: "Find the member first, then complete the renewal.",
    },
    sundries: {
      title: "Send Sundries order",
      action: "Press Sundries",
      note: "Add the required items and send the order when complete.",
    },
  };

  const item = config[topic] ?? config["new-member"];
  const safeTitle = item.title.replace(/&/g, "&amp;");
  const safeAction = item.action.replace(/&/g, "&amp;");
  const safeNote = item.note.replace(/&/g, "&amp;");
  const isWaiting = topic === "waiting-applications";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#eef1f4"/>
  <rect x="28" y="24" width="1224" height="672" rx="22" fill="#fff" stroke="#d6dce2" stroke-width="2"/>
  <rect x="28" y="24" width="1224" height="78" rx="22" fill="#101820"/>
  <text x="70" y="74" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#fff">BestGymsMalta Staff Portal</text>
  ${isWaiting ? `
  <text x="70" y="150" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#20252b">${safeTitle}</text>
  <rect x="70" y="182" width="1140" height="360" rx="18" fill="#f7f8f9" stroke="#d8dde2"/>
  <rect x="105" y="220" width="205" height="235" rx="14" fill="#e2e6ea"/>
  <circle cx="208" cy="292" r="50" fill="#c2c9cf"/>
  <path d="M135 422c18-64 128-64 146 0" fill="#c2c9cf"/>
  <text x="350" y="245" font-family="Arial,sans-serif" font-size="18" fill="#687078">MEMBER APPLICATION</text>
  <text x="350" y="292" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#20252b">Check details and member photo</text>
  <text x="350" y="344" font-family="Arial,sans-serif" font-size="20" fill="#454b52">Confirm everything on screen is correct.</text>
  <rect x="350" y="394" width="245" height="66" rx="12" fill="#ef7d00"/>
  <text x="472" y="436" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#fff">Continue</text>
  <rect x="615" y="394" width="180" height="66" rx="12" fill="#fff" stroke="#c8ced4" stroke-width="2"/>
  <text x="705" y="436" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#333">Reject</text>` : `
  <text x="70" y="150" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#20252b">${safeTitle}</text>
  <rect x="70" y="182" width="1140" height="360" rx="18" fill="#f7f8f9" stroke="#d8dde2"/>
  <text x="105" y="235" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#687078">STAFF DASHBOARD</text>
  <rect x="105" y="270" width="300" height="95" rx="16" fill="#fff" stroke="#d3d9df" stroke-width="2"/>
  <text x="255" y="327" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#2b3137">Find Member</text>
  <rect x="430" y="270" width="330" height="95" rx="16" fill="#fff3e6" stroke="#ef7d00" stroke-width="5"/>
  <text x="595" y="327" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#b55c00">${safeAction}</text>
  <path d="M595 385v48" stroke="#ef7d00" stroke-width="7" stroke-linecap="round"/>
  <path d="M595 454l-15-24h30z" fill="#ef7d00"/>
  <rect x="785" y="270" width="300" height="95" rx="16" fill="#fff" stroke="#d3d9df" stroke-width="2"/>
  <text x="935" y="327" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#2b3137">Reception Tools</text>`}
  <rect x="70" y="575" width="1140" height="82" rx="14" fill="#fff3e6" stroke="#ef7d00" stroke-width="2"/>
  <text x="640" y="610" text-anchor="middle" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="#b55c00">${safeAction}</text>
  <text x="640" y="638" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#65492f">${safeNote}</text>
</svg>`;
}

export function middleware(request: NextRequest) {
  if (!BROKEN_HELP_IMAGES.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return new NextResponse(helpVisual(request.nextUrl.pathname), {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

export const config = {
  matcher: ["/staff-help/:path*"],
};
