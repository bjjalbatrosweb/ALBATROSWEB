import { randomBytes, createHash } from 'node:crypto';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import type { Sede } from '@/lib/access-control';
import { adminDb } from '@/lib/firebase-admin';
import {
  RequestAccessError,
  requirePanelActorAccess,
} from '@/lib/server-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEDES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];
const TOKEN_TTL_MS = 20 * 60 * 1000;

type AlumnoPago = {
  id: string;
  nombre: string;
  sede: Sede;
  monto: number;
  montoBase: number;
  descuento: number;
  telefono: string;
  disciplina: string;
  activo: boolean;
};

function normalizarSede(value: unknown): Sede | null {
  if (typeof value !== 'string') return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, '_') as Sede;
  return SEDES.includes(sede) ? sede : null;
}

function normalizarRfid(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    : '';
}

function periodoValido(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function buscarAlumno(rfid: string, sede: Sede): Promise<AlumnoPago | null> {
  const alumnos = adminDb.collection('Alumnos');
  let snapshot = await alumnos
    .where('rfids', 'array-contains', rfid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    snapshot = await alumnos.where('rfid', '==', rfid).limit(1).get();
  }

  if (snapshot.empty) return null;

  const document = snapshot.docs[0];
  const data = document.data();
  const sedeAlumno = normalizarSede(data.sede);
  if (sedeAlumno !== sede) return null;

  const montoBase = Math.max(0, Number(data.montoPago) || 0);
  const descuento = Math.max(0, Number(data.descuento) || 0);

  return {
    id: document.id,
    nombre: String(data.nombre || 'Alumno'),
    sede,
    monto: Math.max(0, montoBase - descuento),
    montoBase,
    descuento,
    telefono: String(data.telefono || ''),
    disciplina: String(data.disciplina || ''),
    activo: data.activo !== false,
  };
}

function serializarFecha(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sede = normalizarSede(url.searchParams.get('sede'));
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: 'La sede no es válida.' },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);
    const snapshot = await adminDb
      .collection('SolicitudesPago')
      .where('sede', '==', sede)
      .limit(100)
      .get();

    const solicitudes = snapshot.docs
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          alumnoId: String(data.alumnoId || ''),
          nombre: String(data.nombre || 'Alumno'),
          sede,
          monto: Number(data.monto) || 0,
          periodo: String(data.periodo || ''),
          estado: String(data.estado || 'pendiente'),
          creadaEn: serializarFecha(data.creadaEn),
        };
      })
      .sort((a, b) =>
        String(b.creadaEn || '').localeCompare(String(a.creadaEn || '')),
      );

    return NextResponse.json({ ok: true, solicitudes });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error('ERROR_LISTAR_SOLICITUDES_PAGO:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudieron cargar las solicitudes.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      accion?: unknown;
      rfid?: unknown;
      sede?: unknown;
      periodo?: unknown;
    } | null;

    const accion = body?.accion === 'generar' ? 'generar' : 'consultar';
    const rfid = normalizarRfid(body?.rfid);
    const sede = normalizarSede(body?.sede);

    if (!rfid || !sede) {
      return NextResponse.json(
        { ok: false, mensaje: 'RFID o sede no válidos.' },
        { status: 400 },
      );
    }

    const actor = await requirePanelActorAccess(request, sede);
    const alumno = await buscarAlumno(rfid, sede);

    if (!alumno) {
      return NextResponse.json(
        { ok: false, mensaje: 'La tarjeta no pertenece a un alumno de esta sede.' },
        { status: 404 },
      );
    }
    if (!alumno.activo) {
      return NextResponse.json(
        { ok: false, mensaje: 'El alumno tiene una baja temporal.' },
        { status: 409 },
      );
    }
    if (alumno.monto <= 0) {
      return NextResponse.json(
        { ok: false, mensaje: 'El alumno no tiene un monto pendiente configurado.' },
        { status: 409 },
      );
    }

    if (accion === 'consultar') {
      return NextResponse.json({ ok: true, alumno });
    }

    if (!periodoValido(body?.periodo)) {
      return NextResponse.json(
        { ok: false, mensaje: 'El periodo no es válido.' },
        { status: 400 },
      );
    }

    const periodo = body.periodo;
    const solicitudId = `${alumno.id}_${periodo.replace('-', '')}`;
    const pagoId = solicitudId;
    const [pago, solicitud] = await Promise.all([
      adminDb.collection('Pagos').doc(pagoId).get(),
      adminDb.collection('SolicitudesPago').doc(solicitudId).get(),
    ]);

    if (pago.exists) {
      return NextResponse.json(
        { ok: false, mensaje: `${alumno.nombre} ya tiene registrado ese periodo.` },
        { status: 409 },
      );
    }
    if (solicitud.exists && solicitud.data()?.estado === 'pendiente') {
      return NextResponse.json(
        {
          ok: false,
          pendiente: true,
          mensaje: 'Ya existe una solicitud pendiente para este alumno y periodo.',
        },
        { status: 409 },
      );
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenId = hashToken(rawToken);
    const expiresAt = Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS);

    await adminDb.collection('TokensSolicitudPago').doc(tokenId).create({
      alumnoId: alumno.id,
      nombre: alumno.nombre,
      sede,
      monto: alumno.monto,
      periodo,
      solicitudId,
      usado: false,
      creadoPor: actor.uid,
      creadoPorEmail: actor.email || '',
      creadoEn: FieldValue.serverTimestamp(),
      expiraEn: expiresAt,
    });

    return NextResponse.json({
      ok: true,
      alumno,
      token: rawToken,
      expiraEn: expiresAt.toDate().toISOString(),
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error('ERROR_PREPARAR_SOLICITUD_PAGO:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo preparar la solicitud de pago.' },
      { status: 500 },
    );
  }
}
