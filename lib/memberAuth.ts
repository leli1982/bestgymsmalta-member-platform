import { NextResponse } from "next/server";

export function setMemberSessionCookie(
  response: NextResponse,
  _memberId: string
) {
  return response;
}
