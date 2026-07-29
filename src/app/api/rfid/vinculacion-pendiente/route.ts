import { NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requireDeviceAccess,
} from '@/lib/server-access';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
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

export async function GET(req: Request) {
  try {
    await requireDeviceAccess(req);
    const { searchParams } = new URL(req.url);
    const dispositivo = normalizarDispositivo(
      searchParams.get('dispositivo')
    );
    const sedeParam = searchParams.get('sede');

    const pendientesQuery = query(
      collection(db, 'VinculacionesRFID'),
      where('dispositivo', '==', dispositivo),
      where('estado', '==', 'pendiente'),
      orderBy('creadoEn', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(pendientesQuery);
    const sedeNormalizada = sedeParam ? normalizarSede(sedeParam) : null;

    const documento = sedeNormalizada
      ? snapshot.docs.find(
          (docSnap) => normalizarSede(docSnap.data().sede) === sedeNormalizada
        )
      : snapshot.docs[0];

    if (!documento) {
      return NextResponse.json({
        pendiente: false,
        dispositivo,
        sede: sedeNormalizada,
      });
    }

    const data = documento.data();

    return NextResponse.json({
      pendiente: true,
      vinculacionId: documento.id,
      alumnoId: data.alumnoId,
      dispositivo: data.dispositivo,
      sede: normalizarSede(data.sede),
    });
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { pendiente: false, error: error.message },
        { status: error.status },
      );
    }

    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en vinculacion-pendiente:', error);

    return NextResponse.json(
      { pendiente: false, error: mensaje },
      { status: 500 }
    );
  }
}
