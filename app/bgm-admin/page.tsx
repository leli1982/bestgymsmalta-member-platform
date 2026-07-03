"use client";

import { useEffect, useState } from "react";
import {
  Image as ImageIcon,
  MapPinned,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type AdminTab = "announcements" | "gyms";

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

type AdminGym = {
  id: string;
  name: string;
  shortName: string;
  status: "active" | "coming_soon";
  city: string;
  address: string;
  latitude: number | "";
  longitude: number | "";
  openingHours: string;
  phone: string;
  email: string;
  logo: string;
  accentColor: string;
  qrCodeId: string;
  facilities: string[];
  classes: string[];
  featuredEquipment: string[];
  notes: string;
  sortOrder: number;
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
  const [activeTab, setActiveTab] = useState<AdminTab>("announcements");
  const [status, setStatus] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementForm, setAnnouncementForm] =
    useState<Announcement>(emptyAnnouncement);
  const [editingAnnouncementId, setEditingAnnouncementId] =
    useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [gyms, setGyms] = useState<AdminGym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [gymForm, setGymForm] = useState<AdminGym | null>(null);
  const [facilitiesText, setFacilitiesText] = useState("");
  const [classesText, setClassesText] = useState("");
  const [featuredEquipmentText, setFeaturedEquipmentText] = useState("");

  useEffect(() => {
    const savedPin = window.sessionStorage.getItem("bgmAdminPin");

    if (savedPin) {
      setPin(savedPin);
      setUnlocked(true);
      loadAnnouncements(savedPin);
      loadGyms(savedPin);
    }
  }, []);

  async function contentFetch(options?: RequestInit, overridePin?: string) {
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

  async function gymsFetch(options?: RequestInit, overridePin?: string) {
    const activePin = overridePin || pin;

    return fetch("/api/admin/gyms", {
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

    const response = await contentFetch(undefined, pin);

    if (!response.ok) {
      setStatus("Incorrect PIN or admin API not ready.");
      return;
    }

    window.sessionStorage.setItem("bgmAdminPin", pin);
    setUnlocked(true);
    setStatus("Admin unlocked.");

    loadAnnouncements(pin);
    loadGyms(pin);
  }

  async function loadAnnouncements(activePin = pin) {
    const response = await contentFetch(undefined, activePin);
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not load announcements.");
      return;
    }

    setAnnouncements(data.announcements || []);
  }

  async function uploadImage(file?: File) {
    if (!file) return;

    setUploading(true);
    setStatus("Uploading image…");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      headers: {
        "x-admin-pin": pin,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Image upload failed.");
      setUploading(false);
      return;
    }

    setAnnouncementForm((current) => ({
      ...current,
      image_url: data.imageUrl,
    }));

    setStatus("Image uploaded.");
    setUploading(false);
  }

  async function saveAnnouncement() {
    const mode = editingAnnouncementId ? "update" : "create";

    const response = await contentFetch({
      method: "POST",
      body: JSON.stringify({
        mode,
        item: {
          ...announcementForm,
          id: editingAnnouncementId || announcementForm.id,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not save announcement.");
      return;
    }

    setAnnouncementForm(emptyAnnouncement);
    setEditingAnnouncementId(null);
    setStatus(
      editingAnnouncementId ? "Announcement updated." : "Announcement saved."
    );
    loadAnnouncements();
  }

  function editAnnouncement(item: Announcement) {
    setEditingAnnouncementId(item.id || null);

    setAnnouncementForm({
      id: item.id,
      title: item.title || "",
      message: item.message || "",
      category: item.category || "Update",
      image_url: item.image_url || "",
      button_text: item.button_text || "",
      button_url: item.button_url || "",
      active: Boolean(item.active),
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      sort_order: Number(item.sort_order || 0),
    });

    setActiveTab("announcements");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setStatus("Editing announcement.");
  }

  function cancelAnnouncementEdit() {
    setEditingAnnouncementId(null);
    setAnnouncementForm(emptyAnnouncement);
    setStatus("Edit cancelled.");
  }

  async function toggleAnnouncement(item: Announcement) {
    await contentFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "update",
        item: {
          ...item,
          active: !item.active,
        },
      }),
    });

    loadAnnouncements();
  }

  async function deleteAnnouncement(id?: string) {
    if (!id) return;

    const confirmed = window.confirm("Delete this announcement?");
    if (!confirmed) return;

    await contentFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "delete",
        id,
      }),
    });

    if (editingAnnouncementId === id) {
      cancelAnnouncementEdit();
    }

    setStatus("Announcement deleted.");
    loadAnnouncements();
  }

  function loadGymIntoForm(gym: AdminGym) {
    setSelectedGymId(gym.id);
    setGymForm(gym);
    setFacilitiesText((gym.facilities || []).join(", "));
    setClassesText((gym.classes || []).join(", "));
    setFeaturedEquipmentText((gym.featuredEquipment || []).join(", "));
  }

  async function loadGyms(activePin = pin, preferredGymId?: string) {
    const response = await gymsFetch(undefined, activePin);
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not load gyms.");
      return;
    }

    const loadedGyms: AdminGym[] = data.gyms || [];
    setGyms(loadedGyms);

    if (loadedGyms.length) {
      const gymToLoad =
        loadedGyms.find((item) => item.id === preferredGymId) ||
        loadedGyms.find((item) => item.id === selectedGymId) ||
        loadedGyms[0];

      loadGymIntoForm(gymToLoad);
    }
  }

  async function seedGyms() {
    const confirmed = window.confirm(
      "Import the current app gym list into Supabase? This will overwrite matching gym IDs."
    );

    if (!confirmed) return;

    setStatus("Importing gyms…");

    const response = await gymsFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "seed",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not import gyms.");
      return;
    }

    setStatus("Gyms imported.");
    loadGyms();
  }

  function selectGym(id: string) {
    const gym = gyms.find((item) => item.id === id);
    if (!gym) return;

    loadGymIntoForm(gym);
  }

  function updateGymForm(updates: Partial<AdminGym>) {
    setGymForm((current) => (current ? { ...current, ...updates } : current));
  }

  function textToList(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function saveGym() {
    if (!gymForm) return;

    setStatus("Saving gym…");

    const gymToSave = {
      ...gymForm,
      facilities: textToList(facilitiesText),
      classes: textToList(classesText),
      featuredEquipment: textToList(featuredEquipmentText),
    };

    const response = await gymsFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "update",
        gym: gymToSave,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not save gym.");
      return;
    }

    setStatus("Gym saved.");
    await loadGyms(pin, gymForm.id);
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-black p-5 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-orange-500">
            BGM Admin
          </p>

          <h1 className="mt-3 text-3xl font-black">Member app admin</h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            Enter your private admin PIN to manage announcements and gym
            details.
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

          <h1 className="mt-3 text-4xl font-black">Member app admin</h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            Manage announcements, images, opening hours, gym status, map pins
            and facilities from one place.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("announcements")}
              className={`rounded-full px-5 py-3 text-sm font-black ${
                activeTab === "announcements"
                  ? "bg-orange-500 text-black"
                  : "border border-white/10 bg-white/[0.04] text-white"
              }`}
            >
              Announcements
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("gyms")}
              className={`rounded-full px-5 py-3 text-sm font-black ${
                activeTab === "gyms"
                  ? "bg-orange-500 text-black"
                  : "border border-white/10 bg-white/[0.04] text-white"
              }`}
            >
              Gym Details
            </button>
          </div>
        </section>

        {activeTab === "announcements" ? (
          <>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Megaphone
                    className="text-orange-500"
                    size={26}
                    strokeWidth={3}
                  />
                  <h2 className="text-2xl font-black">
                    {editingAnnouncementId
                      ? "Edit Announcement"
                      : "New Announcement"}
                  </h2>
                </div>

                {editingAnnouncementId ? (
                  <button
                    type="button"
                    onClick={cancelAnnouncementEdit}
                    className="rounded-full border border-white/10 bg-black/25 p-3 text-white"
                  >
                    <X size={18} strokeWidth={3} />
                  </button>
                ) : null}
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

                {announcementForm.image_url ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                    <img
                      src={announcementForm.image_url}
                      alt=""
                      className="h-48 w-full object-cover"
                    />

                    <div className="p-3">
                      <p className="break-all text-xs font-bold text-white/45">
                        {announcementForm.image_url}
                      </p>
                    </div>
                  </div>
                ) : null}

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-5 py-4 text-sm font-black text-orange-500">
                  <ImageIcon size={18} strokeWidth={3} />
                  {uploading ? "Uploading…" : "Upload Image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => uploadImage(event.target.files?.[0])}
                  />
                </label>

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

                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
                  <span className="text-sm font-black text-white">Active</span>
                  <input
                    type="checkbox"
                    checked={announcementForm.active}
                    onChange={(event) =>
                      setAnnouncementForm({
                        ...announcementForm,
                        active: event.target.checked,
                      })
                    }
                    className="h-5 w-5 accent-orange-500"
                  />
                </label>

                <button
                  type="button"
                  onClick={saveAnnouncement}
                  className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
                >
                  {editingAnnouncementId ? (
                    <Save size={17} strokeWidth={3} />
                  ) : (
                    <Plus size={17} strokeWidth={3} />
                  )}
                  {editingAnnouncementId ? "Save Changes" : "Add Announcement"}
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black">Existing Announcements</h2>

                <button
                  type="button"
                  onClick={() => loadAnnouncements()}
                  className="rounded-full border border-white/10 bg-white/[0.04] p-3"
                >
                  <RefreshCw size={16} strokeWidth={3} />
                </button>
              </div>

              {announcements.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-40 w-full object-cover"
                    />
                  ) : null}

                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-lg font-black">{item.title}</p>

                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] ${
                          item.active
                            ? "bg-green-400/10 text-green-300"
                            : "bg-white/10 text-white/35"
                        }`}
                      >
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-white/45">
                      {item.message}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => editAnnouncement(item)}
                        className="flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-black"
                      >
                        <Pencil size={14} strokeWidth={3} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleAnnouncement(item)}
                        className="rounded-full border border-white/10 px-4 py-2 text-xs font-black"
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
                </div>
              ))}
            </section>
          </>
        ) : null}

        {activeTab === "gyms" ? (
          <>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-bold leading-6 text-white/50">
                Edit opening hours, status, phone numbers, facilities and map
                pins. For facilities, classes and equipment, use normal
                comma-separated text.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => loadGyms()}
                  className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black"
                >
                  <RefreshCw size={16} strokeWidth={3} />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={seedGyms}
                  className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-black text-black"
                >
                  <Upload size={16} strokeWidth={3} />
                  Import Gyms
                </button>
              </div>
            </section>

            {gyms.length === 0 ? (
              <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-bold leading-6 text-white/50">
                  No gyms found in Supabase yet. Tap{" "}
                  <strong>Import Gyms</strong> to copy the current app gym list
                  into Supabase.
                </p>
              </section>
            ) : null}

            {gyms.length > 0 && gymForm ? (
              <>
                <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-[.18em] text-white/40">
                      Select Gym
                    </span>

                    <select
                      value={selectedGymId}
                      onChange={(event) => selectGym(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
                    >
                      {gyms.map((gym) => (
                        <option key={gym.id} value={gym.id}>
                          {gym.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                <section className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center gap-3">
                    <MapPinned
                      className="text-orange-500"
                      size={26}
                      strokeWidth={3}
                    />
                    <h2 className="text-2xl font-black">{gymForm.name}</h2>
                  </div>

                  <div className="grid gap-3">
                    <input
                      value={gymForm.name}
                      onChange={(event) =>
                        updateGymForm({ name: event.target.value })
                      }
                      placeholder="Gym name"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <input
                      value={gymForm.shortName}
                      onChange={(event) =>
                        updateGymForm({ shortName: event.target.value })
                      }
                      placeholder="Short name"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <select
                      value={gymForm.status}
                      onChange={(event) =>
                        updateGymForm({
                          status: event.target.value as
                            | "active"
                            | "coming_soon",
                        })
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="coming_soon">Coming Soon</option>
                    </select>

                    <input
                      value={gymForm.city}
                      onChange={(event) =>
                        updateGymForm({ city: event.target.value })
                      }
                      placeholder="City"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <textarea
                      value={gymForm.address}
                      onChange={(event) =>
                        updateGymForm({ address: event.target.value })
                      }
                      placeholder="Address"
                      className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <textarea
                      value={gymForm.openingHours}
                      onChange={(event) =>
                        updateGymForm({ openingHours: event.target.value })
                      }
                      placeholder="Opening hours"
                      className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={gymForm.latitude}
                        onChange={(event) =>
                          updateGymForm({
                            latitude:
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                          })
                        }
                        placeholder="Latitude"
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                      />

                      <input
                        value={gymForm.longitude}
                        onChange={(event) =>
                          updateGymForm({
                            longitude:
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                          })
                        }
                        placeholder="Longitude"
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={gymForm.phone}
                        onChange={(event) =>
                          updateGymForm({ phone: event.target.value })
                        }
                        placeholder="Phone"
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                      />

                      <input
                        value={gymForm.email}
                        onChange={(event) =>
                          updateGymForm({ email: event.target.value })
                        }
                        placeholder="Email"
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                      />
                    </div>

                    <input
                      value={gymForm.logo}
                      onChange={(event) =>
                        updateGymForm({ logo: event.target.value })
                      }
                      placeholder="Logo path, example /gym-logos/bgm-marsa.png"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <textarea
                      value={facilitiesText}
                      onChange={(event) =>
                        setFacilitiesText(event.target.value)
                      }
                      placeholder="Facilities, comma separated. Example: Free weights, Cardio, Showers, Lockers"
                      className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <textarea
                      value={classesText}
                      onChange={(event) => setClassesText(event.target.value)}
                      placeholder="Classes, comma separated. Example: Spinning, Boxing, Functional Training"
                      className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <textarea
                      value={featuredEquipmentText}
                      onChange={(event) =>
                        setFeaturedEquipmentText(event.target.value)
                      }
                      placeholder="Featured equipment, comma separated. Example: Squat racks, Dumbbells, Cable machines"
                      className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <textarea
                      value={gymForm.notes}
                      onChange={(event) =>
                        updateGymForm({ notes: event.target.value })
                      }
                      placeholder="Notes"
                      className="min-h-28 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <input
                      type="number"
                      value={gymForm.sortOrder}
                      onChange={(event) =>
                        updateGymForm({ sortOrder: Number(event.target.value) })
                      }
                      placeholder="Sort order"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                    />

                    <button
                      type="button"
                      onClick={saveGym}
                      className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
                    >
                      <Save size={17} strokeWidth={3} />
                      Save Gym
                    </button>
                  </div>
                </section>
              </>
            ) : null}
          </>
        ) : null}

        {status ? (
          <p className="text-center text-sm font-bold text-white/50">
            {status}
          </p>
        ) : null}
      </div>
    </main>
  );
}
