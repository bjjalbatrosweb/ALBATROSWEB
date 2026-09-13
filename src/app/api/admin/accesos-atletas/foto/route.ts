import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requireAdminActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENT_ID_PATTERN = /^[^/]{1,128}$/;
const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";
const MAX_PHOTO_BYTES = 180 * 1024;

function athleteIdFrom(value: unknown): string {
  const alumnoId = typeof value === "string" ? value.trim() : "";
  if (!DOCUMENT_ID_PATTERN.test(alumnoId)) {
    throw new RequestAccessError("La ficha del atleta no es válida.", 400);
  }
  return alumnoId;
}

function validatedPhoto(value: unknown) {
  if (typeof value !== "string" || !value.startsWith(JPEG_DATA_URL_PREFIX)) {
    throw new RequestAccessError("La fotografía debe estar en formato JPEG.", 400);
  }

  const encoded = value.slice(JPEG_DATA_URL_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new RequestAccessError("La fotografía contiene datos inválidos.", 400);
  }

  const bytes = Buffer.from(encoded, "base64");
  if (
    bytes.length === 0 ||
    bytes.length > MAX_PHOTO_BYTES ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff
  ) {
    throw new RequestAccessError(
      "La fotografía no es un JPEG válido o supera 180 KB.",
      400,
    );
  }

  return { imagenDataUrl: value, bytes: bytes.length };
}

async function athleteData(alumnoId: string) {
  const snapshot = await adminDb.collection("Alumnos").doc(alumnoId).get();
  if (!snapshot.exists) {
    throw new RequestAccessError("La ficha del atleta ya no existe.", 404);
  }
  const data = snapshot.data() || {};
  const sede = String(data.sede || "");
  if (!["MMA", "CAUCEL", "JUAN_PABLO"].includes(sede)) {
    throw new RequestAccessError("La ficha tiene una sede inválida.", 409);
  }
  return { snapshot, sede };
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { ok: false, mensaje: error.message },
      { status: error.status },
    );
  }
  console.error("ADMIN_ATHLETE_PHOTO_ERROR:", error);
  return NextResponse.json(
    { ok: false, mensaje: "No se pudo gestionar la fotografía del atleta." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    await requireAdminActorAccess(request);
    const alumnoId = athleteIdFrom(new URL(request.url).searchParams.get("alumnoId"));
    await athleteData(alumnoId);
    const snapshot = await adminDb.collection("FotosAtletas").doc(alumnoId).get();
    return NextResponse.json({
      ok: true,
      imagenDataUrl: snapshot.exists
        ? String(snapshot.data()?.imagenDataUrl || "")
        : "",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAdminActorAccess(request);
    const body = (await request.json().catch(() => ({}))) as {
      alumnoId?: unknown;
      imagenDataUrl?: unknown;
    };
    const alumnoId = athleteIdFrom(body.alumnoId);
    const photo = validatedPhoto(body.imagenDataUrl);
    const { snapshot: athleteSnapshot, sede } = await athleteData(alumnoId);
    const linkedUsers = await adminDb
      .collection("usuarios")
      .where("alumnoId", "==", alumnoId)
      .get();
    const linkedAthlete = linkedUsers.docs.find(
      (profile) =>
        profile.data().rol === "atleta" && profile.data().activo === true,
    );

    const batch = adminDb.batch();
    batch.set(adminDb.collection("FotosAtletas").doc(alumnoId), {
      alumnoId,
      usuarioId: linkedAthlete?.id || "",
      sede,
      imagenDataUrl: photo.imagenDataUrl,
      mimeType: "image/jpeg",
      bytes: photo.bytes,
      actualizadoEn: FieldValue.serverTimestamp(),
      actualizadoPor: actor.uid,
    });
    batch.update(athleteSnapshot.ref, {
      fotoUrl: FieldValue.delete(),
      fotoStoragePath: FieldValue.delete(),
      fotoActualizadaEn: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminActorAccess(request);
    const body = (await request.json().catch(() => ({}))) as {
      alumnoId?: unknown;
    };
    const alumnoId = athleteIdFrom(body.alumnoId);
    const { snapshot: athleteSnapshot } = await athleteData(alumnoId);

    const batch = adminDb.batch();
    batch.delete(adminDb.collection("FotosAtletas").doc(alumnoId));
    batch.update(athleteSnapshot.ref, {
      fotoUrl: FieldValue.delete(),
      fotoStoragePath: FieldValue.delete(),
      fotoActualizadaEn: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
