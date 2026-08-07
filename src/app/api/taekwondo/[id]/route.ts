import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(data: FirebaseFirestore.DocumentData, id: string) {
  let restanteMs = Math.max(0, Number(data.restanteMs) || 0);
  const inicio = data.iniciadoEn instanceof Timestamp ? data.iniciadoEn.toMillis() : 0;
  if (data.corriendo && inicio) restanteMs = Math.max(0, restanteMs - (Date.now() - inicio));
  return {
    id, rojo: String(data.rojo || 'ROJO'), azul: String(data.azul || 'AZUL'),
    puntosRojo: Number(data.puntosRojo) || 0, puntosAzul: Number(data.puntosAzul) || 0,
    round: Number(data.round) || 1, restanteMs, duracionMs: Number(data.duracionMs) || 120000,
    corriendo: data.corriendo === true && restanteMs > 0, terminado: data.terminado === true,
  };
}

function tokenOk(value: unknown, stored: unknown) {
  if (typeof value !== 'string' || typeof stored !== 'string') return false;
  const actual = createHash('sha256').update(value).digest();
  const expected = Buffer.from(stored, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const snap = await adminDb.collection('CombatesTaekwondo').doc(id).get();
  if (!snap.exists) return NextResponse.json({ ok: false, mensaje: 'Combate no encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, combate: clean(snap.data() || {}, snap.id) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const ref = adminDb.collection('CombatesTaekwondo').doc(id);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const data = snap.data() || {};
      if (!tokenOk(body.token, data.tokenHash)) throw new Error('FORBIDDEN');
      const now = Date.now();
      const inicio = data.iniciadoEn instanceof Timestamp ? data.iniciadoEn.toMillis() : 0;
      const actual = data.corriendo && inicio
        ? Math.max(0, Number(data.restanteMs || 0) - (now - inicio))
        : Math.max(0, Number(data.restanteMs || 0));
      const common = { actualizadoEn: FieldValue.serverTimestamp() };
      if (body.accion === 'puntos') {
        const lado = body.lado === 'rojo' ? 'puntosRojo' : body.lado === 'azul' ? 'puntosAzul' : '';
        const delta = Number(body.delta);
        if (!lado || ![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(delta)) throw new Error('BAD');
        tx.update(ref, { [lado]: Math.max(0, Number(data[lado] || 0) + delta), ...common });
      } else if (body.accion === 'iniciar') {
        tx.update(ref, { corriendo: actual > 0, restanteMs: actual, iniciadoEn: Timestamp.fromMillis(now), ...common });
      } else if (body.accion === 'pausar') {
        tx.update(ref, { corriendo: false, restanteMs: actual, iniciadoEn: null, ...common });
      } else if (body.accion === 'reiniciar') {
        tx.update(ref, { puntosRojo: 0, puntosAzul: 0, round: 1, restanteMs: Number(data.duracionMs) || 120000, corriendo: false, iniciadoEn: null, terminado: false, ...common });
      } else if (body.accion === 'siguiente_round') {
        tx.update(ref, { round: Math.min(5, Number(data.round || 1) + 1), restanteMs: Number(data.duracionMs) || 120000, corriendo: false, iniciadoEn: null, ...common });
      } else if (body.accion === 'terminar') {
        tx.update(ref, { corriendo: false, restanteMs: actual, iniciadoEn: null, terminado: true, ...common });
      } else throw new Error('BAD');
    });
    const updated = await ref.get();
    return NextResponse.json({ ok: true, combate: clean(updated.data() || {}, updated.id) });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'NOT_FOUND') return NextResponse.json({ ok: false, mensaje: 'Combate no encontrado.' }, { status: 404 });
    if (code === 'FORBIDDEN') return NextResponse.json({ ok: false, mensaje: 'Control no autorizado.' }, { status: 403 });
    if (code === 'BAD') return NextResponse.json({ ok: false, mensaje: 'Operación inválida.' }, { status: 400 });
    console.error('ERROR_CONTROL_TAEKWONDO:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo actualizar el combate.' }, { status: 500 });
  }
}
