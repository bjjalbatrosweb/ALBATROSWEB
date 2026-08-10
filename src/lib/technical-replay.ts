export type ReplayPoint = { x: number; y: number };

export type ReplayStroke = {
  id: string;
  color: "#facc15" | "#ef4444" | "#ffffff" | "#22d3ee";
  points: ReplayPoint[];
};

export type ReplayMarker = {
  id: string;
  at: number;
  note: string;
};

export type ReplayClip = {
  id: string;
  title: string;
  athleteId: string;
  athleteName: string;
  createdAt: string;
  durationSeconds: number;
  mimeType: string;
  size: number;
  blob: Blob;
  markers: ReplayMarker[];
  strokes: ReplayStroke[];
};

const DATABASE_NAME = "albatros-technical-replay-v1";
const DATABASE_VERSION = 1;
const CLIP_STORE = "clips";

function openReplayDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CLIP_STORE)) {
        database.createObjectStore(CLIP_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir la videoteca local."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falló una operación de video local."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("No se guardó el video."));
    transaction.onabort = () => reject(transaction.error || new Error("Se canceló el guardado del video."));
  });
}

export async function listReplayClips() {
  const database = await openReplayDatabase();
  try {
    const transaction = database.transaction(CLIP_STORE, "readonly");
    const request = transaction.objectStore(CLIP_STORE).getAll() as IDBRequest<ReplayClip[]>;
    const [clips] = await Promise.all([requestResult(request), transactionDone(transaction)]);
    return clips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    database.close();
  }
}

export async function saveReplayClip(clip: ReplayClip) {
  const database = await openReplayDatabase();
  try {
    const transaction = database.transaction(CLIP_STORE, "readwrite");
    transaction.objectStore(CLIP_STORE).put(clip);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function deleteReplayClip(id: string) {
  const database = await openReplayDatabase();
  try {
    const transaction = database.transaction(CLIP_STORE, "readwrite");
    transaction.objectStore(CLIP_STORE).delete(id);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export function recorderMimeType() {
  const options = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return options.find((value) => MediaRecorder.isTypeSupported(value)) || "";
}

export function replayFileExtension(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

export function formatReplayTime(seconds: number) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}.${String(
    Math.floor((safe % 1) * 10),
  )}`;
}
