import { timingSafeEqual } from "node:crypto";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
  type PerfilAcceso,
  type Sede,
} from "@/lib/access-control";

export class RequestAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function secureEquals(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function hasValidDeviceKey(request: Request): boolean {
  const expectedKey = process.env.RFID_DEVICE_KEY;
  const receivedKey = request.headers.get("x-device-key") || "";

  return Boolean(
    expectedKey && receivedKey && secureEquals(receivedKey, expectedKey),
  );
}

export type PanelActorAccess = {
  uid: string;
  email?: string;
  profile: PerfilAcceso;
};

type ActorCacheEntry = { profile: PerfilAcceso; expiresAt: number };
const globalActorCache = globalThis as typeof globalThis & {
  __albatrosActorCache?: Map<string, ActorCacheEntry>;
};
const actorCache =
  globalActorCache.__albatrosActorCache ??
  (globalActorCache.__albatrosActorCache = new Map());
const ACTOR_CACHE_TTL_MS = 30_000;

async function getPanelActor(request: Request): Promise<PanelActorAccess> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    throw new RequestAccessError("Sesión requerida", 401);
  }

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    throw new RequestAccessError("Sesión inválida o expirada", 401);
  }

  try {
    const cached = actorCache.get(decodedToken.uid);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        profile: cached.profile,
      };
    }
    const userSnapshot = await adminDb
      .collection("usuarios")
      .doc(decodedToken.uid)
      .get();
    const profile = userSnapshot.exists
      ? normalizarPerfilAcceso(userSnapshot.data() || {})
      : null;

    if (
      !profile ||
      !profile.activo ||
      !["admin", "profesor"].includes(profile.rol)
    ) {
      throw new RequestAccessError("Cuenta sin permisos administrativos", 403);
    }

    actorCache.set(decodedToken.uid, {
      profile,
      expiresAt: Date.now() + ACTOR_CACHE_TTL_MS,
    });

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      profile,
    };
  } catch (error) {
    if (error instanceof RequestAccessError) throw error;
    console.error("FIREBASE_ADMIN_ACCESS_ERROR:", error);
    const code = String(
      (error as { code?: unknown; details?: unknown })?.code || "",
    ).toLowerCase();
    if (code.includes("resource-exhausted"))
      throw new RequestAccessError(
        "Firebase alcanzó temporalmente su límite de operaciones. Intenta de nuevo más tarde.",
        503,
      );
    if (code.includes("permission-denied"))
      throw new RequestAccessError(
        "La cuenta de servicio no tiene permisos para consultar Firebase.",
        503,
      );
    if (code.includes("unavailable") || code.includes("deadline-exceeded"))
      throw new RequestAccessError(
        "Firebase no está disponible temporalmente. Intenta de nuevo.",
        503,
      );
    throw new RequestAccessError(
      "No se pudo validar el acceso administrativo en Firebase.",
      503,
    );
  }
}

export async function requirePanelAccess(
  request: Request,
  sede: Sede,
): Promise<PerfilAcceso> {
  const actor = await requirePanelActorAccess(request, sede);
  return actor.profile;
}

export async function requirePanelActorAccess(
  request: Request,
  sede: Sede,
): Promise<PanelActorAccess> {
  const actor = await getPanelActor(request);

  if (!puedeAdministrarSede(actor.profile, sede)) {
    throw new RequestAccessError("No tienes acceso a esta sede", 403);
  }

  return actor;
}

export async function requireAdminActorAccess(
  request: Request,
): Promise<PanelActorAccess> {
  const actor = await getPanelActor(request);

  if (actor.profile.rol !== "admin") {
    throw new RequestAccessError(
      "Solo un administrador puede gestionar accesos biométricos",
      403,
    );
  }

  return actor;
}

export async function requireDeviceAccess(request: Request): Promise<void> {
  if (!process.env.RFID_DEVICE_KEY) {
    throw new RequestAccessError(
      "La clave del dispositivo no está configurada",
      503,
    );
  }

  if (!hasValidDeviceKey(request)) {
    throw new RequestAccessError("Dispositivo no autorizado", 401);
  }
}

export async function requirePanelOrDevice(
  request: Request,
  sede: Sede,
): Promise<void> {
  if (hasValidDeviceKey(request)) return;
  await requirePanelAccess(request, sede);
}
