import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { isValidCalendarDate, maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE = 1000;
const MAX_ROWS = 150000;

const LEGACY_TO_GYM_ID: Record<string, string> = {
  "Tal-Qroqq": "bgm-talqroqq",
  Birkirkara: "bgm-birkirkara",
  Kirkop: "bgm-kirkop",
  Marsa: "bgm-marsa",
  Neptunes: "bgm-neptunes",
  Pembroke: "bgm-pembroke",
  Build: "bgm-build",
  Sliema: "bgm-sliema",
  "Birżebbuġa": "bgm-birzebbuga",
};

type AppRow = {
  id: string;
  application_kind: string | null;
  membership_type: string | null;
  duration_key: string | null;
  enrollment_gym_id: string | null;
  status: string | null;
  activated_at: string | null;
  start_date: string | null;
  expiry_date: string | null;
  final_amount_cents: number | null;
  base_price_cents: number | null;
  discount_amount_cents: number | null;
  discount_percentage_snapshot: number | null;
  payment_method: string | null;
};

type ApplicationMemberRow = {
  application_id: string;
  existing_member_id: string | null;
};

type MembershipRow = {
  id: string;
  application_id: string;
  membership_type: string | null;
  duration_key: string | null;
  expiry_date: string;
  enrollment_gym_id: string | null;
  status: string | null;
};

type MembershipMemberRow = {
  membership_id: string;
  member_id: string;
};

type CheckinRow = {
  member_id: string;
  gym_id: string;
  checkin_at: string;
  enrollment_gym_id_at_checkin: string | null;
  enrollment_snapshot_recorded: boolean | null;
};

type MemberRow = {
  id: string;
  member_number: string | null;
  full_name: string | null;
  enrollment_gym_id: string | null;
  legacy_gym: string | null;
  membership_expiry: string | null;
  status: string | null;
  cancellation_effective_date: string | null;
  archived_at: string | null;
};

function maltaDateFromInstant(value: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}

function maltaHour(value: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value)));
}

