import type { Answer, ProctoringEvent } from "../schemas/attempt-schemas";

const DB_NAME = "utl_exam_offline";
const DB_VERSION = 1;
const ANSWERS_STORE = "answers";
const EVENTS_STORE = "events";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ANSWERS_STORE)) {
        db.createObjectStore(ANSWERS_STORE, { keyPath: "questionId" });
      }
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        db.createObjectStore(EVENTS_STORE, { keyPath: "clientEventId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Answers Queue ──────────────────────────────────────────────────────────

export async function queueAnswer(answer: Answer): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(ANSWERS_STORE, "readwrite");
  tx.objectStore(ANSWERS_STORE).put(answer);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedAnswers(): Promise<Answer[]> {
  const db = await openDB();
  const tx = db.transaction(ANSWERS_STORE, "readonly");
  const store = tx.objectStore(ANSWERS_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearQueuedAnswers(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(ANSWERS_STORE, "readwrite");
  tx.objectStore(ANSWERS_STORE).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Proctoring Events Queue ────────────────────────────────────────────────

export async function queueEvent(event: ProctoringEvent): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(EVENTS_STORE, "readwrite");
  tx.objectStore(EVENTS_STORE).put(event);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedEvents(): Promise<ProctoringEvent[]> {
  const db = await openDB();
  const tx = db.transaction(EVENTS_STORE, "readonly");
  const store = tx.objectStore(EVENTS_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearQueuedEvents(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(EVENTS_STORE, "readwrite");
  tx.objectStore(EVENTS_STORE).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllQueues(): Promise<void> {
  await clearQueuedAnswers();
  await clearQueuedEvents();
}
