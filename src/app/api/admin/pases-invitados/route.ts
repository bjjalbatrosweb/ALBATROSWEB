import { createHash, randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import { RequestAccessError, requirePanelActorAccess } from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SITES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function text(value: unknown, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
function siteValue(value: unknown): Sede | null { const site = text(value, 30).toUpperCase().replace(/\s+/g, "_") as Sede; return SITES.includes(site) ? site : null; }
function iso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : null; }
function serialize(document: FirebaseFirestore.DocumentSnapshot) { const data = document.data() || {}; return { id: document.id, site: String(data.sede || ""), guestName: String(data.guestName || "Invitado"), discipline: String(data.discipline || ""), hostName: String(data.hostName || ""), notes: String(data.notes || ""), active: data.active === true, uses: Math.max(0, Number(data.uses) || 0), maxUses: Math.max(1, Number(data.maxUses) || 1), validFrom: iso(data.validFrom), validUntil: iso(data.validUntil), lastUsedAt: iso(data.lastUsedAt), history: Array.isArray(data.history) ? data.history.slice(0, 20) : [], createdAt: iso(data.createdAt) }; }
function passUrl(request: Request, id: string, token: string) { return `${new URL(request.url).origin}/pase-invitado/${id}?token=${encodeURIComponent(token)}`; }
function failure(error: unknown) { if (error instanceof RequestAccessError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status }); const message = error instanceof Error ? error.message : ""; if (message.startsWith("VALIDATION:")) return NextResponse.json({ ok: false, mensaje: message.slice(11) }, { status: 400 }); return NextResponse.json({ ok: false, mensaje: "No se pudo administrar el pase." }, { status: 500 }); }

export async function GET(request: Request) {
  try { const site = siteValue(new URL(request.url).searchParams.get("sede")); if (!site) throw new Error("VALIDATION:Sede inválida."); await requirePanelActorAccess(request, site); const snapshot = await adminDb.collection("PasesInvitados").where("sede", "==", site).limit(150).get(); const passes = snapshot.docs.map(serialize).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); return NextResponse.json({ ok: true, passes }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})); const site = siteValue(body.sede); if (!site) throw new Error("VALIDATION:Sede inválida."); const actor = await requirePanelActorAccess(request, site);
    if (body.action === "create") {
      const guestName = text(body.guestName, 80); const discipline = text(body.discipline, 50); const hostName = text(body.hostName, 80); const maxUses = Math.max(1, Math.min(10, Math.floor(Number(body.maxUses) || 1))); const validHours = Math.max(1, Math.min(168, Math.floor(Number(body.validHours) || 24)));
      if (!guestName || !discipline) throw new Error("VALIDATION:Escribe el nombre del invitado y la disciplina.");
      const token = randomBytes(24).toString("base64url"); const ref = adminDb.collection("PasesInvitados").doc(); const now = Date.now();
      await ref.create({ sede: site, guestName, discipline, hostName, notes: text(body.notes, 300), active: true, uses: 0, maxUses, tokenHash: hash(token), validFrom: Timestamp.fromMillis(now), validUntil: Timestamp.fromMillis(now + validHours * 60 * 60 * 1000), history: [], createdBy: actor.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, pass: serialize(await ref.get()), url: passUrl(request, ref.id, token) });
    }
    const id = text(body.id, 100); const ref = adminDb.collection("PasesInvitados").doc(id); const snapshot = await ref.get(); if (!snapshot.exists || snapshot.data()?.sede !== site) throw new Error("VALIDATION:Pase no encontrado.");
    if (body.action === "revoke") { await ref.update({ active: false, revokedAt: FieldValue.serverTimestamp(), revokedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); return NextResponse.json({ ok: true, pass: serialize(await ref.get()) }); }
    if (body.action === "reissue") { const token = randomBytes(24).toString("base64url"); await ref.update({ tokenHash: hash(token), active: true, updatedAt: FieldValue.serverTimestamp() }); return NextResponse.json({ ok: true, pass: serialize(await ref.get()), url: passUrl(request, ref.id, token) }); }
    throw new Error("VALIDATION:Acción inválida.");
  } catch (error) { return failure(error); }
}
