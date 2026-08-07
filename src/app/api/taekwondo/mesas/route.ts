import { randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { hashToken, serializarCombate, tokenValido } from "@/lib/taekwondo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await adminDb.collection("CombatesTaekwondo").limit(100).get();
    const mesas = snap.docs
      .filter((doc) => doc.data().fase !== "finalizado")
      .map((doc) => ({
        ...serializarCombate(doc.data(), doc.id),
        protegida: Boolean(doc.data().pinHash),
      }))
      .sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
    return NextResponse.json({ ok: true, mesas });
  } catch (error) {
    console.error("ERROR_MESAS_PUBLICAS:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudieron cargar las mesas abiertas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    const pin = String(body.pin || "").trim();
    const ref = adminDb.collection("CombatesTaekwondo").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.fase === "finalizado")
      return NextResponse.json(
        { ok: false, mensaje: "La mesa ya no está disponible." },
        { status: 404 },
      );
    const pinHash = String(snap.data()?.pinHash || "");
    if (pinHash && !tokenValido(pin, pinHash))
      return NextResponse.json(
        { ok: false, mensaje: "PIN incorrecto." },
        { status: 403 },
      );
    const active = await ref
      .collection("Controles")
      .where("activo", "==", true)
      .get();
    const valid = active.docs.filter(
      (doc) =>
        doc.data().expiraEn instanceof Timestamp &&
        doc.data().expiraEn.toMillis() > Date.now(),
    );
    if (valid.length >= 4)
      return NextResponse.json(
        { ok: false, mensaje: "La mesa ya tiene cuatro controles." },
        { status: 409 },
      );
    const nombre =
      String(body.nombre || `Juez ${valid.length + 1}`)
        .trim()
        .slice(0, 30) || `Juez ${valid.length + 1}`;
    const secret = randomBytes(24).toString("base64url");
    const controlRef = ref.collection("Controles").doc();
    await controlRef.create({
      nombre,
      tokenHash: hashToken(secret),
      activo: true,
      origen: "union_publica",
      creadoEn: FieldValue.serverTimestamp(),
      expiraEn: Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000),
      ultimoContacto: null,
    });
    await ref.update({
      votosPendientes: [],
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({
      ok: true,
      controlToken: `${controlRef.id}.${secret}`,
    });
  } catch (error) {
    console.error("ERROR_UNIRSE_MESA:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo conectar el control." },
      { status: 500 },
    );
  }
}
