import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  kioskAthleteFromPin,
  publicAthleteName,
} from "@/lib/kiosk-athlete-server";
import { isPaymentExempt } from "@/lib/member-role";
import {
  checkRateLimit,
  checkRateLimitForIdentifier,
} from "@/lib/rate-limit";
import { kioskPinDigest, normalizeKioskPin } from "@/lib/kiosk-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timestampMillis(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return Number((value as { toMillis: () => number }).toMillis()) || 0;
  }
  return 0;
}

function dateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dayKey(date: Date) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function mondayFor(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date));
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function previousWeek(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date));
  value.setUTCDate(value.getUTCDate() - 7);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function attendanceSummary(values: unknown[]) {
  const today = dayKey(new Date());
  const period = today.slice(0, 7);
  const days = new Set(
    values
      .map((value) => timestampMillis(value))
      .filter((value) => value > 0)
      .map((value) => dayKey(new Date(value)))
      .filter((value) => value <= today),
  );
  const currentMonday = mondayFor(today);
  const weekStarts = new Set(Array.from(days).map(mondayFor));
  let cursor = weekStarts.has(currentMonday)
    ? currentMonday
    : previousWeek(currentMonday);
  let streak = 0;
  while (weekStarts.has(cursor)) {
    streak += 1;
    cursor = previousWeek(cursor);
  }
  return {
    today: days.has(today),
    week: Array.from(days).filter((value) => value >= currentMonday).length,
    month: Array.from(days).filter((value) => value.startsWith(period)).length,
    streakWeeks: streak,
    total: days.size,
  };
}

function currentPeriod() {
  const parts = dateParts();
  return `${parts.year}-${parts.month}`;
}

function paymentPeriodFromTimestamp(value: unknown) {
  const millis = timestampMillis(value);
  if (!millis) return "";
  const parts = dateParts(new Date(millis));
  return `${parts.year}-${parts.month}`;
}

