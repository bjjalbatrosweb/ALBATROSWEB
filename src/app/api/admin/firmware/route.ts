import { createHash, randomUUID } from 'node:crypto';

import { put } from '@vercel/blob';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { RequestAccessError, requireAdminActorAccess } from '@/lib/server-access';

export const runtime = 'nodejs';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
const SEDES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];
const ONLINE_WINDOW_MS = 5 * 60_000;
const COMMAND_TTL_MS = 10 * 60_000;
const MAX_FIRMWARE_BYTES = 1_300_000;
const MIN_FIRMWARE_BYTES = 100_000;

function normalizarSede(value: unknown): Sede | null {
  const sede = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  return SEDES.includes(sede as Sede) ? sede as Sede : null;
}

function normalizarDeviceId(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 40);
}

function normalizarVersion(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 40);
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const form = await request.formData();
    const sede = normalizarSede(form.get('sede'));
    const deviceId = normalizarDeviceId(form.get('deviceId'));
    const version = normalizarVersion(form.get('version'));
    const confirmar = form.get('confirmar') === 'true';
    const archivo = form.get('firmware');

    if (!sede || !deviceId.startsWith('ESP32-') || !version || !confirmar) {
      return NextResponse.json(
        { ok: false, mensaje: 'Los datos de la actualización son inválidos.' },
        { status: 400 },
      );
    }

    if (!(archivo instanceof File) || !archivo.name.toLowerCase().endsWith('.bin')) {
      return NextResponse.json(
        { ok: false, mensaje: 'Seleccione el archivo .bin exportado por Arduino IDE.' },
        { status: 400 },
      );
    }

    if (archivo.size < MIN_FIRMWARE_BYTES || archivo.size > MAX_FIRMWARE_BYTES) {
      return NextResponse.json(
        { ok: false, mensaje: 'El tamaño del firmware no corresponde a la partición OTA del ESP32.' },
        { status: 400 },
      );
    }

    const deviceRef = adminDb.collection('DispositivosAcceso').doc(sede);
    const commandRef = adminDb.collection('ComandosDispositivo').doc(deviceId);
    const [deviceSnapshot, commandSnapshot] = await Promise.all([
      deviceRef.get(),
      commandRef.get(),
    ]);
    const device = deviceSnapshot.data() || {};
    const lastContact = device.ultimoContacto?.toMillis?.() || 0;

    if (!deviceSnapshot.exists || device.deviceId !== deviceId) {
      throw new RequestAccessError('El ESP32 no corresponde a la sede seleccionada.', 409);
    }
    if (!lastContact || Date.now() - lastContact > ONLINE_WINDOW_MS) {
      throw new RequestAccessError('El ESP32 está sin conexión. No se enviará firmware.', 409);
    }
    if (device.otaRemota !== true) {
      throw new RequestAccessError(
        'Este ESP32 todavía necesita instalar una vez el firmware puente con OTA remota.',
        409,
      );
    }
    if (device.puertaCerrada !== true || device.puertaBloqueada !== true || device.alarmaActiva === true) {
      throw new RequestAccessError(
        'La puerta debe estar cerrada, bloqueada y sin alarma antes de actualizar.',
        409,
      );
    }
    if (String(device.firmware || '') === version) {
      throw new RequestAccessError('El ESP32 ya reporta esta misma versión.', 409);
    }

    const previous = commandSnapshot.data() || {};
    const previousExpires = previous.expiraEn?.toMillis?.() || 0;
    if (previous.estado === 'pendiente' && previousExpires > Date.now()) {
      throw new RequestAccessError(
        'El ESP32 ya tiene una orden pendiente. Espere a que termine o expire.',
        409,
      );
    }

    const bytes = Buffer.from(await archivo.arrayBuffer());
    if (bytes[0] !== 0xe9) {
      return NextResponse.json(
        { ok: false, mensaje: 'El archivo no tiene la cabecera de una aplicación ESP32 válida.' },
        { status: 400 },
      );
    }

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const pathname = `firmware/${deviceId}/${version}-${sha256.slice(0, 16)}.bin`;
    const blob = await put(pathname, bytes, {
      access: 'private',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
      // El pathname incluye el SHA-256. Reintentar el mismo binario puede
      // reutilizarlo sin crear copias ni quedar bloqueado por un intento previo.
      allowOverwrite: true,
    });

    const commandId = randomUUID();
    const registroId = randomUUID();
    const now = Date.now();
    const historyRef = adminDb.collection('ActualizacionesFirmware').doc(registroId);

    await adminDb.runTransaction(async (transaction) => {
      const freshDevice = await transaction.get(deviceRef);
      const freshCommand = await transaction.get(commandRef);
      const freshDeviceData = freshDevice.data() || {};
      const freshLastContact = freshDeviceData.ultimoContacto?.toMillis?.() || 0;
      const freshPrevious = freshCommand.data() || {};
      const freshPreviousExpires = freshPrevious.expiraEn?.toMillis?.() || 0;

      if (
        !freshDevice.exists ||
        freshDeviceData.deviceId !== deviceId ||
        freshDeviceData.otaRemota !== true ||
        freshDeviceData.puertaCerrada !== true ||
        freshDeviceData.puertaBloqueada !== true ||
        freshDeviceData.alarmaActiva === true ||
        !freshLastContact ||
        now - freshLastContact > ONLINE_WINDOW_MS
      ) {
        throw new RequestAccessError('El estado seguro del ESP32 cambió. Se canceló la orden.', 409);
      }
      if (freshPrevious.estado === 'pendiente' && freshPreviousExpires > now) {
        throw new RequestAccessError('Apareció otra orden pendiente para este ESP32.', 409);
      }

      transaction.set(commandRef, {
        commandId,
        tipo: 'ACTUALIZAR_FIRMWARE',
        estado: 'pendiente',
        deviceId,
        sede,
        solicitadoPor: actor.uid,
        solicitadoPorEmail: actor.email || '',
        solicitadoEn: FieldValue.serverTimestamp(),
        expiraEn: Timestamp.fromMillis(now + COMMAND_TTL_MS),
        entregas: 0,
        firmwareRegistroId: registroId,
        firmware: {
          version,
          sha256,
          tamano: bytes.length,
          pathname: blob.pathname,
        },
      });

      transaction.set(historyRef, {
        registroId,
        commandId,
        deviceId,
        sede,
        versionAnterior: String(freshDeviceData.firmware || 'Sin identificar'),
        versionNueva: version,
        sha256,
        tamano: bytes.length,
        pathname: blob.pathname,
        estado: 'pendiente',
        solicitadoPor: actor.uid,
        solicitadoPorEmail: actor.email || '',
        creadoEn: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      ok: true,
      commandId,
      version,
      sha256,
      tamano: bytes.length,
      mensaje: 'Firmware privado preparado. El ESP32 lo recibirá mediante su próximo heartbeat.',
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    console.error('FIRMWARE_UPLOAD_ERROR:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo preparar la actualización de firmware.' },
      { status: 500 },
    );
  }
}
