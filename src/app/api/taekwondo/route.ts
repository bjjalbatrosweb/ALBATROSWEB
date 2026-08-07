import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { RequestAccessError, requirePanelActorAccess } from '@/lib/server-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sede = String(body.sede || 'MMA').trim().toUpperCase().replace(/\s+/g, '_');
    if (!['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(sede)) {
      return NextResponse.json({ ok: false, mensaje: 'Sede inválida.' }, { status: 400 });
    }
    const actor = await requirePanelActorAccess(request, sede as 'MMA' | 'CAUCEL' | 'JUAN_PABLO');
    const rojo = String(body.rojo || 'ROJO').trim().slice(0, 50) || 'ROJO';
    const azul = String(body.azul || 'AZUL').trim().slice(0, 50) || 'AZUL';
    const segundos = Math.max(30, Math.min(600, Number(body.segundos) || 120));
    const token = randomBytes(24).toString('base64url');
    const ref = adminDb.collection('CombatesTaekwondo').doc();
    await ref.create({
      rojo, azul, puntosRojo: 0, puntosAzul: 0, round: 1,
      restanteMs: segundos * 1000, duracionMs: segundos * 1000,
      corriendo: false, iniciadoEn: null, sede, terminado: false,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      creadoPor: actor.uid, creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, combateId: ref.id, token });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    console.error('ERROR_CREAR_COMBATE_TAEKWONDO:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo crear el combate.' }, { status: 500 });
  }
}
