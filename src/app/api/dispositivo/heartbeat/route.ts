import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { RequestAccessError, requireDeviceAccess } from '@/lib/server-access';

const SEDES_DISPOSITIVO = ['MMA', 'CAUCEL'] as const;

function textoSeguro(valor: unknown, respaldo: string, maximo = 60) {
  return typeof valor === 'string' && valor.trim()
    ? valor.trim().slice(0, maximo)
    : respaldo;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = typeof body.deviceId === 'string'
      ? body.deviceId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)
      : '';

    await requireDeviceAccess(request);

    if (!deviceId || !deviceId.startsWith('ESP32-')) {
      return NextResponse.json(
        { ok: false, mensaje: 'El dispositivo no tiene un identificador válido' },
        { status: 400 },
      );
    }

    const telemetry = {
      deviceId,
      dispositivo: textoSeguro(body.dispositivo, 'ESP32 acceso'),
      firmware: textoSeguro(body.firmware, 'Sin identificar', 30),
      puertaCerrada: body.puertaCerrada === true,
      puertaBloqueada: body.puertaBloqueada === true,
      alarmaActiva: body.alarmaActiva === true,
      rssi: Number.isFinite(Number(body.rssi)) ? Number(body.rssi) : null,
      ip: textoSeguro(body.ip, 'Sin IP', 45),
      ultimoContacto: FieldValue.serverTimestamp(),
    };

    const batch = adminDb.batch();
    SEDES_DISPOSITIVO.forEach((sede) => {
      batch.set(
        adminDb.collection('DispositivosAcceso').doc(sede),
        { ...telemetry, sede },
        { merge: true },
      );
    });
    await batch.commit();

    return NextResponse.json({
      ok: true,
      deviceId,
      sedes: SEDES_DISPOSITIVO,
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }

    console.error('DEVICE_HEARTBEAT_ERROR:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo registrar el estado del dispositivo' },
      { status: 500 },
    );
  }
}
