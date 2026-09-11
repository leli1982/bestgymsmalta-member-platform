import type { OfflineRosterMember } from "@/lib/offlineRosterCore";

const DB_NAME = "bgm-staff-offline";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "active-members";
const DEVICE_KEY = "bgmStaffOfflineDeviceId";

export type OfflineRosterSnapshot = {
  id: typeof SNAPSHOT_KEY;
  generatedAt: string;
  memberCount: number;
  rosterHash: string;
  members: OfflineRosterMember[];
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineRoster(
  snapshot: Omit<OfflineRosterSnapshot, "id">
) {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id: SNAPSHOT_KEY, ...snapshot });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  db.close();
}

export async function loadOfflineRoster(): Promise<OfflineRosterSnapshot | null> {
  const db = await openDatabase();

  const result = await new Promise<OfflineRosterSnapshot | null>(
    (resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }
  );

  db.close();
  return result;
}

export function getOrCreateOfflineDeviceId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `bgm-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(DEVICE_KEY, generated);
  return generated;
}

export async function syncOfflineRoster() {
  const deviceId = getOrCreateOfflineDeviceId();
  const response = await fetch(
    `/api/system/offline-roster?deviceId=${encodeURIComponent(deviceId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Offline roster sync failed.");
  }

  const data = await response.json();
  const snapshot = {
    generatedAt: String(data.generatedAt || ""),
    memberCount: Number(data.memberCount || 0),
    rosterHash: String(data.rosterHash || ""),
    members: Array.isArray(data.members) ? data.members : [],
  };

  await saveOfflineRoster(snapshot);
  return snapshot;
}

export async function registerStaffServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("/staff-sw.js", { scope: "/" });
  } catch (error) {
    console.warn("Could not register staff offline service worker.", error);
  }
}
