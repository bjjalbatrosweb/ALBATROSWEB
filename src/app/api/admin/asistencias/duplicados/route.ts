import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import type { Sede } from '@/lib/access-control';
import { adminDb } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelActorAccess,
} from '@/lib/server-access';

export const runtime = 'nodejs';

const SEDES_VALIDAS: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

function normalizarSede(valor: unknown): Sede | null {
  if (typeof valor !== 'string') return null;
  const sede = valor.trim().toUpperCase().replace(/\s+/g, '_') as Sede;
  return SEDES_VALIDAS.includes(sede) ? sede : null;
}

function fechaMerida(fecha: Date) {
  const partes = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Merida',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

type Registro = {
  id: string;
  alumnoId: string;
  nombre: string;
  fecha: Date;
};

function encontrarDuplicados(registros: Registro[]) {
  const grupos = new Map<string, Registro[]>();

  registros.forEach((registro) => {
    const clave = `${registro.alumnoId}_${fechaMerida(registro.fecha)}`;
    grupos.set(clave, [...(grupos.get(clave) || []), registro]);
  });

  return [...grupos.values()]
    .filter((grupo) => grupo.length > 1)
    .map((grupo) => {
      const ordenado = [...grupo].sort(
        (a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id.localeCompare(b.id),
      );
      return {
        alumnoId: ordenado[0].alumnoId,
        nombre: ordenado[0].nombre,
        fecha: fechaMerida(ordenado[0].fecha),
        cantidad: ordenado.length,
        conservarId: ordenado[0].id,
        eliminarIds: ordenado.slice(1).map((item) => item.id),
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      sede?: unknown;
      confirmar?: unknown;
    } | null;
    const sede = normalizarSede(body?.sede);
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: 'Sede inválida.' },
        { status: 400 },
      );
    }

    const actor = await requirePanelActorAccess(request, sede);
    if (actor.profile.rol !== 'admin') {
      return NextResponse.json(
        {
          ok: false,
          mensaje: 'Solo el administrador general puede eliminar duplicados.',
        },
        { status: 403 },
      );
    }

    const snapshot = await adminDb
      .collection('Asistencias')
      .where('sede', '==', sede)
      .get();
    const registros = snapshot.docs.flatMap((documento) => {
      const data = documento.data();
      const fecha = data.fecha?.toDate?.();
      const alumnoId =
        typeof data.alumnoId === 'string' ? data.alumnoId.trim() : '';
      if (!(fecha instanceof Date) || !alumnoId) return [];
      return [{
        id: documento.id,
        alumnoId,
        nombre: String(data.nombre || 'Alumno'),
        fecha,
      }];
    });
    const grupos = encontrarDuplicados(registros);
    const eliminarIds = grupos.flatMap((grupo) => grupo.eliminarIds);

    if (body?.confirmar !== true || eliminarIds.length === 0) {
      return NextResponse.json({
        ok: true,
        vistaPrevia: true,
        grupos,
        gruposDuplicados: grupos.length,
        registrosAEliminar: eliminarIds.length,
      });
    }

    for (let inicio = 0; inicio < eliminarIds.length; inicio += 400) {
      const batch = adminDb.batch();
      eliminarIds.slice(inicio, inicio + 400).forEach((id) => {
        batch.delete(adminDb.collection('Asistencias').doc(id));
      });
      await batch.commit();
    }

    await adminDb
      .collection('Auditoria')
      .doc(sede)
      .collection('movimientos')
      .add({
        action: 'eliminar_asistencia',
        entity: 'asistencia',
        entityId: 'duplicados',
        entityName: 'Duplicados históricos',
        summary: `Se eliminaron ${eliminarIds.length} asistencias duplicadas.`,
        reason: 'Limpieza administrativa de registros duplicados.',
        details: {
          grupos: grupos.length,
          eliminados: eliminarIds.length,
          conservados: grupos.map((grupo) => grupo.conservarId),
        },
        before: null,
        after: null,
        sede,
        actorUid: actor.uid,
        actorName: actor.profile.nombre || actor.email || 'Administrador',
        actorEmail: actor.email || '',
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      ok: true,
      vistaPrevia: false,
      gruposCorregidos: grupos.length,
      registrosEliminados: eliminarIds.length,
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error('ERROR_LIMPIEZA_ASISTENCIAS:', error);
    return NextResponse.json(
      {
        ok: false,
        mensaje: 'No se pudieron analizar las asistencias.',
      },
      { status: 500 },
    );
  }
}
