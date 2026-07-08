import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

  if (lines.length < 2) {
    return [];
  }

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

function calculateStatus(expiry: string) {
  if (!expiry) return "active";
  return expiry < new Date().toISOString().slice(0, 10) ? "inactive" : "active";
}

export async function POST(request: NextRequest) {
  try {
    const pin = request.headers.get("x-admin-pin") || "";

    if (!process.env.BGM_ADMIN_PIN || pin !== process.env.BGM_ADMIN_PIN) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "CSV file is required." },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const rows = parseCsv(csvText);

    if (!rows.length) {
      return NextResponse.json(
        { error: "CSV does not contain member rows." },
        { status: 400 }
      );
    }

    const members = rows
      .map((row) => {
        const memberNumber = getRowValue(row, [
          "memberNumber",
          "member_number",
          "number",
          "membershipNumber",
        ]).toUpperCase();

        const fullName = getRowValue(row, ["fullName", "full_name", "name"]);
        const email = getRowValue(row, ["email"]).toLowerCase();
        const phone = getRowValue(row, ["phone", "mobile"]);
        const enrollmentDate = getRowValue(row, [
          "enrollmentDate",
          "enrolmentDate",
          "enrollment_date",
          "enrolment_date",
        ]);
        const membershipPeriod = getRowValue(row, [
          "membershipPeriod",
          "membership_period",
          "duration",
        ]);
        const membershipExpiry = getRowValue(row, [
          "membershipExpiry",
          "membership_expiry",
          "expiry",
          "expiryDate",
        ]);
        const notes = getRowValue(row, ["notes", "note"]);

        return {
          member_number: memberNumber,
          full_name: fullName,
          email,
          phone: phone || null,
          enrollment_date: enrollmentDate || null,
          membership_period: membershipPeriod || null,
          membership_expiry: membershipExpiry || null,
          status: calculateStatus(membershipExpiry),
          notes: notes || null,
          updated_at: new Date().toISOString(),
        };
      })
      .filter((member) => member.member_number && member.full_name && member.email);

    if (!members.length) {
      return NextResponse.json(
        {
          error:
            "No valid rows found. Each row needs memberNumber, fullName and email.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_members")
      .upsert(members, {
        onConflict: "member_number",
      })
      .select("id, member_number, full_name, email");

    if (result.error) throw result.error;

    return NextResponse.json({
      imported: result.data?.length || 0,
      skipped: rows.length - members.length,
      members: result.data || [],
      message: `Imported ${result.data?.length || 0} member${
        result.data?.length === 1 ? "" : "s"
      }.`,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not import members CSV." },
      { status: 500 }
    );
  }
}
