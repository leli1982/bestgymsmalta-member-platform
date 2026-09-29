import type { Metadata } from "next";
import JoinEnrollmentPage from "@/components/membership/JoinEnrollmentPage";
import JoinPwaRegistration from "@/components/membership/JoinPwaRegistration";

export const dynamic = "force-dynamic";

type JoinPageProps = {
  params: Promise<{ gymSlug: string }>;
};

function cleanGymSlug(value: string): string {
  return String(value || "").trim().toLowerCase();
}

export async function generateMetadata({ params }: JoinPageProps): Promise<Metadata> {
  const { gymSlug } = await params;
  const slug = cleanGymSlug(gymSlug);

  return {
    title: "BestGymsMalta Registration",
    description: "BestGymsMalta new membership registration.",
    manifest: `/join/${encodeURIComponent(slug)}/manifest.webmanifest`,
    icons: {
      icon: "/icons/favicon-32.png",
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { gymSlug } = await params;
  const slug = cleanGymSlug(gymSlug);

  return (
    <>
      <JoinPwaRegistration />
      <JoinEnrollmentPage gymSlug={slug} />
    </>
  );
}
