import { timingSafeEqual } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimitForIdentifier } from "@/lib/rate-limit";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";

const SEDES = ["MMA", "CAUCEL", "JUAN_PABLO"] as const;
type Sede = (typeof SEDES)[number];
const ADMIN_PIN = process.env.TAEKWONDO_ADMIN_PIN || "1357";

function pinValido(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sede = String(body.sede || "").toUpperCase() as Sede;
    if (!SEDES.includes(sede))
      return NextResponse.json(
        { ok: false, mensaje: "Sede inválida." },
        { status: 400 },
      );
    const actor = await requirePanelActorAccess(request, sede);
    if (!pinValido(String(body.pin || ""), ADMIN_PIN)) {
      const rate = await checkRateLimitForIdentifier(`${actor.uid}:${sede}`, {
        scope: "taekwondo-admin-pin",
        limit: 5,
        windowMs: 15 * 60_000,
      });
      if (!rate.allowed) {
        return NextResponse.json(
          { ok: false, mensaje: "Demasiados intentos. Espera antes de volver a intentar." },
          { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
        );
      }
      return NextResponse.json(
        { ok: false, mensaje: "PIN administrativo incorrecto." },
        { status: 403 },
      );
    }
    const accion = String(body.accion || "");
    const solicitados = Array.isArray(body.ids) ? body.ids.map(String) : [];
    const snap = await adminDb
      .collection("CombatesTaekwondo")
      .where("sede", "==", sede)
      .limit(150)
      .get();
    const targets = snap.docs.filter((doc) =>
      body.todas === true
        ? accion === "finalizar" && doc.data().fase !== "finalizado"
        : solicitados.includes(doc.id),
    );
    if (!targets.length)
      return NextResponse.json(
        { ok: false, mensaje: "No hay mesas seleccionadas." },
        { status: 400 },
      );

    if (accion === "finalizar") {
      for (const doc of targets) {
        const data = doc.data();
        const ganador =
          Number(data.puntosRojo) === Number(data.puntosAzul)
            ? "empate"
            : Number(data.puntosRojo) > Number(data.puntosAzul)
              ? "rojo"
              : "azul";
        await doc.ref.update({
          fase: "finalizado",
          corriendo: false,
          iniciadoEn: null,
          restanteMs: 0,
          ganador,
          finalizadoEn: FieldValue.serverTimestamp(),
          actualizadoEn: FieldValue.serverTimestamp(),
          votosPendientes: [],
          controlesCerrados: true,
        });
        const controls = await doc.ref
          .collection("Controles")
          .where("activo", "==", true)
          .get();
        if (!controls.empty) {
          const batch = adminDb.batch();
          controls.docs.forEach((control) =>
            batch.update(control.ref, {
              activo: false,
              revocadoEn: FieldValue.serverTimestamp(),
            }),
          );
          await batch.commit();
        }
      }
    } else if (accion === "eliminar") {
      for (const doc of targets) await adminDb.recursiveDelete(doc.ref);
    } else {
      return NextResponse.json(
        { ok: false, mensaje: "Acción inválida." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, procesadas: targets.length });
  } catch (error) {
    if (error instanceof RequestAccessError)
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    console.error("ERROR_ADMIN_MESAS:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron administrar las mesas." },
      { status: 500 },
    );
  }
}
