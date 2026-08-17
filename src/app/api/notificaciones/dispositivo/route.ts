import { createHash } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  RequestAccessError,
  requireActiveActorAccess,
} from '@/lib/server-access';

export const runtime = 'nodejs';

function notificationDocumentId(uid: string, token: string) {
  return createHash('sha256').update(`${uid}:${token}`).digest('hex');
}

function readToken(value: unknown) {
  const token = typeof value === 'string' ? value.trim() : '';
  return token.length >= 40 && token.length <= 4096 ? token : '';
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { ok: false, mensaje: error.message },
      { status: error.status },
    );
  }

  console.error('ATHLETE_NOTIFICATION_DEVICE_ERROR', error);
  return NextResponse.json(
    { ok: false, mensaje: fallback },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: 'notificaciones-dispositivo',
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: 'Demasiados intentos. Espera un momento.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
      );
    }

    const actor = await requireActiveActorAccess(request);
    if (actor.profile.rol !== 'atleta' || !actor.profile.alumnoId) {
      throw new RequestAccessError(
        'Solo un perfil de atleta vinculado puede activar notificaciones.',
        403,
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      token?: unknown;
      consentimiento?: unknown;
    };
    const token = readToken(body.token);
    if (!token || body.consentimiento !== true) {
      return NextResponse.json(
        { ok: false, mensaje: 'Suscripción de notificaciones inválida.' },
        { status: 400 },
      );
    }

    const reference = adminDb
      .collection('DispositivosNotificacion')
      .doc(notificationDocumentId(actor.uid, token));
    const previous = await reference.get();

    await reference.set(
      {
        uid: actor.uid,
        alumnoId: actor.profile.alumnoId,
        sede: actor.profile.sede || null,
        token,
        plataforma: 'web',
        activo: true,
        consentimientoEn:
          previous.data()?.consentimientoEn || FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(
      error,
      'No se pudo activar este dispositivo para notificaciones.',
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: 'notificaciones-dispositivo',
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: 'Demasiados intentos. Espera un momento.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
      );
    }

    const actor = await requireActiveActorAccess(request);
    if (actor.profile.rol !== 'atleta') {
      throw new RequestAccessError(
        'Solo un perfil de atleta puede desactivar notificaciones.',
        403,
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      token?: unknown;
    };
    const token = readToken(body.token);
    if (!token) {
      return NextResponse.json(
        { ok: false, mensaje: 'Suscripción de notificaciones inválida.' },
        { status: 400 },
      );
    }

    await adminDb
      .collection('DispositivosNotificacion')
      .doc(notificationDocumentId(actor.uid, token))
      .delete();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(
      error,
      'No se pudo desactivar este dispositivo.',
    );
  }
}
