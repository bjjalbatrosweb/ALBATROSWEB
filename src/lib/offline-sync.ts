"use client";

import {
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import {
  reportFirebaseAvailable,
  reportFirebaseFailure,
} from "@/lib/firebase-health";

const DATABASE_NAME = "albatros-offline-v1";
const STORE_NAME = "pendientes";
const DATABASE_VERSION = 1;
export const OFFLINE_QUEUE_EVENT = "albatros-offline-queue-changed";

type QueueKind =
  | "alumno-crear"
  | "alumno-rfid-actualizar"
  | "emergencia-actualizar"
  | "asistencia-recepcion"
  | "asistencia-rfid";

type QueueEntry = {
  key: string;
  kind: QueueKind;
  targetId: string;
  actorUid: string;
  sede: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  payload: Record<string, unknown>;
};

export type OfflineSyncResult = {
  pending: number;
  synced: number;
  failed: number;
  rejected: number;
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(
      new Error("Este dispositivo no permite almacenamiento offline."),
    );

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });
        store.createIndex("actorUid", "actorUid", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("No se pudo abrir la cola offline."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Falló el almacenamiento offline."));
  });
}

async function writeEntry(entry: QueueEntry) {
  if (typeof navigator !== "undefined" && navigator.storage?.persist)
    void navigator.storage.persist().catch(() => false);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestResult(transaction.objectStore(STORE_NAME).put(entry));
  } finally {
    database.close();
  }
  notifyQueueChanged();
}

async function removeEntry(key: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestResult(transaction.objectStore(STORE_NAME).delete(key));
  } finally {
    database.close();
  }
}

async function readEntries(actorUid: string): Promise<QueueEntry[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const index = transaction.objectStore(STORE_NAME).index("actorUid");
    const entries = await requestResult(index.getAll(actorUid));
    return (entries as QueueEntry[]).sort(
      (left, right) => left.createdAt - right.createdAt,
    );
  } finally {
    database.close();
  }
}

function notifyQueueChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
}

export function isOfflineQueueError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const code = String((error as { code?: unknown })?.code || "").toLowerCase();
  const name = String((error as { name?: unknown })?.name || "").toLowerCase();
  return (
    error instanceof TypeError ||
    name === "aborterror" ||
    name === "offlinetimeouterror" ||
    [
      "aborted",
      "deadline-exceeded",
      "internal",
      "resource-exhausted",
      "unavailable",
      "unknown",
    ].some((value) => code.includes(value))
  );
}

