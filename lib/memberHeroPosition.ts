// Shared, no server/browser imports: home-hero background-cover focal point.
export type MemberHeroPosition = { x: number; y: number };
export const DEFAULT_MEMBER_HERO_POSITION: Readonly<MemberHeroPosition> = { x: 38, y: 50 };

export function parseMemberHeroPosition(x: unknown, y: unknown): MemberHeroPosition | null {
  if (!((typeof x === "number" || typeof x === "string") &&
        (typeof y === "number" || typeof y === "string"))) return null;
  if (String(x).trim() === "" || String(y).trim() === "") return null;
  const posX = Number(x);
  const posY = Number(y);
  if (!Number.isFinite(posX) || !Number.isFinite(posY) ||
      posX < 0 || posX > 100 || posY < 0 || posY > 100) return null;
  return {
    x: Math.round(posX * 100) / 100,
    y: Math.round(posY * 100) / 100,
  };
}
export function constrainMemberHeroPosition(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

/** Convert a physical drag into CSS background-position percentages under background-size:cover. */
export function dragMemberHeroPosition(
  original: MemberHeroPosition,
  deltaX: number,
  deltaY: number,
  overflowX: number,
  overflowY: number,
): MemberHeroPosition {
  return {
    x: overflowX > 0.5
      ? constrainMemberHeroPosition(original.x - deltaX * 100 / overflowX)
      : original.x,
    y: overflowY > 0.5
      ? constrainMemberHeroPosition(original.y - deltaY * 100 / overflowY)
      : original.y,
  };
}
