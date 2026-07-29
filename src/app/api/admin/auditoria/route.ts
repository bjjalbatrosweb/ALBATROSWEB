import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import type { Sede } from '@/lib/access-control';
import { adminDb } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelActorAccess,
} from '@/lib/server-access';

export const runtime = 'nodejs';

const VALID_SITES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];
const VALID_ENTITIES = ['alumno', 'pago', 'asistencia', 'rfid'];
const VALID_ACTIONS = [
  'crear',
  'editar',
  'eliminar',
  'activar',
  'desactivar',
  'registrar_pago',
  'editar_pago',
  'cancelar_pago',
  'agregar_asistencia',
  'eliminar_asistencia',
  'reiniciar_asistencias',
];

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { ok: false, mensaje: error.message },
      { status: error.status },
    );
  }

  console.error('Error de auditoría:', error);
  return NextResponse.json(
    { ok: false, mensaje: 'No se pudo procesar el historial.' },
    { status: 500 },
  );
}

function normalizeSite(value: unknown): Sede | null {
  const site =
    typeof value === 'string'
      ? value.trim().toUpperCase().replace(/\s+/g, '_')
      : '';

  return VALID_SITES.includes(site as Sede) ? (site as Sede) : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sede = normalizeSite(body.sede);

    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: 'Sede inválida.' },
        { status: 400 },
      );
    }

    const actor = await requirePanelActorAccess(request, sede);
    const action = String(body.action || '');
    const entity = String(body.entity || '');
    const summary = String(body.summary || '').trim().slice(0, 240);

    if (
      !VALID_ACTIONS.includes(action) ||
      !VALID_ENTITIES.includes(entity) ||
      !summary
    ) {
      return NextResponse.json(
        { ok: false, mensaje: 'Movimiento inválido.' },
        { status: 400 },
      );
    }

    const details =
      body.details &&
      typeof body.details === 'object' &&
      !Array.isArray(body.details)
        ? JSON.parse(JSON.stringify(body.details))
        : {};
    const inferredBefore: Record<string, unknown> = {};
    const inferredAfter: Record<string, unknown> = {};
    Object.entries(details).forEach(([key, value]) => {
      if (key.endsWith('Anterior')) {
        inferredBefore[key.slice(0, -8)] = value;
      } else if (key.endsWith('Nuevo')) {
        inferredAfter[key.slice(0, -5)] = value;
      }
    });
    const before =
      details.before && typeof details.before === 'object'
        ? details.before
        : Object.keys(inferredBefore).length
          ? inferredBefore
          : action === 'eliminar' || action === 'cancelar_pago'
            ? details
            : null;
    const after =
      details.after && typeof details.after === 'object'
        ? details.after
        : Object.keys(inferredAfter).length
          ? inferredAfter
          : action === 'crear' ||
              action === 'editar' ||
              action === 'registrar_pago' ||
              action === 'agregar_asistencia'
            ? details
            : null;
    const reason = String(details.reason || summary).trim().slice(0, 300);

    const reference = await adminDb
      .collection('Auditoria')
      .doc(sede)
      .collection('movimientos')
      .add({
        action,
        entity,
        entityId: String(body.entityId || '').slice(0, 160),
        entityName: String(body.entityName || '').slice(0, 160),
        summary,
        details,
        before,
        after,
        reason,
        sede,
        actorUid: actor.uid,
        actorName: actor.profile.nombre || actor.email || 'Usuario',
        actorEmail: actor.email || '',
        actorRole: actor.profile.rol,
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ ok: true, id: reference.id });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sede = normalizeSite(url.searchParams.get('sede'));

    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: 'Sede inválida.' },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);

    const requestedLimit = Number(url.searchParams.get('limit') || 50);
    const pageSize = Math.min(Math.max(requestedLimit, 10), 100);
    const cursor = String(url.searchParams.get('cursor') || '').trim();
    let historyQuery = adminDb
      .collection('Auditoria')
      .doc(sede)
      .collection('movimientos')
      .orderBy('createdAt', 'desc')
      .limit(pageSize + 1);

    if (cursor) {
      const cursorSnapshot = await adminDb
        .collection('Auditoria')
        .doc(sede)
        .collection('movimientos')
        .doc(cursor)
        .get();
      if (cursorSnapshot.exists) {
        historyQuery = historyQuery.startAfter(cursorSnapshot);
      }
    }

    const snapshot = await historyQuery.get();
    const hasMore = snapshot.docs.length > pageSize;
    const pageDocuments = snapshot.docs.slice(0, pageSize);

    const movements = pageDocuments.map((document) => {
      const data = document.data();
      const date = data.createdAt?.toDate?.();

      return {
        id: document.id,
        ...data,
        createdAt: date ? date.toISOString() : null,
      };
    });

    return NextResponse.json({
      ok: true,
      movements,
      nextCursor: hasMore
        ? pageDocuments[pageDocuments.length - 1]?.id || null
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
