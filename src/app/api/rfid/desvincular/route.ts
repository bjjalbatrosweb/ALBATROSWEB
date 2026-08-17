import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb as db } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";
import type { Sede } from "@/lib/access-control";

const SEDES_VALIDAS: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];

export const runtime = "nodejs";

function normalizarSede(valor: unknown): Sede | null {
  if (typeof valor !== "string") return null;
  const sede = valor.trim().toUpperCase().replace(/\s+/g, "_");
  return SEDES_VALIDAS.includes(sede as Sede) ? (sede as Sede) : null;
}

function normalizarRfid(valor: unknown): string {
  return typeof valor === "string"
    ? valor.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    : "";
}

function tarjetasDelAlumno(alumno: Record<string, unknown>): string[] {
  const candidatas = [
    ...(Array.isArray(alumno.rfids) ? alumno.rfids : []),
    alumno.rfid,
  ];
  return Array.from(
    new Set(candidatas.map(normalizarRfid).filter(Boolean)),
  );
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      alumnoId?: unknown;
      rfid?: unknown;
      sede?: unknown;
    };
    const alumnoId =
      typeof body.alumnoId === "string" ? body.alumnoId.trim() : "";
    const rfid = normalizarRfid(body.rfid);
    const sede = normalizarSede(body.sede);

    if (!alumnoId || !rfid || !sede) {
      return NextResponse.json(
        { ok: false, mensaje: "Los datos para desvincular no son válidos." },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);

    const alumnoRef = db.collection("Alumnos").doc(alumnoId);
    const tarjetaRef = db.collection("TarjetasRFID").doc(rfid);
    const resultado = await db.runTransaction(async (transaction) => {
      const [alumnoSnapshot, tarjetaSnapshot] = await Promise.all([
        transaction.get(alumnoRef),
        transaction.get(tarjetaRef),
      ]);

      if (!alumnoSnapshot.exists) {
        throw new RequestAccessError("El alumno ya no existe.", 404);
      }

      const alumno = alumnoSnapshot.data() || {};
      if (normalizarSede(alumno.sede) !== sede) {
        throw new RequestAccessError(
          "El alumno no pertenece a la sede seleccionada.",
          409,
        );
      }

      const indice = tarjetaSnapshot.data() || {};
      const propietarioIndice =
        typeof indice.alumnoId === "string" ? indice.alumnoId.trim() : "";
      if (
        tarjetaSnapshot.exists &&
        propietarioIndice &&
        propietarioIndice !== alumnoId
      ) {
        const otroAlumnoSnapshot = await transaction.get(
          db.collection("Alumnos").doc(propietarioIndice),
        );
        const otroAlumno = otroAlumnoSnapshot.data() || {};
        if (
          otroAlumnoSnapshot.exists &&
          tarjetasDelAlumno(otroAlumno).includes(rfid)
        ) {
          throw new RequestAccessError(
            "La tarjeta también aparece vinculada a otro alumno. Revisa el duplicado antes de eliminarla.",
            409,
          );
        }
      }

      const restantes = tarjetasDelAlumno(alumno).filter(
        (codigo) => codigo !== rfid,
      );
      transaction.update(alumnoRef, {
        rfids: restantes,
        rfid: restantes[0] || FieldValue.delete(),
        actualizadoEn: FieldValue.serverTimestamp(),
      });

      if (tarjetaSnapshot.exists) {
        transaction.delete(tarjetaRef);
      }

      return { restantes, indiceEliminado: tarjetaSnapshot.exists };
    });

    return NextResponse.json({
      ok: true,
      rfid,
      alumnoId,
      rfids: resultado.restantes,
      indiceEliminado: resultado.indiceEliminado,
      mensaje: "Tarjeta desvinculada correctamente.",
    });
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }

    console.error("RFID_UNLINK_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo desvincular la tarjeta." },
      { status: 500 },
    );
  }
}
