"use client";

export type FirebaseHealthStatus =
  | "checking"
  | "operational"
  | "quota-exhausted"
  | "offline"
  | "degraded"
  | "permission-denied";

export type FirebaseHealthState = {
  status: FirebaseHealthStatus;
  message: string;
  changedAt: number;
  source: string;
};

const STORAGE_KEY = "albatros-firebase-health-v1";
const HEALTH_EVENT = "albatros-firebase-health-changed";
const PERSISTED_WARNING_MS = 6 * 60 * 60 * 1000;

const INITIAL_STATE: FirebaseHealthState = {
  status: "checking",
  message: "Comprobando disponibilidad de Firebase.",
  changedAt: Date.now(),
  source: "inicio",
};

let currentState = INITIAL_STATE;
let storageLoaded = false;

function browserIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function loadStoredState() {
  if (storageLoaded || typeof window === "undefined") return;
  storageLoaded = true;

  if (browserIsOffline()) {
    currentState = {
      status: "offline",
      message: "Este dispositivo no tiene conexión a internet.",
      changedAt: Date.now(),
      source: "navegador",
    };
    return;
  }

  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "null",
    ) as FirebaseHealthState | null;
    if (
      saved &&
      ["quota-exhausted", "degraded", "permission-denied"].includes(
        saved.status,
      ) &&
      Date.now() - Number(saved.changedAt || 0) < PERSISTED_WARNING_MS
    )
      currentState = saved;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function publish(next: FirebaseHealthState) {
  currentState = next;
  if (typeof window === "undefined") return;

  try {
    if (next.status === "operational")
      window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // El estado visual funciona aunque el almacenamiento esté bloqueado.
  }

  window.dispatchEvent(
    new CustomEvent<FirebaseHealthState>(HEALTH_EVENT, { detail: next }),
  );
}

function textFromError(error: unknown) {
  const value = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
    status?: unknown;
  };
  return [value?.code, value?.name, value?.status, value?.message]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
}

export function getFirebaseHealth() {
  loadStoredState();
  return currentState;
}

export function subscribeFirebaseHealth(
  listener: (state: FirebaseHealthState) => void,
) {
  if (typeof window === "undefined") return () => undefined;
  loadStoredState();
  listener(currentState);
  const handle = (event: Event) =>
    listener((event as CustomEvent<FirebaseHealthState>).detail);
  window.addEventListener(HEALTH_EVENT, handle);
  return () => window.removeEventListener(HEALTH_EVENT, handle);
}

export function reportFirebaseAvailable(source = "firebase") {
  if (browserIsOffline()) {
    reportFirebaseFailure(
      { code: "offline", message: "Sin conexión a internet" },
      "navegador",
    );
    return;
  }
  publish({
    status: "operational",
    message: "Firebase confirmó una operación correctamente.",
    changedAt: Date.now(),
    source,
  });
}

export function reportFirebaseChecking(source = "firebase") {
  if (browserIsOffline()) {
    reportFirebaseFailure(
      { code: "offline", message: "Sin conexión a internet" },
      "navegador",
    );
    return;
  }
  publish({
    status: "checking",
    message: "Esperando confirmación de Firebase.",
    changedAt: Date.now(),
    source,
  });
}

export function reportFirebaseFailure(error: unknown, source = "firebase") {
  const text = textFromError(error);
  let status: FirebaseHealthStatus = "degraded";
  let message = "Firebase no respondió correctamente. Modo offline preventivo.";

  if (browserIsOffline()) {
    status = "offline";
    message = "Sin internet. Las operaciones compatibles se guardarán offline.";
  } else if (
    text.includes("resource-exhausted") ||
    text.includes("resource exhausted") ||
    text.includes("quota") ||
    text.includes("cuota") ||
    text.includes("limit exceeded")
  ) {
    status = "quota-exhausted";
    message =
      "Firebase rechazó operaciones por límite de cuota. Modo offline activo.";
  } else if (
    text.includes("permission-denied") ||
    text.includes("permission denied") ||
    text.includes("insufficient permissions")
  ) {
    status = "permission-denied";
    message = "Firebase respondió, pero la operación no tiene permisos.";
  } else if (
    text.includes("unavailable") ||
    text.includes("deadline-exceeded") ||
    text.includes("timeout") ||
    text.includes("aborterror") ||
    text.includes("503") ||
    text.includes("network") ||
    text.includes("conexión")
  ) {
    status = "degraded";
    message =
      "Firebase está temporalmente inaccesible. Modo offline preventivo.";
  }

  publish({ status, message, changedAt: Date.now(), source });
}

export function reportFirebaseApiFailure(
  status: number,
  serverMessage: unknown,
  source = "api",
) {
  const message = typeof serverMessage === "string" ? serverMessage : "";
  const text = message.toLowerCase();
  if (
    status === 503 ||
    text.includes("firebase") ||
    text.includes("resource-exhausted") ||
    text.includes("cuota")
  )
    reportFirebaseFailure({ status, message }, source);
}

export function reportBrowserNetworkStatus() {
  if (browserIsOffline())
    reportFirebaseFailure(
      { code: "offline", message: "Sin conexión a internet" },
      "navegador",
    );
  else reportFirebaseChecking("navegador");
}
