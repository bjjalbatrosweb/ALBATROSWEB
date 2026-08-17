import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { processOverduePaymentReminders } from '@/lib/payment-reminders-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function secureEquals(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET || '';
  const authorization = request.headers.get('authorization') || '';
  return Boolean(
    secret && secureEquals(authorization, `Bearer ${secret}`),
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const summary = await processOverduePaymentReminders();
    console.info('PAYMENT_REMINDERS_CRON_COMPLETE', summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('PAYMENT_REMINDERS_CRON_ERROR', error);
    return NextResponse.json(
      { ok: false, mensaje: 'No se pudieron procesar los recordatorios.' },
      { status: 500 },
    );
  }
}
