import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";
import type { Sede } from "@/lib/access-control";

export const runtime = "nodejs";

const SEDES_VALIDAS: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];

function normalizarSede(valor: unknown): Sede | null {
  if (typeof valor !== "string") return null;
  const sede = valor.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SEDES_VALIDAS.includes(sede) ? sede : null;
}

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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      alumnoId?: unknown;
      sede?: unknown;
      fecha?: unknown;
    } | null;
    const alumnoId =
      typeof body?.alumnoId === "string" ? body.alumnoId.trim() : "";
    const sede = normalizarSede(body?.sede);

    if (!alumnoId || !sede) {
      return NextResponse.json(
        { ok: false, mensaje: "Alumno o sede inválidos." },
        { status: 400 },
      );
    }

    const actor = await requirePanelActorAccess(request, sede);
    const fechaRegistro =
      typeof body?.fecha === "string" ? new Date(body.fecha) : new Date();
    if (Number.isNaN(fechaRegistro.getTime())) {
      return NextResponse.json(
        { ok: false, mensaje: "La fecha de asistencia es inválida." },
        { status: 400 },
      );
    }
    const dia = fechaMerida(fechaRegistro);
    const asistenciaId = `${alumnoId}_${dia.replaceAll("-", "")}`;
    const alumnoRef = adminDb.collection("Alumnos").doc(alumnoId);
    const asistenciaRef = adminDb
      .collection("Asistencias")
      .doc(asistenciaId);
    const auditoriaRef = adminDb
      .collection("Auditoria")
      .doc(sede)
      .collection("movimientos")
      .doc();

    /*
     * Compatibilidad con asistencias antiguas y con registros creados por
     * RFID/NFC usando un ID automático. La consulta usa solo alumnoId para no
     * requerir un índice compuesto; la comparación del día se hace en el
     * servidor con la zona horaria de Mérida.
     */
    const alumnoPrevio = await alumnoRef.get();
    if (!alumnoPrevio.exists) {
      return NextResponse.json(
        { ok: false, mensaje: "El alumno no existe." },
        { status: 404 },
      );
    }

    const datosAlumnoPrevio = alumnoPrevio.data() || {};
    if (normalizarSede(datosAlumnoPrevio.sede) !== sede) {
      return NextResponse.json(
        { ok: false, mensaje: "El alumno pertenece a otra sede." },
        { status: 403 },
      );
    }
    if (datosAlumnoPrevio.activo === false) {
      return NextResponse.json(
        { ok: false, mensaje: "El alumno tiene una baja temporal." },
        { status: 409 },
      );
    }

    const asistenciasPrevias = await adminDb
      .collection("Asistencias")
      .where("alumnoId", "==", alumnoId)
      .get();
    const yaRegistroHoy = asistenciasPrevias.docs.some((documento) => {
      const fecha = documento.data().fecha;
      const fechaDate =
        fecha && typeof fecha.toDate === "function" ? fecha.toDate() : null;
      return fechaDate instanceof Date && fechaMerida(fechaDate) === dia;
    });

    if (yaRegistroHoy) {
      return NextResponse.json(
        {
          ok: false,
          duplicado: true,
          mensaje: `${String(datosAlumnoPrevio.nombre || "Alumno")} ya ingresó hoy.`,
        },
        { status: 409 },
      );
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const [alumnoSnapshot, asistenciaSnapshot] = await Promise.all([
        transaction.get(alumnoRef),
        transaction.get(asistenciaRef),
      ]);

      if (!alumnoSnapshot.exists) {
        return { estado: "no_encontrado" as const };
      }

      const alumno = alumnoSnapshot.data() || {};
      if (normalizarSede(alumno.sede) !== sede) {
        return { estado: "otra_sede" as const };
      }
      if (alumno.activo === false) {
        return { estado: "inactivo" as const };
      }
      if (asistenciaSnapshot.exists) {
        return {
          estado: "duplicado" as const,
          nombre: String(alumno.nombre || "Alumno"),
        };
      }

      const nombre = String(alumno.nombre || "Alumno");
      transaction.create(asistenciaRef, {
        alumnoId,
        nombre,
        sede,
        fecha: Timestamp.fromDate(fechaRegistro),
        acceso: "permitido",
        dispositivo: "Modo recepción",
        registroManual: true,
      });
      transaction.create(auditoriaRef, {
        action: "agregar_asistencia",
        entity: "asistencia",
        entityId: asistenciaId,
        entityName: nombre,
        summary: `Recepción registró la asistencia de ${nombre}.`,
        reason: `Recepción registró la asistencia de ${nombre}.`,
        details: { alumnoId, fecha: dia },
        before: null,
        after: null,
        sede,
        actorUid: actor.uid,
        actorName: actor.profile.nombre || actor.email || "Usuario",
        actorEmail: actor.email || "",
        createdAt: FieldValue.serverTimestamp(),
      });

      return { estado: "creado" as const, nombre };
    });

    if (resultado.estado === "duplicado") {
      return NextResponse.json(
        {
          ok: false,
          duplicado: true,
          mensaje: `${resultado.nombre} ya ingresó hoy.`,
        },
        { status: 409 },
      );
    }
    if (resultado.estado === "no_encontrado") {
      return NextResponse.json(
        { ok: false, mensaje: "El alumno no existe." },
        { status: 404 },
      );
    }
    if (resultado.estado === "otra_sede") {
      return NextResponse.json(
        { ok: false, mensaje: "El alumno pertenece a otra sede." },
        { status: 403 },
      );
    }
    if (resultado.estado === "inactivo") {
      return NextResponse.json(
        { ok: false, mensaje: "El alumno tiene una baja temporal." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      asistenciaId,
      nombre: resultado.nombre,
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ERROR_RECEPCION_ASISTENCIA:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo registrar la asistencia." },
      { status: 500 },
    );
  }
}
