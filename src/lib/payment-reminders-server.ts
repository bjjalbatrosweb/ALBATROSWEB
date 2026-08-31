import 'server-only';

import type { DocumentReference } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

import { adminDb, adminMessaging } from '@/lib/firebase-admin';
import { isBillableAthlete } from '@/lib/member-role';

const TIME_ZONE = 'America/Merida';
const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

type DateParts = { year: number; month: number; day: number };
type PaymentStudent = {
  id: string;
  nombre?: unknown;
  sede?: unknown;
  activo?: unknown;
  rol?: unknown;
  diaPago?: unknown;
  estadoPago?: unknown;
  periodoUltimoPago?: unknown;
  fechaUltimoPago?: unknown;
};
type DeviceEntry = {
  token: string;
  reference: DocumentReference;
};

function datePartsInTimeZone(date = new Date()): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function paymentPeriod(parts: DateParts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function effectiveDueDay(rawDueDay: unknown, parts: DateParts) {
  const normalized = Math.min(
    31,
    Math.max(1, Math.trunc(Number(rawDueDay) || 1)),
  );
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return Math.min(normalized, lastDay);
}

function paymentPeriodFromDate(value: unknown) {
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    date = value.toDate();
  }

  if (!date || Number.isNaN(date.getTime())) return '';
  return paymentPeriod(datePartsInTimeZone(date));
}

function isPaidForPeriod(
  student: PaymentStudent,
  paidStudentIds: Set<string>,
  period: string,
) {
  const lastPaymentPeriod = paymentPeriodFromDate(student.fechaUltimoPago);
  const legacyPaidRecord =
    student.estadoPago === 'Pagado' &&
    !student.periodoUltimoPago &&
    !lastPaymentPeriod;

  return (
    paidStudentIds.has(student.id) ||
    String(student.periodoUltimoPago || '') === period ||
    lastPaymentPeriod === period ||
    legacyPaidRecord
  );
}

function isOverdueStudent(
  student: PaymentStudent,
  paidStudentIds: Set<string>,
  parts: DateParts,
) {
  return (
    student.activo !== false &&
    isBillableAthlete(student.rol) &&
    !isPaidForPeriod(student, paidStudentIds, paymentPeriod(parts)) &&
    parts.day > effectiveDueDay(student.diaPago, parts)
  );
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function reserveReminder(student: PaymentStudent, period: string) {
  const reference = adminDb
    .collection('RecordatoriosPago')
    .doc(`${period}_${student.id}`);
  const reserved = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data() || {};
    const updatedAt = data.actualizadoEn?.toMillis?.() || 0;
    const recentlySending =
      data.estado === 'enviando' && Date.now() - updatedAt < 20 * 60 * 1000;

    if (data.estado === 'enviado' || recentlySending) return false;

    transaction.set(
      reference,
      {
        alumnoId: student.id,
        nombre: String(student.nombre || 'Atleta').slice(0, 160),
        sede: student.sede || null,
        periodo: period,
        estado: 'enviando',
        intentos: FieldValue.increment(1),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });

  return { reference, reserved };
}

async function disableInvalidDevices(references: DocumentReference[]) {
  for (const group of chunks(references, 450)) {
    const batch = adminDb.batch();
    group.forEach((reference) => {
      batch.set(
        reference,
        {
          activo: false,
          error: 'token_no_registrado',
          actualizadoEn: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
}

async function sendStudentReminder(
  student: PaymentStudent,
  devices: DeviceEntry[],
  parts: DateParts,
) {
  const period = paymentPeriod(parts);
  const dueDay = effectiveDueDay(student.diaPago, parts);
  const firstName =
    String(student.nombre || 'Atleta').trim().split(/\s+/)[0] || 'Atleta';
  const { reference, reserved } = await reserveReminder(student, period);
  if (!reserved) return { status: 'duplicate', sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const invalidReferences: DocumentReference[] = [];

  try {
    for (const group of chunks(devices, 500)) {
      const response = await adminMessaging.sendEachForMulticast({
        tokens: group.map((entry) => entry.token),
        data: {
          title: 'Pago pendiente · ALBATROS',
          body: `Hola ${firstName}, tu mensualidad está pendiente. Abre Mi Academia para consultar los detalles.`,
          url: '/mi-academia',
          tag: `pago-${period}`,
        },
        webpush: {
          headers: { TTL: '86400', Urgency: 'normal' },
        },
      });

      sent += response.successCount;
      failed += response.failureCount;
      response.responses.forEach((result, index) => {
        if (
          !result.success &&
          result.error?.code &&
          INVALID_TOKEN_CODES.has(result.error.code)
        ) {
          invalidReferences.push(group[index].reference);
        }
      });
    }

    if (invalidReferences.length) {
      await disableInvalidDevices(invalidReferences);
    }

    await reference.set(
      {
        estado: sent > 0 ? 'enviado' : 'fallido',
        enviados: sent,
        fallidos: failed,
        vencioDia: dueDay,
        enviadoEn: sent > 0 ? FieldValue.serverTimestamp() : null,
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { status: sent > 0 ? 'sent' : 'failed', sent, failed };
  } catch (error) {
    await reference.set(
      {
        estado: 'fallido',
        error: String(error instanceof Error ? error.message : error).slice(
          0,
          500,
        ),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
}

export async function processOverduePaymentReminders() {
  const parts = datePartsInTimeZone();
  const period = paymentPeriod(parts);
  const [studentsSnapshot, paymentsSnapshot, devicesSnapshot] =
    await Promise.all([
      adminDb.collection('Alumnos').get(),
      adminDb.collection('Pagos').where('periodo', '==', period).get(),
      adminDb
        .collection('DispositivosNotificacion')
        .where('activo', '==', true)
        .get(),
    ]);

  const paidStudentIds = new Set(
    paymentsSnapshot.docs
      .map((document) => String(document.data().alumnoId || ''))
      .filter(Boolean),
  );
  const devicesByStudent = new Map<string, DeviceEntry[]>();
  devicesSnapshot.docs.forEach((document) => {
    const data = document.data();
    const studentId = String(data.alumnoId || '');
    const token = String(data.token || '');
    if (!studentId || token.length < 40) return;
    const current = devicesByStudent.get(studentId) || [];
    current.push({ token, reference: document.ref });
    devicesByStudent.set(studentId, current);
  });

  const overdueStudents = studentsSnapshot.docs
    .map((document) => ({ ...document.data(), id: document.id }))
    .filter((student) => isOverdueStudent(student, paidStudentIds, parts))
    .filter((student) => (devicesByStudent.get(student.id) || []).length > 0);

  const summary = {
    period,
    overdueStudents: overdueStudents.length,
    sent: 0,
    failed: 0,
    duplicate: 0,
  };
  for (const student of overdueStudents) {
    try {
      const result = await sendStudentReminder(
        student,
        devicesByStudent.get(student.id) || [],
        parts,
      );
      summary.sent += result.sent;
      summary.failed += result.failed;
      if (result.status === 'duplicate') summary.duplicate += 1;
    } catch (error) {
      summary.failed += 1;
      console.error('PAYMENT_REMINDER_SEND_ERROR', {
        alumnoId: student.id,
        error: String(error instanceof Error ? error.message : error),
      });
    }
  }

  return summary;
}
