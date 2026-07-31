import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import type { Sede } from '@/lib/access-control';
import { adminDb } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelActorAccess,
} from '@/lib/server-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSite(value: string | null): Sede {
  const site = (value || 'MMA').toUpperCase().replace(/\s+/g, '_');
  return ['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(site)
    ? (site as Sede)
    : 'MMA';
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error('ADMIN_WHATSAPP_PROSPECTS_ERROR:', error);
  return NextResponse.json(
    { error: 'No se pudo completar la operación' },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const selectedSite = normalizeSite(url.searchParams.get('sede'));
    const actor = await requirePanelActorAccess(request, selectedSite);
    const snapshot = await adminDb
      .collection('ProspectosWhatsApp')
      .limit(250)
      .get();

    const prospects = snapshot.docs
      .map((document) => ({
        id: document.id,
        ...document.data(),
      }))
      .filter((prospect) => {
        const data = prospect as Record<string, unknown>;
        const visible =
          (data.nivelInteres === 'alto' || data.requiereHumano === true) &&
          data.estadoSeguimiento !== 'descartado';
        if (!visible) return false;
        if (actor.profile.rol === 'admin' && actor.profile.sede === 'TODAS') {
          return true;
        }
        return !data.sede || data.sede === selectedSite;
      })
      .sort((a, b) => {
        const left =
          (a as { actualizadoEn?: { toMillis?: () => number } }).actualizadoEn
            ?.toMillis?.() || 0;
        const right =
          (b as { actualizadoEn?: { toMillis?: () => number } }).actualizadoEn
            ?.toMillis?.() || 0;
        return right - left;
      })
      .map((prospect) => {
        const data = prospect as Record<string, unknown>;
        const updated = data.actualizadoEn as
          | { toDate?: () => Date }
          | undefined;
        return {
          ...data,
          actualizadoEn: updated?.toDate?.().toISOString() || null,
        };
      });

    return NextResponse.json({ prospects });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      sede?: string;
      action?: 'pause' | 'resume' | 'contacted' | 'discard';
    };
    const selectedSite = normalizeSite(body.sede || null);
    const actor = await requirePanelActorAccess(request, selectedSite);
    const id = String(body.id || '').replace(/[^\d]/g, '');

    if (!id || !body.action) {
      return NextResponse.json(
        { error: 'Prospecto o acción inválidos' },
        { status: 400 },
      );
    }

    const prospectReference = adminDb
      .collection('ProspectosWhatsApp')
      .doc(id);
    const prospectSnapshot = await prospectReference.get();
    if (!prospectSnapshot.exists) {
      return NextResponse.json(
        { error: 'El prospecto no existe' },
        { status: 404 },
      );
    }

    const prospectSite = prospectSnapshot.data()?.sede;
    const isGlobalAdmin =
      actor.profile.rol === 'admin' && actor.profile.sede === 'TODAS';
    if (
      !isGlobalAdmin &&
      prospectSite &&
      prospectSite !== selectedSite
    ) {
      return NextResponse.json(
        { error: 'No tienes acceso a este prospecto' },
        { status: 403 },
      );
    }

    const updates: Record<string, unknown> = {
      actualizadoEn: FieldValue.serverTimestamp(),
      actualizadoPor: actor.uid,
    };

    if (body.action === 'pause') updates.botPausado = true;
    if (body.action === 'resume') {
      updates.botPausado = false;
      updates.requiereHumano = false;
      updates.motivoTransferencia = null;
    }
    if (body.action === 'contacted') {
      updates.botPausado = true;
      updates.estadoSeguimiento = 'contactado';
      updates.contactadoEn = FieldValue.serverTimestamp();
    }
    if (body.action === 'discard') {
      updates.botPausado = true;
      updates.estadoSeguimiento = 'descartado';
    }

    await prospectReference.set(updates, {
      merge: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
