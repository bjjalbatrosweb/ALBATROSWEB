import { createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  checkRateLimit,
  checkRateLimitForIdentifier,
} from "@/lib/rate-limit";
import {
  prepareTrialClassRequest,
  type TrialClassDiscipline,
  type TrialClassFormData,
  type TrialClassOrigin,
  type TrialClassSite,
} from "@/lib/trial-class-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCIPLINES = ["Jiu-Jitsu", "Kick Boxing", "MMA"] as const;
const SITES = ["CAUCEL", "MMA", "JUAN_PABLO"] as const;

function dayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function safeChoice<T extends readonly string[]>(value: unknown, options: T) {
  return typeof value === "string" && options.includes(value)
    ? (value as T[number])
    : null;
}

export async function POST(request: Request) {
  try {
    const ipRate = await checkRateLimit(request, {
      scope: "clase-prueba-publica",
      limit: 5,
      windowMs: 10 * 60_000,
    });
    if (!ipRate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: "Demasiadas solicitudes. Espera unos minutos." },
        { status: 429, headers: { "Retry-After": String(ipRate.retryAfter) } },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | (Record<string, unknown> & { website?: unknown })
      | null;
    if (!body || (typeof body.website === "string" && body.website.trim())) {
      return NextResponse.json({ ok: true, duplicada: true });
    }

    const discipline = safeChoice(body.disciplina, DISCIPLINES);
    const site = safeChoice(body.sede, SITES);
    const origin = safeChoice(body.origen, ["kiosco", "web"] as const);
    if (!discipline || !site || !origin) {
      return NextResponse.json(
        { ok: false, mensaje: "La disciplina o sede no es válida." },
        { status: 400 },
      );
    }

    const form: TrialClassFormData = {
      nombre: typeof body.nombre === "string" ? body.nombre : "",
      telefono: typeof body.telefono === "string" ? body.telefono : "",
      disciplina: discipline as TrialClassDiscipline,
      horario: typeof body.horario === "string" ? body.horario : "",
      sede: site as TrialClassSite,
      notas: typeof body.notas === "string" ? body.notas : "",
    };
    const prepared = prepareTrialClassRequest(
      form,
      origin as TrialClassOrigin,
    );
    if (!prepared.ok) {
      return NextResponse.json(
        { ok: false, mensaje: prepared.error },
        { status: 400 },
      );
    }

    const phoneRate = await checkRateLimitForIdentifier(
      `clase-prueba:${prepared.data.telefono}`,
      { scope: "clase-prueba-telefono", limit: 2, windowMs: 24 * 60 * 60_000 },
    );
    if (!phoneRate.allowed) {
      return NextResponse.json(
        { ok: false, mensaje: "Ya recibimos una solicitud para este teléfono." },
        { status: 429, headers: { "Retry-After": String(phoneRate.retryAfter) } },
      );
    }

    const id = createHash("sha256")
      .update(`${dayKey()}:${prepared.data.sede}:${prepared.data.telefono}`)
      .digest("hex");
    const reference = adminDb.collection("SolicitudesClasePrueba").doc(id);
    const created = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) return false;
      transaction.create(reference, {
        ...prepared.data,
        creadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      });
      return true;
    });
    return NextResponse.json({ ok: true, duplicada: !created });
  } catch (error) {
    console.error("TRIAL_CLASS_REQUEST_ERROR", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo enviar la solicitud." },
      { status: 500 },
    );
  }
}