export async function withOfflineTimeout<T>(
  operation: Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("La escritura se guardará para sincronizar.");
          error.name = "OfflineTimeoutError";
          reject(error);
        }, timeoutMs);
      }),
    ]);
    reportFirebaseAvailable("sincronización");
    return result;
  } catch (error) {
    reportFirebaseFailure(error, "sincronización");
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function queueStudentCreation(input: {
  targetId: string;
  actorUid: string;
  sede: string;
  payload: Record<string, unknown>;
}) {
  await writeEntry({
    key: `alumno:${input.actorUid}:${input.targetId}`,
    kind: "alumno-crear",
    targetId: input.targetId,
    actorUid: input.actorUid,
    sede: input.sede,
    createdAt: Date.now(),
    attempts: 0,
    payload: input.payload,
  });
}

export async function queueEmergencyUpdate(input: {
  targetId: string;
  actorUid: string;
  sede: string;
  payload: Record<string, unknown>;
}) {
  await writeEntry({
    key: `emergencia:${input.actorUid}:${input.targetId}`,
    kind: "emergencia-actualizar",
    targetId: input.targetId,
    actorUid: input.actorUid,
    sede: input.sede,
    createdAt: Date.now(),
    attempts: 0,
    payload: input.payload,
  });
}

export async function queueStudentRfidUpdate(input: {
  targetId: string;
  actorUid: string;
  sede: string;
  rfids: string[];
}) {
  await writeEntry({
    key: `alumno-rfid:${input.actorUid}:${input.targetId}`,
    kind: "alumno-rfid-actualizar",
    targetId: input.targetId,
    actorUid: input.actorUid,
    sede: input.sede,
    createdAt: Date.now(),
    attempts: 0,
    payload: {
      rfids: input.rfids,
      rfid: input.rfids[0] || "",
    },
  });
}

function meridaDayKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}${value("month")}${value("day")}`;
}

export async function queueReceptionAttendance(input: {
  alumnoId: string;
  alumnoNombre: string;
  actorUid: string;
  sede: string;
  capturedAt?: string;
}) {
  const capturedAt = input.capturedAt || new Date().toISOString();
  const capturedDate = new Date(capturedAt);
  await writeEntry({
    key: `asistencia-recepcion:${input.actorUid}:${input.sede}:${input.alumnoId}:${meridaDayKey(capturedDate)}`,
    kind: "asistencia-recepcion",
    targetId: input.alumnoId,
    actorUid: input.actorUid,
    sede: input.sede,
    createdAt: capturedDate.getTime(),
    attempts: 0,
    payload: {
      alumnoId: input.alumnoId,
      alumnoNombre: input.alumnoNombre,
      fecha: capturedAt,
    },
  });
}

export async function queueRfidAttendance(input: {
  rfid: string;
  actorUid: string;
  sede: string;
  capturedAt?: string;
}) {
  const capturedAt = input.capturedAt || new Date().toISOString();
  const capturedDate = new Date(capturedAt);
  await writeEntry({
    key: `asistencia-rfid:${input.actorUid}:${input.sede}:${input.rfid}:${meridaDayKey(capturedDate)}`,
    kind: "asistencia-rfid",
    targetId: input.rfid,
    actorUid: input.actorUid,
    sede: input.sede,
    createdAt: capturedDate.getTime(),
    attempts: 0,
    payload: {
      rfid: input.rfid,
      fecha: capturedAt,
    },
  });
}

export async function countOfflineEntries(actorUid: string) {
  if (!actorUid) return 0;
  return (await readEntries(actorUid)).length;
}

export async function syncOfflineEntries(
  firestore: Firestore,
  actorUid: string,
  getIdToken?: () => Promise<string>,
): Promise<OfflineSyncResult> {
  const entries = await readEntries(actorUid);
  if (
    entries.length === 0 ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  )
    return { pending: entries.length, synced: 0, failed: 0, rejected: 0 };

  let synced = 0;
  let failed = 0;
  let rejected = 0;
  for (const entry of entries) {
    try {
      if (entry.kind === "alumno-crear") {
        await withOfflineTimeout(
          setDoc(
            doc(firestore, "Alumnos", entry.targetId),
            {
              ...entry.payload,
              fechaRegistro: serverTimestamp(),
              creadoOfflineEn: new Date(entry.createdAt).toISOString(),
              sincronizadoOfflineEn: serverTimestamp(),
            },
            { merge: true },
          ),
          12_000,
        );
      } else if (entry.kind === "alumno-rfid-actualizar") {
        const rfids = Array.isArray(entry.payload.rfids)
          ? entry.payload.rfids.map(String).filter(Boolean)
          : [];
        await withOfflineTimeout(
          setDoc(
            doc(firestore, "Alumnos", entry.targetId),
            {
              rfids,
              rfid: rfids[0] || deleteField(),
              sincronizadoOfflineEn: serverTimestamp(),
            },
            { merge: true },
          ),
          12_000,
        );
      } else if (entry.kind === "emergencia-actualizar") {
        const emergency =
          entry.payload.emergencia &&
          typeof entry.payload.emergencia === "object"
            ? (entry.payload.emergencia as Record<string, unknown>)
            : {};
        await withOfflineTimeout(
          updateDoc(doc(firestore, "Alumnos", entry.targetId), {
            fotoUrl: String(entry.payload.fotoUrl || ""),
            emergenciaToken: String(entry.payload.emergenciaToken || ""),
            emergencia: {
              ...emergency,
              activo: true,
              actualizadoEn: serverTimestamp(),
            },
            sincronizadoOfflineEn: serverTimestamp(),
          }),
          12_000,
        );
      } else {
        if (!getIdToken) {
          throw new Error("La sesión debe estar activa para sincronizar asistencias.");
        }
        const token = await getIdToken();
        const isRfid = entry.kind === "asistencia-rfid";
        const response = await withOfflineTimeout(
          fetch(isRfid ? "/api/rfid" : "/api/recepcion/asistencia", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(
              isRfid
                ? {
                    rfid: String(entry.payload.rfid || entry.targetId),
                    sede: entry.sede,
                    dispositivo: "Recepcion offline",
                    fecha: String(entry.payload.fecha || ""),
                    offline: true,
                  }
                : {
                    alumnoId: String(entry.payload.alumnoId || entry.targetId),
                    sede: entry.sede,
                    fecha: String(entry.payload.fecha || ""),
                    offline: true,
                  },
            ),
          }),
          12_000,
        );
        const data = (await response.json().catch(() => ({}))) as {
          duplicado?: boolean;
          mensaje?: string;
        };
        const duplicate = response.status === 409 && data.duplicado === true;
        if (!response.ok && !duplicate) {
          if (response.status >= 400 && response.status < 500) {
            await removeEntry(entry.key);
            rejected += 1;
            continue;
          }
          throw new Error(data.mensaje || "El servidor no aceptó la asistencia.");
        }
      }
      await removeEntry(entry.key);
      synced += 1;
    } catch (error) {
      failed += 1;
      await writeEntry({
        ...entry,
        attempts: entry.attempts + 1,
        lastError:
          error instanceof Error ? error.message.slice(0, 180) : "Error de red",
      });
      break;
    }
  }

  notifyQueueChanged();
  return {
    pending: await countOfflineEntries(actorUid),
    synced,
    failed,
    rejected,
  };
}
