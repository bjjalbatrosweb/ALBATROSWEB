import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  isValidKioskPin,
  kioskPinDigest,
  normalizeKioskPin,
} from "@/lib/kiosk-pin";
import {
  RequestAccessError,
  requireAdminActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";

function alumnoIdFromUrl(request: Request) {
  return new URL(request.url).searchParams.get("alumnoId")?.trim() || "";
}

function apiError(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { ok: false, mensaje: error.message },
      { status: error.status },
    );
  }
  console.error("ERROR_ADMIN_KIOSCO_PIN:", error);
  return NextResponse.json(
    { ok: false, mensaje: "No se pudo administrar el PIN del atleta." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    await requireAdminActorAccess(request);
    const alumnoId = alumnoIdFromUrl(request);
    if (!alumnoId) {
      throw new RequestAccessError("La ficha del atleta no es válida.", 400);
    }

    const [alumno, mapping] = await Promise.all([
      adminDb.collection("Alumnos").doc(alumnoId).get(),
      adminDb.collection("KioscoPinsPorAlumno").doc(alumnoId).get(),
    ]);
    if (!alumno.exists) {
      throw new RequestAccessError("La ficha del atleta ya no existe.", 404);
    }

    const actualizadoEn = mapping.data()?.actualizadoEn;
    return NextResponse.json({
      ok: true,
      configurado: mapping.exists,
      actualizadoEn:
        actualizadoEn instanceof Timestamp
          ? actualizadoEn.toDate().toISOString()
          : null,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const body = (await request.json().catch(() => null)) as {
      alumnoId?: unknown;
      pin?: unknown;
    } | null;
    const alumnoId =
      typeof body?.alumnoId === "string" ? body.alumnoId.trim() : "";
    const pin = normalizeKioskPin(body?.pin);

    if (!alumnoId) {
      throw new RequestAccessError("La ficha del atleta no es válida.", 400);
    }
    if (!isValidKioskPin(pin)) {
      throw new RequestAccessError("El PIN debe tener exactamente 4 dígitos.", 400);
    }

    const digest = kioskPinDigest(pin);
    const alumnoRef = adminDb.collection("Alumnos").doc(alumnoId);
    const mappingRef = adminDb.collection("KioscoPinsPorAlumno").doc(alumnoId);
    const pinRef = adminDb.collection("KioscoPins").doc(digest);
    const auditRef = adminDb
      .collection("Auditoria")
      .doc("MMA")
      .collection("movimientos")
      .doc();

    await adminDb.runTransaction(async (transaction) => {
      const [alumnoSnapshot, mappingSnapshot, pinSnapshot] = await Promise.all([
        transaction.get(alumnoRef),
        transaction.get(mappingRef),
        transaction.get(pinRef),
      ]);
      if (!alumnoSnapshot.exists) {
        throw new RequestAccessError("La ficha del atleta ya no existe.", 404);
      }

      const alumno = alumnoSnapshot.data() || {};
      const sede = String(alumno.sede || "").trim().toUpperCase();
      if (sede !== "MMA") {
        throw new RequestAccessError(
          "El PIN del kiosco iPad solo está disponible para la sede MMA.",
          409,
        );
      }
      if (alumno.activo === false) {
        throw new RequestAccessError(
          "No se puede asignar un PIN a una ficha inactiva.",
          409,
        );
      }

      const propietario = String(pinSnapshot.data()?.alumnoId || "");
      if (pinSnapshot.exists && propietario !== alumnoId) {
        throw new RequestAccessError(
          "Ese PIN ya pertenece a otro atleta. Elige uno diferente.",
          409,
        );
      }

      const digestAnterior = String(mappingSnapshot.data()?.pinDigest || "");
      const pinAnteriorRef =
        digestAnterior && digestAnterior !== digest
          ? adminDb.collection("KioscoPins").doc(digestAnterior)
          : null;
      const pinAnteriorSnapshot = pinAnteriorRef
        ? await transaction.get(pinAnteriorRef)
        : null;
      if (
        pinAnteriorRef &&
        pinAnteriorSnapshot?.exists &&
        pinAnteriorSnapshot.data()?.alumnoId === alumnoId
      ) {
        transaction.delete(pinAnteriorRef);
      }

      const now = FieldValue.serverTimestamp();
      transaction.set(pinRef, {
        alumnoId,
        nombre: String(alumno.nombre || "Alumno"),
        sede: "MMA",
        activo: true,
        creadoEn: pinSnapshot.exists
          ? pinSnapshot.data()?.creadoEn || now
          : now,
        actualizadoEn: now,
        actualizadoPor: actor.uid,
      });
      transaction.set(mappingRef, {
        alumnoId,
        pinDigest: digest,
        sede: "MMA",
        actualizadoEn: now,
        actualizadoPor: actor.uid,
      });
      transaction.create(auditRef, {
        action: "editar",
        entity: "alumno",
        entityId: alumnoId,
        entityName: String(alumno.nombre || "Alumno"),
        summary: `${mappingSnapshot.exists ? "Se actualizó" : "Se asignó"} el PIN de asistencia en kiosco.`,
        reason: "Administración de acceso por PIN en kiosco iPad.",
        details: { pinConfigurado: true },
        before: null,
        after: null,
        sede: "MMA",
        actorUid: actor.uid,
        actorName: actor.profile.nombre || actor.email || "Administrador",
        actorEmail: actor.email || "",
        createdAt: now,
      });
    });

    return NextResponse.json({ ok: true, configurado: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const body = (await request.json().catch(() => null)) as {
      alumnoId?: unknown;
    } | null;
    const alumnoId =
      typeof body?.alumnoId === "string" ? body.alumnoId.trim() : "";
    if (!alumnoId) {
      throw new RequestAccessError("La ficha del atleta no es válida.", 400);
    }

    const alumnoRef = adminDb.collection("Alumnos").doc(alumnoId);
    const mappingRef = adminDb.collection("KioscoPinsPorAlumno").doc(alumnoId);
    await adminDb.runTransaction(async (transaction) => {
      const [alumnoSnapshot, mappingSnapshot] = await Promise.all([
        transaction.get(alumnoRef),
        transaction.get(mappingRef),
      ]);
      if (!alumnoSnapshot.exists) {
        throw new RequestAccessError("La ficha del atleta ya no existe.", 404);
      }
      if (!mappingSnapshot.exists) return;

      const alumno = alumnoSnapshot.data() || {};
      const digest = String(mappingSnapshot.data()?.pinDigest || "");
      const pinRef = digest
        ? adminDb.collection("KioscoPins").doc(digest)
        : null;
      const pinSnapshot = pinRef ? await transaction.get(pinRef) : null;
      if (
        pinRef &&
        pinSnapshot?.exists &&
        pinSnapshot.data()?.alumnoId === alumnoId
      ) {
        transaction.delete(pinRef);
      }
      transaction.delete(mappingRef);

      const auditRef = adminDb
        .collection("Auditoria")
        .doc("MMA")
        .collection("movimientos")
        .doc();
      transaction.create(auditRef, {
        action: "editar",
        entity: "alumno",
        entityId: alumnoId,
        entityName: String(alumno.nombre || "Alumno"),
        summary: "Se eliminó el PIN de asistencia en kiosco.",
        reason: "Administración de acceso por PIN en kiosco iPad.",
        details: { pinConfigurado: false },
        before: null,
        after: null,
        sede: "MMA",
        actorUid: actor.uid,
        actorName: actor.profile.nombre || actor.email || "Administrador",
        actorEmail: actor.email || "",
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true, configurado: false });
  } catch (error) {
    return apiError(error);
  }
}
