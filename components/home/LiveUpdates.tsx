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
        const response = await fetch("/api/content", { cache: "no-store" });
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
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 text-zinc-400">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading updates…</p>
        </div>
      </section>
    );
  }

  if (announcements.length === 0) {
    return (
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 text-zinc-950 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <Megaphone size={23} strokeWidth={3} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-orange-600">BGM Updates</p>
            <h2 className="mt-1 text-xl font-black">Nothing new right now</h2>
          </div>
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-zinc-500">
          Gym news and member updates will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 text-zinc-950 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-orange-600">BGM Updates</p>
          <h2 className="mt-1 text-2xl font-black">Latest from BGM</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <Megaphone size={22} strokeWidth={3} />
        </div>
      </div>

      <div className="mt-4 divide-y divide-zinc-100">
        {announcements.slice(0, 3).map((item, index) => {
          const ctaUrl = getCtaUrl(item);
          const ctaLabel = getCtaLabel(item);

          const body = (
            <article className="group flex gap-3 py-4 first:pt-0 last:pb-0">
              <img
                src={getImage(item)}
                alt=""
                className="h-16 w-16 shrink-0 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-black leading-tight">{getTitle(item)}</h3>
                  {ctaUrl ? (
                    <ChevronRight className="shrink-0 text-zinc-300 transition group-hover:translate-x-1" size={18} strokeWidth={3} />
                  ) : null}
                </div>
                {getBody(item) ? (
                  <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-zinc-500">{getBody(item)}</p>
                ) : null}
                {ctaUrl ? (
                  <p className="mt-1.5 text-xs font-black text-orange-600">{ctaLabel || "Open update"}</p>
                ) : null}
              </div>
            </article>
          );

          return ctaUrl ? (
            <a key={item.id || index} href={ctaUrl} target="_blank" rel="noreferrer" className="block">
              {body}
            </a>
          ) : (
            <div key={item.id || index}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}
