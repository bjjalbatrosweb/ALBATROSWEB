import { randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requirePanelActorAccess,
} from "@/lib/server-access";
import { hashToken } from "@/lib/taekwondo";

async function acceso(request: Request, id: string) {
  const ref = adminDb.collection("CombatesTaekwondo").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new RequestAccessError("Combate no encontrado.", 404);
  await requirePanelActorAccess(request, snap.data()?.sede);
  return ref;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ref = await acceso(request, id);
    const snap = await ref.collection("Controles").get();
    return NextResponse.json({
      ok: true,
      controles: snap.docs.map((d) => ({
        id: d.id,
        nombre: String(d.data().nombre || "Juez"),
        activo:
          d.data().activo === true &&
          d.data().expiraEn instanceof Timestamp &&
          d.data().expiraEn.toMillis() > Date.now(),
        conectado:
          d.data().ultimoContacto instanceof Timestamp &&
          Date.now() - d.data().ultimoContacto.toMillis() < 70000,
      })),
    });
  } catch (error) {
    if (error instanceof RequestAccessError)
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron cargar los controles." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const ref = await acceso(request, id);
    if (body.accion === "revocar") {
      const controlId = String(body.controlId || "");
      await ref
        .collection("Controles")
        .doc(controlId)
        .update({ activo: false, revocadoEn: FieldValue.serverTimestamp() });
      const active = await ref
        .collection("Controles")
        .where("activo", "==", true)
        .get();
      const valid = active.docs.filter(
        (d) =>
          d.data().expiraEn instanceof Timestamp &&
          d.data().expiraEn.toMillis() > Date.now(),
      ).length;
      await ref.update({
        controlesActivos: Math.max(1, valid),
        votosPendientes: [],
      });
      return NextResponse.json({ ok: true });
    }
    const active = await ref
      .collection("Controles")
      .where("activo", "==", true)
      .get();
    const validCount = active.docs.filter(
      (d) =>
        d.data().expiraEn instanceof Timestamp &&
        d.data().expiraEn.toMillis() > Date.now(),
    ).length;
    if (validCount >= 4)
      return NextResponse.json(
        { ok: false, mensaje: "Ya hay cuatro controles activos." },
        { status: 409 },
      );
    const nombre =
      String(body.nombre || `Juez ${validCount + 1}`)
        .trim()
        .slice(0, 30) || `Juez ${validCount + 1}`;
    const secret = randomBytes(24).toString("base64url");
    const controlRef = ref.collection("Controles").doc();
    await controlRef.create({
      nombre,
      tokenHash: hashToken(secret),
      activo: true,
      creadoEn: FieldValue.serverTimestamp(),
      expiraEn: Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000),
      ultimoContacto: null,
    });
    await ref.update({ controlesActivos: validCount + 1, votosPendientes: [] });
    return NextResponse.json({
      ok: true,
      control: {
        id: controlRef.id,
        nombre,
        controlToken: `${controlRef.id}.${secret}`,
      },
    });
  } catch (error) {
    if (error instanceof RequestAccessError)
      return NextResponse.json(
        { ok: false, mensaje: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo administrar el control." },
      { status: 500 },
    );
  }
}
