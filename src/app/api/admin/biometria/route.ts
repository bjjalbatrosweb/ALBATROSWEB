import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { normalizarPerfilAcceso, type PerfilAcceso, type Sede } from '@/lib/access-control';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { RequestAccessError, requireAdminActorAccess } from '@/lib/server-access';

const SEDES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

function timestampToIso(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('toDate' in value)) return null;
  const toDate = (value as { toDate?: unknown }).toDate;
  return typeof toDate === 'function'
    ? (toDate.call(value) as Date).toISOString()
    : null;
}

function sedesPermitidas(perfil: PerfilAcceso): Sede[] {
  if (perfil.sede === 'TODAS') return SEDES;
  const result = new Set<Sede>();
  if (perfil.sede) result.add(perfil.sede);
  perfil.sedes?.forEach((sede) => result.add(sede));
  return Array.from(result);
}

function parseSedes(value: unknown): Sede[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is Sede => SEDES.includes(item as Sede))));
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
  }
  console.error('ADMIN_BIOMETRIA_ERROR:', error);
  return NextResponse.json(
    { ok: false, mensaje: 'No se pudo completar la gestión biométrica' },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    await requireAdminActorAccess(request);

    const [passkeysSnapshot, usersSnapshot] = await Promise.all([
      adminDb.collection('Passkeys').get(),
      adminDb.collection('usuarios').get(),
    ]);

    const profiles = new Map<string, ReturnType<typeof normalizarPerfilAcceso>>();
    usersSnapshot.docs.forEach((item) => {
      profiles.set(item.id, normalizarPerfilAcceso(item.data() || {}));
    });

    const usuarios = usersSnapshot.docs
      .map((item) => {
        const raw = item.data() || {};
        const perfil = profiles.get(item.id);
        if (!perfil) return null;
        return {
          uid: item.id,
          nombre: perfil.nombre || String(raw.nombreCompleto || raw.email || item.id),
          email: typeof raw.email === 'string' ? raw.email : '',
          rol: perfil.rol,
          activo: perfil.activo,
          sedes: sedesPermitidas(perfil),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const credenciales = passkeysSnapshot.docs
      .map((item) => {
        const data = item.data() || {};
        const perfil = profiles.get(String(data.uid || ''));
        return {
          id: item.id,
          uid: String(data.uid || ''),
          nombrePersona: String(
            data.nombrePersona || perfil?.nombre || data.email || 'Sin asignar',
          ),
          funcion: String(data.funcion || perfil?.rol || 'sin_asignar'),
          sedes: parseSedes(data.sedes),
          dispositivo: String(data.nombre || 'Dispositivo sin nombre'),
          email: String(data.email || ''),
          activo: data.activo !== false,
          creadoEn: timestampToIso(data.creadoEn),
          ultimoUso: timestampToIso(data.ultimoUso),
          respaldada: data.credentialBackedUp === true,
        };
      })
      .sort((a, b) => (b.ultimoUso || b.creadoEn || '').localeCompare(a.ultimoUso || a.creadoEn || ''));

    return NextResponse.json({ ok: true, credenciales, usuarios });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const body = await request.json();
    const credentialId = String(body.credentialId || '');
    const targetUid = String(body.uid || '');
    const nombrePersona = String(body.nombrePersona || '').trim();
    const sedes = parseSedes(body.sedes);

    if (!credentialId || !targetUid || !nombrePersona || sedes.length === 0) {
      return NextResponse.json(
        { ok: false, mensaje: 'Completa la persona, el nombre y al menos una sede' },
        { status: 400 },
      );
    }

    const [credentialSnapshot, profileSnapshot] = await Promise.all([
      adminDb.collection('Passkeys').doc(credentialId).get(),
      adminDb.collection('usuarios').doc(targetUid).get(),
    ]);
    const perfil = profileSnapshot.exists
      ? normalizarPerfilAcceso(profileSnapshot.data() || {})
      : null;

    if (!credentialSnapshot.exists || !perfil) {
      return NextResponse.json({ ok: false, mensaje: 'La credencial o la cuenta no existe' }, { status: 404 });
    }
    if (!perfil.activo) {
      return NextResponse.json({ ok: false, mensaje: 'No puedes asignarla a una cuenta inactiva' }, { status: 400 });
    }

    const permitidas = sedesPermitidas(perfil);
    if (sedes.some((sede) => !permitidas.includes(sede))) {
      return NextResponse.json(
        { ok: false, mensaje: 'La cuenta seleccionada no tiene permiso para alguna de esas sedes' },
        { status: 400 },
      );
    }

    const authUser = await adminAuth.getUser(targetUid);
    await credentialSnapshot.ref.update({
      uid: targetUid,
      email: authUser.email || '',
      nombrePersona,
      funcion: perfil.rol,
      sedes,
      activo: body.activo !== false,
      actualizadoEn: FieldValue.serverTimestamp(),
      actualizadoPor: actor.uid,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const body = await request.json();
    const credentialId = String(body.credentialId || '');
    if (!credentialId) {
      return NextResponse.json({ ok: false, mensaje: 'Credencial inválida' }, { status: 400 });
    }

    const ref = adminDb.collection('Passkeys').doc(credentialId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return NextResponse.json({ ok: false, mensaje: 'La credencial ya no existe' }, { status: 404 });
    }

    const batch = adminDb.batch();
    batch.delete(ref);
    parseSedes(snapshot.data()?.sedes).forEach((sede) => {
      const auditRef = adminDb
        .collection('Auditoria')
        .doc(sede)
        .collection('movimientos')
        .doc();
      batch.set(auditRef, {
        action: 'eliminar',
        entity: 'biometria',
        entityId: credentialId,
        entityName: String(snapshot.data()?.nombrePersona || snapshot.data()?.email || 'Passkey'),
        summary: 'Acceso biométrico eliminado',
        details: { dispositivo: snapshot.data()?.nombre || '' },
        sede,
        actorUid: actor.uid,
        actorName: actor.profile.nombre || actor.email || 'Administrador',
        actorEmail: actor.email || '',
        actorRole: actor.profile.rol,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
