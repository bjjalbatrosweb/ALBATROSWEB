import { createHash } from 'node:crypto';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      token?: unknown;
    } | null;
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
      return NextResponse.json(
        { ok: false, mensaje: 'El código de solicitud no es válido.' },
        { status: 400 },
      );
    }

    const tokenRef = adminDb.collection('TokensSolicitudPago').doc(hashToken(token));

    const result = await adminDb.runTransaction(async (transaction) => {
      const tokenSnapshot = await transaction.get(tokenRef);
      if (!tokenSnapshot.exists) return { estado: 'invalido' as const };

      const tokenData = tokenSnapshot.data() || {};
      const solicitudId = String(tokenData.solicitudId || '');
      const alumnoId = String(tokenData.alumnoId || '');
      const periodo = String(tokenData.periodo || '');
      if (!solicitudId || !alumnoId || !/^\d{4}-\d{2}$/.test(periodo)) {
        return { estado: 'invalido' as const };
      }

      const expiraEn = tokenData.expiraEn as Timestamp | undefined;
      if (!expiraEn || expiraEn.toMillis() < Date.now()) {
        return { estado: 'expirado' as const };
      }

      const solicitudRef = adminDb.collection('SolicitudesPago').doc(solicitudId);
      const pagoRef = adminDb.collection('Pagos').doc(solicitudId);
      const alumnoRef = adminDb.collection('Alumnos').doc(alumnoId);
      const [solicitudSnapshot, pagoSnapshot, alumnoSnapshot] = await Promise.all([
        transaction.get(solicitudRef),
        transaction.get(pagoRef),
        transaction.get(alumnoRef),
      ]);

      if (pagoSnapshot.exists) return { estado: 'pagado' as const };
      if (!alumnoSnapshot.exists || alumnoSnapshot.data()?.activo === false) {
        return { estado: 'alumno_invalido' as const };
      }

      if (!solicitudSnapshot.exists) {
        transaction.create(solicitudRef, {
          alumnoId,
          nombre: String(tokenData.nombre || 'Alumno'),
          sede: String(tokenData.sede || ''),
          monto: Number(tokenData.monto) || 0,
          periodo,
          estado: 'pendiente',
          origen: 'qr_rfid_android',
          creadaEn: FieldValue.serverTimestamp(),
          actualizadaEn: FieldValue.serverTimestamp(),
        });
      } else if (solicitudSnapshot.data()?.estado === 'rechazada') {
        transaction.update(solicitudRef, {
          estado: 'pendiente',
          origen: 'qr_rfid_android',
          actualizadaEn: FieldValue.serverTimestamp(),
        });
      }

      if (!tokenData.usado) {
        transaction.update(tokenRef, {
          usado: true,
          usadoEn: FieldValue.serverTimestamp(),
        });
      }

      return {
        estado: solicitudSnapshot.exists ? ('existente' as const) : ('creado' as const),
      };
    });

    if (result.estado === 'invalido') {
      return NextResponse.json(
        { ok: false, mensaje: 'La solicitud no existe o ya no es válida.' },
        { status: 404 },
      );
    }
    if (result.estado === 'expirado') {
      return NextResponse.json(
        { ok: false, mensaje: 'El código expiró. Solicita uno nuevo en recepción.' },
        { status: 410 },
      );
    }
    if (result.estado === 'pagado') {
      return NextResponse.json(
        { ok: false, mensaje: 'Este periodo ya aparece como pagado.' },
        { status: 409 },
      );
    }
    if (result.estado === 'alumno_invalido') {
      return NextResponse.json(
        { ok: false, mensaje: 'No fue posible validar al alumno.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      duplicada: result.estado === 'existente',
      mensaje: 'Solicitud de pago realizada. Espere su comprobante.',
    });
  } catch (error) {
    console.error('ERROR_CONFIRMAR_SOLICITUD_PAGO:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo registrar la solicitud.' },
      { status: 500 },
    );
  }
}
