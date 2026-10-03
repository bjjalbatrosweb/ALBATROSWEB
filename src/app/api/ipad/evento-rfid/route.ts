import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  buildKioskWelcome,
  type KioskActiveClass,
} from "@/lib/kiosk-welcome";

export const runtime = "nodejs";

const EVENT_TTL_MS = 3 * 60_000;
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
  if (
    process.env.NODE_ENV !== "production" &&
    searchParams.get("demo") === "idle"
  ) {
    return noEvent(now);
  }
  if (
    process.env.NODE_ENV !== "production" &&
    searchParams.get("demo") === "event"
  ) {
    return NextResponse.json(
      {
        ok: true,
        metodo: "RFID",
        permitido: true,
        estadoLed: "verde",
        eventoId: "diagnostico-ipad",
        ocurridoEn: now,
        nombre: "Atleta",
        duplicado: false,
        mensaje: "Tu asistencia quedó registrada correctamente.",
        bienvenida: {
          asistenciasSemana: 3,
          totalAsistencias: 18,
          claseActiva: { disciplina: "MMA", tema: "Entrenamiento técnico" },
          siguienteLogro: {
            nombre: "Atleta constante",
            meta: 25,
            faltan: 7,
            completado: false,
          },
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  const requestedAfter = Number(searchParams.get("after"));
  const after = Number.isFinite(requestedAfter)
    ? Math.max(now - EVENT_TTL_MS, Math.min(requestedAfter, now + 2_000))
    : now;
  const seenEventId = (searchParams.get("seen") || "").slice(0, 80);

  const eventSnapshot = await adminDb.collection("KioscoEventos").doc("MMA").get();
  if (!eventSnapshot.exists) return noEvent();

  const documentData = eventSnapshot.data() || {};
  const queuedEvents = (Array.isArray(documentData.eventos)
    ? documentData.eventos
    : [])
    .filter((item) => item && typeof item === "object")
    .sort(
      (left, right) =>
        timestampMillis(left.ocurridoEn) - timestampMillis(right.ocurridoEn),
    );
  let event: Record<string, unknown> = documentData;
  let remaining = 0;
  if (queuedEvents.length) {
    const seenIndex = seenEventId
      ? queuedEvents.findIndex(
          (item) => String(item.eventoId || "") === seenEventId,
        )
      : -1;
    const startIndex = seenIndex >= 0 ? seenIndex + 1 : 0;
    const nextIndex = seenIndex >= 0
      ? (startIndex < queuedEvents.length ? startIndex : -1)
      : queuedEvents.findIndex(
          (item) => timestampMillis(item.ocurridoEn) > after,
        );
    if (nextIndex < 0) return noEvent();
    event = queuedEvents[nextIndex];
    remaining = Math.max(0, queuedEvents.length - nextIndex - 1);
  }
  const occurredAt = timestampMillis(event.ocurridoEn);
  const athleteId = typeof event.alumnoId === "string" ? event.alumnoId : "";
  if (
    occurredAt <= after ||
    occurredAt < now - EVENT_TTL_MS ||
    occurredAt > now + 2_000
  ) {
    return noEvent();
  }

  const attendanceDays = athleteId
    ? (await adminDb
        .collection("Asistencias")
        .where("alumnoId", "==", athleteId)
        .get())
        .docs.map((document) => {
          const timestamp = document.data().fecha;
          const date =
            timestamp && typeof timestamp.toDate === "function"
              ? timestamp.toDate()
              : null;
          return date instanceof Date ? dateKeyMerida(date) : "";
        })
        .filter(Boolean)
    : [];
  const activeClassData = event.claseActiva;
  const activeClassRecord =
    activeClassData && typeof activeClassData === "object"
      ? (activeClassData as Record<string, unknown>)
      : null;
  const activeClass: KioskActiveClass =
    activeClassRecord
      ? {
          disciplina:
            typeof activeClassRecord.disciplina === "string"
              ? activeClassRecord.disciplina.slice(0, 80)
              : "",
          tema:
            typeof activeClassRecord.tema === "string"
              ? activeClassRecord.tema.slice(0, 120)
              : "",
        }
      : null;
  const name =
    typeof event.nombre === "string" && event.nombre.trim()
      ? event.nombre.trim().split(/\s+/)[0].slice(0, 40)
      : "Atleta";
  const method =
    event.metodo === "CELULAR" || event.metodo === "PIN"
      ? event.metodo
      : "RFID";
  const allowed = event.permitido !== false;
  const ledState =
    event.estadoLed === "rojo" || event.estadoLed === "amarillo"
      ? event.estadoLed
      : "verde";
  const eventMessage =
    typeof event.mensaje === "string" && event.mensaje.trim()
      ? event.mensaje.trim().slice(0, 180)
      : "";

  return NextResponse.json(
    {
      ok: true,
      metodo: method,
      permitido: allowed,
      estadoLed: ledState,
      eventoId: String(event.eventoId || "").slice(0, 80),
      ocurridoEn: occurredAt,
      nombre: name,
      duplicado: event.duplicado === true,
      mensaje: eventMessage || (event.duplicado === true
          ? `${name}, tu asistencia de hoy ya estaba registrada.`
          : method === "CELULAR"
            ? `¡Listo, ${name}! Tu asistencia se registró desde recepción.`
            : `¡Listo, ${name}! Tu asistencia quedó registrada con tu tarjeta.`),
      bienvenida: buildKioskWelcome(
        attendanceDays,
        dateKeyMerida(new Date(occurredAt)),
        activeClass,
      ),
      pendientes: remaining,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
