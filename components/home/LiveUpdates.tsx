"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Megaphone, RefreshCw } from "lucide-react";

type Announcement = {
  id?: string;
  title?: string;
  headline?: string;
  body?: string;
  message?: string;
  description?: string;
  imageUrl?: string;
  image_url?: string;
  ctaLabel?: string;
  cta_label?: string;
  ctaUrl?: string;
  cta_url?: string;
};

function getTitle(item: Announcement) {
  return item.title || item.headline || "BestGymsMalta announcement";
}

function getBody(item: Announcement) {
  return item.body || item.message || item.description || "";
}

function getImage(item: Announcement) {
  return item.imageUrl || item.image_url || "/visuals/announcement-default.jpg";
}

function getCtaLabel(item: Announcement) {
  return item.ctaLabel || item.cta_label || "";
}

function getCtaUrl(item: Announcement) {
  return item.ctaUrl || item.cta_url || "";
}

export default function LiveUpdates() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnnouncements() {
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

    loadAnnouncements();
  }, []);

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3 text-white/45">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading announcements…</p>
        </div>
      </section>
    );
  }

  if (announcements.length === 0) {
    return (
      <section
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-cover bg-center p-5"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.82)), linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.78)), url('/visuals/announcement-default.jpg')",
        }}
      >
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fcb415] text-black">
              <Megaphone size={24} strokeWidth={3} />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Announcements
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">
                Nothing new right now
              </h2>
            </div>
          </div>

          <p className="mt-4 text-sm font-bold leading-6 text-white/60">
            Updates, gym news and member announcements will appear here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Announcements
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Latest from BGM
          </h2>
        </div>

        <Megaphone className="text-[#fcb415]" size={25} strokeWidth={3} />
      </div>

      {announcements.slice(0, 3).map((item, index) => {
        const ctaUrl = getCtaUrl(item);
        const ctaLabel = getCtaLabel(item);

        return (
          <article
            key={item.id || index}
            className="relative min-h-[230px] overflow-hidden rounded-[2rem] border border-white/10 bg-cover bg-center p-5 shadow-2xl"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.86)), linear-gradient(135deg, rgba(252,180,21,.16), rgba(0,0,0,.78)), url('${getImage(
                item
              )}')`,
            }}
          >
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#fcb415]/20 blur-3xl" />

            <div className="relative flex min-h-[190px] flex-col justify-between">
              <div>
                <div className="inline-flex rounded-full bg-[#fcb415] px-4 py-2 text-[10px] font-black uppercase tracking-[.2em] text-black">
                  BGM Update
                </div>

                <h3 className="mt-5 text-3xl font-black leading-tight text-white drop-shadow">
                  {getTitle(item)}
                </h3>

                {getBody(item) ? (
                  <p className="mt-3 text-sm font-bold leading-6 text-white/65">
                    {getBody(item)}
                  </p>
                ) : null}
              </div>

              {ctaUrl ? (
                <a
                  href={ctaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black"
                >
                  {ctaLabel || "Open"}
                  <ChevronRight size={17} strokeWidth={3} />
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
