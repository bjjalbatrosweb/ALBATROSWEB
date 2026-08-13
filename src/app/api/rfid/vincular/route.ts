import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb as db } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelOrDevice,
} from '@/lib/server-access';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
const SEDES_VALIDAS: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];
const VINCULACION_TTL_MS = 10 * 60_000;

export const runtime = 'nodejs';

function normalizarSede(valor: unknown): Sede | null {
  if (typeof valor !== 'string') return null;
  const sede = valor.trim().toUpperCase().replace(/\s+/g, '_');
  return SEDES_VALIDAS.includes(sede as Sede) ? sede as Sede : null;
}

function normalizarDispositivo(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) return 'Recepcion';
  const dispositivo = valor.trim();
  return dispositivo.toLowerCase().startsWith('recepcion')
    ? 'Recepcion'
    : dispositivo;
}

function normalizarRfid(valor: unknown): string {
  return typeof valor === 'string'
    ? valor.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    : '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as {
      vinculacionId?: string;
      rfid?: string;
      dispositivo?: string;
      sede?: string;
      deviceId?: string;
    };
    const vinculacionId = typeof body.vinculacionId === 'string'
      ? body.vinculacionId.trim()
      : '';
    const rfid = normalizarRfid(body.rfid);
    const sedeRecibida = normalizarSede(body.sede);
    const dispositivoRecibido = normalizarDispositivo(body.dispositivo);

    if (!vinculacionId || !rfid || !sedeRecibida) {
      return NextResponse.json(
        { ok: false, mensaje: 'Los datos de vinculación no son válidos' },
        { status: 400 },
      );
    }
    await requirePanelOrDevice(req, sedeRecibida);

    // Compatibilidad con datos anteriores al índice TarjetasRFID. Esta
    // comprobación evita aceptar un UID que ya vive en Alumnos.rfid/rfids.
    const alumnos = db.collection('Alumnos');
    const [porPrincipal, porArreglo] = await Promise.all([
      alumnos.where('rfid', '==', rfid).limit(1).get(),
      alumnos.where('rfids', 'array-contains', rfid).limit(1).get(),
    ]);
    if (!porPrincipal.empty || !porArreglo.empty) {
      return NextResponse.json(
        { ok: false, mensaje: 'Tarjeta ya registrada' },
        { status: 409 },
      );
    }

    const vinculacionRef = db.collection('VinculacionesRFID').doc(vinculacionId);
    const tarjetaRef = db.collection('TarjetasRFID').doc(rfid);
    const resultado = await db.runTransaction(async (transaction) => {
      const vinculacionSnapshot = await transaction.get(vinculacionRef);
      if (!vinculacionSnapshot.exists) {
        throw new RequestAccessError('La vinculación no existe', 404);
      }
      const vinculacion = vinculacionSnapshot.data() || {};
      if (vinculacion.estado !== 'pendiente') {
        throw new RequestAccessError('El proceso ya no es válido', 409);
      }
      const expiraEn = vinculacion.expiraEn?.toMillis?.()
        || ((vinculacion.creadoEn?.toMillis?.() || 0) + VINCULACION_TTL_MS);
      if (!expiraEn || expiraEn <= Date.now()) {
        throw new RequestAccessError(
          'La vinculación expiró; solicita una nueva',
          410,
        );
      }

      const sedeEsperada = normalizarSede(vinculacion.sede);
      const dispositivoEsperado = normalizarDispositivo(vinculacion.dispositivo);
      if (!sedeEsperada || sedeEsperada !== sedeRecibida) {
        throw new RequestAccessError('La solicitud pertenece a otra sede', 409);
      }
      if (body.dispositivo && dispositivoEsperado !== dispositivoRecibido) {
        throw new RequestAccessError(
          'La solicitud pertenece a otro dispositivo',
          409,
        );
      }

      const alumnoId = typeof vinculacion.alumnoId === 'string'
        ? vinculacion.alumnoId
        : '';
      if (!alumnoId) {
        throw new RequestAccessError(
          'La vinculación no tiene alumno asociado',
          400,
        );
      }
      const alumnoRef = db.collection('Alumnos').doc(alumnoId);
      const [alumnoSnapshot, tarjetaSnapshot] = await Promise.all([
        transaction.get(alumnoRef),
        transaction.get(tarjetaRef),
      ]);
      if (!alumnoSnapshot.exists) {
        throw new RequestAccessError('El alumno ya no existe', 404);
      }
      if (tarjetaSnapshot.exists) {
        throw new RequestAccessError('Tarjeta ya registrada', 409);
      }

      const alumno = alumnoSnapshot.data() || {};
      const actualizacion: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        rfids: FieldValue.arrayUnion(rfid),
        sede: sedeEsperada,
      };
      if (typeof alumno.rfid !== 'string' || !alumno.rfid.trim()) {
        actualizacion.rfid = rfid;
      }
      transaction.update(alumnoRef, actualizacion);
      transaction.create(tarjetaRef, {
        rfid,
        alumnoId,
        sede: sedeEsperada,
        vinculacionId,
        creadoEn: FieldValue.serverTimestamp(),
      });
      transaction.update(vinculacionRef, {
        estado: 'completada',
        rfidAsignado: rfid,
        completadoEn: FieldValue.serverTimestamp(),
        dispositivo: dispositivoEsperado,
        sede: sedeEsperada,
      });
      return { alumnoId, dispositivoEsperado, sedeEsperada };
    });

    return NextResponse.json({
      ok: true,
      rfid,
      alumnoId: resultado.alumnoId,
      dispositivo: resultado.dispositivoEsperado,
      sede: resultado.sedeEsperada,
      mensaje: 'Tarjeta vinculada correctamente',
    });
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error('RFID_LINK_ERROR:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo vincular la tarjeta' },
      { status: 500 },
    );
  }
}
