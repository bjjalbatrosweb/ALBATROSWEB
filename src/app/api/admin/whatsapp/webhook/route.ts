import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  processWhatsAppWebhook,
  type WhatsAppWebhookPayload,
  verifyWhatsAppSignature,
} from '@/lib/whatsapp-bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenValido(received: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    token &&
    challenge &&
    tokenValido(token, process.env.WHATSAPP_VERIFY_TOKEN)
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json(
    { error: 'Verificación de webhook rechazada' },
    { status: 403 },
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256') || '';

  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: 'Firma de Meta inválida' },
      { status: 401 },
    );
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  await processWhatsAppWebhook(payload);
  return NextResponse.json({ received: true });
}
