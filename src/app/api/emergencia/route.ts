import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,160}$/;

function publicProfile(data: FirebaseFirestore.DocumentData) {
  const emergency =
    data.emergencia && typeof data.emergencia === 'object'
      ? data.emergencia
      : {};

  return {
    nombre: String(data.nombre || 'Atleta'),
    sede: String(data.sede || 'ALBATROS'),
    fotoUrl: typeof data.fotoUrl === 'string' ? data.fotoUrl : '',
    fechaNacimiento:
      typeof emergency.fechaNacimiento === 'string'
        ? emergency.fechaNacimiento
        : '',
    tipoSangre:
      typeof emergency.tipoSangre === 'string' ? emergency.tipoSangre : '',
    alergias:
      typeof emergency.alergias === 'string' ? emergency.alergias : '',
    condicionesMedicas:
      typeof emergency.condicionesMedicas === 'string'
        ? emergency.condicionesMedicas
        : '',
    medicamentos:
      typeof emergency.medicamentos === 'string'
        ? emergency.medicamentos
        : '',
    contactoNombre:
      typeof emergency.contactoNombre === 'string'
        ? emergency.contactoNombre
        : '',
    contactoParentesco:
      typeof emergency.contactoParentesco === 'string'
        ? emergency.contactoParentesco
        : '',
    contactoTelefono:
      typeof emergency.contactoTelefono === 'string'
        ? emergency.contactoTelefono
        : '',
    indicaciones:
      typeof emergency.indicaciones === 'string' ? emergency.indicaciones : '',
  };
}

export async function GET(
  request: Request,
) {
  try {
    const token = new URL(request.url).searchParams.get('token')?.trim() || '';

    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json(
        { ok: false, mensaje: 'El enlace de emergencia no es válido.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const snapshot = await adminDb
      .collection('Alumnos')
      .where('emergenciaToken', '==', token)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { ok: false, mensaje: 'El perfil no existe o el enlace fue desactivado.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const data = snapshot.docs[0].data();
    if (data.activo === false || data.emergencia?.activo === false) {
      return NextResponse.json(
        { ok: false, mensaje: 'Este perfil de emergencia está desactivado.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, perfil: publicProfile(data) },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
  } catch (error) {
    console.error('ERROR_PERFIL_EMERGENCIA_PUBLICO:', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudo consultar el perfil de emergencia.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
