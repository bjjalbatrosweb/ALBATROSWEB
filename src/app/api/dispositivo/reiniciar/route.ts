import { randomUUID } from 'node:crypto';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requireAdminActorAccess,
  requireDeviceAccess,
} from '@/lib/server-access';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
const SEDES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];
const ONLINE_WINDOW_MS = 5 * 60_000;
const COMMAND_TTL_MS = 7 * 60_000;
const COMMAND_COOLDOWN_MS = 60_000;

function normalizeSite(value: unknown): Sede | null {
  const site = typeof value === 'string'
    ? value.trim().toUpperCase().replace(/\s+/g, '_')
    : '';
  return SEDES.includes(site as Sede) ? site as Sede : null;
}

function normalizeDeviceId(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)
    : '';
}

export async function GET(request: Request) {
  try {
    await requireDeviceAccess(request);
    const url = new URL(request.url);
    const deviceId = normalizeDeviceId(url.searchParams.get('deviceId'));
    const ultimoComandoId = String(url.searchParams.get('ultimoComandoId') || '').slice(0, 80);

    if (!deviceId || !deviceId.startsWith('ESP32-')) {
      return NextResponse.json({ ok: false, mensaje: 'Dispositivo inválido' }, { status: 400 });
    }

    const commandRef = adminDb.collection('ComandosDispositivo').doc(deviceId);
    const commandSnapshot = await commandRef.get();
    if (!commandSnapshot.exists) {
      return NextResponse.json({ ok: true, comando: null });
    }

    const command = commandSnapshot.data() || {};
    const commandId = String(command.commandId || '');
    if (commandId && ultimoComandoId === commandId) {
      if (command.estado !== 'confirmado') {
        await commandRef.set({
          estado: 'confirmado',
          confirmadoEn: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      return NextResponse.json({ ok: true, comando: null, confirmado: true });
    }

    const expiresAt = command.expiraEn?.toMillis?.() || 0;
    if (command.estado !== 'pendiente' || !expiresAt || expiresAt <= Date.now()) {
      if (command.estado === 'pendiente') {
        await commandRef.set({
          estado: 'expirado',
          expiradoEn: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      return NextResponse.json({ ok: true, comando: null });
    }

    await commandRef.set({
      ultimoEntregadoEn: FieldValue.serverTimestamp(),
      entregas: FieldValue.increment(1),
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      comando: { id: commandId, tipo: 'REINICIAR' },
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    console.error('DEVICE_COMMAND_POLL_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo consultar el comando' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const body = await request.json().catch(() => ({}));
    const sede = normalizeSite(body.sede);
    const deviceId = normalizeDeviceId(body.deviceId);

    if (!sede || !deviceId || body.confirmar !== true) {
      return NextResponse.json(
        { ok: false, mensaje: 'La solicitud de reinicio es inválida' },
        { status: 400 },
      );
    }

    const deviceRef = adminDb.collection('DispositivosAcceso').doc(sede);
    const commandRef = adminDb.collection('ComandosDispositivo').doc(deviceId);
    const result = await adminDb.runTransaction(async (transaction) => {
      const deviceSnapshot = await transaction.get(deviceRef);
      const commandSnapshot = await transaction.get(commandRef);
      const device = deviceSnapshot.data() || {};
      const lastContact = device.ultimoContacto?.toMillis?.() || 0;

      if (!deviceSnapshot.exists || device.deviceId !== deviceId) {
        throw new RequestAccessError('El dispositivo no corresponde a esta sede', 409);
      }
      if (!lastContact || Date.now() - lastContact > ONLINE_WINDOW_MS) {
        throw new RequestAccessError(
          'El ESP32 está sin conexión. No se dejó una orden pendiente por seguridad.',
          409,
        );
      }
      if (
        (sede === 'MMA' || sede === 'CAUCEL')
        && (
          device.puertaCerrada !== true
          || device.puertaBloqueada !== true
          || device.alarmaActiva === true
        )
      ) {
        throw new RequestAccessError(
          'La puerta debe estar cerrada, bloqueada y sin alarma antes de reiniciar.',
          409,
        );
      }

      const previous = commandSnapshot.data() || {};
      const previousRequestedAt = previous.solicitadoEn?.toMillis?.() || 0;
      if (
        previous.estado === 'pendiente' &&
        previousRequestedAt &&
        Date.now() - previousRequestedAt < COMMAND_COOLDOWN_MS
      ) {
        return { commandId: String(previous.commandId || ''), reused: true };
      }

      const commandId = randomUUID();
      transaction.set(commandRef, {
        commandId,
        tipo: 'REINICIAR',
        estado: 'pendiente',
        deviceId,
        sede,
        solicitadoPor: actor.uid,
        solicitadoPorEmail: actor.email || '',
        solicitadoEn: FieldValue.serverTimestamp(),
        expiraEn: Timestamp.fromMillis(Date.now() + COMMAND_TTL_MS),
        entregas: 0,
      });
      transaction.update(deviceRef, {
        reinicioEstado: 'solicitado',
        reinicioCommandId: commandId,
        reinicioSolicitadoEn: FieldValue.serverTimestamp(),
      });
      return { commandId, reused: false };
    });

    return NextResponse.json({
      ok: true,
      commandId: result.commandId,
      reutilizada: result.reused,
      mensaje: result.reused
        ? 'El reinicio ya estaba solicitado'
        : 'Orden de reinicio preparada para el ESP32',
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    console.error('DEVICE_RESTART_ERROR:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo solicitar el reinicio del ESP32' },
      { status: 500 },
    );
  }
}
