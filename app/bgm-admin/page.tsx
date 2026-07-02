"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, RefreshCw, Trash2 } from "lucide-react";

type Announcement = {
  id?: string;
  title: string;
  message: string;
  category: string;
  image_url: string;
  button_text: string;
  button_url: string;
  active: boolean;
  start_date: string;
  end_date: string;
  sort_order: number;
};

const emptyAnnouncement: Announcement = {
  title: "",
  message: "",
  category: "Update",
  image_url: "",
  button_text: "",
  button_url: "",
  active: true,
  start_date: "",
  end_date: "",
  sort_order: 0,
};

export default function BgmAdminPage() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementForm, setAnnouncementForm] =
    useState<Announcement>(emptyAnnouncement);

  useEffect(() => {
    const savedPin = window.sessionStorage.getItem("bgmAdminPin");

    if (savedPin) {
      setPin(savedPin);
      setUnlocked(true);
      loadContent(savedPin);
    }
  }, []);

  async function adminFetch(options?: RequestInit, overridePin?: string) {
    const activePin = overridePin || pin;

    return fetch("/api/admin/content", {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-pin": activePin,
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });
  }

  async function unlockAdmin() {
    setStatus("Checking PIN…");

    const response = await adminFetch(undefined, pin);

    if (!response.ok) {
      setStatus("Incorrect PIN or admin API not ready.");
      return;
    }

    window.sessionStorage.setItem("bgmAdminPin", pin);
    setUnlocked(true);
    setStatus("Admin unlocked.");
    loadContent(pin);
  }

  async function loadContent(activePin = pin) {
    const response = await adminFetch(undefined, activePin);
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not load content.");
      return;
    }

    setAnnouncements(data.announcements || []);
  }

  async function createAnnouncement() {
    const response = await adminFetch({
      method: "POST",
      body: JSON.stringify({
        type: "announcement",
        mode: "create",
        item: announcementForm,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not save announcement.");
      return;
    }

    setAnnouncementForm(emptyAnnouncement);
    setStatus("Announcement saved.");
    loadContent();
  }

  async function toggleAnnouncement(item: Announcement) {
    await adminFetch({
      method: "POST",
      body: JSON.stringify({
        type: "announcement",
        mode: "update",
        item: {
          ...item,
          active: !item.active,
        },
      }),
    });

    loadContent();
  }

  async function deleteAnnouncement(id?: string) {
    if (!id) return;

    const confirmed = window.confirm("Delete this announcement?");
    if (!confirmed) return;

    await adminFetch({
      method: "POST",
      body: JSON.stringify({
        type: "announcement",
        mode: "delete",
        id,
      }),
    });

    setStatus("Announcement deleted.");
    loadContent();
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-black p-5 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-orange-500">
            BGM Admin
          </p>

          <h1 className="mt-3 text-3xl font-black">Announcements admin</h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            Enter your private admin PIN to manage BGM announcements.
          </p>

          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Admin PIN"
            className="mt-5 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <button
            type="button"
            onClick={unlockAdmin}
            className="mt-4 w-full rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
          >
            Unlock Admin
          </button>

          {status ? (
            <p className="mt-4 text-sm font-bold text-white/50">{status}</p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-5 pb-28 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 to-black p-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-orange-500">
            BGM Admin
          </p>

          <h1 className="mt-3 text-4xl font-black">Announcements</h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            Add BGM updates. Changes appear on the Home page without changing
            code.
          </p>

          <button
            type="button"
            onClick={() => loadContent()}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black"
          >
            <RefreshCw size={16} strokeWidth={3} />
            Refresh
          </button>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-5 flex items-center gap-3">
            <Megaphone className="text-orange-500" size={26} strokeWidth={3} />
            <h2 className="text-2xl font-black">New Announcement</h2>
          </div>

          <div className="grid gap-3">
            <input
              value={announcementForm.title}
              onChange={(event) =>
                setAnnouncementForm({
                  ...announcementForm,
                  title: event.target.value,
                })
              }
              placeholder="Title"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
            />

            <textarea
              value={announcementForm.message}
              onChange={(event) =>
                setAnnouncementForm({
                  ...announcementForm,
                  message: event.target.value,
                })
              }
              placeholder="Message"
              className="min-h-28 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
            />

            <input
              value={announcementForm.category}
              onChange={(event) =>
                setAnnouncementForm({
                  ...announcementForm,
                  category: event.target.value,
                })
              }
              placeholder="Category, example: Public Holiday"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
            />

            <input
              value={announcementForm.image_url}
              onChange={(event) =>
                setAnnouncementForm({
                  ...announcementForm,
                  image_url: event.target.value,
                })
              }
              placeholder="Image URL or public path, optional"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                value={announcementForm.button_text}
                onChange={(event) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    button_text: event.target.value,
                  })
                }
                placeholder="Button text"
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
              />

              <input
                value={announcementForm.button_url}
                onChange={(event) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    button_url: event.target.value,
                  })
                }
                placeholder="Button URL"
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <input
                type="date"
                value={announcementForm.start_date}
                onChange={(event) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    start_date: event.target.value,
                  })
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
              />

              <input
                type="date"
                value={announcementForm.end_date}
                onChange={(event) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    end_date: event.target.value,
                  })
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
              />

              <input
                type="number"
                value={announcementForm.sort_order}
                onChange={(event) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    sort_order: Number(event.target.value),
                  })
                }
                placeholder="Order"
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
              />
            </div>

            <button
              type="button"
              onClick={createAnnouncement}
              className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
            >
              <Plus size={17} strokeWidth={3} />
              Add Announcement
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-black">Existing Announcements</h2>

          {announcements.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <p className="text-lg font-black">{item.title}</p>

              <p className="mt-2 text-sm font-bold text-white/45">
                {item.message}
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => toggleAnnouncement(item)}
                  className="rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-black"
                >
                  {item.active ? "Deactivate" : "Activate"}
                </button>

                <button
                  type="button"
                  onClick={() => deleteAnnouncement(item.id)}
                  className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-black"
                >
                  <Trash2 size={14} strokeWidth={3} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </section>

        {status ? (
          <p className="text-center text-sm font-bold text-white/50">
            {status}
          </p>
        ) : null}
      </div>
    </main>
  );
}
