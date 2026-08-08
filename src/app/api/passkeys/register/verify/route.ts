import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { type Sede } from '@/lib/access-control';
import { checkRateLimitForIdentifier } from '@/lib/rate-limit';
import { RequestAccessError, requirePanelActorAccess } from '@/lib/server-access';
import {
  challengeIsValid,
  encodePublicKey,
  getPasskeyContext,
} from '@/lib/passkey-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sede = body.sede as Sede;
    const actor = await requirePanelActorAccess(request, sede);
    const rate = checkRateLimitForIdentifier(actor.uid, {
      scope: 'passkey-register-verify',
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: 'Demasiados intentos de registro.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
      );
    }
    const context = getPasskeyContext(request);
    const challengeRef = adminDb.collection('PasskeyChallenges').doc(String(body.challengeId || ''));
    const challengeSnapshot = await challengeRef.get();
    const challenge = challengeSnapshot.data();

    if (
      !challengeSnapshot.exists ||
      challenge?.purpose !== 'register' ||
      challenge?.uid !== actor.uid ||
      challenge?.sede !== sede ||
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

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const batch = adminDb.batch();
    batch.set(adminDb.collection('Passkeys').doc(credential.id), {
      uid: actor.uid,
      email: actor.email || '',
      sedes: actor.profile.sedes,
      credentialId: credential.id,
      publicKey: encodePublicKey(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || body.response?.response?.transports || [],
      credentialDeviceType,
      credentialBackedUp,
      nombre: body.deviceName || 'Dispositivo personal',
      creadoEn: FieldValue.serverTimestamp(),
      ultimoUso: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.delete(challengeRef);
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    }
    console.error('PASSKEY_REGISTER_VERIFY_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo registrar el acceso biométrico' }, { status: 500 });
  }
}
