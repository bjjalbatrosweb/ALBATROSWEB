import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  normalizeAthletePersonalProfile,
  parseAthletePersonalProfile,
} from "@/lib/athlete-personal-profile";
import { parseNutritionTargets } from "@/lib/nutrition-estimates";
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
  console.error("ATHLETE_PROFILE_ERROR:", error);
  return NextResponse.json(
    { ok: false, mensaje: "No se pudo procesar tu perfil." },
    { status: 500 },
  );
}

async function requireLinkedAthlete(request: Request) {
  const actor = await requireActiveActorAccess(request);
  if (
    actor.profile.rol !== "atleta" ||
    !actor.profile.alumnoId ||
    !actor.profile.sede ||
    actor.profile.sede === "TODAS"
  ) {
    throw new RequestAccessError(
      "Tu cuenta no tiene un expediente de atleta vinculado.",
      403,
    );
  }
  return actor;
}

export async function GET(request: Request) {
  try {
    const actor = await requireLinkedAthlete(request);
    const athleteId = actor.profile.alumnoId as string;
    const [athleteSnapshot, personalSnapshot, photoSnapshot, authUser] =
      await Promise.all([
        adminDb.collection("Alumnos").doc(athleteId).get(),
        adminDb.collection("perfiles").doc(actor.uid).get(),
        adminDb.collection("FotosAtletas").doc(athleteId).get(),
        adminAuth.getUser(actor.uid),
      ]);

    if (!athleteSnapshot.exists) {
      throw new RequestAccessError("Tu expediente de atleta ya no existe.", 404);
    }

    const athlete = athleteSnapshot.data() || {};
    const physicalHistory = Array.isArray(athlete.historialFisico)
      ? athlete.historialFisico.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry && typeof entry === "object"),
        )
      : [];
    const latestPhysical = [...physicalHistory].sort((left, right) =>
      String(right.fecha || "").localeCompare(String(left.fecha || "")),
    )[0];
    const personal = normalizeAthletePersonalProfile(
      personalSnapshot.data() || {},
      {
        gender: latestPhysical?.sexoCalculo,
        weightKg: athlete.pesoActual || latestPhysical?.pesoKg,
        heightCm: latestPhysical?.estaturaCm,
        age: latestPhysical?.edad,
      },
    );

    return NextResponse.json({
      ok: true,
      account: {
        email: authUser.email || actor.email || "",
        emailVerified: authUser.emailVerified,
        createdAt: authUser.metadata.creationTime || null,
        lastSignInAt: authUser.metadata.lastSignInTime || null,
      },
      athlete: {
        id: athleteSnapshot.id,
        name: String(athlete.nombre || actor.profile.nombre || "Atleta"),
        site: String(athlete.sede || actor.profile.sede || ""),
        discipline: String(athlete.disciplina || ""),
        grade: String(athlete.grado || ""),
        goal: String(athlete.objetivo || ""),
        paymentStatus: String(athlete.estadoPago || ""),
        active: athlete.activo !== false,
        officialWeightKg: Number(athlete.pesoActual || latestPhysical?.pesoKg || 0),
        nextCompetition: String(athlete.proximaCompetencia || ""),
        photoUrl: String(
          photoSnapshot.data()?.imagenDataUrl || athlete.fotoUrl || "",
        ),
      },
      personal,
      hasSavedPersonalProfile: personalSnapshot.exists,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireLinkedAthlete(request);
    const body = await request.json().catch(() => null);
    let personal;
    let targets = null;
    try {
      personal = parseAthletePersonalProfile(body);
      if (
        body &&
        typeof body === "object" &&
        "dailyTargets" in body &&
        body.dailyTargets !== undefined
      ) {
        targets = parseNutritionTargets(body.dailyTargets);
      }
    } catch (error) {
      throw new RequestAccessError(
        error instanceof Error ? error.message : "Los datos no son válidos.",
        400,
      );
    }

    await adminDb.collection("perfiles").doc(actor.uid).set(
      {
        ...personal,
        ...(targets
          ? {
              dailyTargetCalories: targets.calories,
              dailyTargetProtein: targets.protein,
              dailyTargetCarbs: targets.carbs,
              dailyTargetFats: targets.fats,
            }
          : {}),
        alumnoId: actor.profile.alumnoId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, personal, dailyTargets: targets });
  } catch (error) {
    return errorResponse(error);
  }
}
