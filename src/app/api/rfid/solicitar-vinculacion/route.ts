import { NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelAccess,
} from '@/lib/server-access';
import {
  addDoc,
  collection,
  doc,
  getDocs,
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
    const body: { alumnoId?: string; dispositivo?: string; sede?: string } =
      await req.json();

    const { alumnoId, dispositivo, sede } = body;

    if (!alumnoId) {
      return NextResponse.json(
        { ok: false, mensaje: 'alumnoId es obligatorio' },
        { status: 400 }
      );
    }

    const dispositivoNormalizado = normalizarDispositivo(dispositivo);
    const sedeNormalizada = normalizarSede(sede);
    await requirePanelAccess(req, sedeNormalizada);
    const vinculacionesRef = collection(db, 'VinculacionesRFID');

    const pendientesQuery = query(
      vinculacionesRef,
      where('dispositivo', '==', dispositivoNormalizado),
      where('estado', '==', 'pendiente')
    );

    const pendientesSnapshot = await getDocs(pendientesQuery);

    await Promise.all(
      pendientesSnapshot.docs.map((documento) =>
        updateDoc(doc(db, 'VinculacionesRFID', documento.id), {
          estado: 'cancelada',
          canceladoEn: serverTimestamp(),
        })
      )
    );

    const nuevaVinculacion = await addDoc(vinculacionesRef, {
      alumnoId,
      dispositivo: dispositivoNormalizado,
      sede: sedeNormalizada,
      estado: 'pendiente',
      creadoEn: serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      vinculacionId: nuevaVinculacion.id,
      dispositivo: dispositivoNormalizado,
      sede: sedeNormalizada,
      mensaje: 'Vinculación solicitada. Acerca la tarjeta maestra al ESP32.',
    });
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }

    console.error('Error al solicitar vinculación:', error);

    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo solicitar la vinculación.' },
      { status: 500 }
    );
  }
}
