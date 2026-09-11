import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { RequestAccessError, requireActiveActorAccess } from "@/lib/server-access";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActiveActorAccess(request);
    if (actor.profile.rol !== "atleta")
      throw new RequestAccessError("Solo una cuenta de atleta puede consultar reservas.", 403);
    const requestedIds = [...new Set(
      (new URL(request.url).searchParams.get("claseIds") || "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^[A-Za-z0-9_-]{1,120}$/.test(value)),
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
    const rate = await checkRateLimit(request, { scope: "reservas-atleta", limit: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos. Espera un momento." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const actor = await requireActiveActorAccess(request);
    if (actor.profile.rol !== "atleta" || !actor.profile.alumnoId) throw new RequestAccessError("Solo una cuenta de atleta puede reservar.", 403);
    const body = await request.json().catch(() => ({}));
    const classId = typeof body.claseId === "string" ? body.claseId.trim().slice(0, 120) : "";
    if (!classId) return NextResponse.json({ ok: false, mensaje: "Clase inválida." }, { status: 400 });
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
    const rate = await checkRateLimit(request, { scope: "reservas-atleta", limit: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos. Espera un momento." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const actor = await requireActiveActorAccess(request);
    if (actor.profile.rol !== "atleta") throw new RequestAccessError("Solo una cuenta de atleta puede cancelar.", 403);
    const classId = new URL(request.url).searchParams.get("claseId")?.trim().slice(0, 120) || "";
    if (!classId) return NextResponse.json({ ok: false, mensaje: "Clase inválida." }, { status: 400 });
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
