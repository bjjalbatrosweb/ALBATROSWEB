import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import {
  normalizeWeeklyGoal,
  parseWeeklyGoal,
  weeklyAttendanceProgress,
  weeklyGoalWeekKey,
} from "@/lib/athlete-weekly-goal";
import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { RequestAccessError, requireActiveActorAccess } from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
  }
  console.error("ATHLETE_WEEKLY_GOAL_ERROR:", error);
  return NextResponse.json({ ok: false, mensaje: "No se pudo procesar tu meta semanal." }, { status: 500 });
}

async function requireAthlete(request: Request) {
  const actor = await requireActiveActorAccess(request);
  if (actor.profile.rol !== "atleta" || !actor.profile.alumnoId) {
    throw new RequestAccessError("Solo una cuenta de atleta vinculada puede usar metas semanales.", 403);
  }
  return actor;
}

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== "object" || !("toMillis" in value)) return 0;
  const method = (value as { toMillis?: unknown }).toMillis;
  return typeof method === "function" ? Number(method.call(value)) || 0 : 0;
}

export async function GET(request: Request) {
  try {
    const actor = await requireAthlete(request);
    const weekKey = weeklyGoalWeekKey();
    const [profile, attendance] = await Promise.all([
      adminDb.collection("perfiles").doc(actor.uid).get(),
      adminDb.collection("Asistencias").where("alumnoId", "==", actor.profile.alumnoId).limit(500).get(),
    ]);
    const goal = normalizeWeeklyGoal(profile.data()?.weeklyTrainingGoal, weekKey);
    const completedSessions = weeklyAttendanceProgress(
      attendance.docs.map((entry) => timestampMillis(entry.data()?.fecha)),
      weekKey,
    );
    return NextResponse.json({ ok: true, weekKey, goal, completedSessions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAthlete(request);
    const rate = await checkRateLimit(request, { scope: "meta-semanal-atleta", limit: 20, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: "Demasiados cambios. Espera un momento." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }
    const weekKey = weeklyGoalWeekKey();
    const body = await request.json().catch(() => null);
    let goal;
    try {
      goal = parseWeeklyGoal(body, weekKey);
    } catch (error) {
      throw new RequestAccessError(error instanceof Error ? error.message : "La meta no es válida.", 400);
    }
    await adminDb.collection("perfiles").doc(actor.uid).set(
      {
        weeklyTrainingGoal: goal,
        alumnoId: actor.profile.alumnoId,
        weeklyTrainingGoalUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true, goal });
  } catch (error) {
    return errorResponse(error);
  }
}
