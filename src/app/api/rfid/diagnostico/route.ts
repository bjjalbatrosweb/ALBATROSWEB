import { NextResponse } from "next/server";

import { adminDb as db } from "@/lib/firebase-admin";
import {
  buildRfidDiagnosticReport,
  normalizeRfidDiagnosticSite,
} from "@/lib/rfid-diagnostics";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sede = normalizeRfidDiagnosticSite(
      new URL(request.url).searchParams.get("sede"),
    );
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }

    await requirePanelActorAccess(request, sede);

    const [studentsSnapshot, indexesSnapshot] = await Promise.all([
      db.collection("Alumnos").get(),
      db.collection("TarjetasRFID").get(),
    ]);

    const report = buildRfidDiagnosticReport(
      studentsSnapshot.docs.map((document) => ({
        ...document.data(),
        id: document.id,
      })),
      indexesSnapshot.docs.map((document) => ({
        ...document.data(),
        id: document.id,
      })),
      sede,
    );

    return NextResponse.json(report);
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }

    console.error("RFID_DIAGNOSTIC_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo calcular el diagnóstico RFID." },
      { status: 500 },
    );
  }
}
