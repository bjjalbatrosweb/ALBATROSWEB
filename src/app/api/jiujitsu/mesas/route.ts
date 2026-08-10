import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  serializarCombateJiujitsu,
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
