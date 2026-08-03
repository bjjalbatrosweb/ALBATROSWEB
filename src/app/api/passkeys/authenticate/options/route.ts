import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import {
  challengeExpiresAt,
  createChallengeId,
  getPasskeyContext,
} from '@/lib/passkey-server';

const EMAIL_POR_SEDE = {
  MMA: 'mma@albatrosbjj.com',
  CAUCEL: 'caucel@albatrosbjj.com',
  JUAN_PABLO: 'juanpablo@albatrosbjj.com',
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sede = String(body.sede || '') as keyof typeof EMAIL_POR_SEDE;
    const email = EMAIL_POR_SEDE[sede];

    if (!email) {
      return NextResponse.json({ ok: false, mensaje: 'Sede inválida' }, { status: 400 });
    }

    const { origin, rpID } = getPasskeyContext(request);
    const credentialsSnapshot = await adminDb
      .collection('Passkeys')
      .where('email', '==', email)
      .get();

    if (credentialsSnapshot.empty) {
      return NextResponse.json(
        { ok: false, mensaje: 'Esta sede todavía no tiene una passkey registrada' },
        { status: 404 },
      );
    }

    const credentials = credentialsSnapshot.docs.filter((item) => {
      const sedes = item.data().sedes;
      return !Array.isArray(sedes) || sedes.includes(sede);
    });

    const options = await generateAuthenticationOptions({
      rpID,
      timeout: 60_000,
      userVerification: 'required',
      allowCredentials: credentials.map((item) => ({
        id: item.id,
        transports: item.data().transports || undefined,
      })),
    });

    const challengeId = createChallengeId();
    await adminDb.collection('PasskeyChallenges').doc(challengeId).set({
      challenge: options.challenge,
      purpose: 'authenticate',
      sede,
      credentialIds: credentials.map((item) => item.id),
      origin,
      rpID,
      expiresAt: challengeExpiresAt(),
    });

    return NextResponse.json({ ok: true, challengeId, options });
  } catch (error) {
    const status = error instanceof Error && error.message === 'PASSKEY_ORIGIN_NOT_ALLOWED' ? 403 : 500;
    console.error('PASSKEY_AUTH_OPTIONS_ERROR:', error);
    return NextResponse.json({ ok: false, mensaje: 'No se pudo iniciar el acceso biométrico' }, { status });
  }
}
