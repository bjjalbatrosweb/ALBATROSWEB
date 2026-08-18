import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb as db } from "@/lib/firebase-admin";
import { normalizeRfidDiagnosticSite } from "@/lib/rfid-diagnostics";
import { buildRfidRepairPlan } from "@/lib/rfid-repair";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";

const MAX_OPERATIONS_PER_BATCH = 400;

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sede?: unknown;
    };
    const sede = normalizeRfidDiagnosticSite(body.sede);
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
    const plan = buildRfidRepairPlan(
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

    type Batch = ReturnType<typeof db.batch>;
    const operations: Array<(batch: Batch) => void> = [];

    plan.studentUpdates.forEach((update) => {
      operations.push((batch) => {
        batch.update(db.collection("Alumnos").doc(update.studentId), {
          rfids: update.rfids,
          rfid: update.rfid,
          actualizadoEn: FieldValue.serverTimestamp(),
        });
      });
    });

    plan.indexUpserts.forEach((upsert) => {
      operations.push((batch) => {
        batch.set(
          db.collection("TarjetasRFID").doc(upsert.rfid),
          {
            rfid: upsert.rfid,
            alumnoId: upsert.studentId,
            sede: upsert.site,
            reparadoEn: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
    });

    plan.indexDeletes.forEach((item) => {
      operations.push((batch) => {
        batch.delete(db.collection("TarjetasRFID").doc(item.indexId));
      });
    });

    for (
      let start = 0;
      start < operations.length;
      start += MAX_OPERATIONS_PER_BATCH
    ) {
      const batch = db.batch();
      operations
        .slice(start, start + MAX_OPERATIONS_PER_BATCH)
        .forEach((operation) => operation(batch));
      await batch.commit();
    }

    const created = plan.indexUpserts.filter(
      (item) => item.mode === "create",
    ).length;
    const corrected = plan.indexUpserts.length - created;
    const orphanDeleted = plan.indexDeletes.filter(
      (item) => item.reason === "orphan",
    ).length;
    const noncanonicalDeleted = plan.indexDeletes.length - orphanDeleted;
    const repaired =
      plan.studentUpdates.length +
      plan.indexUpserts.length +
      plan.indexDeletes.length;

    return NextResponse.json({
      ok: true,
      sede,
      reparadas: repaired,
      alumnosNormalizados: plan.studentUpdates.length,
      indicesCreados: created,
      indicesCorregidos: corrected,
      huerfanosEliminados: orphanDeleted,
      indicesObsoletosEliminados: noncanonicalDeleted,
      duplicadosBloqueados: plan.blockedDuplicates.length,
      duplicados: plan.blockedDuplicates.map((item) => item.rfid),
      mensaje:
        repaired > 0
          ? `Se aplicaron ${repaired} correcciones RFID seguras.`
          : plan.blockedDuplicates.length > 0
            ? "No se modificaron los RFID duplicados; requieren revisión manual."
            : "El sistema RFID ya estaba sincronizado.",
    });
  } catch (error: unknown) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }

    console.error("RFID_REPAIR_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo completar la reparación RFID." },
      { status: 500 },
    );
  }
}
