import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { RequestAccessError, requireDeviceAccess } from '@/lib/server-access';

const SEDES = ['MMA', 'CAUCEL', 'JUAN_PABLO'] as const;
type Sede = typeof SEDES[number];

function normalizarSede(value: unknown): Sede | null {
  const sede = typeof value === 'string'
    ? value.trim().toUpperCase().replace(/\s+/g, '_')
    : '';
  return SEDES.includes(sede as Sede) ? sede as Sede : null;
}

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

    // La primera conexión registra las sedes declaradas. A partir de entonces
    // el servidor usa exclusivamente el registro fijado para este deviceId.
    const registryRef = adminDb.collection('DispositivosRegistrados').doc(deviceId);
    const registrySnapshot = await registryRef.get();
    const registryData = registrySnapshot.data() || {};
    const sedesRegistradas: Sede[] = Array.isArray(registryData.sedes)
      ? registryData.sedes.map(normalizarSede).filter((item: Sede | null): item is Sede => item !== null)
      : [];
    const sedesDeclaradas: Sede[] = Array.isArray(body.sedes)
      ? Array.from(new Set<Sede>(
          body.sedes
            .map((item: unknown) => normalizarSede(item))
            .filter((item: Sede | null): item is Sede => item !== null),
        ))
      : [];
    const sedeUnica = normalizarSede(body.sede || body.sedePrincipal);
    let sedesDispositivo: Sede[] = sedesRegistradas.length
      ? sedesRegistradas
      : sedesDeclaradas.length
        ? sedesDeclaradas
        : sedeUnica
          ? [sedeUnica]
          : [];

    if (sedesDispositivo.length === 0) {
      const existentes = await Promise.all(
        SEDES.map(async (sede) => ({
          sede,
          snapshot: await adminDb.collection('DispositivosAcceso').doc(sede).get(),
        })),
      );
      sedesDispositivo = existentes
        .filter(({ snapshot }) => snapshot.exists && snapshot.data()?.deviceId === deviceId)
        .map(({ sede }) => sede);
    }

    if (sedesDispositivo.length === 0) {
      return NextResponse.json(
        { ok: false, mensaje: 'Este dispositivo todavía no tiene una sede asociada' },
        { status: 409 },
      );
    }

    if (!registrySnapshot.exists) {
      const sitesToRegister = [...sedesDispositivo];
      await adminDb.runTransaction(async (transaction) => {
        const currentRegistry = await transaction.get(registryRef);
        if (currentRegistry.exists) return;

        const ownership = await Promise.all(sitesToRegister.map(async (sede) => {
          const ownerRef = adminDb.collection('PropietariosDispositivo').doc(sede);
          const accessRef = adminDb.collection('DispositivosAcceso').doc(sede);
          return {
            sede,
            ownerRef,
            owner: await transaction.get(ownerRef),
            access: await transaction.get(accessRef),
          };
        }));

        ownership.forEach(({ sede, ownerRef, owner, access }) => {
          const ownerId = owner.data()?.deviceId;
          const currentAccessId = access.data()?.deviceId;
          if (
            (typeof ownerId === 'string' && ownerId !== deviceId) ||
            (typeof currentAccessId === 'string' && currentAccessId !== deviceId)
          ) {
            throw new RequestAccessError(`La sede ${sede} ya pertenece a otro dispositivo`, 409);
          }
          transaction.set(ownerRef, {
            deviceId,
            sede,
            actualizadoEn: FieldValue.serverTimestamp(),
          }, { merge: true });
        });

        transaction.create(registryRef, {
          deviceId,
          sedes: sitesToRegister,
          creadoEn: FieldValue.serverTimestamp(),
          firmwareInicial: textoSeguro(body.firmware, 'Sin identificar', 30),
        });
      });
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
      estadoSistema: textoSeguro(body.estadoSistema, 'OPERATIVO', 30),
      bootId: textoSeguro(body.bootId, 'Sin identificar', 50),
      uptimeMs: Number.isFinite(Number(body.uptimeMs)) ? Math.max(0, Number(body.uptimeMs)) : null,
      heapLibre: Number.isFinite(Number(body.heapLibre)) ? Math.max(0, Number(body.heapLibre)) : null,
      ultimoContacto: FieldValue.serverTimestamp(),
    };

    const commandRef = adminDb.collection('ComandosDispositivo').doc(deviceId);
    const commandSnapshot = await commandRef.get();
    const commandData = commandSnapshot.data() || {};
    const lastCommandId = textoSeguro(body.ultimoComandoId, '', 80);
    const commandId = String(commandData.commandId || '');
    const expiresAt = commandData.expiraEn?.toMillis?.() || 0;
    let command: { id: string; tipo: 'REINICIAR' } | null = null;

    if (commandId && lastCommandId === commandId) {
      await commandRef.set({
        estado: 'confirmado',
        confirmadoEn: FieldValue.serverTimestamp(),
      }, { merge: true });
    } else if (
      commandData.estado === 'pendiente' &&
      commandData.tipo === 'REINICIAR' &&
      expiresAt > Date.now()
    ) {
      command = { id: commandId, tipo: 'REINICIAR' };
    }

    const batch = adminDb.batch();
    sedesDispositivo.forEach((sede) => {
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
      sedes: sedesDispositivo,
      comando: command,
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
