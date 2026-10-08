import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function text(value: unknown, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
function validSite(value: unknown) { const site = text(value, 30).toUpperCase().replace(/\s+/g, "_"); return ["MMA", "CAUCEL", "JUAN_PABLO"].includes(site) ? site : "MMA"; }
function integer(value: unknown, minimum: number, maximum: number) { const number = Number(value); return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null; }

export async function GET(request: Request) {
  const rate = await checkRateLimit(request, { scope: "ipad-encuestas-ver", limit: 90, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiadas consultas." }, { status: 429 });
  const site = validSite(new URL(request.url).searchParams.get("sede")); const now = Date.now();
  const [classSnapshot, customSnapshot] = await Promise.all([
    adminDb.collection("EncuestasClase").where("sede", "==", site).where("active", "==", true).limit(20).get(),
    adminDb.collection("EncuestasPersonalizadas").where("sede", "==", site).where("active", "==", true).limit(20).get(),
  ]);
  const classes = classSnapshot.docs.filter((document) => { const expiresAt = document.data().expiresAt; return expiresAt instanceof Timestamp && expiresAt.toMillis() > now; }).map((document) => { const data = document.data(); return { id: document.id, type: "class", title: String(data.className || "Clase"), description: [data.discipline, data.instructorName].filter(Boolean).join(" · ") }; });
  const custom = customSnapshot.docs.map((document) => { const data = document.data(); return { id: document.id, type: "custom", title: String(data.title || "Encuesta"), description: String(data.description || ""), questions: Array.isArray(data.questions) ? data.questions : [] }; });
  return NextResponse.json({ ok: true, surveys: [...classes, ...custom] });
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, { scope: "ipad-encuestas-responder", limit: 20, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos." }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({})); const id = text(body.id, 100); const type = body.type === "class" ? "class" : "custom"; const deviceId = text(body.deviceId, 100); const responseId = text(body.responseId, 100); const site = validSite(body.sede);
    if (!id || deviceId.length < 8 || responseId.length < 8) return NextResponse.json({ ok: false, mensaje: "No se pudo identificar esta respuesta." }, { status: 400 });
    const collection = type === "class" ? "EncuestasClase" : "EncuestasPersonalizadas"; const ref = adminDb.collection(collection).doc(id); const responseRef = ref.collection("Respuestas").doc(hash(`${id}:${deviceId}:${responseId}`).slice(0, 40));
    await adminDb.runTransaction(async (transaction) => {
      const [surveySnapshot, responseSnapshot] = await Promise.all([transaction.get(ref), transaction.get(responseRef)]); const data = surveySnapshot.data();
      if (!surveySnapshot.exists || !data || data.sede !== site) throw new Error("INVALID");
      if (data.active !== true || (type === "class" && (!(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() < Date.now()))) throw new Error("CLOSED");
      if (responseSnapshot.exists) throw new Error("DUPLICATE");
      if (type === "class") {
        const ratings = body.answers || {}; const classQuality = integer(ratings.classQuality, 1, 5); const instructor = integer(ratings.instructor, 1, 5); const intensity = integer(ratings.intensity, 1, 5); const facilities = integer(ratings.facilities, 1, 5); const recommendation = integer(ratings.recommendation, 0, 10); const comment = text(ratings.comment, 500);
        if (!classQuality || !instructor || !intensity || !facilities || recommendation === null) throw new Error("INCOMPLETE");
        transaction.create(responseRef, { classQuality, instructor, intensity, facilities, recommendation, comment, deviceHash: hash(deviceId), source: "ipad", at: FieldValue.serverTimestamp() });
        const comments = Array.isArray(data.recentComments) ? data.recentComments : [];
        transaction.update(ref, { responseCount: FieldValue.increment(1), "sums.classQuality": FieldValue.increment(classQuality), "sums.instructor": FieldValue.increment(instructor), "sums.intensity": FieldValue.increment(intensity), "sums.facilities": FieldValue.increment(facilities), "sums.recommendation": FieldValue.increment(recommendation), recentComments: comment ? [{ text: comment, at: new Date().toISOString() }, ...comments].slice(0, 20) : comments, updatedAt: FieldValue.serverTimestamp() });
      } else {
        const answers = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : {}; const questions = Array.isArray(data.questions) ? data.questions : [];
        const cleanAnswers: Record<string, string | number> = {};
        questions.forEach((question: Record<string, unknown>) => { const key = text(question.id, 20); const answer = answers[key]; const required = question.required !== false; if (required && (answer === undefined || answer === null || String(answer).trim() === "")) throw new Error("INCOMPLETE"); if (question.type === "rating") { const rating = integer(answer, 1, 5); if (required && rating === null) throw new Error("INCOMPLETE"); if (rating !== null) cleanAnswers[key] = rating; } else if (question.type === "choice") { const choice = text(answer, 60); const options = Array.isArray(question.options) ? question.options.map((option) => text(option, 60)) : []; if (required && !options.includes(choice)) throw new Error("INCOMPLETE"); if (options.includes(choice)) cleanAnswers[key] = choice; } else { const written = text(answer, 500); if (required && !written) throw new Error("INCOMPLETE"); if (written) cleanAnswers[key] = written; } });
        transaction.create(responseRef, { answers: cleanAnswers, deviceHash: hash(deviceId), source: "ipad", at: FieldValue.serverTimestamp() });
        transaction.update(ref, { responseCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      }
    });
    return NextResponse.json({ ok: true, mensaje: "Gracias por compartir tu opinión." });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "DUPLICATE") return NextResponse.json({ ok: false, mensaje: "Este iPad ya registró una respuesta para esta encuesta." }, { status: 409 });
    if (code === "CLOSED") return NextResponse.json({ ok: false, mensaje: "Esta encuesta ya cerró." }, { status: 410 });
    if (code === "INCOMPLETE") return NextResponse.json({ ok: false, mensaje: "Completa las preguntas requeridas." }, { status: 400 });
    if (code === "INVALID") return NextResponse.json({ ok: false, mensaje: "Encuesta no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: false, mensaje: "No se pudo guardar la respuesta." }, { status: 500 });
  }
}
