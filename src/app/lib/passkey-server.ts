import { randomUUID } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';

export const PASSKEY_RP_NAME = 'Albatros BJJ';
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function createChallengeId() {
  return randomUUID();
}

export function challengeExpiresAt() {
  return Timestamp.fromMillis(Date.now() + PASSKEY_CHALLENGE_TTL_MS);
}

export function challengeIsValid(expiresAt: unknown) {
  return Boolean(
    expiresAt &&
      typeof expiresAt === 'object' &&
      'toMillis' in expiresAt &&
      typeof (expiresAt as { toMillis?: unknown }).toMillis === 'function' &&
      (expiresAt as { toMillis: () => number }).toMillis() > Date.now(),
  );
}

export function getPasskeyContext(request: Request) {
  const requestOrigin = request.headers.get('origin') || '';
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';
  const allowedOrigins = new Set([
    'https://albatrosbjj.com',
    'https://www.albatrosbjj.com',
    'http://localhost:9002',
    configuredOrigin,
  ].filter(Boolean));

  if (!allowedOrigins.has(requestOrigin)) {
    throw new Error('PASSKEY_ORIGIN_NOT_ALLOWED');
  }

  const hostname = new URL(requestOrigin).hostname;
  const rpID = hostname === 'albatrosbjj.com' || hostname.endsWith('.albatrosbjj.com')
    ? 'albatrosbjj.com'
    : hostname;

  return { origin: requestOrigin, rpID };
}

export function encodePublicKey(value: Uint8Array) {
  return Buffer.from(value).toString('base64url');
}

export function decodePublicKey(value: string) {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}
