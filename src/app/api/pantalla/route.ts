import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEDES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function normalizarSede(value: unknown): Sede | null {
  if (typeof value !== "string") return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SEDES.includes(sede) ? sede : null;
}

export async function GET(request: Request) {
  try {
    const sede = normalizarSede(new URL(request.url).searchParams.get("sede"));
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }

    const snapshot = await adminDb.collection("Pantallas").doc(sede).get();
    if (!snapshot.exists)
      return NextResponse.json(
        { ok: true, evento: null },
        { headers: PRIVATE_HEADERS },
      );

    const data = snapshot.data() || {};
    const fecha =
      data.fecha instanceof Timestamp
        ? data.fecha.toDate().toISOString()
        : null;
    return NextResponse.json(
      {
        ok: true,
        evento: {
          nombre: String(data.nombre || ""),
          sede,
          permitido: data.permitido === true,
          estadoLed: ["verde", "amarillo", "rojo"].includes(data.estadoLed)
            ? data.estadoLed
            : "rojo",
          mensaje: String(data.mensaje || ""),
          mensajePago: String(data.mensajePago || ""),
          fotoUrl: String(data.fotoUrl || ""),
          fecha,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error("ERROR_CONSULTAR_PANTALLA:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo consultar la pantalla." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
