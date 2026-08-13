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
import type { Sede as AccessSite } from '@/lib/access-control';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
const SEDES_VALIDAS: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];
const VINCULACION_TTL_MS = 10 * 60_000;

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
    const { searchParams } = new URL(req.url);
    const dispositivo = normalizarDispositivo(
      searchParams.get('dispositivo')
    );
    const sedeParam = searchParams.get('sede');
    const sedeNormalizada = sedeParam ? normalizarSede(sedeParam) : null;
    if (sedeNormalizada) {
      await requireDeviceAccess(req, sedeNormalizada as AccessSite);
    } else {
      await requireDeviceAccess(req);
    }

    const pendientesQuery = query(
      collection(db, 'VinculacionesRFID'),
      where('dispositivo', '==', dispositivo),
      where('estado', '==', 'pendiente'),
      orderBy('creadoEn', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(pendientesQuery);
    const ahora = Date.now();
    const vigente = (docSnap: (typeof snapshot.docs)[number]) => {
      const data = docSnap.data();
      const expiraEn = data.expiraEn?.toMillis?.()
        || ((data.creadoEn?.toMillis?.() || 0) + VINCULACION_TTL_MS);
      return expiraEn > ahora;
    };
    const perteneceAlGrupo = (docSnap: (typeof snapshot.docs)[number]) => {
      const sede = normalizarSede(docSnap.data().sede);
      const group = (req.headers.get('x-device-group') || '').toUpperCase();
      return sede === 'JUAN_PABLO'
        ? group === 'JUAN_PABLO'
        : group === 'MMA_CAUCEL';
    };
    const documento = snapshot.docs.find((docSnap) =>
      vigente(docSnap)
      && perteneceAlGrupo(docSnap)
      && (!sedeNormalizada || normalizarSede(docSnap.data().sede) === sedeNormalizada)
    );

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

    console.error('Error en vinculacion-pendiente:', error);

    return NextResponse.json(
      { pendiente: false, error: 'No se pudo consultar la vinculación.' },
      { status: 500 }
    );
  }
}
