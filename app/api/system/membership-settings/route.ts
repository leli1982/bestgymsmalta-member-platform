import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeDiscountCode,
  validatePriceMatrix,
  type DeclarationKey,
  type MembershipDurationKey,
  type MembershipType,
  type PriceEntry,
} from "@/lib/membershipSettingsCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin, type SystemContext } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

const DECLARATION_KEYS: readonly DeclarationKey[] = [
  "gym_rules",
  "legacy_declaration",
  "privacy",
  "health",
  "guardian",
];

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function optionalDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be a YYYY-MM-DD date.`);
  }
  return value;
}

function parsePriceEntries(value: unknown): PriceEntry[] {
  if (!Array.isArray(value)) throw new Error("A complete price matrix is required.");

  return value.map((raw) => {
    if (!isRecord(raw)) throw new Error("Each price entry must be an object.");
    if (raw.isActive !== undefined && typeof raw.isActive !== "boolean") {
      throw new Error("Availability must be active or inactive.");
    }
    return {
      membershipType: String(raw.membershipType || "") as MembershipType,
      durationKey: String(raw.durationKey || "") as MembershipDurationKey,
      amountCents: Number(raw.amountCents),
      currency: String(raw.currency || "") as "EUR",
      isActive: raw.isActive === undefined ? true : raw.isActive as boolean,
    };
  });
}

async function writeAudit(
  context: SystemContext,
  actionKey: string,
  entityType: string,
  entityId: string | null,
  beforeData: unknown,
  afterData: unknown
) {
  const supabase = getSupabaseAdmin();
  const result = await supabase.from("bgm_audit_log").insert({
    system_user_id: context.systemUserId,
    context_gym_id: context.gymId,
    staff_name: null,
    action_key: actionKey,
    entity_type: entityType,
    entity_id: entityId,
    before_data: beforeData,
    after_data: afterData,
  });
  if (result.error) throw result.error;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    const [catalogsResult, entriesResult, declarationsResult, discountsResult] =
      await Promise.all([
        supabase
          .from("bgm_membership_price_catalog_versions")
          .select("id, version_no, status, published_at, created_by_system_user_id, created_at")
          .order("version_no", { ascending: false }),
        supabase
          .from("bgm_membership_price_entries")
          .select("catalog_version_id, membership_type, duration_key, amount_cents, currency, is_active"),
        supabase
          .from("bgm_membership_declaration_versions")
          .select(
            "id, content_key, version_no, body, content_sha256, status, published_at, created_by_system_user_id, created_at"
          )
          .order("content_key", { ascending: true })
          .order("version_no", { ascending: false }),
        supabase
          .from("bgm_discount_codes")
          .select(
            "id, code, percentage, active, valid_from, valid_until, max_uses, successful_uses, created_by_system_user_id, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),
      ]);

    for (const result of [catalogsResult, entriesResult, declarationsResult, discountsResult]) {
      if (result.error) throw result.error;
    }

    const priceEntries = entriesResult.data || [];

    return NextResponse.json({
      priceCatalogs: (catalogsResult.data || []).map((catalog) => ({
        id: catalog.id,
        versionNo: catalog.version_no,
        status: catalog.status,
        publishedAt: catalog.published_at,
        createdAt: catalog.created_at,
        entries: priceEntries
          .filter((entry) => entry.catalog_version_id === catalog.id)
          .map((entry) => ({
            membershipType: entry.membership_type,
            durationKey: entry.duration_key,
            amountCents: entry.amount_cents,
            currency: entry.currency,
            isActive: entry.is_active,
          })),
      })),
      declarations: (declarationsResult.data || []).map((declaration) => ({
        id: declaration.id,
        contentKey: declaration.content_key,
        versionNo: declaration.version_no,
        body: declaration.body,
        contentSha256: declaration.content_sha256,
        status: declaration.status,
        publishedAt: declaration.published_at,
        createdAt: declaration.created_at,
      })),
      discountCodes: (discountsResult.data || []).map((discount) => ({
        id: discount.id,
        code: discount.code,
        percentage: discount.percentage,
        active: discount.active,
        validFrom: discount.valid_from,
        validUntil: discount.valid_until,
        maxUses: discount.max_uses,
        successfulUses: discount.successful_uses,
        createdAt: discount.created_at,
        updatedAt: discount.updated_at,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load membership settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const body: unknown = await request.json();
    if (!isRecord(body)) return badRequest("Invalid request body.");

    const action = typeof body.action === "string" ? body.action : "";
    const supabase = getSupabaseAdmin();
    const actorSystemUserId = auth.context.systemUserId;

    if (action === "save_price_draft") {
      let entries: PriceEntry[];
      try {
        entries = parsePriceEntries(body.entries);
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid price matrix.");
      }

      const validation = validatePriceMatrix(entries);
      if (!validation.ok) return badRequest(validation.error);

      const catalogResult = await supabase
        .from("bgm_membership_price_catalog_versions")
        .insert({ created_by_system_user_id: actorSystemUserId })
        .select("id, version_no, status, created_at")
        .single();
      if (catalogResult.error) throw catalogResult.error;

      const entryResult = await supabase.from("bgm_membership_price_entries").insert(
        entries.map((entry) => ({
          catalog_version_id: catalogResult.data.id,
          membership_type: entry.membershipType,
          duration_key: entry.durationKey,
          amount_cents: entry.amountCents,
          currency: "EUR",
          is_active: entry.isActive !== false,
        }))
      );

      if (entryResult.error) {
        await supabase
          .from("bgm_membership_price_catalog_versions")
          .delete()
          .eq("id", catalogResult.data.id);
        throw entryResult.error;
      }

      await writeAudit(
        auth.context,
        "membership_settings.price_draft.saved",
        "membership_price_catalog",
        catalogResult.data.id,
        null,
        {
          versionNo: catalogResult.data.version_no,
          entryCount: entries.length,
          currency: "EUR",
        }
      );

      return NextResponse.json({ ok: true, catalog: catalogResult.data });
    }

    if (action === "publish_price_catalog") {
      let catalogVersionId: string;
      try {
        catalogVersionId = requiredString(body.catalogVersionId, "Catalog version");
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid catalog version.");
      }

      // An older abandoned draft must not replace rates already published later.
      const [draftResult, currentResult] = await Promise.all([
        supabase.from("bgm_membership_price_catalog_versions")
          .select("version_no,status").eq("id", catalogVersionId).maybeSingle(),
        supabase.from("bgm_membership_price_catalog_versions")
          .select("version_no").eq("status", "published").maybeSingle(),
      ]);
      if (draftResult.error) throw draftResult.error;
      if (currentResult.error) throw currentResult.error;
      if (draftResult.data?.status !== "draft") return badRequest("Select a current price draft.");
      if (currentResult.data &&
          Number(draftResult.data.version_no) <= Number(currentResult.data.version_no)) {
        return badRequest("This draft predates the current published rates. Save a new draft based on the current prices.");
      }
      const result = await supabase.rpc("bgm_publish_membership_price_catalog", {
        p_catalog_version_id: catalogVersionId,
        p_system_user_id: actorSystemUserId,
      });
      if (result.error) throw result.error;
      return NextResponse.json(result.data);
    }

    if (action === "save_declaration_draft") {
      let contentKey: DeclarationKey;
      let declarationBody: string;
      try {
        const rawKey = requiredString(body.contentKey, "Declaration type") as DeclarationKey;
        if (!DECLARATION_KEYS.includes(rawKey)) throw new Error("Unsupported declaration type.");
        contentKey = rawKey;
        if (typeof body.body !== "string" || !body.body.trim()) {
          throw new Error("Declaration wording is required.");
        }
        declarationBody = body.body;
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid declaration.");
      }

      const latestResult = await supabase
        .from("bgm_membership_declaration_versions")
        .select("version_no")
        .eq("content_key", contentKey)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestResult.error) throw latestResult.error;

      const versionNo = Number(latestResult.data?.version_no || 0) + 1;
      const contentSha256 = createHash("sha256")
        .update(declarationBody, "utf8")
        .digest("hex");

      const declarationResult = await supabase
        .from("bgm_membership_declaration_versions")
        .insert({
          content_key: contentKey,
          version_no: versionNo,
          body: declarationBody,
          content_sha256: contentSha256,
          created_by_system_user_id: actorSystemUserId,
        })
        .select(
          "id, content_key, version_no, body, content_sha256, status, published_at, created_at"
        )
        .single();
      if (declarationResult.error) throw declarationResult.error;

      await writeAudit(
        auth.context,
        "membership_settings.declaration_draft.saved",
        "membership_declaration",
        declarationResult.data.id,
        null,
        {
          contentKey,
          versionNo,
          contentSha256,
        }
      );

      return NextResponse.json({ ok: true, declaration: declarationResult.data });
    }

    if (action === "publish_declaration") {
      let declarationVersionId: string;
      try {
        declarationVersionId = requiredString(
          body.declarationVersionId,
          "Declaration version"
        );
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid declaration version.");
      }

      const result = await supabase.rpc("bgm_publish_membership_declaration", {
        p_declaration_version_id: declarationVersionId,
        p_system_user_id: actorSystemUserId,
      });
      if (result.error) throw result.error;
      return NextResponse.json(result.data);
    }

    if (action === "save_discount_code") {
      let id: string | null;
      let code: string;
      let percentage: number;
      let active: boolean;
      let validFrom: string | null;
      let validUntil: string | null;
      let maxUses: number | null;

      try {
        id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
        code = normalizeDiscountCode(requiredString(body.code, "Discount code"));
        percentage = Number(body.percentage);
        if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
          throw new Error("Discount percentage must be an integer from 1 to 100.");
        }
        active = body.active === undefined ? true : body.active === true;
        if (body.active !== undefined && typeof body.active !== "boolean") {
          throw new Error("Discount active state must be true or false.");
        }
        validFrom = optionalDate(body.validFrom, "Valid from");
        validUntil = optionalDate(body.validUntil, "Valid until");
        if (validFrom && validUntil && validUntil < validFrom) {
          throw new Error("Valid until cannot be before valid from.");
        }
        if (body.maxUses === null || body.maxUses === undefined || body.maxUses === "") {
          maxUses = null;
        } else {
          maxUses = Number(body.maxUses);
          if (!Number.isInteger(maxUses) || maxUses <= 0) {
            throw new Error("Maximum uses must be a positive integer.");
          }
        }
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid discount code.");
      }

      let beforeData: unknown = null;
      let discountResult;
      const now = new Date().toISOString();

      if (id) {
        const existingResult = await supabase
          .from("bgm_discount_codes")
          .select(
            "id, code, percentage, active, valid_from, valid_until, max_uses, successful_uses, created_by_system_user_id, created_at, updated_at"
          )
          .eq("id", id)
          .maybeSingle();
        if (existingResult.error) throw existingResult.error;
        if (!existingResult.data) {
          return NextResponse.json({ error: "Discount code not found." }, { status: 404 });
        }
        beforeData = existingResult.data;

        discountResult = await supabase
          .from("bgm_discount_codes")
          .update({
            code,
            percentage,
            active,
            valid_from: validFrom,
            valid_until: validUntil,
            max_uses: maxUses,
            updated_at: now,
          })
          .eq("id", id)
          .select(
            "id, code, percentage, active, valid_from, valid_until, max_uses, successful_uses, created_at, updated_at"
          )
          .single();
      } else {
        discountResult = await supabase
          .from("bgm_discount_codes")
          .insert({
            code,
            percentage,
            active,
            valid_from: validFrom,
            valid_until: validUntil,
            max_uses: maxUses,
            created_by_system_user_id: actorSystemUserId,
            updated_at: now,
          })
          .select(
            "id, code, percentage, active, valid_from, valid_until, max_uses, successful_uses, created_at, updated_at"
          )
          .single();
      }

      if (discountResult.error) throw discountResult.error;

      await writeAudit(
        auth.context,
        "membership_settings.discount.saved",
        "membership_discount_code",
        discountResult.data.id,
        beforeData,
        discountResult.data
      );

      return NextResponse.json({ ok: true, discountCode: discountResult.data });
    }

    if (action === "set_discount_active") {
      let id: string;
      let active: boolean;
      try {
        id = requiredString(body.id, "Discount code");
        if (typeof body.active !== "boolean") {
          throw new Error("Discount active state must be true or false.");
        }
        active = body.active;
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid discount state.");
      }

      const existingResult = await supabase
        .from("bgm_discount_codes")
        .select(
          "id, code, percentage, active, valid_from, valid_until, max_uses, successful_uses, created_at, updated_at"
        )
        .eq("id", id)
        .maybeSingle();
      if (existingResult.error) throw existingResult.error;
      if (!existingResult.data) {
        return NextResponse.json({ error: "Discount code not found." }, { status: 404 });
      }

      const updateResult = await supabase
        .from("bgm_discount_codes")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(
          "id, code, percentage, active, valid_from, valid_until, max_uses, successful_uses, created_at, updated_at"
        )
        .single();
      if (updateResult.error) throw updateResult.error;

      await writeAudit(
        auth.context,
        "membership_settings.discount.active_changed",
        "membership_discount_code",
        id,
        existingResult.data,
        updateResult.data
      );

      return NextResponse.json({ ok: true, discountCode: updateResult.data });
    }

    return badRequest("Unsupported membership settings action.");
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update membership settings." },
      { status: 500 }
    );
  }
}
