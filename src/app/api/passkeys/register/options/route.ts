import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { type Sede } from '@/lib/access-control';
import { RequestAccessError, requirePanelActorAccess } from '@/lib/server-access';
import {
  challengeExpiresAt,
  createChallengeId,
  getPasskeyContext,
  PASSKEY_RP_NAME,
} from '@/lib/passkey-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sede = body.sede as Sede;
    const actor = await requirePanelActorAccess(request, sede);
    const { origin, rpID } = getPasskeyContext(request);

    const credentialsSnapshot = await adminDb
      .collection('Passkeys')
      .where('uid', '==', actor.uid)
      .get();

    const options = await generateRegistrationOptions({
      rpName: PASSKEY_RP_NAME,
      rpID,
      userID: new Uint8Array(Buffer.from(actor.uid, 'utf8')),
      userName: actor.email || actor.uid,
      userDisplayName: actor.email || `Profesor ${sede.replace('_', ' ')}`,
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
      purpose: 'register',
      uid: actor.uid,
      sede,
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
    console.error('PASSKEY_REGISTER_OPTIONS_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo preparar la passkey' }, { status });
  }
}
