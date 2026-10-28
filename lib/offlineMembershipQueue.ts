import type {
  OfflineVerificationSnapshot,
  PublicEnrollmentConfig,
  RegistrationDraft,
} from "@/lib/membershipRegistrationTypes";

const DB_NAME = "bgm-staff-offline-memberships";
const DB_VERSION = 2;
const SALE_STORE = "membership-sales";
const CONTEXT_STORE = "enrollment-contexts";
const RECEIPT_STORE = "sync-receipts";

export type OfflineEnrollmentContext = {
  gymId: string;
  cachedAt: string;
  config: PublicEnrollmentConfig;
  systemUser: {
    id: string;
    gymId: string | null;
    displayName: string;
    isSuperAdmin: boolean;
  };
};

export type OfflineMembershipPayment = {
  method: "cash" | "card" | "other";
  otherText?: string;
  amountCents: number;
  currency: "EUR";
  staffName: string;
};

export type OfflineMembershipState =
  | "queued"
  | "syncing"
  | "needs_login"
  | "needs_attention"
  | "error"
  | "synced";

export type OfflineMembershipRecord = {
  clientSubmissionId: string;
  offlineReference: string;
  gymId: string;
  soldAt: string;
  cachedContext: OfflineEnrollmentContext;
  registration: Omit<RegistrationDraft, "photos">;
  pendingCardValues: string[];
  payment: OfflineMembershipPayment;
  verifications: OfflineVerificationSnapshot;
  photos: Array<Blob | null>;
  state: OfflineMembershipState;
  lastError?: string;
};

export type OfflineMembershipSyncReceipt = {
  clientSubmissionId: string;
  offlineReference: string;
  gymId: string;
  soldAt: string;
  syncedAt: string;
  result: "activated" | "review_required" | "rejected";
  applicationId: string | null;
  memberNumbers: string[];
  reason?: string;
};

function notifyQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bgm:offline-membership-queue-changed"));
  }
}

function requireIndexedDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("Offline membership storage is not available on this device.");
  }
  return indexedDB;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = requireIndexedDb().open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SALE_STORE)) {
        const sales = db.createObjectStore(SALE_STORE, {
          keyPath: "clientSubmissionId",
        });
        sales.createIndex("soldAt", "soldAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(CONTEXT_STORE)) {
        const contexts = db.createObjectStore(CONTEXT_STORE, {
          keyPath: "gymId",
        });
        contexts.createIndex("cachedAt", "cachedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
        const receipts = db.createObjectStore(RECEIPT_STORE, {
          keyPath: "clientSubmissionId",
        });
        receipts.createIndex("syncedAt", "syncedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open offline membership storage."));
    request.onblocked = () => reject(new Error("Offline membership storage is blocked by another tab."));
  });
}

async function putRecord(storeName: string, value: unknown) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Offline storage write failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Offline storage write was aborted."));
    });
  } finally {
    db.close();
  }
}

async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve((request.result || []) as T[]);
      request.onerror = () => reject(request.error || new Error("Offline storage read failed."));
    });
  } finally {
    db.close();
  }
}

async function deleteRecord(storeName: string, id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Offline storage delete failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Offline storage delete was aborted."));
    });
  } finally {
    db.close();
  }
}

export function buildOfflineReference(clientSubmissionId: string) {
  const compact = String(clientSubmissionId || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();
  return `OFFLINE-${compact || "PENDING"}`;
}

export async function cacheOfflineEnrollmentContext(
  context: OfflineEnrollmentContext,
): Promise<void> {
  await putRecord(CONTEXT_STORE, context);
}

export async function loadLatestOfflineEnrollmentContext(): Promise<OfflineEnrollmentContext | null> {
  const contexts = await getAllRecords<OfflineEnrollmentContext>(CONTEXT_STORE);
  contexts.sort((a, b) => String(b.cachedAt).localeCompare(String(a.cachedAt)));
  return contexts[0] || null;
}

export async function enqueueOfflineMembership(
  record: OfflineMembershipRecord,
): Promise<void> {
  await putRecord(SALE_STORE, record);
  notifyQueueChanged();
}

export async function listOfflineMemberships(): Promise<OfflineMembershipRecord[]> {
  const records = await getAllRecords<OfflineMembershipRecord>(SALE_STORE);
  return records.sort((a, b) => String(a.soldAt).localeCompare(String(b.soldAt)));
}

export async function updateOfflineMembershipState(
  id: string,
  state: OfflineMembershipState,
  lastError?: string,
): Promise<void> {
  const records = await getAllRecords<OfflineMembershipRecord>(SALE_STORE);
  const current = records.find((record) => record.clientSubmissionId === id);
  if (!current) return;
  await putRecord(SALE_STORE, {
    ...current,
    state,
    ...(lastError ? { lastError } : { lastError: undefined }),
  });
  notifyQueueChanged();
}

export async function removeOfflineMembership(id: string): Promise<void> {
  await deleteRecord(SALE_STORE, id);
  notifyQueueChanged();
}

export async function saveOfflineMembershipSyncReceipt(
  receipt: OfflineMembershipSyncReceipt,
): Promise<void> {
  await putRecord(RECEIPT_STORE, receipt);
  notifyQueueChanged();
}

export async function listOfflineMembershipSyncReceipts(): Promise<OfflineMembershipSyncReceipt[]> {
  const receipts = await getAllRecords<OfflineMembershipSyncReceipt>(RECEIPT_STORE);
  return receipts.sort((a, b) => String(b.syncedAt).localeCompare(String(a.syncedAt)));
}

export async function removeOfflineMembershipSyncReceipt(id: string): Promise<void> {
  await deleteRecord(RECEIPT_STORE, id);
  notifyQueueChanged();
}
