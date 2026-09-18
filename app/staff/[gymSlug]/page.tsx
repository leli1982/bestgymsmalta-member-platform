import { notFound } from "next/navigation";
import StaffLoginPage from "@/components/staff/StaffLoginPage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ gymSlug: string }>;
};

function cleanGymSlug(value: string) {
  return String(value || "").trim().toLowerCase();
}

export default async function GymStaffPage({ params }: Props) {
  const { gymSlug: rawGymSlug } = await params;
  const gymSlug = cleanGymSlug(rawGymSlug);

  if (!gymSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymSlug)) {
    notFound();
  }

  const supabase = getSupabaseAdmin();
  const gymResult = await supabase
    .from("bgm_gyms")
    .select("id,name,short_name,public_enrollment_slug,status")
    .eq("public_enrollment_slug", gymSlug)
    .eq("status", "active")
    .maybeSingle();

  if (gymResult.error) throw gymResult.error;
  if (!gymResult.data) notFound();

  return (
    <StaffLoginPage
      expectedGym={{
        id: gymResult.data.id,
        name: gymResult.data.name,
        shortName: gymResult.data.short_name || gymResult.data.name,
        gymSlug,
      }}
    />
  );
}
