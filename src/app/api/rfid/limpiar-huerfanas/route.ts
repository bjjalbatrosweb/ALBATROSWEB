import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb as db } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";

const SEDES_VALIDAS: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
const MAXIMO_POR_LOTE = 400;

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
  return [
    ...(Array.isArray(alumno.rfids) ? alumno.rfids : []),
    alumno.rfid,
  ]
    .map(normalizarRfid)
    .filter(Boolean);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sede?: unknown;
    };
    const sede = normalizarSede(body.sede);
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);

    // Se cargan todos los alumnos para no borrar una tarjeta que siga vinculada
    // en otra sede por datos históricos o por un índice con sede desactualizada.
    const [alumnosSnapshot, tarjetasSnapshot] = await Promise.all([
      db.collection("Alumnos").get(),
      db.collection("TarjetasRFID").where("sede", "==", sede).get(),
    ]);
    const tarjetasVinculadas = new Set<string>();
    alumnosSnapshot.docs.forEach((documento) => {
      tarjetasDelAlumno(documento.data()).forEach((rfid) =>
        tarjetasVinculadas.add(rfid),
      );
    });

    const huerfanas = tarjetasSnapshot.docs.filter((documento) => {
      const rfid = normalizarRfid(documento.id);
      return Boolean(rfid) && !tarjetasVinculadas.has(rfid);
    });

    for (let inicio = 0; inicio < huerfanas.length; inicio += MAXIMO_POR_LOTE) {
      const lote = db.batch();
      huerfanas
        .slice(inicio, inicio + MAXIMO_POR_LOTE)
        .forEach((documento) => lote.delete(documento.ref));
      await lote.commit();
    }

    return NextResponse.json({
      ok: true,
      sede,
      revisadas: tarjetasSnapshot.size,
      eliminadas: huerfanas.length,
      conservadas: tarjetasSnapshot.size - huerfanas.length,
      mensaje:
        huerfanas.length > 0
          ? `Se eliminaron ${huerfanas.length} índices RFID huérfanos.`
          : "No se encontraron índices RFID huérfanos.",
    });
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }

    console.error("RFID_ORPHAN_CLEANUP_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo completar la limpieza de RFID." },
      { status: 500 },
    );
  }
}
