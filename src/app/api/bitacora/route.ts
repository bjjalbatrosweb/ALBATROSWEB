import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { parseAthleteLog } from "@/lib/athlete-log";
import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requireActiveActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[^/]{1,128}$/;

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { ok: false, mensaje: error.message },
      { status: error.status },
    );
  }
  console.error("ATHLETE_LOG_ERROR:", error);
  return NextResponse.json(
    { ok: false, mensaje: "No se pudo procesar tu bitácora." },
    { status: 500 },
  );
}

async function requireAthlete(request: Request) {
  const actor = await requireActiveActorAccess(request);
  if (actor.profile.rol !== "atleta" || !actor.profile.alumnoId) {
    throw new RequestAccessError(
      "Solo una cuenta de atleta vinculada puede usar esta bitácora.",
      403,
    );
  }
  return actor;
}

function safeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function safeDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function GET(request: Request) {
  try {
    const actor = await requireAthlete(request);
    const profileRef = adminDb.collection("perfiles").doc(actor.uid);
    const [meals, trainings] = await Promise.all([
      profileRef.collection("mealLogs").orderBy("logDate", "desc").limit(100).get(),
      profileRef.collection("trainingSessions").orderBy("logDate", "desc").limit(100).get(),
    ]);

    const items = [
      ...meals.docs.map((entry) => {
        const data = entry.data() || {};
        return {
          id: entry.id,
          type: "meal" as const,
          mealType: String(data.mealType || "Comida"),
          totalCalories: safeNumber(data.totalCalories),
          totalProtein: safeNumber(data.totalProtein),
          totalFat: safeNumber(data.totalFat),
          totalCarbohydrates: safeNumber(data.totalCarbohydrates),
          notes: String(data.notes || "").slice(0, 500),
          logDate: safeDate(data.logDate),
        };
      }),
      ...trainings.docs.map((entry) => {
        const data = entry.data() || {};
        return {
          id: entry.id,
          type: "training" as const,
          activityType: String(data.activityType || "Entrenamiento").slice(0, 80),
          durationMinutes: safeNumber(data.durationMinutes),
          intensityLevel: String(data.intensityLevel || "Moderada"),
          estimatedCaloriesBurned: safeNumber(data.estimatedCaloriesBurned),
          notes: String(data.notes || "").slice(0, 500),
          logDate: safeDate(data.logDate),
        };
      }),
    ]
      .sort((left, right) => right.logDate.localeCompare(left.logDate))
      .slice(0, 150);

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAthlete(request);
    const body = await request.json().catch(() => null);
    let input;
    try {
      input = parseAthleteLog(body);
    } catch (error) {
      throw new RequestAccessError(
        error instanceof Error ? error.message : "El registro no es válido.",
        400,
      );
    }

    const type = input.type;
    const collectionName = type === "meal" ? "mealLogs" : "trainingSessions";
    const { type: _type, ...fields } = input;
    void _type;
    const logDate = new Date().toISOString();
    const reference = await adminDb
      .collection("perfiles")
      .doc(actor.uid)
      .collection(collectionName)
      .add({
        ...fields,
        userId: actor.uid,
        alumnoId: actor.profile.alumnoId,
        logDate,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json(
      { ok: true, item: { id: reference.id, ...input, logDate } },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAthlete(request);
    const parameters = new URL(request.url).searchParams;
    const id = parameters.get("id")?.trim() || "";
    const type = parameters.get("type");
    if (!ID_PATTERN.test(id) || (type !== "meal" && type !== "training")) {
      throw new RequestAccessError("El registro que intentas actualizar no es válido.", 400);
    }

    const body = await request.json().catch(() => null);
    let input;
    try {
      input = parseAthleteLog(body);
    } catch (error) {
      throw new RequestAccessError(
        error instanceof Error ? error.message : "El registro no es válido.",
        400,
      );
    }
    if (input.type !== type) {
      throw new RequestAccessError("No puedes cambiar el tipo de un registro existente.", 400);
    }

    const collectionName = type === "meal" ? "mealLogs" : "trainingSessions";
    const reference = adminDb
      .collection("perfiles")
      .doc(actor.uid)
      .collection(collectionName)
      .doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      throw new RequestAccessError("Ese registro ya no existe.", 404);
    }

    const { type: _type, ...fields } = input;
    void _type;
    await reference.update({
      ...fields,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      item: {
        id,
        ...input,
        logDate: safeDate(snapshot.data()?.logDate),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAthlete(request);
    const parameters = new URL(request.url).searchParams;
    const id = parameters.get("id")?.trim() || "";
    const type = parameters.get("type");
    if (!ID_PATTERN.test(id) || (type !== "meal" && type !== "training")) {
      throw new RequestAccessError("El registro que intentas eliminar no es válido.", 400);
    }

    const collectionName = type === "meal" ? "mealLogs" : "trainingSessions";
    const reference = adminDb
      .collection("perfiles")
      .doc(actor.uid)
      .collection(collectionName)
      .doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      throw new RequestAccessError("Ese registro ya no existe.", 404);
    }
    await reference.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
