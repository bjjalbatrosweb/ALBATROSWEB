import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import {
  normalizeStoredWellness,
  parseWellnessCheckin,
  wellnessDateKey,
} from "@/lib/athlete-wellness";
import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requireActiveActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { ok: false, mensaje: error.message },
      { status: error.status },
    );
  }
  console.error("ATHLETE_WELLNESS_ERROR:", error);
  return NextResponse.json(
    { ok: false, mensaje: "No se pudo procesar tu registro de bienestar." },
    { status: 500 },
  );
}

async function requireAthlete(request: Request) {
  const actor = await requireActiveActorAccess(request);
  if (actor.profile.rol !== "atleta" || !actor.profile.alumnoId) {
    throw new RequestAccessError(
      "Solo una cuenta de atleta vinculada puede usar el check-in.",
      403,
    );
  }
  return actor;
}

export async function GET(request: Request) {
  try {
    const actor = await requireAthlete(request);
    const today = wellnessDateKey();
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") || 7);
    const historyLimit = Number.isInteger(requestedLimit)
      ? Math.max(7, Math.min(45, requestedLimit))
      : 7;
    const documentPrefix = `${actor.uid}_`;
    const [todaySnapshot, historySnapshot] = await Promise.all([
      adminDb.collection("BienestarAtletas").doc(`${actor.uid}_${today}`).get(),
      adminDb
        .collection("BienestarAtletas")
        .where(FieldPath.documentId(), ">=", documentPrefix)
        .where(FieldPath.documentId(), "<=", `${documentPrefix}\uf8ff`)
        .orderBy(FieldPath.documentId(), "desc")
        .limit(historyLimit)
        .get(),
    ]);

    const item = todaySnapshot.exists
      ? normalizeStoredWellness(todaySnapshot.data() || {})
      : null;
    const items = historySnapshot.docs
      .map((entry) => normalizeStoredWellness(entry.data() || {}))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((left, right) => right.fecha.localeCompare(left.fecha))
      .slice(0, historyLimit);

    return NextResponse.json({ ok: true, item, items, date: today });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAthlete(request);
    const body = await request.json().catch(() => null);
    const today = wellnessDateKey();
    let input;
    try {
      input = parseWellnessCheckin(body, today);
    } catch (error) {
      throw new RequestAccessError(
        error instanceof Error ? error.message : "El check-in no es válido.",
        400,
      );
    }

    await adminDb
      .collection("BienestarAtletas")
      .doc(`${actor.uid}_${today}`)
      .set(
        {
          ...input,
          alumnoId: actor.profile.alumnoId,
          usuarioId: actor.uid,
          sede: actor.profile.sede || "",
          actualizadoEn: FieldValue.serverTimestamp(),
        },
      );

    return NextResponse.json({ ok: true, item: input });
  } catch (error) {
    return errorResponse(error);
  }
}
