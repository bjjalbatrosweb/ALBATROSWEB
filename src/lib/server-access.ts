import { timingSafeEqual } from 'node:crypto';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
  type PerfilAcceso,
  type Sede,
} from '@/lib/access-control';

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
  const receivedKey = request.headers.get('x-device-key') || '';

  return Boolean(
    expectedKey &&
      receivedKey &&
      secureEquals(receivedKey, expectedKey),
  );
}

export type PanelActorAccess = {
  uid: string;
  email?: string;
  profile: PerfilAcceso;
};

async function getPanelActor(request: Request): Promise<PanelActorAccess> {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    throw new RequestAccessError('Sesión requerida', 401);
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userSnapshot = await adminDb
      .collection('usuarios')
      .doc(decodedToken.uid)
      .get();
    const profile = userSnapshot.exists
      ? normalizarPerfilAcceso(userSnapshot.data() || {})
      : null;

    if (
      !profile ||
      !profile.activo ||
      !['admin', 'profesor'].includes(profile.rol)
    ) {
      throw new RequestAccessError('Cuenta sin permisos administrativos', 403);
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      profile,
    };
  } catch (error) {
    if (error instanceof RequestAccessError) throw error;
    throw new RequestAccessError('Sesión inválida o expirada', 401);
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
    throw new RequestAccessError('No tienes acceso a esta sede', 403);
  }

  return actor;
}

export async function requireDeviceAccess(request: Request): Promise<void> {
  if (!process.env.RFID_DEVICE_KEY) {
    throw new RequestAccessError(
      'La clave del dispositivo no está configurada',
      503,
    );
  }

  if (!hasValidDeviceKey(request)) {
    throw new RequestAccessError('Dispositivo no autorizado', 401);
  }
}

export async function requirePanelOrDevice(
  request: Request,
  sede: Sede,
): Promise<void> {
  if (hasValidDeviceKey(request)) return;
  await requirePanelAccess(request, sede);
}
