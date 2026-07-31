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
const METODOS_VALIDOS = ["Efectivo", "Transferencia", "Tarjeta", "Otro"];

function normalizarSede(valor: unknown): Sede | null {
  if (typeof valor !== "string") return null;
  const sede = valor.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SEDES_VALIDAS.includes(sede) ? sede : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      alumnoId?: unknown;
      sede?: unknown;
      monto?: unknown;
      periodo?: unknown;
      metodoPago?: unknown;
      fechaPago?: unknown;
    } | null;
    const alumnoId =
      typeof body?.alumnoId === "string" ? body.alumnoId.trim() : "";
    const sede = normalizarSede(body?.sede);
    const monto = Number(body?.monto);
    const periodo =
      typeof body?.periodo === "string" ? body.periodo.trim() : "";
    const metodoPago =
      typeof body?.metodoPago === "string" ? body.metodoPago : "";
    const fechaPago =
      typeof body?.fechaPago === "string" ? body.fechaPago.trim() : "";

    if (
      !alumnoId ||
      !sede ||
      !Number.isFinite(monto) ||
      monto <= 0 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) ||
      !METODOS_VALIDOS.includes(metodoPago) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)
    ) {
      return NextResponse.json(
        { ok: false, mensaje: "Los datos del pago no son válidos." },
        { status: 400 },
      );
    }

    const fecha = new Date(`${fechaPago}T12:00:00-06:00`);
    if (Number.isNaN(fecha.getTime())) {
      return NextResponse.json(
        { ok: false, mensaje: "La fecha del pago no es válida." },
        { status: 400 },
      );
    }

    const actor = await requirePanelActorAccess(request, sede);
    const pagoId = `${alumnoId}_${periodo.replace("-", "")}`;
    const alumnoRef = adminDb.collection("Alumnos").doc(alumnoId);
    const pagoRef = adminDb.collection("Pagos").doc(pagoId);
    const auditoriaRef = adminDb
      .collection("Auditoria")
      .doc(sede)
      .collection("movimientos")
      .doc();

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const [alumnoSnapshot, pagoSnapshot] = await Promise.all([
        transaction.get(alumnoRef),
        transaction.get(pagoRef),
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
      if (pagoSnapshot.exists) {
        return {
          estado: "duplicado" as const,
          nombre: String(alumno.nombre || "Alumno"),
        };
      }

      const nombre = String(alumno.nombre || "Alumno");
      const fechaTimestamp = Timestamp.fromDate(fecha);
      transaction.create(pagoRef, {
        alumnoId,
        nombre,
        sede,
        monto,
        periodo,
        metodoPago,
        fecha: fechaTimestamp,
        creadoEn: FieldValue.serverTimestamp(),
      });
      transaction.update(alumnoRef, {
        estadoPago: "Pagado",
        fechaUltimoPago: fechaTimestamp,
        periodoUltimoPago: periodo,
      });
      transaction.create(auditoriaRef, {
        action: "registrar_pago",
        entity: "pago",
        entityId: pagoId,
        entityName: nombre,
        summary: `Recepción registró el pago de ${nombre}.`,
        reason: `Recepción registró el pago de ${nombre}.`,
        details: { monto, periodo, metodo: metodoPago },
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
          mensaje: `${resultado.nombre} ya tiene un pago para ${periodo}.`,
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
      pagoId,
      nombre: resultado.nombre,
    });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ERROR_RECEPCION_PAGO:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo registrar el pago." },
      { status: 500 },
    );
  }
}
