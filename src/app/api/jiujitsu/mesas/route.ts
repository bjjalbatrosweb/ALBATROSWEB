import { randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  hashTokenJiujitsu,
  serializarCombateJiujitsu,
  tokenJiujitsuValido,
} from "@/lib/jiujitsu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rate = checkRateLimit(request, {
    scope: "jiujitsu-mesas-publicas",
    limit: 300,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, mensaje: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  try {
    const snapshot = await adminDb
      .collection("CombatesJiujitsu")
      .where("fase", "!=", "finalizado")
      .limit(50)
      .get();
    const mesas = snapshot.docs
      .map((documento) => ({
        ...serializarCombateJiujitsu(documento.data(), documento.id),
        protegida: Boolean(documento.data().pinHash),
      }))
      .sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
    return NextResponse.json(
      { ok: true, mesas },
      {
        headers: {
          "Cache-Control":
            "public, max-age=2, s-maxage=5, stale-while-revalidate=10",
        },
      },
    );
  } catch (error) {
    console.error("ERROR_MESAS_JIUJITSU:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron cargar las mesas abiertas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, {
    scope: "jiujitsu-unirse-mesa",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, mensaje: "Demasiados intentos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    const pin = String(body.pin || "").trim();
    const ref = adminDb.collection("CombatesJiujitsu").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.fase === "finalizado") {
      return NextResponse.json(
        { ok: false, mensaje: "La mesa ya no está disponible." },
        { status: 404 },
      );
    }

    const pinHash = String(snapshot.data()?.pinHash || "");
    if (pinHash && !tokenJiujitsuValido(pin, pinHash)) {
      return NextResponse.json(
        { ok: false, mensaje: "PIN incorrecto." },
        { status: 403 },
      );
    }

    const active = await ref
      .collection("Controles")
      .where("activo", "==", true)
      .get();
    const valid = active.docs.filter(
      (documento) =>
        documento.data().expiraEn instanceof Timestamp &&
        documento.data().expiraEn.toMillis() > Date.now(),
    );
    if (valid.length >= 4) {
      return NextResponse.json(
        { ok: false, mensaje: "La mesa ya tiene cuatro controles." },
        { status: 409 },
      );
    }

    const nombre =
      String(body.nombre || `Árbitro ${valid.length + 1}`)
        .trim()
        .slice(0, 30) || `Árbitro ${valid.length + 1}`;
    const secret = randomBytes(24).toString("base64url");
    const controlRef = ref.collection("Controles").doc();
    await controlRef.create({
      nombre,
      tokenHash: hashTokenJiujitsu(secret),
      activo: true,
      origen: "union_publica",
      creadoEn: FieldValue.serverTimestamp(),
      expiraEn: Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000),
      ultimoContacto: null,
    });
    await ref.update({
      controlesActivos: valid.length + 1,
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({
      ok: true,
      controlToken: `${controlRef.id}.${secret}`,
    });
  } catch (error) {
    console.error("ERROR_UNIRSE_JIUJITSU:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo conectar el control." },
      { status: 500 },
    );
  }
}
