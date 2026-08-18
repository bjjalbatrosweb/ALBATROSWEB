const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|\/_next\/static\/chunks\//i;

const RECOVERY_KEY = "albatros:chunk-recovery";
const RECOVERY_COOLDOWN_MS = 2 * 60_000;

export function isStaleChunkError(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === "string") return CHUNK_ERROR_PATTERN.test(value);
  if (value instanceof Error)
    return CHUNK_ERROR_PATTERN.test(`${value.name} ${value.message}`);
  if (typeof value === "object") {
    const candidate = value as { message?: unknown; reason?: unknown; src?: unknown };
    return (
      isStaleChunkError(candidate.message) ||
      isStaleChunkError(candidate.reason) ||
      isStaleChunkError(candidate.src)
    );
  }
  return false;
}

export async function recoverFromStaleChunk(
  value: unknown,
  options: { force?: boolean } = {},
): Promise<"ignored" | "reloading" | "cooldown"> {
  if (typeof window === "undefined" || !isStaleChunkError(value))
    return "ignored";

  const lastRecovery = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
  if (
    !options.force &&
    Number.isFinite(lastRecovery) &&
    Date.now() - lastRecovery < RECOVERY_COOLDOWN_MS
  ) {
    window.dispatchEvent(new CustomEvent("albatros:chunk-recovery-needed"));
    return "cooldown";
  }

  sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));

  // Cache Storage contiene respuestas del service worker, no la sesión de
  // Firebase ni los datos locales de la aplicación.
  if ("caches" in window) {
    const names = await caches.keys().catch(() => [] as string[]);
    await Promise.all(names.map((name) => caches.delete(name))).catch(() => {});
  }

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker
      .getRegistration("/")
      .catch(() => undefined);
    await registration?.update().catch(() => {});
  }

  window.location.reload();
  return "reloading";
}

export function forceChunkRecovery() {
  sessionStorage.removeItem(RECOVERY_KEY);
  return recoverFromStaleChunk("ChunkLoadError", { force: true });
}

