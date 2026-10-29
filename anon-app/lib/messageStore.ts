/**
 * ANON// Message Store
 * 
 * Client-side persistence using IndexedDB.
 * NOTHING is ever sent to the server.
 * Lives only in this browser. Cleared when user clears browser data.
 */

const DB_NAME = "anon_msgs";
const DB_VERSION = 1;
const STORE = "messages";

const TTL_MS = 24 * 60 * 60 * 1000;   // 24 hours
const IMAGE_TTL_MS = 60 * 60 * 1000;  // 60 min for images
const MAX_MESSAGES = 500;

export type StoredMessage = {
  id: string;
  senderSessionId: string;
  senderName: string;
  content: string;
  createdAt: number;
  editedAt?: number;
  deleted?: boolean;
  image?: string;
  localSent?: boolean;
  replyTo?: { id: string; senderName: string; content: string };
  scope: "public" | "room";
  roomId?: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_createdAt", "createdAt", { unique: false });
        store.createIndex("by_scope", "scope", { unique: false });
        store.createIndex("by_room", "roomId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = fn(transaction.objectStore(STORE));
    let result: T;
    request.onsuccess = () => { result = request.result as T; };
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

/** Save one message (upsert). Silently no-ops if IndexedDB unavailable. */
export async function saveMessage(msg: Omit<StoredMessage, "scope"> & { scope: "public" | "room"; roomId?: string }): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(msg));
  } catch {
    /* ignore — e.g. private mode */
  }
}

/** Load messages for a scope. Prunes stale ones on the way out. */
export async function loadMessages(scope: "public" | "room", roomId?: string): Promise<StoredMessage[]> {
  try {
    const all = await tx<StoredMessage[]>("readonly", (s) => s.getAll());
    const now = Date.now();

    // Enforce TTL in storage as well as in the returned view.
    const expiredIds = all.filter((m) => now - m.createdAt > TTL_MS).map((m) => m.id);
    await Promise.all(expiredIds.map((id) => removeMessage(id)));

    const expiredImages = all.filter((m) => m.image && now - m.createdAt > IMAGE_TTL_MS);
    await Promise.all(expiredImages.map((m) => updateMessage(m.id, { image: undefined })));

    const filtered = all
      .filter((m) => {
        if (m.scope !== scope) return false;
        if (scope === "room" && m.roomId !== roomId) return false;
        if (now - m.createdAt > TTL_MS) return false;
        return true;
      })
      .map((m) => {
        if (m.image && now - m.createdAt > IMAGE_TTL_MS) return { ...m, image: undefined };
        return m;
      })
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-MAX_MESSAGES);

    return filtered;
  } catch {
    return [];
  }
}

/** Update an existing message (edit or delete marker). */
export async function updateMessage(id: string, patch: Partial<StoredMessage>): Promise<void> {
  try {
    const existing = await tx<StoredMessage | undefined>("readonly", (s) => s.get(id));
    if (!existing) return;
    await tx("readwrite", (s) => s.put({ ...existing, ...patch }));
  } catch {
    /* ignore */
  }
}

/** Remove a single message. */
export async function removeMessage(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

/** Clear everything for a scope. */
export async function clearScope(scope: "public" | "room", roomId?: string): Promise<void> {
  try {
    const all = await tx<StoredMessage[]>("readonly", (store) => store.getAll());
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      for (const message of all) {
        if (message.scope !== scope) continue;
        if (scope === "room" && message.roomId !== roomId) continue;
        store.delete(message.id);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB clear failed"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB clear aborted"));
    });
  } catch {
    /* Keep the UI responsive if browser storage is unavailable. */
  }
}

/** Delete every stored message and wait for the IndexedDB transaction to complete. */
export async function clearAll(): Promise<void> {
  await tx("readwrite", (store) => store.clear());
}

/** Close the app's database handle and delete the database during an explicit full wipe. */
export async function destroyStore(): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  if (dbPromise) {
    try { (await dbPromise).close(); } catch { /* failed opening is already handled by caller */ }
  }
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not delete local message database"));
    request.onblocked = () => reject(new Error("Another ANON tab is using the local database. Close other ANON tabs and retry the wipe."));
  });
}

/**
 * Export the local message records after applying the same expiry rules as the UI.
 * Returns only currently retained messages; stale records and expired image payloads
 * are pruned before export so the downloaded bundle matches the intended local TTL.
 */
export async function exportAllMessages(): Promise<StoredMessage[]> {
  try {
    const all = await tx<StoredMessage[]>("readonly", (store) => store.getAll());
    const now = Date.now();
    const expired = all.filter((message) => now - message.createdAt > TTL_MS);
    const staleImages = all.filter((message) => message.image && now - message.createdAt > IMAGE_TTL_MS);
    await Promise.all(expired.map((message) => removeMessage(message.id)));
    await Promise.all(staleImages.filter((message) => now - message.createdAt <= TTL_MS).map((message) =>
      updateMessage(message.id, { image: undefined })
    ));
    return all
      .filter((message) => now - message.createdAt <= TTL_MS)
      .map((message) => message.image && now - message.createdAt > IMAGE_TTL_MS
        ? { ...message, image: undefined }
        : message)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

/** Stats for /data page. */
export async function getStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const all = await tx<StoredMessage[]>("readonly", (s) => s.getAll());
    const now = Date.now();
    const fresh = all.filter((m) => now - m.createdAt < TTL_MS);
    let bytes = 0;
    for (const m of fresh) {
      bytes += (m.content || "").length * 2;   // rough UTF-16
      if (m.image) bytes += m.image.length;
    }
    return { count: fresh.length, totalBytes: bytes };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}