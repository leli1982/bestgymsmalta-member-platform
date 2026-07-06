"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  message: string;
  category?: string;
  image_url?: string | null;
  button_text?: string | null;
  button_url?: string | null;
};

export default function LiveUpdates() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContent() {
      try {
        const response = await fetch("/api/content", {
          cache: "no-store",
        });

        const data = await response.json();

        setAnnouncements(data.announcements || []);
      } catch {
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, []);

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm font-bold text-white/45">Loading BGM updates…</p>
      </section>
    );
  }

  if (!announcements.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
          BGM Updates
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          Announcements
        </h2>
      </div>

      {announcements.map((item) => (
        <article
          key={item.id}
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]"
        >
          {item.image_url ? (
            <img
              src={item.image_url}
              alt=""
              className="h-44 w-full object-cover"
            />
          ) : null}

          <div className="p-5">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#fcb415]/30 bg-[#fcb415]/10 px-3 py-2">
              <Megaphone
                size={15}
                strokeWidth={3}
                className="text-[#fcb415]"
              />
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#fcb415]">
                {item.category || "Update"}
              </p>
            </div>

            <h3 className="text-2xl font-black text-white">{item.title}</h3>

            <p className="mt-3 text-sm font-bold leading-6 text-white/50">
              {item.message}
            </p>

            {item.button_text && item.button_url ? (
              <a
                href={item.button_url}
                target={item.button_url.startsWith("http") ? "_blank" : undefined}
                rel={item.button_url.startsWith("http") ? "noreferrer" : undefined}
                className="mt-5 inline-flex rounded-full bg-[#fcb415] px-5 py-3 text-sm font-black text-black"
              >
                {item.button_text}
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
