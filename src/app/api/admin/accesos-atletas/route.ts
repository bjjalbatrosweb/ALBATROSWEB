import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requireAdminActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UID_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;
const DOCUMENT_ID_PATTERN = /^[^/]{1,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== "object" || !("toMillis" in value)) return 0;
  const toMillis = (value as { toMillis?: unknown }).toMillis;
  return typeof toMillis === "function" ? Number(toMillis.call(value)) || 0 : 0;
}

function timestampIso(value: unknown): string | null {
  const millis = timestampMillis(value);
  return millis > 0 ? new Date(millis).toISOString() : null;
}

function isMissingAuthUser(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code || "");
  return code === "auth/user-not-found" || code.endsWith("/user-not-found");
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { ok: false, mensaje: error.message },
      { status: error.status },
    );
  }

  console.error("ADMIN_ACCESOS_ATLETAS_ERROR:", error);
  return NextResponse.json(
    {
      ok: false,
      mensaje: "No se pudo completar la gestión de acceso del atleta.",
    },
    { status: 500 },
  );
}

function authCreationError(error: unknown): RequestAccessError | null {
  const code = String((error as { code?: unknown })?.code || "");
  if (code === "auth/email-already-exists") {
    return new RequestAccessError(
      "Ese correo ya tiene una cuenta. Elimina su solicitud pendiente o vincula su UID existente.",
      409,
    );
  }
  if (code === "auth/invalid-password") {
    return new RequestAccessError(
      "La contraseña no cumple los requisitos de Firebase Authentication.",
      400,
    );
  }
  if (code === "auth/invalid-email") {
    return new RequestAccessError("El correo electrónico no es válido.", 400);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAdminActorAccess(request);
    const alumnoId = new URL(request.url).searchParams.get("alumnoId")?.trim() || "";
    if (!DOCUMENT_ID_PATTERN.test(alumnoId)) {
      throw new RequestAccessError("La ficha del atleta no es válida.", 400);
    }

    const athleteRef = adminDb.collection("Alumnos").doc(alumnoId);
    const [athleteSnapshot, linkedUsers, payments, attendance] =
      await Promise.all([
        athleteRef.get(),
        adminDb.collection("usuarios").where("alumnoId", "==", alumnoId).get(),
        adminDb.collection("Pagos").where("alumnoId", "==", alumnoId).get(),
        adminDb.collection("Asistencias").where("alumnoId", "==", alumnoId).get(),
      ]);

    if (!athleteSnapshot.exists) {
      throw new RequestAccessError("La ficha del atleta ya no existe.", 404);
    }

    const athlete = athleteSnapshot.data() || {};
    const accessProfile =
      linkedUsers.docs.find(
        (profile) =>
          profile.data().rol === "atleta" && profile.data().activo === true,
      ) || linkedUsers.docs.find((profile) => profile.data().rol === "atleta");
    let authAccount: Awaited<ReturnType<typeof adminAuth.getUser>> | null = null;
    if (accessProfile) {
      try {
        authAccount = await adminAuth.getUser(accessProfile.id);
      } catch (error) {
        if (!isMissingAuthUser(error)) throw error;
      }
    }

    const orderedPayments = payments.docs.sort(
      (left, right) =>
        timestampMillis(right.data().fecha) - timestampMillis(left.data().fecha),
    );
    const orderedAttendance = attendance.docs.sort(
      (left, right) =>
        timestampMillis(right.data().fecha) - timestampMillis(left.data().fecha),
    );
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    const physicalHistory = Array.isArray(athlete.historialFisico)
      ? athlete.historialFisico
      : [];
    const latestPhysical = [...physicalHistory]
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
      .sort((left, right) =>
        String(right.fecha || "").localeCompare(String(left.fecha || "")),
      )[0];

    return NextResponse.json({
      ok: true,
      alumno: {
        id: athleteSnapshot.id,
        nombre: String(athlete.nombre || "Atleta"),
        telefono: String(athlete.telefono || ""),
        sede: String(athlete.sede || ""),
        disciplina: String(athlete.disciplina || ""),
        grado: String(athlete.grado || ""),
        objetivo: String(athlete.objetivo || ""),
        estadoPago: String(athlete.estadoPago || ""),
        diaPago: Number(athlete.diaPago || 0),
        pesoActual: Number(athlete.pesoActual || 0),
        pesoObjetivo: Number(athlete.pesoObjetivo || 0),
        proximaCompetencia: String(athlete.proximaCompetencia || ""),
        activo: athlete.activo !== false,
      },
      acceso: accessProfile
        ? {
            uid: accessProfile.id,
            activo: accessProfile.data().activo === true,
            email: authAccount?.email || String(accessProfile.data().email || ""),
            emailVerificado: authAccount?.emailVerified === true,
            bloqueado: authAccount?.disabled === true,
            creadoEn: authAccount?.metadata.creationTime || null,
            ultimoIngreso: authAccount?.metadata.lastSignInTime || null,
            existeEnAuthentication: Boolean(authAccount),
          }
        : null,
      actividad: {
        asistenciasTotales: attendance.size,
        asistencias30Dias: attendance.docs.filter(
          (entry) => timestampMillis(entry.data().fecha) >= thirtyDaysAgo,
        ).length,
        ultimaAsistencia: orderedAttendance[0]
          ? timestampIso(orderedAttendance[0].data().fecha)
          : null,
        pagosTotales: payments.size,
        ultimoPago: orderedPayments[0]
          ? {
              fecha: timestampIso(orderedPayments[0].data().fecha),
              periodo: String(orderedPayments[0].data().periodo || ""),
              monto: Number(orderedPayments[0].data().monto || 0),
              metodo: String(orderedPayments[0].data().metodoPago || ""),
            }
          : null,
        evaluacionesFisicas: physicalHistory.length,
        ultimaEvaluacion: latestPhysical
          ? {
              fecha: String(latestPhysical.fecha || ""),
              pesoKg: Number(latestPhysical.pesoKg || 0),
              imc: Number(latestPhysical.imc || 0),
              puntaje: Number(
                (latestPhysical.puntajeBateria60 as { general?: unknown } | undefined)
                  ?.general || 0,
              ),
            }
          : null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let createdUid = "";

  try {
    const actor = await requireAdminActorAccess(request);
    const body = (await request.json().catch(() => ({}))) as {
      alumnoId?: unknown;
      email?: unknown;
      password?: unknown;
    };
    const alumnoId =
      typeof body.alumnoId === "string" ? body.alumnoId.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!DOCUMENT_ID_PATTERN.test(alumnoId)) {
      throw new RequestAccessError("La ficha del atleta no es válida.", 400);
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      throw new RequestAccessError("Escribe un correo electrónico válido.", 400);
    }
    if (password.length < 8 || password.length > 128) {
      throw new RequestAccessError(
        "La contraseña debe tener entre 8 y 128 caracteres.",
        400,
      );
    }

    const athleteRef = adminDb.collection("Alumnos").doc(alumnoId);
    const photoRef = adminDb.collection("FotosAtletas").doc(alumnoId);
    const [athleteSnapshot, linkedUsersSnapshot, photoSnapshot] =
      await Promise.all([
        athleteRef.get(),
        adminDb
          .collection("usuarios")
          .where("alumnoId", "==", alumnoId)
          .get(),
        photoRef.get(),
      ]);

    if (!athleteSnapshot.exists) {
      throw new RequestAccessError("La ficha del atleta ya no existe.", 404);
    }

    const athlete = athleteSnapshot.data() || {};
    if (athlete.activo === false) {
      throw new RequestAccessError(
        "No se puede crear acceso para una ficha inactiva.",
        409,
      );
    }

    const protectedProfile = linkedUsersSnapshot.docs.find(
      (profile) => String(profile.data().rol || "") !== "atleta",
    );
    if (protectedProfile) {
      throw new RequestAccessError(
        "La ficha está asociada con una cuenta administrativa o de profesor.",
        409,
      );
    }
    if (
      linkedUsersSnapshot.docs.some((profile) => profile.data().activo === true)
    ) {
      throw new RequestAccessError(
        "El atleta ya tiene una cuenta activa. Usa Actualizar UID si necesitas reemplazarla.",
        409,
      );
    }

    const nombre = String(athlete.nombre || "Atleta").trim() || "Atleta";
    const sede = String(athlete.sede || "MMA");
    if (!["MMA", "CAUCEL", "JUAN_PABLO"].includes(sede)) {
      throw new RequestAccessError("La ficha tiene una sede inválida.", 409);
    }

    const account = await adminAuth.createUser({
      email,
      password,
      displayName: nombre,
      disabled: false,
      emailVerified: false,
    });
    createdUid = account.uid;

    const [firstName, ...lastName] = nombre.split(/\s+/);
    const batch = adminDb.batch();
    linkedUsersSnapshot.docs.forEach((previousProfile) => {
      batch.update(previousProfile.ref, {
        activo: false,
        alumnoId: FieldValue.delete(),
        reemplazadoPorUid: account.uid,
        actualizadoEn: FieldValue.serverTimestamp(),
        actualizadoPor: actor.uid,
      });
    });
    batch.set(adminDb.collection("usuarios").doc(account.uid), {
      rol: "atleta",
      activo: true,
      alumnoId,
      sede,
      nombre,
      email,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
      actualizadoPor: actor.uid,
    });
    batch.set(adminDb.collection("perfiles").doc(account.uid), {
      id: account.uid,
      email,
      firstName,
      lastName: lastName.join(" "),
      age: 0,
      gender: "other",
      heightCm: 0,
      weightKg: 0,
      activityLevel: 1.2,
      athleticDiscipline: String(athlete.disciplina || "MMA"),
      goal: "maintain",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (photoSnapshot.exists) {
      batch.update(photoRef, {
        usuarioId: account.uid,
        actualizadoEn: FieldValue.serverTimestamp(),
        actualizadoPor: actor.uid,
      });
    }
    await batch.commit();

    return NextResponse.json({ ok: true, uid: account.uid });
  } catch (error) {
    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
      } catch (cleanupError) {
        console.error("ADMIN_ATHLETE_ACCOUNT_ROLLBACK_ERROR:", cleanupError);
      }
    }
    return errorResponse(authCreationError(error) || error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminActorAccess(request);

    const body = (await request.json().catch(() => ({}))) as { uid?: unknown };
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    if (!UID_PATTERN.test(uid)) {
      throw new RequestAccessError("La solicitud tiene un UID inválido.", 400);
    }

    const requestRef = adminDb.collection("SolicitudesAcceso").doc(uid);
    const profileRef = adminDb.collection("perfiles").doc(uid);
    const userRef = adminDb.collection("usuarios").doc(uid);
    const [requestSnapshot, userSnapshot] = await Promise.all([
      requestRef.get(),
      userRef.get(),
    ]);

    if (!requestSnapshot.exists) {
      throw new RequestAccessError("La solicitud ya no existe.", 404);
    }

    const requestData = requestSnapshot.data() || {};
    if (requestData.uid && requestData.uid !== uid) {
      throw new RequestAccessError("La solicitud contiene un UID inconsistente.", 409);
    }
    if (requestData.estado !== "pendiente") {
      throw new RequestAccessError(
        "Solo se pueden eliminar solicitudes que siguen pendientes.",
        409,
      );
    }
    if (userSnapshot.exists) {
      throw new RequestAccessError(
        "La cuenta ya está vinculada. Desactívala o desvincúlala antes de eliminarla.",
        409,
      );
    }

    let authUserDeleted = true;
    try {
      await adminAuth.deleteUser(uid);
    } catch (error) {
      if (!isMissingAuthUser(error)) throw error;
      authUserDeleted = false;
    }

    const batch = adminDb.batch();
    batch.delete(requestRef);
    batch.delete(profileRef);
    await batch.commit();

    return NextResponse.json({ ok: true, authUserDeleted });
  } catch (error) {
    return errorResponse(error);
  }
}
