import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizarPerfilAcceso, puedeAdministrarSede, type Sede } from '@/lib/access-control';
import {
  challengeIsValid,
  decodePublicKey,
  getPasskeyContext,
} from '@/lib/passkey-server';

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, {
      scope: 'passkey-auth-verify',
      limit: 20,
      windowMs: 15 * 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: 'Demasiados intentos. Espera antes de intentar otra vez.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
      );
    }
    const body = await request.json();
    const response = body.response as AuthenticationResponseJSON;
    const challengeRef = adminDb.collection('PasskeyChallenges').doc(String(body.challengeId || ''));
    const challengeSnapshot = await challengeRef.get();
    const challenge = challengeSnapshot.data();
    const context = getPasskeyContext(request);

    if (
      !challengeSnapshot.exists ||
      challenge?.purpose !== 'authenticate' ||
      challenge?.sede !== body.sede ||
      challenge?.origin !== context.origin ||
      challenge?.rpID !== context.rpID ||
      !challengeIsValid(challenge?.expiresAt) ||
      !Array.isArray(challenge?.credentialIds) ||
      !challenge.credentialIds.includes(response?.id)
    ) {
      return NextResponse.json({ ok: false, mensaje: 'La solicitud biométrica expiró' }, { status: 400 });
    }

    const passkeyRef = adminDb.collection('Passkeys').doc(response.id);
    const passkeySnapshot = await passkeyRef.get();
    const passkey = passkeySnapshot.data();

    if (!passkeySnapshot.exists || !passkey?.uid || !passkey?.publicKey) {
      return NextResponse.json({ ok: false, mensaje: 'Passkey no reconocida' }, { status: 404 });
    }
    if (passkey.activo === false) {
      return NextResponse.json({ ok: false, mensaje: 'Este acceso biométrico está bloqueado' }, { status: 403 });
    }

    const credential: WebAuthnCredential = {
      id: response.id,
      publicKey: decodePublicKey(passkey.publicKey),
      counter: Number(passkey.counter || 0),
      transports: passkey.transports || undefined,
    };

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpID,
      credential,
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return NextResponse.json({ ok: false, mensaje: 'No se pudo verificar tu identidad' }, { status: 401 });
    }

    const userSnapshot = await adminDb.collection('usuarios').doc(passkey.uid).get();
    const userProfile = userSnapshot.exists
      ? normalizarPerfilAcceso(userSnapshot.data() || {})
      : null;
    if (
      !userProfile ||
      !userProfile.activo ||
      !puedeAdministrarSede(userProfile, challenge.sede as Sede)
    ) {
      return NextResponse.json({ ok: false, mensaje: 'La cuenta ya no está activa' }, { status: 403 });
    }

    const batch = adminDb.batch();
    batch.update(passkeyRef, {
      counter: verification.authenticationInfo.newCounter,
      credentialBackedUp: verification.authenticationInfo.credentialBackedUp,
      ultimoUso: FieldValue.serverTimestamp(),
    });
    batch.delete(challengeRef);
    await batch.commit();

    const customToken = await adminAuth.createCustomToken(passkey.uid, {
      passkey: true,
      sede: challenge.sede,
    });

    return NextResponse.json({ ok: true, customToken });
  } catch (error) {
    console.error('PASSKEY_AUTH_VERIFY_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo completar el acceso biométrico' }, { status: 500 });
  }
}
