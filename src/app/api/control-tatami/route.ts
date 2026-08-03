import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { RequestAccessError, requirePanelOrDevice } from '@/lib/server-access';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
const validSites: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

function normalizeSite(value: string | null): Sede {
  const site = (value || 'MMA').trim().toUpperCase().replace(/\s+/g, '_');
  return validSites.includes(site as Sede) ? (site as Sede) : 'MMA';
}

export async function GET(request: Request) {
  const site = normalizeSite(new URL(request.url).searchParams.get('sede'));

  try {
    await requirePanelOrDevice(request, site);
    const [controlSnapshot, classSnapshot] = await Promise.all([
      adminDb.collection('ControlesAcceso').doc(site).get(),
      adminDb.collection('ClasesActivas').doc(site).get(),
    ]);
    const control = controlSnapshot.exists ? controlSnapshot.data() || {} : {};
    const activeClass = classSnapshot.exists ? classSnapshot.data() || {} : {};

    return NextResponse.json({
      ok: true,
      sede: site,
      claseActiva: classSnapshot.exists,
      claseId: typeof activeClass.claseId === 'string' ? activeClass.claseId : null,
      tatamiBloqueado: control.tatamiBloqueado === true,
      actualizadoEn: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error('CONTROL_TATAMI_ERROR:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo consultar el control del tatami' },
      { status: 500 },
    );
  }
}