function maltaWeekday(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    weekday: "short",
  }).format(new Date(value));
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function weekKey(date: string) {
  const d = new Date(date + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function diffDays(later: string, earlier: string) {
  return Math.floor((Date.parse(later + "T12:00:00Z") - Date.parse(earlier + "T12:00:00Z")) / 86400000);
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function gymForMember(member: MemberRow) {
  return member.enrollment_gym_id || LEGACY_TO_GYM_ID[String(member.legacy_gym || "").trim()] || null;
}

function isCurrentlyActive(member: MemberRow, today: string) {
  if (member.status !== "active" || member.archived_at) return false;
  if (member.membership_expiry && member.membership_expiry < today) return false;
  if (member.cancellation_effective_date && member.cancellation_effective_date <= today) return false;
  return true;
}

async function allRows<T>(builder: (from: number, to: number) => PromiseLike<{ data: unknown; error: any }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const result = await builder(from, from + PAGE - 1);
    if (result.error) throw result.error;
    const batch = (result.data || []) as T[];
    rows.push(...batch);
    if (rows.length > MAX_ROWS) throw new Error("Analytics selection is too large. Choose a shorter date range.");
    if (batch.length < PAGE) break;
  }
  return rows;
}

function periodRows(apps: Array<AppRow & { localDate: string }>, key: "month" | "week") {
  const map = new Map<string, { period: string; newMemberships: number; renewals: number; total: number; revenueCents: number }>();
  for (const app of apps) {
    const period = key === "month" ? monthKey(app.localDate) : weekKey(app.localDate);
    const row = map.get(period) || { period, newMemberships: 0, renewals: 0, total: 0, revenueCents: 0 };
    if (app.application_kind === "new") row.newMemberships += 1;
    if (app.application_kind === "renewal") row.renewals += 1;
    row.total += 1;
    row.revenueCents += Number(app.final_amount_cents || 0);
    map.set(period, row);
  }
  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const today = todayMaltaDate();
    const defaultFromDate = new Date(today + "T12:00:00Z");
    defaultFromDate.setUTCMonth(defaultFromDate.getUTCMonth() - 11, 1);
    const defaultFrom = defaultFromDate.toISOString().slice(0, 10);
    const from = request.nextUrl.searchParams.get("from") || defaultFrom;
    const to = request.nextUrl.searchParams.get("to") || today;
    const gymId = String(request.nextUrl.searchParams.get("gymId") || "").trim();

    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      return NextResponse.json({ error: "Choose a valid analytics date range." }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const gymRows = await allRows<{ id: string; name: string }>((a, b) =>
      db.from("bgm_gyms").select("id,name").order("id").range(a, b)
    );
    const gymNames = Object.fromEntries(gymRows.map((g) => [g.id, g.name || g.id]));
    if (gymId && !gymNames[gymId]) {
      return NextResponse.json({ error: "Gym not found." }, { status: 404 });
    }

    const start = maltaDayUtcRange(from).start;
    const end = maltaDayUtcRange(to).end;

    const applications = await allRows<AppRow>((a, b) => {
      let query = db.from("bgm_membership_applications")
        .select("id,application_kind,membership_type,duration_key,enrollment_gym_id,status,activated_at,start_date,expiry_date,final_amount_cents,base_price_cents,discount_amount_cents,discount_percentage_snapshot,payment_method")
        .eq("status", "activated")
        .gte("activated_at", start)
        .lt("activated_at", end)
        .order("activated_at")
        .range(a, b);
      if (gymId) query = query.eq("enrollment_gym_id", gymId);
      return query;
    });

    const apps = applications
      .filter((app) => app.activated_at)
      .map((app) => ({ ...app, localDate: maltaDateFromInstant(app.activated_at!) }));

    const monthTrend = periodRows(apps, "month");
    const weekTrend = periodRows(apps, "week");

    const byGymMap = new Map<string, { gymId: string; gymName: string; newMemberships: number; renewals: number; total: number; revenueCents: number }>();
    const typeMap = new Map<string, number>();
    const durationMap = new Map<string, number>();
    const paymentMap = new Map<string, { method: string; count: number; revenueCents: number }>();
    let revenueCents = 0;
    let baseRevenueCents = 0;
    let discountCents = 0;
    let discountedApplications = 0;
    let discountPctSum = 0;

    for (const app of apps) {
      const gid = app.enrollment_gym_id || "unassigned";
      const gym = byGymMap.get(gid) || {
        gymId: gid,
        gymName: gymNames[gid] || (gid === "unassigned" ? "Unassigned" : gid),
        newMemberships: 0, renewals: 0, total: 0, revenueCents: 0,
      };
      if (app.application_kind === "new") gym.newMemberships += 1;
      if (app.application_kind === "renewal") gym.renewals += 1;
      gym.total += 1;
      gym.revenueCents += Number(app.final_amount_cents || 0);
      byGymMap.set(gid, gym);

      const type = app.membership_type || "unknown";
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
      const duration = app.duration_key || "unknown";
      durationMap.set(duration, (durationMap.get(duration) || 0) + 1);

      const method = app.payment_method || "Not recorded";
      const pay = paymentMap.get(method) || { method, count: 0, revenueCents: 0 };
      pay.count += 1;
      pay.revenueCents += Number(app.final_amount_cents || 0);
      paymentMap.set(method, pay);

      revenueCents += Number(app.final_amount_cents || 0);
      baseRevenueCents += Number(app.base_price_cents || app.final_amount_cents || 0);
      discountCents += Number(app.discount_amount_cents || 0);
      if (Number(app.discount_amount_cents || 0) > 0) {
        discountedApplications += 1;
        discountPctSum += Number(app.discount_percentage_snapshot || 0);
      }
    }

    const members = await allRows<MemberRow>((a, b) => {
      let query = db.from("bgm_members")
        .select("id,member_number,full_name,enrollment_gym_id,legacy_gym,membership_expiry,status,cancellation_effective_date,archived_at")
        .order("id").range(a, b);
      if (gymId) query = query.or(`enrollment_gym_id.eq.${gymId},legacy_gym.eq.${Object.entries(LEGACY_TO_GYM_ID).find(([, id]) => id === gymId)?.[0] || "__none__"}`);
      return query;
    });
    const activeMembers = members.filter((m) => isCurrentlyActive(m, today) && (!gymId || gymForMember(m) === gymId));
    const activeIds = new Set(activeMembers.map((m) => m.id));
    const activeByGym = new Map<string, number>();
    for (const member of activeMembers) {
      const gid = gymForMember(member) || "unassigned";
      activeByGym.set(gid, (activeByGym.get(gid) || 0) + 1);
    }

    const checkins = await allRows<CheckinRow>((a, b) => {
      let query = db.from("bgm_member_checkins")
        .select("member_id,gym_id,checkin_at,enrollment_gym_id_at_checkin,enrollment_snapshot_recorded")
        .gte("checkin_at", start).lt("checkin_at", end)
        .order("checkin_at").range(a, b);
      if (gymId) query = query.eq("gym_id", gymId);
      return query;
    });

    const visitMembers = new Set<string>();
    const visitGymMap = new Map<string, { gymId: string; gymName: string; visits: number; unique: Set<string> }>();
    const hourMap = new Map<number, number>();
    const weekdayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekdayMap = new Map(weekdayOrder.map((d) => [d, 0]));
    let crossGymVisits = 0;
    let homeGymVisits = 0;
    const originMovement = new Map<string, { enrollmentGymId: string; enrollmentGymName: string; visitedGymId: string; visitedGymName: string; visits: number }>();

    for (const visit of checkins) {
      visitMembers.add(visit.member_id);
      const g = visitGymMap.get(visit.gym_id) || {
        gymId: visit.gym_id,
        gymName: gymNames[visit.gym_id] || visit.gym_id,
        visits: 0,
        unique: new Set<string>(),
      };
      g.visits += 1;
      g.unique.add(visit.member_id);
      visitGymMap.set(visit.gym_id, g);
      const h = maltaHour(visit.checkin_at);
      hourMap.set(h, (hourMap.get(h) || 0) + 1);
      const wd = maltaWeekday(visit.checkin_at);
      weekdayMap.set(wd, (weekdayMap.get(wd) || 0) + 1);
      if (visit.enrollment_snapshot_recorded && visit.enrollment_gym_id_at_checkin) {
        if (visit.enrollment_gym_id_at_checkin === visit.gym_id) homeGymVisits += 1;
        else crossGymVisits += 1;
        const moveKey = visit.enrollment_gym_id_at_checkin + "→" + visit.gym_id;
        const movement = originMovement.get(moveKey) || {
          enrollmentGymId: visit.enrollment_gym_id_at_checkin,
          enrollmentGymName: gymNames[visit.enrollment_gym_id_at_checkin] || visit.enrollment_gym_id_at_checkin,
          visitedGymId: visit.gym_id,
          visitedGymName: gymNames[visit.gym_id] || visit.gym_id,
          visits: 0,
        };
        movement.visits += 1;
        originMovement.set(moveKey, movement);
      }
    }

    // Engagement uses all recorded check-ins up to today so 30/60/90-day inactivity
    // is based on actual digital history, while members with no history are kept separate.
    const historyCheckins = await allRows<{ member_id: string; checkin_at: string }>((a, b) =>
      db.from("bgm_member_checkins")
        .select("member_id,checkin_at")
        .lte("checkin_at", new Date().toISOString())
        .order("checkin_at")
        .range(a, b)
    );
    const lastVisit = new Map<string, string>();
    for (const row of historyCheckins) {
      if (activeIds.has(row.member_id)) lastVisit.set(row.member_id, maltaDateFromInstant(row.checkin_at));
    }
    let noDigitalHistory = 0;
    let inactive30 = 0, inactive60 = 0, inactive90 = 0;
    const inactiveMembers: Array<{ memberNumber: string; fullName: string; gymName: string; lastVisit: string; daysInactive: number }> = [];
    for (const member of activeMembers) {
      const last = lastVisit.get(member.id);
      if (!last) {
        noDigitalHistory += 1;
        continue;
      }
      const days = diffDays(today, last);
      if (days >= 30) inactive30 += 1;
      if (days >= 60) inactive60 += 1;
      if (days >= 90) inactive90 += 1;
      if (days >= 30) {
        const gid = gymForMember(member);
        inactiveMembers.push({
          memberNumber: member.member_number || "",
          fullName: member.full_name || "Member",
          gymName: gid ? (gymNames[gid] || gid) : "Unassigned",
          lastVisit: last,
          daysInactive: days,
        });
      }
    }
    inactiveMembers.sort((a, b) => b.daysInactive - a.daysInactive);

    // Retention cohorts use normalized membership contracts only. Legacy imported
    // history is intentionally excluded because past renewal events are unavailable.
    const contracts = await allRows<MembershipRow>((a, b) => {
      let query = db.from("bgm_memberships")
        .select("id,application_id,membership_type,duration_key,expiry_date,enrollment_gym_id,status")
        .gte("expiry_date", from).lte("expiry_date", to)
        .order("expiry_date").range(a, b);
      if (gymId) query = query.eq("enrollment_gym_id", gymId);
      return query;
    });
    const contractIds = new Set(contracts.map((c) => c.id));
    const contractMembers = await allRows<MembershipMemberRow>((a, b) =>
      db.from("bgm_membership_members").select("membership_id,member_id").order("membership_id").range(a, b)
    );
    const membersByContract = new Map<string, string[]>();
    for (const link of contractMembers) {
      if (!contractIds.has(link.membership_id)) continue;
      const list = membersByContract.get(link.membership_id) || [];
      list.push(link.member_id);
      membersByContract.set(link.membership_id, list);
    }

    const allRenewals = await allRows<AppRow>((a, b) =>
      db.from("bgm_membership_applications")
        .select("id,application_kind,membership_type,duration_key,enrollment_gym_id,status,activated_at,start_date,expiry_date,final_amount_cents,base_price_cents,discount_amount_cents,discount_percentage_snapshot,payment_method")
        .eq("application_kind", "renewal").eq("status", "activated")
        .not("activated_at", "is", null)
        .order("activated_at").range(a, b)
    );
    const renewalIds = new Set(allRenewals.map((r) => r.id));
    const renewalLinks = await allRows<ApplicationMemberRow>((a, b) =>
      db.from("bgm_membership_application_members")
        .select("application_id,existing_member_id")
        .not("existing_member_id", "is", null)
        .order("application_id").range(a, b)
    );
    const renewalMemberIds = new Map<string, Set<string>>();
    for (const link of renewalLinks) {
      if (!renewalIds.has(link.application_id) || !link.existing_member_id) continue;
      const set = renewalMemberIds.get(link.application_id) || new Set<string>();
      set.add(link.existing_member_id);
      renewalMemberIds.set(link.application_id, set);
    }
    const renewalEvents = allRenewals.filter((r) => r.activated_at).map((r) => ({
      ...r,
      localDate: maltaDateFromInstant(r.activated_at!),
      members: renewalMemberIds.get(r.id) || new Set<string>(),
    }));

    type Cohort = { period: string; eligible: number; renewed7: number; renewed14: number; renewed30: number; churn30: number };
    const retentionMonth = new Map<string, Cohort>();
    const retentionWeek = new Map<string, Cohort>();
    const retentionGym = new Map<string, Cohort & { gymId: string; gymName: string }>();
    let reactivations = 0;

    for (const contract of contracts) {
      const memberIds = new Set(membersByContract.get(contract.id) || []);
      if (!memberIds.size) continue;
      const matches = renewalEvents
        .filter((renewal) => Array.from(memberIds).some((id) => renewal.members.has(id)))
        .map((renewal) => {
          const effectiveStart = renewal.start_date || renewal.localDate;
          const startGap = diffDays(effectiveStart, contract.expiry_date);
          const activationGap = diffDays(renewal.localDate, contract.expiry_date);
          // An early renewal bought before expiry counts as retained when its
          // new membership starts at/just after the old expiry. Late renewals
          // use the actual start gap to measure reactivation delay.
          const days = startGap <= 1 && activationGap <= 0 ? 0 : Math.max(0, startGap);
          return { renewal, days, effectiveStart };
        })
        .filter((x) => x.effectiveStart >= contract.expiry_date)
        .sort((a, b) => a.days - b.days);
      const first = matches[0];

      const update = (map: Map<string, Cohort>, period: string) => {
        const row = map.get(period) || { period, eligible: 0, renewed7: 0, renewed14: 0, renewed30: 0, churn30: 0 };
        row.eligible += 1;
        if (first && first.days <= 7) row.renewed7 += 1;
        if (first && first.days <= 14) row.renewed14 += 1;
        if (first && first.days <= 30) row.renewed30 += 1;
        if (!first || first.days > 30) row.churn30 += 1;
        map.set(period, row);
      };
      update(retentionMonth, monthKey(contract.expiry_date));
      update(retentionWeek, weekKey(contract.expiry_date));

      const gid = contract.enrollment_gym_id || "unassigned";
      const gym = retentionGym.get(gid) || {
        period: gid, gymId: gid, gymName: gymNames[gid] || (gid === "unassigned" ? "Unassigned" : gid),
        eligible: 0, renewed7: 0, renewed14: 0, renewed30: 0, churn30: 0,
      };
      gym.eligible += 1;
      if (first && first.days <= 7) gym.renewed7 += 1;
      if (first && first.days <= 14) gym.renewed14 += 1;
      if (first && first.days <= 30) gym.renewed30 += 1;
      if (!first || first.days > 30) gym.churn30 += 1;
      retentionGym.set(gid, gym);

      if (first && first.days > 30) reactivations += 1;
    }

    const decorateRetention = <T extends Cohort>(row: T) => ({
      ...row,
      rate7: pct(row.renewed7, row.eligible),
      rate14: pct(row.renewed14, row.eligible),
      rate30: pct(row.renewed30, row.eligible),
      churnRate30: pct(row.churn30, row.eligible),
    });

    const newCount = apps.filter((a) => a.application_kind === "new").length;
    const renewalCount = apps.filter((a) => a.application_kind === "renewal").length;
    const totalApps = newCount + renewalCount;
    const verifiedCrossGymTotal = crossGymVisits + homeGymVisits;

    return NextResponse.json({
      range: { from, to, gymId, gymName: gymId ? gymNames[gymId] : "All gyms combined" },
      coverage: {
        retention: "Retention uses memberships and renewals recorded by the new BGM platform. Imported legacy history before platform launch is not reconstructed.",
        engagement: "30/60/90-day inactivity uses members with at least one digital check-in. Imported members with no recorded digital visit are shown separately.",
        balances: "Outstanding balances are not currently stored as a dedicated partial-payment balance in the normalized membership model, so no balance figure is shown.",
      },
      overview: {
        newMemberships: newCount,
        renewals: renewalCount,
        totalMembershipActions: totalApps,
        renewalSharePct: pct(renewalCount, totalApps),
        membershipRevenueCents: revenueCents,
        averageMembershipValueCents: totalApps ? Math.round(revenueCents / totalApps) : 0,
        totalDiscountCents: discountCents,
        currentActiveMembers: activeMembers.length,
        visits: checkins.length,
        uniqueVisitors: visitMembers.size,
        visitsPerActiveMember: activeMembers.length ? Math.round((checkins.length / activeMembers.length) * 100) / 100 : 0,
      },
      memberships: {
        byMonth: monthTrend,
        byWeek: weekTrend,
        byGym: Array.from(byGymMap.values()).sort((a, b) => b.total - a.total),
        byType: Array.from(typeMap, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
        byDuration: Array.from(durationMap, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
      },
      retention: {
        byMonth: Array.from(retentionMonth.values()).sort((a, b) => a.period.localeCompare(b.period)).map(decorateRetention),
        byWeek: Array.from(retentionWeek.values()).sort((a, b) => a.period.localeCompare(b.period)).map(decorateRetention),
        byGym: Array.from(retentionGym.values()).sort((a, b) => b.eligible - a.eligible).map(decorateRetention),
        reactivationsAfter30Days: reactivations,
        eligibleContracts: contracts.filter((c) => (membersByContract.get(c.id) || []).length > 0).length,
      },
      revenue: {
        totalCents: revenueCents,
        baseTotalCents: baseRevenueCents,
        discountCents,
        discountedApplications,
        averageDiscountPctOnDiscounted: discountedApplications ? Math.round((discountPctSum / discountedApplications) * 10) / 10 : 0,
        byMonth: monthTrend.map((row) => ({ period: row.period, revenueCents: row.revenueCents })),
        byGym: Array.from(byGymMap.values()).map((row) => ({
          gymId: row.gymId,
          gymName: row.gymName,
          revenueCents: row.revenueCents,
          memberships: row.total,
          averageValueCents: row.total ? Math.round(row.revenueCents / row.total) : 0,
        })).sort((a, b) => b.revenueCents - a.revenueCents),
        byPaymentMethod: Array.from(paymentMap.values()).sort((a, b) => b.revenueCents - a.revenueCents),
        outstandingBalancesSupported: false,
      },
      usage: {
        visits: checkins.length,
        uniqueVisitors: visitMembers.size,
        visitsPerActiveMember: activeMembers.length ? Math.round((checkins.length / activeMembers.length) * 100) / 100 : 0,
        byGym: Array.from(visitGymMap.values()).map((g) => ({
          gymId: g.gymId,
          gymName: g.gymName,
          visits: g.visits,
          uniqueMembers: g.unique.size,
          activeMembers: activeByGym.get(g.gymId) || 0,
          visitsPerActiveMember: activeByGym.get(g.gymId) ? Math.round((g.visits / (activeByGym.get(g.gymId) || 1)) * 100) / 100 : 0,
        })).sort((a, b) => b.visits - a.visits),
        enrollmentToVisited: Array.from(originMovement.values()).sort((a, b) => b.visits - a.visits).slice(0, 100),
        crossGymVisits,
        homeGymVisits,
        crossGymPct: pct(crossGymVisits, verifiedCrossGymTotal),
        verifiedOriginVisits: verifiedCrossGymTotal,
        byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, visits: hourMap.get(hour) || 0 })),
        byWeekday: weekdayOrder.map((day) => ({ day, visits: weekdayMap.get(day) || 0 })),
      },
      engagement: {
        currentActiveMembers: activeMembers.length,
        noDigitalVisitHistory: noDigitalHistory,
        inactive30,
        inactive60,
        inactive90,
        inactiveMembers: inactiveMembers.slice(0, 100),
      },
      trends: {
        busiestMonths: [...monthTrend].sort((a, b) => b.total - a.total || a.period.localeCompare(b.period)).slice(0, 12),
        quietestMonths: [...monthTrend].sort((a, b) => a.total - b.total || a.period.localeCompare(b.period)).slice(0, 12),
        busiestWeeks: [...weekTrend].sort((a, b) => b.total - a.total || a.period.localeCompare(b.period)).slice(0, 12),
        quietestWeeks: [...weekTrend].sort((a, b) => a.total - b.total || a.period.localeCompare(b.period)).slice(0, 12),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load business analytics:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load analytics." }, { status: 500 });
  }
}
