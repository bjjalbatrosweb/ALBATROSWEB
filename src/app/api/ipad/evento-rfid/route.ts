import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  buildKioskWelcome,
  type KioskActiveClass,
} from "@/lib/kiosk-welcome";

export const runtime = "nodejs";

const EVENT_TTL_MS = 20_000;
const RATE_WINDOW_MS = 2 * 60_000;
const RATE_LIMIT = 90;
const localRequests = new Map<string, { count: number; resetAt: number }>();

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown"
  )
    .trim()
    .slice(0, 100);
}

function allowedLocally(request: Request) {
  const now = Date.now();
  const key = clientAddress(request);
  const current = localRequests.get(key);
  if (!current || current.resetAt <= now) {
    localRequests.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

function dateKeyMerida(date = new Date()) {
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function timestampMillis(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function noEvent(serverTime = Date.now()) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Kiosk-Time": String(serverTime),
    },
  });
}

export async function GET(request: Request) {
  if (!allowedLocally(request)) {
    return NextResponse.json(
      { ok: false, mensaje: "Espera un momento antes de volver a consultar." },
      {
        status: 429,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  const now = Date.now();
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get("prime") === "1") return noEvent(now);
  const requestedAfter = Number(searchParams.get("after"));
  const after = Number.isFinite(requestedAfter)
    ? Math.max(now - EVENT_TTL_MS, Math.min(requestedAfter, now + 2_000))
    : now;

  const eventSnapshot = await adminDb.collection("KioscoEventos").doc("MMA").get();
  if (!eventSnapshot.exists) return noEvent();

  const event = eventSnapshot.data() || {};
  const occurredAt = timestampMillis(event.ocurridoEn);
  const athleteId = typeof event.alumnoId === "string" ? event.alumnoId : "";
  if (
    !athleteId ||
    occurredAt <= after ||
    occurredAt < now - EVENT_TTL_MS ||
    occurredAt > now + 2_000
  ) {
    return noEvent();
  }

  const attendanceSnapshot = await adminDb
    .collection("Asistencias")
    .where("alumnoId", "==", athleteId)
    .get();
  const attendanceDays = attendanceSnapshot.docs
    .map((document) => {
      const timestamp = document.data().fecha;
      const date =
        timestamp && typeof timestamp.toDate === "function"
          ? timestamp.toDate()
          : null;
      return date instanceof Date ? dateKeyMerida(date) : "";
    })
    .filter(Boolean);
  const activeClassData = event.claseActiva;
  const activeClass: KioskActiveClass =
    activeClassData && typeof activeClassData === "object"
      ? {
          disciplina:
            typeof activeClassData.disciplina === "string"
              ? activeClassData.disciplina.slice(0, 80)
              : "",
          tema:
            typeof activeClassData.tema === "string"
              ? activeClassData.tema.slice(0, 120)
              : "",
        }
      : null;
  const name =
    typeof event.nombre === "string" && event.nombre.trim()
      ? event.nombre.trim().split(/\s+/)[0].slice(0, 40)
      : "Atleta";

  return NextResponse.json(
    {
      ok: true,
      metodo: "RFID",
      eventoId: String(event.eventoId || "").slice(0, 80),
      ocurridoEn: occurredAt,
      nombre: name,
      duplicado: event.duplicado === true,
      mensaje:
        event.duplicado === true
          ? `${name}, tu asistencia de hoy ya estaba registrada.`
          : `¡Listo, ${name}! Tu asistencia quedó registrada con tu tarjeta.`,
      bienvenida: buildKioskWelcome(
        attendanceDays,
        dateKeyMerida(new Date(occurredAt)),
        activeClass,
      ),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
