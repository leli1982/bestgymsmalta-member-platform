import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

function normaliseHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function normaliseMemberNumber(value: string) {
  return clean(value).toUpperCase();
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normaliseHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = clean(values[index]);
    });

    return row;
  });
}

function getRowValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const normalised = normaliseHeader(key);
    if (row[normalised]) return row[normalised];
  }

  return "";
}

function isValidIsoDate(year: string, month: string, day: string) {
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  );
}

function normaliseDateToIso(value: string) {
  const cleanValue = clean(value);

  if (!cleanValue) return "";

  // Already ISO: yyyy-mm-dd
  const isoMatch = cleanValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");

    return isValidIsoDate(year, month, day) ? `${year}-${month}-${day}` : "";
  }

  // European preferred: dd/mm/yyyy or dd-mm-yyyy
  // Also rescues accidental US format mm/dd/yyyy when the second number is over 12.
  const slashMatch = cleanValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);

  if (slashMatch) {
    let first = Number(slashMatch[1]);
    let second = Number(slashMatch[2]);
    const year = slashMatch[3];

    let day = first;
    let month = second;

    // If month is impossible but first number can be a month, assume accidental US format.
    // Example: 02/17/2026 becomes 17/02/2026.
    if (second > 12 && first <= 12) {
      day = second;
      month = first;
    }

    const dayText = String(day).padStart(2, "0");
    const monthText = String(month).padStart(2, "0");

    return isValidIsoDate(year, monthText, dayText)
      ? `${year}-${monthText}-${dayText}`
      : "";
  }

  return "";
}

function calculateStatus(expiry: string) {
  if (!expiry) return "active";
  return expiry < new Date().toISOString().slice(0, 10) ? "inactive" : "active";
}

async function deleteFromTableIfExists(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  column: string,
  ids: string[]
) {
  if (!ids.length) return;

  const result = await supabase.from(table).delete().in(column, ids);

  if (result.error) {
    const message = String(result.error.message || "");

    if (
      message.includes("Could not find the table") ||
      message.includes("schema cache")
    ) {
      return;
    }

    throw result.error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminError = requireAdmin(request);
    if (adminError) return adminError;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "CSV file is required." },
        { status: 400 }
      );
    }

    const rows = parseCsv(await file.text());

    if (!rows.length) {
      return NextResponse.json(
        { error: "CSV does not contain member rows." },
        { status: 400 }
      );
    }

    const members = rows
      .map((row) => {
        const memberNumber = normaliseMemberNumber(
          getRowValue(row, [
            "memberNumber",
            "member_number",
            "number",
            "membershipNumber",
          ])
        );

        const fullName = getRowValue(row, ["fullName", "full_name", "name"]);
        const email = getRowValue(row, ["email"]).toLowerCase();
        const phone = getRowValue(row, ["phone", "mobile"]);
        const enrollmentDate = normaliseDateToIso(
          getRowValue(row, [
            "enrollmentDate",
            "enrolmentDate",
            "enrollment_date",
            "enrolment_date",
          ])
        );
        const membershipPeriod = getRowValue(row, [
          "membershipPeriod",
          "membership_period",
          "duration",
        ]);
        const membershipExpiry = normaliseDateToIso(
          getRowValue(row, [
            "membershipExpiry",
            "membership_expiry",
            "expiry",
            "expiryDate",
          ])
        );
        const notes = getRowValue(row, ["notes", "note"]);

        return {
          member_number: memberNumber,
          full_name: fullName,
          email,
          phone: phone || null,
          enrollment_date: enrollmentDate || null,
          membership_period: membershipPeriod || null,
          membership_expiry: membershipExpiry || null,
          status: (getRowValue(row, ["status"]) || "active").toLowerCase(),
          notes: notes || null,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(
        (member) => member.member_number && member.full_name && member.email
      );

    if (!members.length) {
      return NextResponse.json(
        {
          error:
            "No valid rows found. Each row needs memberNumber, fullName and email.",
        },
        { status: 400 }
      );
    }

    const membersByNumber = new Map<string, (typeof members)[number]>();
    const duplicateMemberNumbers: string[] = [];

    for (const member of members) {
      if (membersByNumber.has(member.member_number)) {
        duplicateMemberNumbers.push(member.member_number);
      }

      membersByNumber.set(member.member_number, member);
    }

    const uniqueMembers = Array.from(membersByNumber.values());

    const csvMemberNumbers = uniqueMembers.map(
      (member) => member.member_number
    );

    const supabase = getSupabaseAdmin();

    const existingResult = await supabase
      .from("bgm_members")
      .select("id, member_number");

    if (existingResult.error) throw existingResult.error;

    const existingMembers = existingResult.data || [];

    const membersToDelete = existingMembers.filter(
      (member) =>
        !csvMemberNumbers.includes(normaliseMemberNumber(member.member_number))
    );

    const idsToDelete = membersToDelete.map((member) => String(member.id));

    if (idsToDelete.length) {
      await deleteFromTableIfExists(
        supabase,
        "bgm_member_checkins",
        "member_id",
        idsToDelete
      );

      await deleteFromTableIfExists(
        supabase,
        "bgm_member_stats",
        "member_id",
        idsToDelete
      );

      await deleteFromTableIfExists(
        supabase,
        "bgm_progress_photos",
        "member_id",
        idsToDelete
      );

      await deleteFromTableIfExists(
        supabase,
        "bgm_member_workout_plans",
        "member_id",
        idsToDelete
      );

      await deleteFromTableIfExists(
        supabase,
        "bgm_member_password_resets",
        "member_id",
        idsToDelete
      );

      const deleteMembersResult = await supabase
        .from("bgm_members")
        .delete()
        .in("id", idsToDelete);

      if (deleteMembersResult.error) throw deleteMembersResult.error;
    }

    const upsertResult = await supabase
      .from("bgm_members")
      .upsert(uniqueMembers, {
        onConflict: "member_number",
      })
      .select("id, member_number, full_name, email");

    if (upsertResult.error) throw upsertResult.error;

    return NextResponse.json({
      imported: upsertResult.data?.length || 0,
      removed: idsToDelete.length,
      skipped: rows.length - members.length,
      duplicates: Array.from(new Set(duplicateMemberNumbers)),
      csvMemberNumbers,
      removedMemberNumbers: membersToDelete.map((member) => member.member_number),
      message: `CSV sync complete. Imported ${upsertResult.data?.length || 0}. Removed ${idsToDelete.length}. Duplicate member numbers ignored: ${Array.from(new Set(duplicateMemberNumbers)).length}.`,
    });
  } catch (error) {
    console.error("CSV import failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object"
          ? JSON.stringify(error)
          : String(error);

    return NextResponse.json(
      {
        error: "Could not import members CSV.",
        detail: message,
      },
      { status: 500 }
    );
  }
}
