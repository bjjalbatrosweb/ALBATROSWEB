import { createHash, randomBytes } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { adminDb } from "@/lib/firebase-admin";
import {
  kioskAthleteFromEvent,
  kioskAthleteFromPin,
  publicAthleteName,
} from "@/lib/kiosk-athlete-server";
import { isPaymentExempt } from "@/lib/member-role";
import { periodoPagoValido } from "@/lib/payment-validation";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 20 * 60_000;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function currentPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}`;
}

function responseError(message: string, status: number) {
  return NextResponse.json({ ok: false, mensaje: message }, { status });
}

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(request, {
      scope: "ipad-pago",
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if (!rate.allowed) {
      return responseError("Demasiados intentos. Espera unos minutos.", 429);
    }

    const body = (await request.json().catch(() => null)) as {
      metodo?: unknown;
      pin?: unknown;
      eventoId?: unknown;
      periodo?: unknown;
    } | null;
    const method = body?.metodo === "esp32" ? "esp32" : "pin";
    const athlete =
      method === "esp32"
        ? await kioskAthleteFromEvent(body?.eventoId)
        : await kioskAthleteFromPin(body?.pin);
    if (!athlete) {
      return responseError(
        method === "esp32"
          ? "No se pudo validar esta lectura. Acerca nuevamente tu tag."
          : "PIN incorrecto o no disponible.",
        401,
      );
    }
    if (!athlete.active) return responseError("Tu ficha está inactiva.", 409);
    if (isPaymentExempt(athlete.role)) {
      return responseError("Este perfil está exento de mensualidad.", 409);
    }
    if (athlete.amount <= 0) {
      return responseError("No tienes un monto de mensualidad configurado.", 409);
    }

    const period = periodoPagoValido(body?.periodo)
      ? body.periodo
      : currentPeriod();
    const requestId = `${athlete.id}_${period.replace("-", "")}`;
    const [payment, pendingRequest] = await Promise.all([
      adminDb.collection("Pagos").doc(requestId).get(),
      adminDb.collection("SolicitudesPago").doc(requestId).get(),
    ]);
    if (payment.exists) {
      return responseError("Este periodo ya se encuentra registrado como pagado.", 409);
    }
    if (pendingRequest.exists && pendingRequest.data()?.estado === "pendiente") {
      return responseError("Ya tienes una solicitud pendiente para este periodo.", 409);
    }

    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS);
    await adminDb.collection("TokensSolicitudPago").doc(tokenHash(rawToken)).create({
      alumnoId: athlete.id,
      nombre: athlete.name,
      sede: athlete.site,
      monto: athlete.amount,
      periodo: period,
      solicitudId: requestId,
      usado: false,
      creadoPor: `kiosco_ipad_${method}`,
      creadoPorEmail: "",
      creadoEn: FieldValue.serverTimestamp(),
      expiraEn: expiresAt,
    });

    const confirmationUrl = `${new URL(request.url).origin}/solicitud-pago/${rawToken}`;
    const qrDataUrl = await QRCode.toDataURL(confirmationUrl, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#08090d", light: "#ffffff" },
    });
    return NextResponse.json({
      ok: true,
      alumno: {
        nombre: publicAthleteName(athlete.name),
        sede: athlete.site,
        monto: athlete.amount,
      },
      periodo: period,
      token: rawToken,
      qrDataUrl,
      expiraEn: expiresAt.toDate().toISOString(),
    });
  } catch (error) {
    console.error("ERROR_IPAD_PAGO:", error);
    return responseError("No se pudo preparar la solicitud de pago.", 500);
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return responseError("Código inválido.", 400);
  }
  const tokenSnapshot = await adminDb
    .collection("TokensSolicitudPago")
    .doc(tokenHash(token))
    .get();
  const tokenData = tokenSnapshot.data() || {};
  if (!tokenSnapshot.exists) return responseError("Código no encontrado.", 404);
  const requestId = String(tokenData.solicitudId || "");
  const paymentRequest = requestId
    ? await adminDb.collection("SolicitudesPago").doc(requestId).get()
    : null;
  return NextResponse.json(
    {
      ok: true,
      confirmada: Boolean(paymentRequest?.exists),
      estado: paymentRequest?.exists
        ? String(paymentRequest.data()?.estado || "pendiente")
        : "esperando",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
