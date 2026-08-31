import { createHash, randomBytes } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import type { Sede } from "@/lib/access-control";
import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { isPaymentExempt, normalizeMemberRole } from "@/lib/member-role";
import {
  normalizarRfidPago,
  normalizarSedePago,
  periodoPagoValido,
} from "@/lib/payment-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 20 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function buscarAlumno(rfid: string, sede: Sede) {
  const alumnos = adminDb.collection("Alumnos");
  let snapshot = await alumnos
    .where("rfids", "array-contains", rfid)
    .limit(1)
    .get();
  if (snapshot.empty)
    snapshot = await alumnos.where("rfid", "==", rfid).limit(1).get();
  if (snapshot.empty) return null;

  const document = snapshot.docs[0];
  const data = document.data();
  if (normalizarSedePago(data.sede) !== sede) return null;
  const montoBase = Math.max(0, Number(data.montoPago) || 0);
  const descuento = Math.max(0, Number(data.descuento) || 0);
  return {
    id: document.id,
    nombre: String(data.nombre || "Alumno"),
    sede,
    monto: Math.max(0, montoBase - descuento),
    montoBase,
    descuento,
    telefono: String(data.telefono || ""),
    disciplina: String(data.disciplina || ""),
    activo: data.activo !== false,
    rol: normalizeMemberRole(data.rol),
  };
}

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: "pagar-publico",
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed)
      return NextResponse.json(
        { ok: false, mensaje: "Demasiados intentos. Espera un momento." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    const body = (await request.json().catch(() => null)) as {
      accion?: unknown;
      rfid?: unknown;
      sede?: unknown;
      periodo?: unknown;
    } | null;
    const accion = body?.accion === "generar" ? "generar" : "consultar";
    const rfid = normalizarRfidPago(body?.rfid);
    const sede = normalizarSedePago(body?.sede);
    if (!rfid || !sede) {
      return NextResponse.json(
        { ok: false, mensaje: "RFID o sede no válidos." },
        { status: 400 },
      );
    }

    const alumno = await buscarAlumno(rfid, sede);
    if (!alumno)
      return NextResponse.json(
        {
          ok: false,
          mensaje: "La tarjeta no pertenece a un alumno de esta sede.",
        },
        { status: 404 },
      );
    if (!alumno.activo)
      return NextResponse.json(
        { ok: false, mensaje: "El alumno tiene una baja temporal." },
        { status: 409 },
      );
    if (isPaymentExempt(alumno.rol))
      return NextResponse.json(
        { ok: false, exento: true, mensaje: "Este perfil está exento de mensualidad." },
        { status: 409 },
      );
    if (alumno.monto <= 0)
      return NextResponse.json(
        {
          ok: false,
          mensaje: "El alumno no tiene un monto pendiente configurado.",
        },
        { status: 409 },
      );
    if (accion === "consultar") return NextResponse.json({ ok: true, alumno });
    if (!periodoPagoValido(body?.periodo))
      return NextResponse.json(
        { ok: false, mensaje: "El periodo no es válido." },
        { status: 400 },
      );

    const periodo = body.periodo;
    const solicitudId = `${alumno.id}_${periodo.replace("-", "")}`;
    const [pago, solicitud] = await Promise.all([
      adminDb.collection("Pagos").doc(solicitudId).get(),
      adminDb.collection("SolicitudesPago").doc(solicitudId).get(),
    ]);
    if (pago.exists)
      return NextResponse.json(
        {
          ok: false,
          mensaje: `${alumno.nombre} ya tiene registrado ese periodo.`,
        },
        { status: 409 },
      );
    if (solicitud.exists && solicitud.data()?.estado === "pendiente") {
      return NextResponse.json(
        {
          ok: false,
          pendiente: true,
          mensaje:
            "Ya existe una solicitud pendiente para este alumno y periodo.",
        },
        { status: 409 },
      );
    }

    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS);
    await adminDb
      .collection("TokensSolicitudPago")
      .doc(hashToken(rawToken))
      .create({
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        sede,
        monto: alumno.monto,
        periodo,
        solicitudId,
        usado: false,
        creadoPor: "modulo_publico",
        creadoPorEmail: "",
        creadoEn: FieldValue.serverTimestamp(),
        expiraEn: expiresAt,
      });
    return NextResponse.json({
      ok: true,
      alumno,
      token: rawToken,
      expiraEn: expiresAt.toDate().toISOString(),
    });
  } catch (error) {
    console.error("ERROR_PREPARAR_SOLICITUD_PAGO_PUBLICA:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo preparar la solicitud de pago." },
      { status: 500 },
    );
  }
}
