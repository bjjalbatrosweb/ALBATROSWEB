import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { serializarCombate } from "@/lib/taekwondo";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=2, s-maxage=5, stale-while-revalidate=10",
};

export async function GET(request: Request) {
  const rate = checkRateLimit(request, {
    scope: "mesas-publicas",
    limit: 300,
    windowMs: 60_000,
  });
  if (!rate.allowed)
    return NextResponse.json(
      { ok: false, mensaje: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  try {
    const snap = await adminDb
      .collection("CombatesTaekwondo")
      .where("fase", "!=", "finalizado")
      .limit(50)
      .get();
    const mesas = snap.docs
      .map((doc) => ({
        ...serializarCombate(doc.data(), doc.id),
        protegida: Boolean(doc.data().pinHash),
      }))
      .sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
    return NextResponse.json(
      { ok: true, mesas },
      { headers: PUBLIC_CACHE_HEADERS },
    );
  } catch (error) {
    console.error("ERROR_MESAS_PUBLICAS:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron cargar las mesas abiertas." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      mensaje:
        "La unión abierta fue desactivada. Escanea el QR de un solo uso mostrado por la mesa.",
    },
    { status: 410 },
  );
}
