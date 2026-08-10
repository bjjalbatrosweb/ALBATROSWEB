import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { hashTokenJiujitsu } from "@/lib/jiujitsu";
import {
  createGeneralLivePairing,
  createIndividualLivePairing,
  createLiveTableControl,
  LivePairingError,
} from "@/lib/live-control-pairing";
import { RequestAccessError, requirePanelActorAccess } from "@/lib/server-access";

async function acceso(request: Request, id: string) {
  const ref = adminDb.collection("CombatesJiujitsu").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new RequestAccessError("Combate no encontrado.", 404);
  await requirePanelActorAccess(request, snapshot.data()?.sede);
  return ref;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ref = await acceso(request, id);
    const snapshot = await ref.collection("Controles").get();
    return NextResponse.json({
      ok: true,
      controles: snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          nombre: String(data.nombre || "Árbitro"),
          esMesa: data.esMesa === true,
          pendiente: data.activo !== true && data.vinculacionUsada !== true && data.vinculacionExpiraEn instanceof Timestamp && data.vinculacionExpiraEn.toMillis() > Date.now(),
          activo: data.activo === true && data.expiraEn instanceof Timestamp && data.expiraEn.toMillis() > Date.now(),
          conectado: data.ultimoContacto instanceof Timestamp && Date.now() - data.ultimoContacto.toMillis() < 70000,
        };
      }),
    });
  } catch (error) {
    if (error instanceof RequestAccessError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, mensaje: "No se pudieron cargar los controles." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const ref = await acceso(request, id);
    if (body.accion === "revocar") {
      await ref.collection("Controles").doc(String(body.controlId || "")).update({ activo: false, vinculacionUsada: true, revocadoEn: FieldValue.serverTimestamp() });
      const active = await ref.collection("Controles").where("activo", "==", true).get();
      const valid = active.docs.filter((document) => document.data().esMesa !== true && document.data().expiraEn instanceof Timestamp && document.data().expiraEn.toMillis() > Date.now()).length;
      await ref.update({ controlesActivos: Math.max(1, valid), actualizadoEn: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "vinculacion_general") {
      const vinculacion = await createGeneralLivePairing({ fightRef: ref, hash: hashTokenJiujitsu });
      return NextResponse.json({ ok: true, vinculacion });
    }
    if (body.accion === "recuperar_mesa") {
      const control = await createLiveTableControl({ fightRef: ref, hash: hashTokenJiujitsu, name: "Mesa recuperada" });
      return NextResponse.json({ ok: true, control });
    }
    const active = await ref.collection("Controles").where("activo", "==", true).get();
    const count = active.docs.filter((document) => document.data().esMesa !== true).length;
    const nombre = String(body.nombre || `Árbitro ${count + 1}`).trim().slice(0, 30) || `Árbitro ${count + 1}`;
    const control = await createIndividualLivePairing({ fightRef: ref, hash: hashTokenJiujitsu, name: nombre });
    return NextResponse.json({ ok: true, control });
  } catch (error) {
    if (error instanceof RequestAccessError || error instanceof LivePairingError) return NextResponse.json({ ok: false, mensaje: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, mensaje: "No se pudo administrar el control." }, { status: 500 });
  }
}
