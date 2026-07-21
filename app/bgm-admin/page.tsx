"use client";

import {
  useEffect,
  useState } from "react";
import {
  Building2,
  Image as ImageIcon,
  LockKeyhole,
  LogOut,
  MapPinned,
  Megaphone,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
  BarChart3,
} from "lucide-react";
import GymQrAdmin from "@/components/admin/GymQrAdmin";
import AdminCheckinsViewer from "@/components/admin/AdminCheckinsViewer";
import MembersAdmin from "@/components/admin/MembersAdmin";
import AdminAnalytics from "@/components/admin/AdminAnalytics";

type AdminTab = "announcements" | "analytics" | "gyms" | "checkins" | "members";

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
  virtualTourUrl: string;
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

const emptyGym: AdminGym = {
  id: "",
  name: "",
  shortName: "",
  status: "coming_soon",
  city: "",
  address: "",
  latitude: "",
  longitude: "",
  openingHours: "",
  phone: "",
  email: "",
  logo: "",
  virtualTourUrl: "",
  accentColor: "#fcb415",
  qrCodeId: "",
  facilities: [],
  classes: [],
  featuredEquipment: [],
  notes: "",
  sortOrder: 999,
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
  const [creatingGym, setCreatingGym] = useState(false);
  const [uploadingGymLogo, setUploadingGymLogo] = useState(false);

  useEffect(() => {
    async function checkAdminSession() {
      try {
        const response = await fetch("/api/admin/auth", {
          cache: "no-store",
        });

        const data = await response.json();

        if (data.authenticated) {
          setUnlocked(true);
          loadAnnouncements("");
          loadGyms("");
        }
      } catch {
        setUnlocked(false);
      }
    }

    checkAdminSession();
  }, []);

  async function contentFetch(options?: RequestInit, overridePin?: string) {
    const activePin = overridePin || pin;

    return fetch("/api/admin/content", {
      ...options,
      headers: {
        "Content-Type": "application/json",
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
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });
  }

  async function unlockAdmin() {
    setStatus("Checking PIN…");

    const response = await fetch("/api/admin/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Incorrect PIN.");
      return;
    }

    setUnlocked(true);
    setPin("");
    setStatus("Admin unlocked.");

    loadAnnouncements("");
    loadGyms("");
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

    setCreatingGym(false);
    loadGymIntoForm(gym);
  }

  function updateGymForm(updates: Partial<AdminGym>) {
    setGymForm((current) => (current ? { ...current, ...updates } : current));
  }

  function startNewGym() {
    const newGym = {
      ...emptyGym,
      sortOrder: gyms.length + 1,
    };

    setCreatingGym(true);
    setSelectedGymId("");
    setGymForm(newGym);
    setFacilitiesText("");
    setClassesText("");
    setFeaturedEquipmentText("");
    setActiveTab("gyms");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setStatus("Adding new gym. Choose a unique gym ID, then save.");
  }

  async function uploadGymLogo(file?: File) {
    if (!file) return;

    setUploadingGymLogo(true);
    setStatus("Uploading gym logo…");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/gym-logo-upload", {
      method: "POST",
      headers: {
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Gym logo upload failed.");
      setUploadingGymLogo(false);
      return;
    }

    updateGymForm({ logo: data.logoUrl });
    setStatus("Gym logo uploaded.");
    setUploadingGymLogo(false);
  }

  async function deleteGym(id?: string) {
    if (!id) return;

    const confirmed = window.confirm(
      "Delete this gym from the app? This removes it from the public gym list."
    );

    if (!confirmed) return;

    setStatus("Deleting gym…");

    const response = await gymsFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "delete",
        id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not delete gym.");
      return;
    }

    setCreatingGym(false);
    setGymForm(null);
    setSelectedGymId("");
    setFacilitiesText("");
    setClassesText("");
    setFeaturedEquipmentText("");
    setStatus("Gym deleted.");
    await loadGyms();
  }

  function textToList(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function saveGym() {
    if (!gymForm) return;

    if (!gymForm.id.trim()) {
      setStatus("Gym ID is required. Example: bgm-new-location");
      return;
    }

    if (!gymForm.name.trim()) {
      setStatus("Gym name is required.");
      return;
    }

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

    setCreatingGym(false);
    setStatus("Gym saved.");
    await loadGyms(pin, gymForm.id);
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-black p-5 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md items-center">
          <section
            className="relative w-full overflow-hidden rounded-[2.4rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.88)), linear-gradient(135deg, rgba(252,180,21,.24), rgba(0,0,0,.88)), url('/visuals/account.jpg')",
            }}
          >
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#fcb415]/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
                  <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                    Secure Admin
                  </p>
                </div>

                <img
                  src="/bgm-logo.png"
                  alt="BestGymsMalta"
                  className="h-16 w-16 object-contain drop-shadow-2xl"
                />
              </div>

              <div className="mt-14">
                <LockKeyhole className="text-[#fcb415]" size={38} strokeWidth={3} />

                <h1 className="mt-5 text-5xl font-black leading-[0.95] text-white">
                  BGM Admin
                </h1>

                <p className="mt-4 text-sm font-bold leading-6 text-white/60">
                  Manage the member app, gym details, announcements, QR codes and
                  member access.
                </p>
              </div>

              <div className="mt-8 rounded-[1.7rem] border border-white/10 bg-black/40 p-4 backdrop-blur-md">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                    Admin PIN
                  </span>

                  <input
                    type="password"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        unlockAdmin();
                      }
                    }}
                    placeholder="Enter private PIN"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-base font-bold text-white outline-none placeholder:text-white/25"
                  />
                </label>

                <button
                  type="button"
                  onClick={unlockAdmin}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
                >
                  Unlock Admin
                  <ShieldCheck size={18} strokeWidth={3} />
                </button>

                {status ? (
                  <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm font-bold leading-6 text-white/55">
                    {status}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-5 pb-28 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <section
          className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.88)), linear-gradient(135deg, rgba(252,180,21,.24), rgba(0,0,0,.88)), url('/visuals/account.jpg')",
          }}
        >
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#fcb415]/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#fcb415]/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="w-fit rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
                  <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                    BestGymsMalta
                  </p>
                </div>

                <h1 className="mt-5 text-5xl font-black leading-[0.95] text-white">
                  Member app admin
                </h1>

                <p className="mt-4 max-w-xl text-sm font-bold leading-6 text-white/60">
                  Manage announcements, gym details, QR codes and member access
                  from one clean control centre.
                </p>
              </div>

              <img
                src="/bgm-logo.png"
                alt="BestGymsMalta"
                className="h-16 w-16 shrink-0 object-contain drop-shadow-2xl"
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <Megaphone className="text-[#fcb415]" size={22} strokeWidth={3} />
                <p className="mt-3 text-3xl font-black text-white">
                  {announcements.length}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                  Announcements
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <Building2 className="text-[#fcb415]" size={22} strokeWidth={3} />
                <p className="mt-3 text-3xl font-black text-white">
                  {gyms.filter((gym) => gym.status === "active").length}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                  Active gyms
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <MapPinned className="text-[#fcb415]" size={22} strokeWidth={3} />
                <p className="mt-3 text-3xl font-black text-white">
                  {gyms.filter((gym) => gym.status === "coming_soon").length}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                  Coming soon
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <ShieldCheck className="text-[#fcb415]" size={22} strokeWidth={3} />
                <p className="mt-3 text-3xl font-black text-white">ON</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                  Admin access
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <button
                type="button"
                onClick={() => setActiveTab("announcements")}
                className={
                  activeTab === "announcements"
                    ? "flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-4 py-4 text-sm font-black text-black"
                    : "flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-4 text-sm font-black text-white/70 backdrop-blur-md"
                }
              >
                <Megaphone size={17} strokeWidth={3} />
                News
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                className={
                  activeTab === "analytics"
                    ? "flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-4 py-4 text-sm font-black text-black"
                    : "flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-4 text-sm font-black text-white/70 backdrop-blur-md"
                }
              >
                <BarChart3 size={17} strokeWidth={3} />
                Analytics
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("gyms")}
                className={
                  activeTab === "gyms"
                    ? "flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-4 py-4 text-sm font-black text-black"
                    : "flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-4 text-sm font-black text-white/70 backdrop-blur-md"
                }
              >
                <Building2 size={17} strokeWidth={3} />
                Gyms
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("checkins")}
                className={
                  activeTab === "checkins"
                    ? "flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-4 py-4 text-sm font-black text-black"
                    : "flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-4 text-sm font-black text-white/70 backdrop-blur-md"
                }
              >
                <QrCode size={17} strokeWidth={3} />
                QR Codes
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("members")}
                className={
                  activeTab === "members"
                    ? "flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-4 py-4 text-sm font-black text-black"
                    : "flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-4 text-sm font-black text-white/70 backdrop-blur-md"
                }
              >
                <Users size={17} strokeWidth={3} />
                Members
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  loadAnnouncements();
                  loadGyms();
                  setStatus("Admin data refreshed.");
                }}
                className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-white/70"
              >
                <RefreshCw size={15} strokeWidth={3} />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => {
                  fetch("/api/admin/auth", { method: "DELETE" });
                  setUnlocked(false);
                  setPin("");
                  setStatus("");
                }}
                className="flex items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-red-200"
              >
                <LogOut size={15} strokeWidth={3} />
                Lock
              </button>

              {status ? (
                <p className="rounded-full border border-white/10 bg-black/30 px-4 py-3 text-xs font-bold text-white/45">
                  {status}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {activeTab === "announcements" ? (
          <>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Megaphone
                    className="text-[#fcb415]"
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

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#fcb415]/30 bg-[#fcb415]/10 px-5 py-4 text-sm font-black text-[#fcb415]">
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

                <div className="overflow-hidden rounded-[1.7rem] border border-[#fcb415]/25 bg-[#fcb415]/10">
                  <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                      Announcement Preview
                    </p>

                    <h3 className="mt-2 text-2xl font-black text-white">
                      {announcementForm.title || "Announcement title"}
                    </h3>

                    <p className="mt-2 text-sm font-bold leading-6 text-white/60">
                      {announcementForm.message ||
                        "Your announcement message will appear here."}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-[#fcb415]">
                        {announcementForm.category || "Update"}
                      </span>

                      {announcementForm.button_text ? (
                        <span className="rounded-full bg-[#fcb415] px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-black">
                          {announcementForm.button_text}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {announcementForm.image_url ? (
                    <img
                      src={announcementForm.image_url}
                      alt=""
                      className="h-44 w-full object-cover"
                    />
                  ) : null}
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
                    className="h-5 w-5 accent-[#fcb415]"
                  />
                </label>

                <button
                  type="button"
                  onClick={saveAnnouncement}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
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
                        className="flex items-center gap-2 rounded-full bg-[#fcb415] px-4 py-2 text-xs font-black text-black"
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

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-3 text-sm font-black text-black"
                >
                  <Upload size={16} strokeWidth={3} />
                  Import Gyms
                </button>

                <button
                  type="button"
                  onClick={startNewGym}
                  className="flex items-center justify-center gap-2 rounded-full border border-[#fcb415]/30 bg-[#fcb415]/10 px-5 py-3 text-sm font-black text-[#fcb415]"
                >
                  <Plus size={16} strokeWidth={3} />
                  New Gym
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Gym admin overview
              </p>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-3xl font-black text-white">{gyms.length}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                    Total
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-3xl font-black text-green-300">
                    {gyms.filter((gym) => gym.status === "active").length}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                    Active
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-3xl font-black text-[#fcb415]">
                    {gyms.filter((gym) => gym.virtualTourUrl).length}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                    3D Tours
                  </p>
                </div>
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
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                      3D Virtual Tour URL
                    </span>

                    <input
                      value={gymForm.virtualTourUrl}
                      onChange={(event) =>
                        updateGymForm({ virtualTourUrl: event.target.value })
                      }
                      placeholder="https://my.matterport.com/show/?m=..."
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/25"
                    />
                  </label>

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

                <section className="overflow-hidden rounded-[2rem] border border-[#fcb415]/25 bg-[#fcb415]/10">
                  <div className="p-5">
                    <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                      Selected gym preview
                    </p>

                    <div className="mt-4 flex items-center gap-4">
                      {gymForm.logo ? (
                        <img
                          src={gymForm.logo}
                          alt=""
                          className="h-16 w-16 shrink-0 object-contain drop-shadow-2xl"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/25 text-xl font-black text-[#fcb415]">
                          BGM
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="truncate text-2xl font-black text-white">
                          {gymForm.name || "New gym"}
                        </h3>

                        <p className="mt-1 text-sm font-bold text-white/55">
                          {gymForm.city || "City not set"}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-[#fcb415]">
                            {gymForm.status}
                          </span>

                          {gymForm.virtualTourUrl ? (
                            <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-white/60">
                              3D Tour
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center gap-3">
                    <MapPinned
                      className="text-[#fcb415]"
                      size={26}
                      strokeWidth={3}
                    />
                    <h2 className="text-2xl font-black">{gymForm.name}</h2>
                  </div>

                  <div className="grid gap-3">
                    <input
                      value={gymForm.id}
                      disabled={!creatingGym}
                      onChange={(event) =>
                        updateGymForm({
                          id: event.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]+/g, "-")
                            .replace(/(^-|-$)/g, ""),
                          qrCodeId: event.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]+/g, "-")
                            .replace(/(^-|-$)/g, ""),
                        })
                      }
                      placeholder="Gym ID, example: bgm-new-location"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none disabled:opacity-45"
                    />

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

                    {gymForm.logo ? (
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                        <div className="flex items-center justify-center p-5">
                          <img
                            src={gymForm.logo}
                            alt=""
                            className="max-h-28 object-contain"
                          />
                        </div>

                        <div className="border-t border-white/10 p-3">
                          <p className="break-all text-xs font-bold text-white/45">
                            {gymForm.logo}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#fcb415]/30 bg-[#fcb415]/10 px-5 py-4 text-sm font-black text-[#fcb415]">
                      <ImageIcon size={18} strokeWidth={3} />
                      {uploadingGymLogo ? "Uploading…" : "Upload Gym Logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) =>
                          uploadGymLogo(event.target.files?.[0])
                        }
                      />
                    </label>

                    <input
                      value={gymForm.logo}
                      onChange={(event) =>
                        updateGymForm({ logo: event.target.value })
                      }
                      placeholder="Logo path or uploaded logo URL"
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
                      className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
                    >
                      <Save size={17} strokeWidth={3} />
                      {creatingGym ? "Add Gym" : "Save Gym"}
                    </button>

                    {!creatingGym ? (
                      <button
                        type="button"
                        onClick={() => deleteGym(gymForm.id)}
                        className="flex items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-black text-red-300"
                      >
                        <Trash2 size={17} strokeWidth={3} />
                        Delete Gym
                      </button>
                    ) : null}
                  </div>
                </section>
              </>
            ) : null}
          </>
        ) : null}

        {activeTab === "analytics" ? <AdminAnalytics /> : null}

        {activeTab === "checkins" ? (
          <div className="space-y-6">
            <AdminCheckinsViewer pin={pin} />
            <GymQrAdmin pin={pin} />
          </div>
        ) : null}

        {activeTab === "members" ? <MembersAdmin pin={pin} /> : null}

        {status ? (
          <p className="text-center text-sm font-bold text-white/50">
            {status}
          </p>
        ) : null}
      </div>
    </main>
  );
}
