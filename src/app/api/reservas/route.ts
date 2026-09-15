import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { RequestAccessError, requireActiveActorAccess } from "@/lib/server-access";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLASS_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;

function timestampMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    const toMillis = (value as { toMillis?: unknown }).toMillis;
    if (typeof toMillis === "function") {
      return Number(toMillis.call(value)) || 0;
    }
  }
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActiveActorAccess(request);
    if (actor.profile.rol !== "atleta" || !actor.profile.alumnoId || !actor.profile.sede)
      throw new RequestAccessError("Solo una cuenta de atleta puede consultar reservas.", 403);
    const parameters = new URL(request.url).searchParams;
    const rawRequestedIds = parameters.get("claseIds");

    if (rawRequestedIds === null) {
      const now = Date.now();
      const monthAgo = now - 30 * 86_400_000;
      const [classesSnapshot, attendanceSnapshot] = await Promise.all([
        adminDb
          .collection("ReservasClases")
          .where("sede", "==", actor.profile.sede)
          .limit(300)
          .get(),
        adminDb
          .collection("Asistencias")
          .where("alumnoId", "==", actor.profile.alumnoId)
          .limit(500)
          .get(),
      ]);
      const classes = classesSnapshot.docs
        .filter((entry) => {
          const data = entry.data() || {};
          return data.estado === "publicada" && timestampMillis(data.inicio) > now;
        })
        .sort(
          (left, right) =>
            timestampMillis(left.data().inicio) - timestampMillis(right.data().inicio),
        )
        .slice(0, 100);
      const enrollments = classes.length
        ? await adminDb.getAll(
            ...classes.map((entry) =>
              entry.ref.collection("inscripciones").doc(actor.uid),
            ),
          )
        : [];
      const items = classes.map((entry, index) => {
        const data = entry.data() || {};
        const startsAt = timestampMillis(data.inicio);
        return {
          id: entry.id,
          nombre: String(data.nombre || "Clase").slice(0, 80),
          disciplina: String(data.disciplina || "Entrenamiento").slice(0, 80),
          profesor: String(data.profesor || "").slice(0, 80),
          sede: String(data.sede || actor.profile.sede),
          inicio: new Date(startsAt).toISOString(),
          cupo: Math.max(1, Math.min(200, Math.floor(Number(data.cupo) || 1))),
          reservados: Math.max(0, Math.floor(Number(data.reservados) || 0)),
          estado: "publicada" as const,
          reservada:
            Boolean(enrollments[index]?.exists) &&
            enrollments[index]?.data()?.estado === "confirmada",
        };
      });
      const attendanceTimes = attendanceSnapshot.docs
        .map((entry) => timestampMillis(entry.data()?.fecha))
        .filter((value) => value > 0)
        .sort((left, right) => right - left);

      return NextResponse.json({
        ok: true,
        sede: actor.profile.sede,
        items,
        asistencia: {
          ultFecha: attendanceTimes[0]
            ? new Date(attendanceTimes[0]).toISOString()
            : null,
          ultimos30Dias: attendanceTimes.filter((value) => value >= monthAgo).length,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    const requestedIds = [...new Set(
      rawRequestedIds
        .split(",")
        .map((value) => value.trim())
        .filter((value) => CLASS_ID_PATTERN.test(value)),
    )].slice(0, 100);
    if (requestedIds.length === 0)
      return NextResponse.json({ ok: true, claseIds: [] });
    const references = requestedIds.map((classId) =>
      adminDb.collection("ReservasClases").doc(classId).collection("inscripciones").doc(actor.uid),
    );
    const snapshots = await adminDb.getAll(...references);
    const claseIds = snapshots
      .map((entry, index) =>
        entry.exists && entry.data()?.estado === "confirmada"
          ? requestedIds[index]
          : "",
      )
      .filter(Boolean);
    return NextResponse.json({ ok: true, claseIds });
  } catch (error) {
    if (error instanceof RequestAccessError)
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    console.error("RESERVATION_LIST_ERROR", error);
    return NextResponse.json({ ok: false, mensaje: "No se pudieron consultar tus reservas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActiveActorAccess(request);
    if (actor.profile.rol !== "atleta" || !actor.profile.alumnoId) throw new RequestAccessError("Solo una cuenta de atleta puede reservar.", 403);
    const rate = await checkRateLimit(request, { scope: "reservas-atleta", limit: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos. Espera un momento." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const body = await request.json().catch(() => ({}));
    const classId = typeof body.claseId === "string" ? body.claseId.trim().slice(0, 120) : "";
    if (!CLASS_ID_PATTERN.test(classId)) return NextResponse.json({ ok: false, mensaje: "Clase inválida." }, { status: 400 });
    const classRef = adminDb.collection("ReservasClases").doc(classId);
    const enrollmentRef = classRef.collection("inscripciones").doc(actor.uid);
    await adminDb.runTransaction(async (transaction) => {
      const [classSnapshot, enrollmentSnapshot] = await Promise.all([transaction.get(classRef), transaction.get(enrollmentRef)]);
      if (!classSnapshot.exists) throw new RequestAccessError("La clase ya no existe.", 404);
      const data = classSnapshot.data() || {};
      if (data.sede !== actor.profile.sede || data.estado !== "publicada") throw new RequestAccessError("La clase no está disponible para tu sede.", 403);
      if ((data.inicio?.toMillis?.() || 0) <= Date.now()) throw new RequestAccessError("La clase ya comenzó.", 409);
      if (enrollmentSnapshot.exists) throw new RequestAccessError("Ya tienes un lugar reservado.", 409);
      const reserved = Math.max(0, Number(data.reservados) || 0); const capacity = Math.max(0, Number(data.cupo) || 0);
      if (reserved >= capacity) throw new RequestAccessError("La clase ya no tiene lugares.", 409);
      transaction.create(enrollmentRef, { uid: actor.uid, alumnoId: actor.profile.alumnoId, sede: actor.profile.sede, estado: "confirmada", creadoEn: FieldValue.serverTimestamp() });
      transaction.update(classRef, { reservados: FieldValue.increment(1), actualizadoEn: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ ok: true, mensaje: "Lugar reservado." });
  } catch (error) {
    if (error instanceof RequestAccessError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    console.error("RESERVATION_CREATE_ERROR", error);
    return NextResponse.json({ ok: false, mensaje: "No se pudo completar la reserva." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireActiveActorAccess(request);
    if (actor.profile.rol !== "atleta") throw new RequestAccessError("Solo una cuenta de atleta puede cancelar.", 403);
    const rate = await checkRateLimit(request, { scope: "reservas-atleta", limit: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos. Espera un momento." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const classId = new URL(request.url).searchParams.get("claseId")?.trim().slice(0, 120) || "";
    if (!CLASS_ID_PATTERN.test(classId)) return NextResponse.json({ ok: false, mensaje: "Clase inválida." }, { status: 400 });
    const classRef = adminDb.collection("ReservasClases").doc(classId); const enrollmentRef = classRef.collection("inscripciones").doc(actor.uid);
    await adminDb.runTransaction(async (transaction) => {
      const [classSnapshot, enrollment] = await Promise.all([
        transaction.get(classRef),
        transaction.get(enrollmentRef),
      ]);
      if (!classSnapshot.exists)
        throw new RequestAccessError("La clase ya no existe.", 404);
      const classData = classSnapshot.data() || {};
      if (classData.sede !== actor.profile.sede)
        throw new RequestAccessError("La clase no corresponde a tu sede.", 403);
      if ((classData.inicio?.toMillis?.() || 0) <= Date.now())
        throw new RequestAccessError("La clase ya comenzó y la reserva ya no puede cancelarse.", 409);
      if (!enrollment.exists) throw new RequestAccessError("No existe una reserva activa.", 404);
      transaction.delete(enrollmentRef);
      transaction.update(classRef, {
        reservados: Math.max(0, Number(classData.reservados) || 0) - 1,
        actualizadoEn: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ ok: true, mensaje: "Reserva cancelada." });
  } catch (error) {
    if (error instanceof RequestAccessError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    console.error("RESERVATION_DELETE_ERROR", error);
    return NextResponse.json({ ok: false, mensaje: "No se pudo cancelar la reserva." }, { status: 500 });
  }
}
