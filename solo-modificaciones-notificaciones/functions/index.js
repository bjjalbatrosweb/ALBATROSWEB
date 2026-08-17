import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
  TIME_ZONE,
  datePartsInTimeZone,
  isOverdueStudent,
  paymentPeriod,
  reminderPayload,
} from "./payment-reminders.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const messaging = getMessaging();
const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function reserveReminder(student, period) {
  const reference = db
    .collection("RecordatoriosPago")
    .doc(`${period}_${student.id}`);
  const reserved = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data() || {};
    const updatedAt = data.actualizadoEn?.toMillis?.() || 0;
    const recentlySending =
      data.estado === "enviando" && Date.now() - updatedAt < 20 * 60 * 1000;

    if (data.estado === "enviado" || recentlySending) return false;

    transaction.set(
      reference,
      {
        alumnoId: student.id,
        nombre: String(student.nombre || "Atleta").slice(0, 160),
        sede: student.sede || null,
        periodo: period,
        estado: "enviando",
        intentos: FieldValue.increment(1),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });

  return { reference, reserved };
}

async function disableInvalidDevices(invalidReferences) {
  for (const group of chunks(invalidReferences, 450)) {
    const batch = db.batch();
    group.forEach((reference) => {
      batch.set(
        reference,
        {
          activo: false,
          error: "token_no_registrado",
          actualizadoEn: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
}

async function sendStudentReminder(student, deviceEntries, parts) {
  const payload = reminderPayload(student, parts);
  const { reference, reserved } = await reserveReminder(student, payload.period);
  if (!reserved) return { status: "duplicate", sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const invalidReferences = [];

  try {
    for (const group of chunks(deviceEntries, 500)) {
      const response = await messaging.sendEachForMulticast({
        tokens: group.map((entry) => entry.token),
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url,
          tag: payload.tag,
        },
        webpush: {
          headers: {
            TTL: "86400",
            Urgency: "normal",
          },
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
        estado: sent > 0 ? "enviado" : "fallido",
        enviados: sent,
        fallidos: failed,
        vencioDia: payload.dueDay,
        enviadoEn: sent > 0 ? FieldValue.serverTimestamp() : null,
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { status: sent > 0 ? "sent" : "failed", sent, failed };
  } catch (error) {
    await reference.set(
      {
        estado: "fallido",
        error: String(error?.message || error).slice(0, 500),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
}

export const recordatoriosPagoVencido = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: TIME_ZONE,
    region: "us-central1",
    retryCount: 2,
  },
  async () => {
    const parts = datePartsInTimeZone();
    const period = paymentPeriod(parts);
    const [studentsSnapshot, paymentsSnapshot, devicesSnapshot] =
      await Promise.all([
        db.collection("Alumnos").get(),
        db.collection("Pagos").where("periodo", "==", period).get(),
        db
          .collection("DispositivosNotificacion")
          .where("activo", "==", true)
          .get(),
      ]);

    const paidStudentIds = new Set(
      paymentsSnapshot.docs
        .map((document) => String(document.data().alumnoId || ""))
        .filter(Boolean),
    );
    const devicesByStudent = new Map();
    devicesSnapshot.docs.forEach((document) => {
      const data = document.data();
      const studentId = String(data.alumnoId || "");
      const token = String(data.token || "");
      if (!studentId || token.length < 40) return;
      const current = devicesByStudent.get(studentId) || [];
      current.push({ token, reference: document.ref });
      devicesByStudent.set(studentId, current);
    });

    const overdueStudents = studentsSnapshot.docs
      .map((document) => ({ ...document.data(), id: document.id }))
      .filter((student) => isOverdueStudent(student, paidStudentIds, parts))
      .filter((student) => (devicesByStudent.get(student.id) || []).length > 0);

    const summary = { sent: 0, failed: 0, duplicate: 0 };
    for (const student of overdueStudents) {
      try {
        const result = await sendStudentReminder(
          student,
          devicesByStudent.get(student.id),
          parts,
        );
        summary.sent += result.sent;
        summary.failed += result.failed;
        if (result.status === "duplicate") summary.duplicate += 1;
      } catch (error) {
        summary.failed += 1;
        logger.error("No se pudo enviar un recordatorio de pago", {
          alumnoId: student.id,
          error: String(error?.message || error),
        });
      }
    }

    logger.info("Recordatorios de pago procesados", {
      periodo: period,
      alumnosVencidosConDispositivo: overdueStudents.length,
      ...summary,
    });
  },
);
