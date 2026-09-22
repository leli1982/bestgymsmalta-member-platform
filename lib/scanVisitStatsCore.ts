export type CanonicalScanVisit = {
  id: string;
  member_id: string;
  gym_id: string;
  checkin_at: string;
};
export type VisitGym = {
  gymId: string;
  gymName: string;
  visits: number;
  uniqueMembers: number;
  origins: Array<{ gymId: string; gymName: string; visits: number; uniqueMembers: number }>;
  byDay: Array<{ date: string; visits: number }>;
  byHour: Array<{ hour: number; visits: number }>;
};
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta", year: "numeric", month: "2-digit", day: "2-digit",
});
const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta", hour: "2-digit", hourCycle: "h23",
});
export function visitMaltaDate(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid check-in timestamp.");
  const parts = dateFormatter.formatToParts(date);
  const get = (key: string) => parts.find((part) => part.type === key)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}
export function visitMaltaHour(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid check-in timestamp.");
  return Number(hourFormatter.format(date));
}
type Bucket = {
  id: string;
  members: Set<string>;
  visits: number;
};
type GymBucket = Bucket & {
  origins: Map<string, Bucket>;
  byDay: Map<string, number>;
  byHour: number[];
};
function bucket(id: string): Bucket { return { id, visits: 0, members: new Set<string>() }; }
function gymBucket(id: string): GymBucket {
  return { ...bucket(id), origins: new Map<string, Bucket>(), byDay: new Map<string, number>(), byHour: Array(24).fill(0) };
}
const unknownGym = "unknown";
const titleFor = (id: string, names: Record<string, string>) =>
  id === unknownGym ? "Enrollment gym unknown" : names[id] || id;

export function summariseScanVisits(
  rows: CanonicalScanVisit[],
  memberEnrollmentGyms: Record<string, string | null>,
  gymNames: Record<string, string>,
) {
  const gyms = new Map<string, GymBucket>();
  const allMembers = new Set<string>();
  for (const row of rows) {
    const memberId = String(row.member_id || "").trim();
    const gymId = String(row.gym_id || "").trim();
    if (!memberId || !gymId) continue;
    const day = visitMaltaDate(row.checkin_at);
    const hour = visitMaltaHour(row.checkin_at);
    const originId = memberEnrollmentGyms[memberId] || unknownGym;
    let gym = gyms.get(gymId);
    if (!gym) { gym = gymBucket(gymId); gyms.set(gymId, gym); }
    gym.visits++;
    gym.members.add(memberId);
    allMembers.add(memberId);
    gym.byDay.set(day, (gym.byDay.get(day) || 0) + 1);
    gym.byHour[hour]++;
    let origin = gym.origins.get(originId);
    if (!origin) { origin = bucket(originId); gym.origins.set(originId, origin); }
    origin.visits++;
    origin.members.add(memberId);
  }
  const sorter = (a: { visits: number; gymName: string }, b: { visits: number; gymName: string }) =>
    b.visits - a.visits || a.gymName.localeCompare(b.gymName, "en");
  const mappedGyms: VisitGym[] = Array.from(gyms.values()).map((gym) => ({
    gymId: gym.id, gymName: titleFor(gym.id, gymNames),
    visits: gym.visits, uniqueMembers: gym.members.size,
    origins: Array.from(gym.origins.values()).map((origin) => ({
      gymId: origin.id, gymName: titleFor(origin.id, gymNames),
      visits: origin.visits, uniqueMembers: origin.members.size,
    })).sort(sorter),
    byDay: Array.from(gym.byDay.entries()).map(([date, visits]) => ({ date, visits }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byHour: gym.byHour.map((visits, hour) => ({ hour, visits })),
  })).sort(sorter);
  const allByDay = new Map<string, number>();
  const allByHour = Array(24).fill(0) as number[];
  for (const gym of mappedGyms) {
    for (const day of gym.byDay) allByDay.set(day.date, (allByDay.get(day.date) || 0) + day.visits);
    for (const hour of gym.byHour) allByHour[hour.hour] += hour.visits;
  }
  return {
    visits: mappedGyms.reduce((sum, gym) => sum + gym.visits, 0),
    uniqueMembers: allMembers.size,
    gymsWithVisits: mappedGyms.length,
    byGym: mappedGyms,
    byDay: Array.from(allByDay.entries()).map(([date, visits]) => ({ date, visits }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byHour: allByHour.map((visits, hour) => ({ hour, visits })),
  };
}
