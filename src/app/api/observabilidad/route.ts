import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { logServerEvent } from "@/lib/observability";

export const runtime = "nodejs";

function safeText(value: unknown, max: number) {
  return typeof value === "string"
    ? value
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[correo]")
        .replace(/\b(?:\+?52)?\s*\d(?:[\s()-]*\d){9,12}\b/g, "[teléfono]")
        .replace(/\b[A-Fa-f0-9]{24,}\b/g, "[identificador]")
        .trim()
        .slice(0, max)
    : "";
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, { scope: "client-errors", limit: 12, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const body = await request.json().catch(() => ({}));
  const message = safeText(body.message, 300); const digest = safeText(body.digest, 100); const path = safeText(body.path, 180);
  if (!message) return NextResponse.json({ ok: false }, { status: 400 });
  const event = { tipo: "client_error", message, digest, path: path.startsWith("/") ? path : "/", userAgent: safeText(request.headers.get("user-agent"), 180), creadoEn: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000) };
  try { await adminDb.collection("ErroresWeb").add(event); logServerEvent("error", "client_error", { message, digest, path: event.path }); } catch (error) { logServerEvent("error", "client_error_storage_failed", { error }); }
  return NextResponse.json({ ok: true });
}
