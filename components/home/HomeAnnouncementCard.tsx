"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Megaphone } from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  message: string;
  category: string;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
};

export default function HomeAnnouncementCard() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAnnouncement() {
      try {
        const response = await fetch("/api/public/announcements", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!active) return;

        setAnnouncement(data.announcement || null);
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoaded(true);
      }
    }

    loadAnnouncement();

    return () => {
      active = false;
    };
  }, []);

  if (!loaded || !announcement) return null;

  const content = (
    <div className="group relative overflow-hidden rounded-[2rem] border border-[#fcb415]/25 bg-[#fcb415]/10 p-5 shadow-xl">
      {announcement.image_url ? (
        <img
          src={announcement.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25 transition duration-500 group-hover:scale-105"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-black/50 to-black/90" />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#fcb415]/30 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-[#fcb415]">
            <Megaphone size={14} strokeWidth={3} />
            {announcement.category || "Update"}
          </div>

          {announcement.button_url ? (
            <ChevronRight
              className="text-white/40 transition group-hover:translate-x-1"
              size={19}
              strokeWidth={3}
            />
          ) : null}
        </div>

        <h2 className="mt-4 text-2xl font-black leading-tight text-white">
          {announcement.title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/70">
          {announcement.message}
        </p>

        {announcement.button_text && announcement.button_url ? (
          <p className="mt-4 text-sm font-black text-[#fcb415]">
            {announcement.button_text}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (announcement.button_url) {
    return (
      <a href={announcement.button_url} className="block">
        {content}
      </a>
    );
  }

  return content;
}
