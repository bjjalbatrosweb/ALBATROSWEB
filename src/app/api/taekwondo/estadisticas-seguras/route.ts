import { NextResponse } from "next/server";

import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";
import { GET as calcularEstadisticas } from "../estadisticas/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CacheEntry = { expiresAt: number; value: Record<string, unknown> };
const globalCache = globalThis as typeof globalThis & {
  __albatrosSafeStatsCache?: Map<string, CacheEntry>;
};
const cache =
  globalCache.__albatrosSafeStatsCache ??
  (globalCache.__albatrosSafeStatsCache = new Map());

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sede = String(url.searchParams.get("sede") || "").toUpperCase();
    if (!["MMA", "CAUCEL", "JUAN_PABLO"].includes(sede))
      return NextResponse.json(
        { ok: false, mensaje: "Sede inválida." },
        { status: 400 },
      );

    await requirePanelActorAccess(
      request,
      sede as "MMA" | "CAUCEL" | "JUAN_PABLO",
    );
    const force = url.searchParams.get("refresh") === "1";
    const cached = cache.get(sede);
    if (!force && cached && cached.expiresAt > Date.now())
      return NextResponse.json(cached.value);

    const response = await calcularEstadisticas(request);
    const data = (await response.json()) as Record<string, unknown>;
    if (response.ok && data.ok === true)
      cache.set(sede, { expiresAt: Date.now() + 60_000, value: data });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof RequestAccessError)
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron cargar las estadísticas." },
      { status: 500 },
    );
  }
}
