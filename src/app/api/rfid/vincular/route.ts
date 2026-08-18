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

function tarjetasDelAlumno(alumno: Record<string, unknown>): string[] {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(alumno.rfids) ? alumno.rfids : []),
        alumno.rfid,
      ]
        .map(normalizarRfid)
        .filter(Boolean),
    ),
  );
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

    // La colección se revisa completa y se normalizan los valores históricos.
    // Las consultas exactas no detectan variantes antiguas como "aa-bb" cuando
    // el lector envía "AABB", lo que podía crear una segunda vinculación.
    const alumnos = db.collection('Alumnos');
    const alumnosSnapshot = await alumnos.get();
    const propietarios = alumnosSnapshot.docs.filter((documento) =>
      tarjetasDelAlumno(documento.data()).includes(rfid),
    );
    if (propietarios.length > 0) {
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
      let indiceRecuperado = false;
      if (tarjetaSnapshot.exists) {
        const indice = tarjetaSnapshot.data() || {};
        const propietarioAnterior =
          typeof indice.alumnoId === 'string' ? indice.alumnoId.trim() : '';
        if (propietarioAnterior) {
          const propietarioSnapshot = await transaction.get(
            db.collection('Alumnos').doc(propietarioAnterior),
          );
          if (
            propietarioSnapshot.exists &&
            tarjetasDelAlumno(propietarioSnapshot.data() || {}).includes(rfid)
          ) {
            throw new RequestAccessError('Tarjeta ya registrada', 409);
          }
        }
        indiceRecuperado = true;
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
      const datosIndice = {
        rfid,
        alumnoId,
        sede: sedeEsperada,
        vinculacionId,
        creadoEn: FieldValue.serverTimestamp(),
        ...(indiceRecuperado
          ? { recuperadoEn: FieldValue.serverTimestamp() }
          : {}),
      };
      if (indiceRecuperado) transaction.set(tarjetaRef, datosIndice);
      else transaction.create(tarjetaRef, datosIndice);
      transaction.update(vinculacionRef, {
        estado: 'completada',
        rfidAsignado: rfid,
        completadoEn: FieldValue.serverTimestamp(),
        dispositivo: dispositivoEsperado,
        sede: sedeEsperada,
      });
      return {
        alumnoId,
        dispositivoEsperado,
        sedeEsperada,
        indiceRecuperado,
      };
    });

    return NextResponse.json({
      ok: true,
      rfid,
      alumnoId: resultado.alumnoId,
      dispositivo: resultado.dispositivoEsperado,
      sede: resultado.sedeEsperada,
      indiceRecuperado: resultado.indiceRecuperado,
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
