import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  isValidKioskPin,
  kioskPinDigest,
  normalizeKioskPin,
} from "@/lib/kiosk-pin";
import { buildKioskWelcome } from "@/lib/kiosk-welcome";
import {
  checkRateLimit,
  checkRateLimitForIdentifier,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

function fechaMerida(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

async function registrarEnClaseActiva(datos: {
  alumnoId: string;
  nombre: string;
  fecha: Date;
}) {
  const activa = await adminDb.collection("ClasesActivas").doc("MMA").get();
  const clase = activa.exists ? activa.data() || {} : {};
  const claseId = typeof clase.claseId === "string" ? clase.claseId : "";
  if (!claseId) return { registrado: false, clase: null };

  const claseActiva = {
    disciplina:
      typeof clase.disciplina === "string" ? clase.disciplina.trim() : "",
    tema: typeof clase.tema === "string" ? clase.tema.trim() : "",
  };

  const reference = adminDb
    .collection("AsistenciasClase")
    .doc(`${claseId}_${datos.alumnoId}`);
  const registrado = await adminDb.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    if (current.exists) return false;
    transaction.create(reference, {
      claseId,
      alumnoId: datos.alumnoId,
      nombre: datos.nombre,
      sede: "MMA",
      disciplina: String(clase.disciplina || ""),
      dispositivo: "Kiosco iPad",
      metodo: "PIN",
      fecha: Timestamp.fromDate(datos.fecha),
    });
    return true;
  });
  return { registrado, clase: claseActiva };
}

function denied(message: string, status: number, retryAfter?: number) {
  const response = NextResponse.json({ ok: false, mensaje: message }, { status });
  if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
  return response;
}

export async function POST(request: Request) {
  try {
    const ipLimit = await checkRateLimit(request, {
      scope: "ipad-attendance-ip",
      limit: 40,
      windowMs: 10 * 60_000,
    });
    if (!ipLimit.allowed) {
      return denied(
        "Demasiados intentos. Espera un momento antes de continuar.",
        429,
        ipLimit.retryAfter,
      );
    }

    const body = (await request.json().catch(() => null)) as {
      pin?: unknown;
    } | null;
    const pin = normalizeKioskPin(body?.pin);
    if (!isValidKioskPin(pin)) {
      return denied("Ingresa los 4 dígitos de tu PIN.", 400);
    }

    const digest = kioskPinDigest(pin);
    const pinLimit = await checkRateLimitForIdentifier(digest, {
      scope: "ipad-attendance-pin",
      limit: 6,
      windowMs: 10 * 60_000,
    });
    if (!pinLimit.allowed) {
      return denied(
        "Este PIN tiene demasiados intentos. Espera unos minutos.",
        429,
        pinLimit.retryAfter,
      );
    }

    const pinSnapshot = await adminDb.collection("KioscoPins").doc(digest).get();
    const pinData = pinSnapshot.data() || {};
    const alumnoId = String(pinData.alumnoId || "");
    if (
      !pinSnapshot.exists ||
      pinData.activo !== true ||
      pinData.sede !== "MMA" ||
      !alumnoId
    ) {
      return denied("PIN incorrecto o no disponible.", 401);
    }

    const alumnoRef = adminDb.collection("Alumnos").doc(alumnoId);
    const alumnoSnapshot = await alumnoRef.get();
    const alumno = alumnoSnapshot.data() || {};
    if (
      !alumnoSnapshot.exists ||
      alumno.activo === false ||
      String(alumno.sede || "").trim().toUpperCase() !== "MMA"
    ) {
      return denied("PIN incorrecto o no disponible.", 401);
    }

    const ahora = new Date();
    const dia = fechaMerida(ahora);
    const nombre = String(alumno.nombre || pinData.nombre || "Atleta");
    const asistenciaId = `${alumnoId}_${dia.replaceAll("-", "")}`;

    const asistenciasPrevias = await adminDb
      .collection("Asistencias")
      .where("alumnoId", "==", alumnoId)
      .get();
    const diasRegistrados = asistenciasPrevias.docs
      .map((documento) => {
        const fecha = documento.data().fecha;
        const fechaDate =
          fecha && typeof fecha.toDate === "function" ? fecha.toDate() : null;
        return fechaDate instanceof Date ? fechaMerida(fechaDate) : "";
      })
      .filter(Boolean);
    const yaRegistroHoy = asistenciasPrevias.docs.some((documento) => {
      const fecha = documento.data().fecha;
      const fechaDate =
        fecha && typeof fecha.toDate === "function" ? fecha.toDate() : null;
      return fechaDate instanceof Date && fechaMerida(fechaDate) === dia;
    });

    const registroClase = await registrarEnClaseActiva({
      alumnoId,
      nombre,
      fecha: ahora,
    });
    const asistenciaClase = registroClase.registrado;
    const bienvenida = buildKioskWelcome(
      diasRegistrados,
      dia,
      registroClase.clase,
    );

    if (yaRegistroHoy) {
      return NextResponse.json({
        ok: true,
        duplicado: true,
        asistenciaClase,
        bienvenida,
        nombre,
        mensaje: asistenciaClase
          ? `${nombre}, ya habías registrado tu entrada y ahora quedaste en la clase activa.`
          : `${nombre}, tu asistencia de hoy ya estaba registrada.`,
      });
    }

    const asistenciaRef = adminDb.collection("Asistencias").doc(asistenciaId);
    const auditRef = adminDb
      .collection("Auditoria")
      .doc("MMA")
      .collection("movimientos")
      .doc();
    const creado = await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(asistenciaRef);
      if (current.exists) return false;
      transaction.create(asistenciaRef, {
        alumnoId,
        nombre,
        sede: "MMA",
        fecha: Timestamp.fromDate(ahora),
        acceso: "permitido",
        dispositivo: "Kiosco iPad",
        metodo: "PIN",
        origen: "kiosco-ipad",
        registroManual: false,
        registroOffline: false,
        sincronizadoEn: null,
      });
      transaction.create(auditRef, {
        action: "agregar_asistencia",
        entity: "asistencia",
        entityId: asistenciaId,
        entityName: nombre,
        summary: `El kiosco iPad registró la asistencia de ${nombre} mediante PIN.`,
        reason: "Registro presencial mediante PIN individual.",
        details: { alumnoId, fecha: dia, metodo: "PIN" },
        before: null,
        after: null,
        sede: "MMA",
        actorUid: "kiosco-ipad",
        actorName: "Kiosco iPad",
        actorEmail: "",
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    return NextResponse.json({
      ok: true,
      duplicado: !creado,
      asistenciaClase,
      bienvenida,
      nombre,
      mensaje: creado
        ? `¡Listo, ${nombre}! Tu asistencia quedó registrada.`
        : `${nombre}, tu asistencia de hoy ya estaba registrada.`,
    });
  } catch (error) {
    console.error("ERROR_IPAD_ASISTENCIA:", error);
    return NextResponse.json(
      {
        ok: false,
        mensaje: "No se pudo registrar la asistencia. Inténtalo nuevamente.",
      },
      { status: 500 },
    );
  }
}
