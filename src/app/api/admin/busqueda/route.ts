import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEDES: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];
const CACHE_TTL_MS = 5 * 60_000;

type SearchResult = {
  id: string;
  type: "alumno" | "compra" | "pago";
  title: string;
  detail: string;
  keywords: string;
  href: string;
};
type CacheEntry = {
  records: SearchResult[];
  warnings: string[];
  expiresAt: number;
};
const globalCache = globalThis as typeof globalThis & {
  __albatrosAdminSearchCache?: Map<Sede, CacheEntry>;
};
const searchCache =
  globalCache.__albatrosAdminSearchCache ??
  (globalCache.__albatrosAdminSearchCache = new Map());

function normalizarSede(value: unknown): Sede | null {
  if (typeof value !== "string") return null;
  const sede = value.trim().toUpperCase().replace(/\s+/g, "_") as Sede;
  return SEDES.includes(sede) ? sede : null;
}

function normalizar(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sede = normalizarSede(url.searchParams.get("sede"));
    if (!sede) {
      return NextResponse.json(
        { ok: false, mensaje: "La sede no es válida." },
        { status: 400 },
      );
    }
    await requirePanelActorAccess(request, sede);

    const force = url.searchParams.get("force") === "1";
    const cached = searchCache.get(sede);
    if (!force && cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({
        ok: true,
        cached: true,
        records: cached.records,
        warnings: cached.warnings,
      });
    }

    const results = await Promise.allSettled([
      adminDb.collection("Alumnos").where("sede", "==", sede).limit(1_000).get(),
      adminDb.collection("SolicitudesCompra").where("sede", "==", sede).limit(150).get(),
      adminDb.collection("SolicitudesPago").where("sede", "==", sede).limit(150).get(),
    ] as const);
    const warnings: string[] = [];
    const labels = ["alumnos", "compras", "solicitudes de pago"];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        warnings.push(`No se indexaron ${labels[index]}.`);
        console.error(`ADMIN_SEARCH_${index}:`, result.reason);
      }
    });

    const records: SearchResult[] = [];
    const students = results[0].status === "fulfilled" ? results[0].value : null;
    const purchases = results[1].status === "fulfilled" ? results[1].value : null;
    const payments = results[2].status === "fulfilled" ? results[2].value : null;

    students?.docs.forEach((document) => {
      const data = document.data();
      const nombre = String(data.nombre || "Alumno sin nombre");
      const rfid = [data.rfid, ...(Array.isArray(data.rfids) ? data.rfids : [])]
        .filter(Boolean)
        .join(" ");
      const telefono = String(data.telefono || "");
      records.push({
        id: `student-${document.id}`,
        type: "alumno",
        title: nombre,
        detail: [telefono || "Sin teléfono", rfid ? `RFID ${rfid}` : "Sin RFID"].join(" · "),
        keywords: normalizar(`${nombre} ${telefono} ${rfid} ${document.id}`),
        href: `/admin/dashboard?buscar=${encodeURIComponent(nombre)}&alumno=${encodeURIComponent(document.id)}`,
      });
    });

    purchases?.docs.forEach((document) => {
      const data = document.data();
      const nombre = String(data.nombre || "Alumno");
      const folio = String(data.folio || document.id.slice(-8).toUpperCase());
      const estado = String(data.estado || "pendiente_cobro");
      records.push({
        id: `purchase-${document.id}`,
        type: "compra",
        title: folio,
        detail: `${nombre} · ${estado.replaceAll("_", " ")}`,
        keywords: normalizar(`${folio} ${nombre} ${estado} ${document.id}`),
        href: `/admin/compras?buscar=${encodeURIComponent(folio)}`,
      });
    });

    payments?.docs.forEach((document) => {
      const data = document.data();
      const nombre = String(data.nombre || "Alumno");
      const periodo = String(data.periodo || "Sin periodo");
      const estado = String(data.estado || "pendiente");
      records.push({
        id: `payment-${document.id}`,
        type: "pago",
        title: nombre,
        detail: `Solicitud ${periodo} · ${estado}`,
        keywords: normalizar(`${nombre} ${periodo} ${estado} ${document.id}`),
        href: `/admin/pagar?buscar=${encodeURIComponent(nombre)}`,
      });
    });

    searchCache.set(sede, {
      records,
      warnings,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return NextResponse.json({ ok: true, cached: false, records, warnings });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    }
    console.error("ADMIN_SEARCH_ERROR:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo preparar la búsqueda." },
      { status: 500 },
    );
  }
}
