import type { Chat, ChatMember, ChatSummary, Message, Profile } from "@/lib/xgram";

const DB_NAME = "xgram-local-cache";
const DB_VERSION = 1;
const SUMMARY_STORE = "chat_summaries";
const SNAPSHOT_STORE = "chat_snapshots";

export type CachedChatSnapshot = {
  chat: Chat;
  members: ChatMember[];
  messages: Message[];
  profiles: Profile[];
  savedAt: number;
};

function openCache(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SUMMARY_STORE)) {
          db.createObjectStore(SUMMARY_STORE, { keyPath: "userId" });
        }
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: ["userId", "chatId"] });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRecord<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await openCache();
  if (!db) return null;
  try {
    const tx = db.transaction(storeName, "readonly");
    const value = await requestResult(tx.objectStore(storeName).get(key));
    db.close();
    return (value as T | undefined) ?? null;
  } catch {
    db.close();
    return null;
  }
}

async function writeRecord(storeName: string, value: object): Promise<void> {
  const db = await openCache();
  if (!db) return;
  try {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Cache failures must never prevent messaging from working.
  } finally {
    db.close();
  }
}

export async function getCachedChatSummaries(userId: string): Promise<ChatSummary[] | null> {
  const record = await readRecord<{ userId: string; summaries: ChatSummary[] }>(SUMMARY_STORE, userId);
  return record?.summaries ?? null;
}

export async function saveCachedChatSummaries(userId: string, summaries: ChatSummary[]): Promise<void> {
  await writeRecord(SUMMARY_STORE, { userId, summaries, savedAt: Date.now() });
}

export async function getCachedChatSnapshot(
  userId: string,
  chatId: string,
): Promise<CachedChatSnapshot | null> {
  return readRecord<CachedChatSnapshot & { userId: string; chatId: string }>(
    SNAPSHOT_STORE,
    [userId, chatId],
  );
}

export async function saveCachedChatSnapshot(
  userId: string,
  chatId: string,
  snapshot: CachedChatSnapshot,
): Promise<void> {
  await writeRecord(SNAPSHOT_STORE, { userId, chatId, ...snapshot });
}

/** Removes only this account's local data when it signs out. */
export async function clearUserCache(userId: string): Promise<void> {
  const db = await openCache();
  if (!db) return;

  try {
    const tx = db.transaction([SUMMARY_STORE, SNAPSHOT_STORE], "readwrite");
    tx.objectStore(SUMMARY_STORE).delete(userId);

    const snapshots = tx.objectStore(SNAPSHOT_STORE);
    const cursorRequest = snapshots.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if ((cursor.value as { userId?: string }).userId === userId) cursor.delete();
      cursor.continue();
    };

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Logout must still complete even if browser storage is unavailable.
  } finally {
    db.close();
  }
}
