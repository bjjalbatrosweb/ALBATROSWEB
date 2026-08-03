import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  challengeIsValid,
  encodePublicKey,
  getPasskeyContext,
} from '@/lib/passkey-server';
import { RequestAccessError, requireAdminActorAccess } from '@/lib/server-access';

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const body = await request.json();
    const context = getPasskeyContext(request);
    const challengeRef = adminDb.collection('PasskeyChallenges').doc(String(body.challengeId || ''));
    const challengeSnapshot = await challengeRef.get();
    const challenge = challengeSnapshot.data();

    if (
      !challengeSnapshot.exists ||
      challenge?.purpose !== 'admin-register' ||
      challenge?.actorUid !== actor.uid ||
      challenge?.origin !== context.origin ||
      challenge?.rpID !== context.rpID ||
      !challengeIsValid(challenge?.expiresAt)
    ) {
      return NextResponse.json({ ok: false, mensaje: 'El registro biométrico expiró' }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ ok: false, mensaje: 'No se pudo verificar el dispositivo' }, { status: 400 });
    }

    const targetUser = await adminAuth.getUser(String(challenge.targetUid));
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const batch = adminDb.batch();
    batch.set(adminDb.collection('Passkeys').doc(credential.id), {
      uid: challenge.targetUid,
      email: targetUser.email || '',
      nombrePersona: challenge.nombrePersona,
      funcion: challenge.funcion,
      sedes: challenge.sedes,
      activo: true,
      credentialId: credential.id,
      publicKey: encodePublicKey(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || body.response?.response?.transports || [],
      credentialDeviceType,
      credentialBackedUp,
      nombre: String(body.deviceName || 'Dispositivo personal'),
      creadoEn: FieldValue.serverTimestamp(),
      ultimoUso: FieldValue.serverTimestamp(),
      creadoPor: actor.uid,
    });
    batch.delete(challengeRef);
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    console.error('ADMIN_PASSKEY_REGISTER_VERIFY_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo guardar la credencial biométrica' }, { status: 500 });
  }
}
