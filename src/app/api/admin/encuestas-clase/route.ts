import { randomBytes, createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { surveyAverage } from "@/lib/class-survey";
import { adminDb } from "@/lib/firebase-admin";
import { RequestAccessError, requirePanelActorAccess } from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SITES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function text(value: unknown, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
function siteValue(value: unknown): Sede | null {
  const site = text(value, 30).toUpperCase().replace(/\s+/g, "_") as Sede;
  return SITES.includes(site) ? site : null;
}
function iso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : null; }
function serialize(document: FirebaseFirestore.DocumentSnapshot) {
  const data = document.data() || {}; const count = Math.max(0, Number(data.responseCount) || 0); const sums = data.sums || {};
  return { id: document.id, site: String(data.sede || ""), className: String(data.className || "Clase"), discipline: String(data.discipline || ""), instructorName: String(data.instructorName || ""), active: data.active === true && data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > Date.now(), responseCount: count, averages: { classQuality: surveyAverage(sums.classQuality, count), instructor: surveyAverage(sums.instructor, count), intensity: surveyAverage(sums.intensity, count), facilities: surveyAverage(sums.facilities, count), recommendation: surveyAverage(sums.recommendation, count) }, comments: Array.isArray(data.recentComments) ? data.recentComments.slice(0, 20) : [], createdAt: iso(data.createdAt), expiresAt: iso(data.expiresAt) };
}
function failure(error: unknown) {
  if (error instanceof RequestAccessError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("VALIDATION:")) return NextResponse.json({ ok: false, mensaje: message.slice(11) }, { status: 400 });
  return NextResponse.json({ ok: false, mensaje: "No se pudo administrar la encuesta." }, { status: 500 });
}
function shareUrl(request: Request, id: string, token: string) { return `${new URL(request.url).origin}/encuesta-clase/${id}?token=${encodeURIComponent(token)}`; }

export async function GET(request: Request) {
  try {
    const site = siteValue(new URL(request.url).searchParams.get("sede"));
    if (!site) throw new Error("VALIDATION:Sede inválida.");
    await requirePanelActorAccess(request, site);
    const snapshot = await adminDb.collection("EncuestasClase").where("sede", "==", site).limit(100).get();
    const surveys = snapshot.docs.map(serialize).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return NextResponse.json({ ok: true, surveys });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})); const site = siteValue(body.sede);
    if (!site) throw new Error("VALIDATION:Sede inválida.");
    const actor = await requirePanelActorAccess(request, site);
    if (body.action === "create") {
      const className = text(body.className, 80); const discipline = text(body.discipline, 50); const instructorName = text(body.instructorName, 80); const hours = Math.max(1, Math.min(48, Math.floor(Number(body.hours) || 8)));
      if (!className || !discipline) throw new Error("VALIDATION:Escribe la clase y la disciplina.");
      const token = randomBytes(24).toString("base64url"); const ref = adminDb.collection("EncuestasClase").doc();
      await ref.create({ sede: site, className, discipline, instructorName, active: true, tokenHash: hash(token), responseCount: 0, sums: { classQuality: 0, instructor: 0, intensity: 0, facilities: 0, recommendation: 0 }, recentComments: [], createdBy: actor.uid, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + hours * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, survey: serialize(await ref.get()), url: shareUrl(request, ref.id, token) });
    }
    const id = text(body.id, 100); const ref = adminDb.collection("EncuestasClase").doc(id); const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.sede !== site) throw new Error("VALIDATION:Encuesta no encontrada.");
    if (body.action === "close") {
      await ref.update({ active: false, closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, survey: serialize(await ref.get()) });
    }
    if (body.action === "renew") {
      const token = randomBytes(24).toString("base64url"); const hours = Math.max(1, Math.min(48, Math.floor(Number(body.hours) || 8)));
      await ref.update({ active: true, tokenHash: hash(token), expiresAt: Timestamp.fromMillis(Date.now() + hours * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, survey: serialize(await ref.get()), url: shareUrl(request, ref.id, token) });
    }
    throw new Error("VALIDATION:Acción inválida.");
  } catch (error) { return failure(error); }
}
