import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function validToken(token: string, stored: unknown) { return token.length >= 24 && typeof stored === "string" && hash(token) === stored; }
function serialize(id: string, data: FirebaseFirestore.DocumentData) { const uses = Math.max(0, Number(data.uses) || 0); const maximum = Math.max(1, Number(data.maxUses) || 1); const now = Date.now(); let status = "valid"; if (uses >= maximum) status = "used"; else if (data.active !== true) status = "revoked"; else if (!(data.validUntil instanceof Timestamp) || data.validUntil.toMillis() < now) status = "expired"; else if (data.validFrom instanceof Timestamp && data.validFrom.toMillis() > now) status = "scheduled"; return { id, guestName: String(data.guestName || "Invitado"), discipline: String(data.discipline || ""), hostName: String(data.hostName || ""), site: String(data.sede || ""), uses, maxUses: maximum, remaining: Math.max(0, maximum - uses), validFrom: data.validFrom instanceof Timestamp ? data.validFrom.toDate().toISOString() : null, validUntil: data.validUntil instanceof Timestamp ? data.validUntil.toDate().toISOString() : null, status }; }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = await checkRateLimit(request, { scope: "pase-invitado-ver", limit: 120, windowMs: 60_000 }); if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiadas consultas." }, { status: 429 });
  const { id } = await context.params; const token = new URL(request.url).searchParams.get("token") || ""; const snapshot = await adminDb.collection("PasesInvitados").doc(id).get(); const data = snapshot.data(); if (!snapshot.exists || !data || !validToken(token, data.tokenHash)) return NextResponse.json({ ok: false, mensaje: "Pase no encontrado." }, { status: 404 }); return NextResponse.json({ ok: true, pass: serialize(id, data) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = await checkRateLimit(request, { scope: "pase-invitado-usar", limit: 10, windowMs: 60_000 }); if (!rate.allowed) return NextResponse.json({ ok: false, mensaje: "Demasiados intentos." }, { status: 429 });
  try {
    const { id } = await context.params; const body = await request.json().catch(() => ({})); const token = typeof body.token === "string" ? body.token : ""; const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : ""; if (deviceId.length < 8) return NextResponse.json({ ok: false, mensaje: "Dispositivo inválido." }, { status: 400 }); const ref = adminDb.collection("PasesInvitados").doc(id); let result: Record<string, unknown> = {};
    await adminDb.runTransaction(async (transaction) => { const snapshot = await transaction.get(ref); const data = snapshot.data(); if (!snapshot.exists || !data || !validToken(token, data.tokenHash)) throw new Error("INVALID"); const now = Date.now(); const uses = Math.max(0, Number(data.uses) || 0); const maximum = Math.max(1, Number(data.maxUses) || 1); if (uses >= maximum) throw new Error("USED"); if (data.active !== true) throw new Error("REVOKED"); if (!(data.validUntil instanceof Timestamp) || data.validUntil.toMillis() < now || (data.validFrom instanceof Timestamp && data.validFrom.toMillis() > now)) throw new Error("EXPIRED"); if (data.lastUsedAt instanceof Timestamp && now - data.lastUsedAt.toMillis() < 120000) throw new Error("RECENT"); const after = uses + 1; const history = Array.isArray(data.history) ? data.history : []; const entry = { at: new Date().toISOString(), remaining: maximum - after, deviceHash: hash(deviceId) }; transaction.update(ref, { uses: after, active: after < maximum, lastUsedAt: FieldValue.serverTimestamp(), history: [entry, ...history].slice(0, 20), updatedAt: FieldValue.serverTimestamp() }); result = { remaining: maximum - after, completed: after >= maximum }; });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) { const code = error instanceof Error ? error.message : ""; const messages: Record<string, [string, number]> = { INVALID: ["Enlace inválido.", 403], REVOKED: ["Este pase fue revocado.", 410], EXPIRED: ["Este pase no está vigente.", 410], USED: ["Este pase ya agotó sus entradas.", 410], RECENT: ["La entrada ya fue registrada hace un momento.", 409] }; const known = messages[code]; return NextResponse.json({ ok: false, mensaje: known?.[0] || "No se pudo registrar la entrada." }, { status: known?.[1] || 500 }); }
}