function dueDate(period: string, paymentDay: number) {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(paymentDay, lastDay)).padStart(2, "0")}`;
}

function nextPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  const value = new Date(Date.UTC(year, month, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, mensaje: message }, { status });
}

export async function POST(request: Request) {
  try {
    const ipRate = await checkRateLimit(request, {
      scope: "ipad-mi-cuenta",
      limit: 24,
      windowMs: 10 * 60_000,
    });
    if (!ipRate.allowed) return fail("Demasiados intentos. Espera unos minutos.", 429);
    const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
    const pin = normalizeKioskPin(body?.pin);
    if (!/^\d{4}$/.test(pin)) return fail("Ingresa los 4 dígitos de tu PIN.", 400);
    const pinRate = await checkRateLimitForIdentifier(kioskPinDigest(pin), {
      scope: "ipad-mi-cuenta-pin",
      limit: 8,
      windowMs: 10 * 60_000,
    });
    if (!pinRate.allowed) return fail("Espera unos minutos antes de intentarlo nuevamente.", 429);

    const athlete = await kioskAthleteFromPin(pin);
    if (!athlete || !athlete.active) return fail("PIN incorrecto o no disponible.", 401);

    const period = currentPeriod();
    const requestId = `${athlete.id}_${period.replace("-", "")}`;
    const [attendance, payments, pendingRequest, activeClass, passes, userProfile, futureClasses] =
      await Promise.all([
        adminDb.collection("Asistencias").where("alumnoId", "==", athlete.id).limit(500).get(),
        adminDb.collection("Pagos").where("alumnoId", "==", athlete.id).limit(100).get(),
        adminDb.collection("SolicitudesPago").doc(requestId).get(),
        adminDb.collection("ClasesActivas").doc("MMA").get(),
        adminDb.collection("PasesInvitados").where("createdBy", "==", `kiosco-ipad:${athlete.id}`).limit(20).get(),
        adminDb.collection("usuarios").where("alumnoId", "==", athlete.id).limit(1).get(),
        adminDb.collection("ReservasClases").where("sede", "==", "MMA").limit(100).get(),
      ]);

    const paidCurrent = payments.docs.some((document) => {
      const data = document.data();
      return (
        document.id === requestId ||
        String(data.periodo || "") === period ||
        paymentPeriodFromTimestamp(data.fecha) === period
      );
    });
    const legacyPaid =
      athlete.paymentStatus === "Pagado" &&
      (athlete.lastPaymentPeriod === period ||
        paymentPeriodFromTimestamp(athlete.lastPaymentAt) === period ||
        (!athlete.lastPaymentPeriod && !paymentPeriodFromTimestamp(athlete.lastPaymentAt)));
    const exempt = isPaymentExempt(athlete.role);
    const paid = exempt || paidCurrent || legacyPaid;
    const pending = pendingRequest.exists && pendingRequest.data()?.estado === "pendiente";
    const todayNumber = Number(dateParts().day);
    const paymentStatus = exempt
      ? "exento"
      : paid
        ? "pagado"
        : pending
          ? "solicitud_pendiente"
          : todayNumber > athlete.paymentDay
            ? "vencido"
            : "pendiente";
    const nextDuePeriod = paid ? nextPeriod(period) : period;

    const now = Date.now();
    const validPasses = passes.docs
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          active: data.active,
          uses: data.uses,
          maxUses: data.maxUses,
          validUntil: data.validUntil,
          guestName: data.guestName,
        };
      })
      .filter((pass) =>
        pass.active === true &&
        Number(pass.uses || 0) < Math.max(1, Number(pass.maxUses) || 1) &&
        timestampMillis(pass.validUntil) >= now,
      )
      .sort((left, right) => timestampMillis(left.validUntil) - timestampMillis(right.validUntil));

    let nextReservation: null | {
      name: string;
      discipline: string;
      startsAt: string;
    } = null;
    const userId = userProfile.docs[0]?.id || "";
    if (userId) {
      const classes = futureClasses.docs
        .filter((document) => {
          const data = document.data();
          return data.estado === "publicada" && timestampMillis(data.inicio) > now;
        })
        .sort((left, right) => timestampMillis(left.data().inicio) - timestampMillis(right.data().inicio))
        .slice(0, 20);
      if (classes.length) {
        const enrollments = await adminDb.getAll(
          ...classes.map((document) => document.ref.collection("inscripciones").doc(userId)),
        );
        const index = enrollments.findIndex(
          (document) => document.exists && document.data()?.estado === "confirmada",
        );
        if (index >= 0) {
          const classData = classes[index].data();
          nextReservation = {
            name: String(classData.nombre || "Clase").slice(0, 80),
            discipline: String(classData.disciplina || "Entrenamiento").slice(0, 50),
            startsAt: new Date(timestampMillis(classData.inicio)).toISOString(),
          };
        }
      }
    }

    const activeClassData = activeClass.data() || {};
    return NextResponse.json(
      {
        ok: true,
        athlete: {
          name: publicAthleteName(athlete.name),
          discipline: athlete.discipline,
        },
        payment: {
          status: paymentStatus,
          amount: exempt ? 0 : athlete.amount,
          period,
          dueDate: dueDate(nextDuePeriod, athlete.paymentDay),
          pendingRequest: pending,
        },
        attendance: attendanceSummary(attendance.docs.map((document) => document.data().fecha)),
        activeClass: activeClass.exists && activeClassData.claseId
          ? {
              discipline: String(activeClassData.disciplina || "Clase activa").slice(0, 50),
              topic: String(activeClassData.tema || "").slice(0, 100),
            }
          : null,
        nextReservation,
        passes: {
          active: validPasses.length,
          guests: validPasses.slice(0, 3).map((pass) => publicAthleteName(String(pass.guestName || "Invitado"))),
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("ERROR_IPAD_MI_CUENTA:", error);
    return fail("No se pudo consultar tu cuenta. Inténtalo nuevamente.", 500);
  }
}
