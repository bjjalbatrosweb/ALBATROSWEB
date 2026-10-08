import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import { RequestAccessError, requirePanelActorAccess } from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
type Question = { id: string; label: string; type: "rating" | "choice" | "text"; options: string[]; required: boolean };

function text(value: unknown, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
function siteValue(value: unknown): Sede | null { const site = text(value, 30).toUpperCase().replace(/\s+/g, "_") as Sede; return SITES.includes(site) ? site : null; }
function iso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : null; }
function questions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((item, index): Question => {
    const raw = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const type: Question["type"] = raw.type === "choice" || raw.type === "text" ? raw.type : "rating";
    const options = type === "choice" && Array.isArray(raw.options) ? raw.options.map((option) => text(option, 60)).filter(Boolean).slice(0, 8) : [];
    return { id: `q${index + 1}`, label: text(raw.label, 160), type, options, required: raw.required !== false };
  }).filter((question) => question.label && (question.type !== "choice" || question.options.length >= 2));
}
function serialize(document: FirebaseFirestore.DocumentSnapshot) {
  const data = document.data() || {};
  return { id: document.id, title: String(data.title || "Encuesta"), description: String(data.description || ""), site: String(data.sede || ""), active: data.active === true, questions: Array.isArray(data.questions) ? data.questions : [], responseCount: Math.max(0, Number(data.responseCount) || 0), createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt) };
}
function failure(error: unknown) {
  if (error instanceof RequestAccessError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("VALIDATION:")) return NextResponse.json({ ok: false, mensaje: message.slice(11) }, { status: 400 });
  return NextResponse.json({ ok: false, mensaje: "No se pudo administrar la encuesta." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const site = siteValue(new URL(request.url).searchParams.get("sede"));
    if (!site) throw new Error("VALIDATION:Sede inválida.");
    await requirePanelActorAccess(request, site);
    const snapshot = await adminDb.collection("EncuestasPersonalizadas").where("sede", "==", site).limit(100).get();
    const surveys = await Promise.all(snapshot.docs.map(async (document) => {
      const survey = serialize(document); const responses = await document.ref.collection("Respuestas").limit(40).get();
      return { ...survey, responses: responses.docs.map((response) => ({ id: response.id, answers: response.data().answers || {} })) };
    }));
    return NextResponse.json({ ok: true, surveys: surveys.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})); const site = siteValue(body.sede);
    if (!site) throw new Error("VALIDATION:Sede inválida.");
    const actor = await requirePanelActorAccess(request, site);
    if (body.action === "create") {
      const title = text(body.title, 100); const description = text(body.description, 300); const parsedQuestions = questions(body.questions);
      if (!title) throw new Error("VALIDATION:Escribe un título.");
      if (!parsedQuestions.length) throw new Error("VALIDATION:Agrega al menos una pregunta válida.");
      const ref = adminDb.collection("EncuestasPersonalizadas").doc();
      await ref.create({ sede: site, title, description, questions: parsedQuestions, active: body.active !== false, responseCount: 0, createdBy: actor.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, survey: serialize(await ref.get()) });
    }
    const id = text(body.id, 100); const ref = adminDb.collection("EncuestasPersonalizadas").doc(id); const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.sede !== site) throw new Error("VALIDATION:Encuesta no encontrada.");
    if (body.action === "set-active") {
      await ref.update({ active: body.active === true, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, survey: serialize(await ref.get()) });
    }
    throw new Error("VALIDATION:Acción inválida.");
  } catch (error) { return failure(error); }
}
