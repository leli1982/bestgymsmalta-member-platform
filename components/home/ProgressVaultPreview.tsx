"use client";

import { useEffect, useState } from "react";
import { Camera, ChevronRight } from "lucide-react";
import { getSavedMember } from "@/lib/memberSession";

type ProgressPhoto = {
  id: string;
  imageUrl: string;
  progressDate: string;
};

export default function ProgressVaultPreview() {
  const [photoCount, setPhotoCount] = useState(0);
  const [latestPhoto, setLatestPhoto] = useState<ProgressPhoto | null>(null);

  useEffect(() => {
    async function loadPhotos() {
      const member = getSavedMember();

      if (!member) {
        setPhotoCount(0);
        setLatestPhoto(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/member/progress-photos?memberId=${member.id}`,
          { cache: "no-store" }
        );

        const data = await response.json();
        const photos = data.photos || [];

        setPhotoCount(photos.length);
        setLatestPhoto(photos[0] || null);
      } catch {
        setPhotoCount(0);
        setLatestPhoto(null);
      }
    }

    loadPhotos();

    window.addEventListener("bgmMemberChanged", loadPhotos);

    return () => {
      window.removeEventListener("bgmMemberChanged", loadPhotos);
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]">
      {latestPhoto ? (
        <img
          src={latestPhoto.imageUrl}
          alt="Latest progress"
          className="h-48 w-full object-cover"
        />
      ) : null}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Progress Vault
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              {photoCount > 0
                ? `${photoCount} private photo${photoCount === 1 ? "" : "s"}`
                : "Start your progress vault"}
            </h2>

            <p className="mt-2 text-sm font-bold leading-6 text-white/55">
              Upload private progress photos and compare your before and after
              journey.
            </p>
          </div>

          <Camera className="shrink-0 text-[#fcb415]" size={30} strokeWidth={3} />
        </div>

        <a
          href="/progress"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          Open Progress Vault
          <ChevronRight size={17} strokeWidth={3} />
        </a>
      </div>
    </section>
  );
}
