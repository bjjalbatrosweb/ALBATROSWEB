import { NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelOrDevice,
} from '@/lib/server-access';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@/lib/server-firestore';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
const SEDES_VALIDAS: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

export const runtime = 'nodejs';

function normalizarSede(valor: unknown): Sede {
  if (typeof valor !== 'string') return 'MMA';
  const sede = valor.trim().toUpperCase().replace(/\s+/g, '_');
  return SEDES_VALIDAS.includes(sede as Sede) ? (sede as Sede) : 'MMA';
}

function normalizarDispositivo(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) return 'Recepcion';
  const dispositivo = valor.trim();
  return dispositivo.toLowerCase().startsWith('recepcion')
    ? 'Recepcion'
    : dispositivo;
}

export async function POST(req: Request) {
  try {
    const body: {
      vinculacionId?: string;
      rfid?: string;
      dispositivo?: string;
      sede?: string;
    } = await req.json();

    const { vinculacionId, rfid, dispositivo, sede } = body;
    const sedeAutorizada = normalizarSede(sede);
    await requirePanelOrDevice(req, sedeAutorizada);

    if (!vinculacionId || !rfid) {
      return NextResponse.json(
        { ok: false, mensaje: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const rfidNormalizado = rfid
      .toString()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    if (!rfidNormalizado) {
      return NextResponse.json(
        { ok: false, mensaje: 'RFID inválido' },
        { status: 400 }
      );
    }

    const rfidQuery = query(
      collection(db, 'Alumnos'),
      where('rfid', '==', rfidNormalizado),
      limit(1)
    );
    
    const rfidArrayQuery = query(
      collection(db, 'Alumnos'),
      where('rfids', 'array-contains', rfidNormalizado),
      limit(1)
    );
    
    const [rfidSnapshot, rfidArraySnapshot] = await Promise.all([
      getDocs(rfidQuery),
      getDocs(rfidArrayQuery),
    ]);
    
    if (!rfidSnapshot.empty || !rfidArraySnapshot.empty) {
      return NextResponse.json(
        { ok: false, mensaje: 'Tarjeta ya registrada' },
        { status: 409 }
      );
    }

    const vinculacionRef = doc(
      db,
      'VinculacionesRFID',
      vinculacionId
    );

    const vinculacionSnapshot = await getDoc(vinculacionRef);

    if (!vinculacionSnapshot.exists()) {
      return NextResponse.json(
        { ok: false, mensaje: 'La vinculación no existe' },
        { status: 404 }
      );
    }

    const vinculacion = vinculacionSnapshot.data();

    if (vinculacion.estado !== 'pendiente') {
      return NextResponse.json(
        { ok: false, mensaje: 'El proceso ya no es válido' },
        { status: 409 }
      );
    }

    const dispositivoEsperado = normalizarDispositivo(
      vinculacion.dispositivo
    );
    const dispositivoRecibido = normalizarDispositivo(dispositivo);

    if (dispositivo && dispositivoEsperado !== dispositivoRecibido) {
      return NextResponse.json(
        { ok: false, mensaje: 'La solicitud pertenece a otro dispositivo' },
        { status: 409 }
      );
    }

    const sedeEsperada = normalizarSede(vinculacion.sede);

    if (sede && normalizarSede(sede) !== sedeEsperada) {
      return NextResponse.json(
        { ok: false, mensaje: 'La solicitud pertenece a otra sede' },
        { status: 409 }
      );
    }

    const alumnoId = vinculacion.alumnoId;

    if (!alumnoId) {
      return NextResponse.json(
        { ok: false, mensaje: 'La vinculación no tiene alumno asociado' },
        { status: 400 }
      );
    }

    const alumnoRef = doc(db, 'Alumnos', alumnoId);
    const alumnoSnapshot = await getDoc(alumnoRef);

    if (!alumnoSnapshot.exists()) {
      return NextResponse.json(
        { ok: false, mensaje: 'El alumno ya no existe' },
        { status: 404 }
      );
    }

    const alumnoData = alumnoSnapshot.data();

const rfidPrincipal =
  typeof alumnoData.rfid === 'string'
    ? alumnoData.rfid
    : '';

const actualizacionAlumno: any = {
  rfids: arrayUnion(rfidNormalizado),
  sede: sedeEsperada,
};

if (!rfidPrincipal) {
  actualizacionAlumno.rfid = rfidNormalizado;
}

await updateDoc(alumnoRef, actualizacionAlumno);

    await updateDoc(vinculacionRef, {
      estado: 'completada',
      rfidAsignado: rfidNormalizado,
      completadoEn: serverTimestamp(),
      dispositivo: dispositivoEsperado,
      sede: sedeEsperada,
    });

    return NextResponse.json({
      ok: true,
      rfid: rfidNormalizado,
      alumnoId,
      dispositivo: dispositivoEsperado,
      sede: sedeEsperada,
      mensaje: 'Tarjeta vinculada correctamente',
    });
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }

    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en endpoint vincular:', error);

    return NextResponse.json(
      { ok: false, mensaje },
      { status: 500 }
    );
  }
}
