import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';

import { normalizarPerfilAcceso, type PerfilAcceso, type Sede } from '@/lib/access-control';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  challengeExpiresAt,
  createChallengeId,
  getPasskeyContext,
  PASSKEY_RP_NAME,
} from '@/lib/passkey-server';
import { RequestAccessError, requireAdminActorAccess } from '@/lib/server-access';

const SEDES: Sede[] = ['MMA', 'CAUCEL', 'JUAN_PABLO'];

function sedesPermitidas(perfil: PerfilAcceso): Sede[] {
  if (perfil.sede === 'TODAS') return SEDES;
  return Array.from(new Set([
    ...(perfil.sede ? [perfil.sede] : []),
    ...(perfil.sedes || []),
  ]));
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const body = await request.json();
    const targetUid = String(body.uid || '');
    const nombrePersona = String(body.nombrePersona || '').trim();
    const sedes: Sede[] = Array.isArray(body.sedes)
      ? Array.from(new Set(body.sedes.filter((item: unknown): item is Sede => SEDES.includes(item as Sede))))
      : [];

    const profileSnapshot = await adminDb.collection('usuarios').doc(targetUid).get();
    const perfil = profileSnapshot.exists
      ? normalizarPerfilAcceso(profileSnapshot.data() || {})
      : null;

    if (!perfil || !perfil.activo || !nombrePersona || sedes.length === 0) {
      return NextResponse.json({ ok: false, mensaje: 'La asignación biométrica está incompleta' }, { status: 400 });
    }
    const permitidas = sedesPermitidas(perfil);
    if (sedes.some((sede) => !permitidas.includes(sede))) {
      return NextResponse.json({ ok: false, mensaje: 'La cuenta no tiene acceso a las sedes elegidas' }, { status: 400 });
    }

    const [targetUser, credentialsSnapshot] = await Promise.all([
      adminAuth.getUser(targetUid),
      adminDb.collection('Passkeys').where('uid', '==', targetUid).get(),
    ]);
    const { origin, rpID } = getPasskeyContext(request);
    const options = await generateRegistrationOptions({
      rpName: PASSKEY_RP_NAME,
      rpID,
      userID: new Uint8Array(Buffer.from(targetUid, 'utf8')),
      userName: targetUser.email || targetUid,
      userDisplayName: nombrePersona,
      attestationType: 'none',
      timeout: 60_000,
      excludeCredentials: credentialsSnapshot.docs.map((item) => ({
        id: item.id,
        transports: item.data().transports || undefined,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      preferredAuthenticatorType: 'localDevice',
    });

    const challengeId = createChallengeId();
    await adminDb.collection('PasskeyChallenges').doc(challengeId).set({
      challenge: options.challenge,
      purpose: 'admin-register',
      actorUid: actor.uid,
      targetUid,
      nombrePersona,
      funcion: perfil.rol,
      sedes,
      origin,
      rpID,
      expiresAt: challengeExpiresAt(),
    });

    return NextResponse.json({ ok: true, challengeId, options });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    const status = error instanceof Error && error.message === 'PASSKEY_ORIGIN_NOT_ALLOWED' ? 403 : 500;
    console.error('ADMIN_PASSKEY_REGISTER_OPTIONS_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo preparar el registro biométrico' }, { status });
  }
}
