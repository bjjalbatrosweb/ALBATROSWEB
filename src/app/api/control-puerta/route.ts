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

const SEDES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

function normalizarSede(value: unknown): Sede | null {
  if (typeof value !== 'string') return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, '_') as Sede;
  return SEDES.includes(sede) ? sede : null;
}

export async function GET(request: Request) {
  try {
    const sede = normalizarSede(new URL(request.url).searchParams.get('sede'));
    if (!sede) return NextResponse.json({ ok: false, mensaje: 'La sede no es válida.' }, { status: 400 });

    await requirePanelOrDevice(request, sede);
    const snapshot = await adminDb.collection('ControlesAcceso').doc(sede).get();
    const data = snapshot.data() || {};
    return NextResponse.json({
      ok: true,
      sede,
      puertaLiberada: data.puertaLiberada === true,
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
    await adminDb.collection('ControlesAcceso').doc(sede).set({
      sede,
      puertaLiberada: body.puertaLiberada,
      puertaActualizadaPor: actor.uid,
      puertaActualizadaPorEmail: actor.email || '',
      puertaActualizadaEn: FieldValue.serverTimestamp(),
    }, { merge: true });

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
