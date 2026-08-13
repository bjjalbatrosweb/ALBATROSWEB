import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import type { Sede } from '@/lib/access-control';
import { adminDb } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelActorAccess,
  requirePanelOrDevice,
} from '@/lib/server-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEDES_CON_PUERTA: Sede[] = ['MMA', 'CAUCEL'];

// MMA y Caucel comparten un solo ESP32, relé y electroimán. Por ello no pueden
// conservar órdenes distintas: cualquier cambio se replica de forma atómica.
function sedesDeLaMismaPuerta(): Sede[] {
  return ['MMA', 'CAUCEL'];
}

function normalizarSede(value: unknown): Sede | null {
  if (typeof value !== 'string') return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, '_') as Sede;
  return SEDES_CON_PUERTA.includes(sede) ? sede : null;
}

export async function GET(request: Request) {
  try {
    const sede = normalizarSede(new URL(request.url).searchParams.get('sede'));
    if (!sede) return NextResponse.json({ ok: false, mensaje: 'La sede no es válida.' }, { status: 400 });

    await requirePanelOrDevice(request, sede);
    const snapshots = await Promise.all(
      sedesDeLaMismaPuerta().map((item) =>
        adminDb.collection('ControlesAcceso').doc(item).get(),
      ),
    );
    const data = snapshots.find((item) => item.exists)?.data() || {};
    const puertaLiberada = snapshots.some(
      (item) => item.exists && item.data()?.puertaLiberada === true,
    );
    return NextResponse.json({
      ok: true,
      sede,
      puertaLiberada,
      actualizadoEn: data.puertaActualizadaEn?.toDate?.().toISOString() || null,
      actualizadoPorEmail: String(data.puertaActualizadaPorEmail || ''),
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    console.error('CONTROL_PUERTA_GET_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo consultar la puerta.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sede = normalizarSede(body.sede);
    if (!sede || typeof body.puertaLiberada !== 'boolean' || body.confirmar !== true) {
      return NextResponse.json({ ok: false, mensaje: 'La orden de puerta no es válida.' }, { status: 400 });
    }

    const actor = await requirePanelActorAccess(request, sede);
    const batch = adminDb.batch();
    for (const sedeFisica of sedesDeLaMismaPuerta()) {
      batch.set(adminDb.collection('ControlesAcceso').doc(sedeFisica), {
        sede: sedeFisica,
        puertaLiberada: body.puertaLiberada,
        puertaActualizadaPor: actor.uid,
        puertaActualizadaPorEmail: actor.email || '',
        puertaActualizadaEn: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();

    return NextResponse.json({
      ok: true,
      puertaLiberada: body.puertaLiberada,
      mensaje: body.puertaLiberada ? 'Puerta liberada.' : 'Puerta bloqueada.',
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    console.error('CONTROL_PUERTA_POST_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo cambiar la puerta.' }, { status: 500 });
  }
}
