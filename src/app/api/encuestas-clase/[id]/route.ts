import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function integer(value: unknown, minimum: number, maximum: number) { const number = Number(value); return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null; }
function tokenValid(token: string, stored: unknown) { return token.length >= 24 && typeof stored === "string" && hash(token) === stored; }
function publicSurvey(id: string, data: FirebaseFirestore.DocumentData) { return { id, className: String(data.className || "Clase"), discipline: String(data.discipline || ""), instructorName: String(data.instructorName || ""), site: String(data.sede || ""), expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate().toISOString() : null }; }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, { scope: "encuesta-clase-ver", limit: 120, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiadas consultas." }, { status: 429 });
  const { id } = await context.params; const token = new URL(request.url).searchParams.get("token") || ""; const snapshot = await adminDb.collection("EncuestasClase").doc(id).get(); const data = snapshot.data();
  if (!snapshot.exists || !data || !tokenValid(token, data.tokenHash)) return NextResponse.json({ ok: false, mensaje: "Encuesta no encontrada." }, { status: 404 });
  if (data.active !== true || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() < Date.now()) return NextResponse.json({ ok: false, mensaje: "Esta encuesta ya cerró." }, { status: 410 });
  return NextResponse.json({ ok: true, survey: publicSurvey(id, data) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, { scope: "encuesta-clase-responder", limit: 15, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos." }, { status: 429 });
  try {
    const { id } = await context.params; const body = await request.json().catch(() => ({})); const token = typeof body.token === "string" ? body.token : ""; const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const classQuality = integer(body.classQuality, 1, 5); const instructor = integer(body.instructor, 1, 5); const intensity = integer(body.intensity, 1, 5); const facilities = integer(body.facilities, 1, 5); const recommendation = integer(body.recommendation, 0, 10); const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : "";
    if (deviceId.length < 8 || !classQuality || !instructor || !intensity || !facilities || recommendation === null) return NextResponse.json({ ok: false, mensaje: "Completa todas las calificaciones." }, { status: 400 });
    const ref = adminDb.collection("EncuestasClase").doc(id); const responseRef = ref.collection("Respuestas").doc(hash(`${id}:${deviceId}`).slice(0, 40));
    await adminDb.runTransaction(async (transaction) => {
      const [surveySnapshot, responseSnapshot] = await Promise.all([transaction.get(ref), transaction.get(responseRef)]); const data = surveySnapshot.data();
      if (!surveySnapshot.exists || !data || !tokenValid(token, data.tokenHash)) throw new Error("INVALID");
      if (data.active !== true || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() < Date.now()) throw new Error("CLOSED");
      if (responseSnapshot.exists) throw new Error("DUPLICATE");
      const response = { classQuality, instructor, intensity, facilities, recommendation, comment, deviceHash: hash(deviceId), at: FieldValue.serverTimestamp() };
      transaction.create(responseRef, response);
      const comments = Array.isArray(data.recentComments) ? data.recentComments : [];
      transaction.update(ref, { responseCount: FieldValue.increment(1), "sums.classQuality": FieldValue.increment(classQuality), "sums.instructor": FieldValue.increment(instructor), "sums.intensity": FieldValue.increment(intensity), "sums.facilities": FieldValue.increment(facilities), "sums.recommendation": FieldValue.increment(recommendation), recentComments: comment ? [{ text: comment, at: new Date().toISOString() }, ...comments].slice(0, 20) : comments, updatedAt: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "DUPLICATE") return NextResponse.json({ ok: false, mensaje: "Este dispositivo ya respondió la encuesta." }, { status: 409 });
    if (code === "CLOSED") return NextResponse.json({ ok: false, mensaje: "Esta encuesta ya cerró." }, { status: 410 });
    if (code === "INVALID") return NextResponse.json({ ok: false, mensaje: "Enlace inválido." }, { status: 403 });
    return NextResponse.json({ ok: false, mensaje: "No se pudo guardar la respuesta." }, { status: 500 });
  }
}
