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
        const response = await fetch("/api/public/announcements", { cache: "no-store" });
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
    <div className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-5 text-zinc-950 shadow-sm">
      {announcement.image_url ? (
        <div className="absolute right-0 top-0 h-full w-28 overflow-hidden opacity-10">
          <img
            src={announcement.image_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white" />
        </div>
      ) : null}

      <div className="relative z-10 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <Megaphone size={23} strokeWidth={3} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-600">
              {announcement.category || "Announcement"}
            </p>
            {announcement.button_url ? (
              <ChevronRight className="shrink-0 text-zinc-300 transition group-hover:translate-x-1" size={19} strokeWidth={3} />
            ) : null}
          </div>

          <h2 className="mt-2 text-xl font-black leading-tight">{announcement.title}</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">{announcement.message}</p>

          {announcement.button_text && announcement.button_url ? (
            <p className="mt-3 text-sm font-black text-orange-600">{announcement.button_text}</p>
          ) : null}
        </div>
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
