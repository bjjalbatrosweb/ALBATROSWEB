import { createHash, randomBytes } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { adminDb } from "@/lib/firebase-admin";
import {
  kioskAthleteFromPin,
  publicAthleteName,
} from "@/lib/kiosk-athlete-server";
import {
  checkRateLimit,
  checkRateLimitForIdentifier,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCIPLINES = ["Jiu-Jitsu", "Kick Boxing", "MMA"] as const;
const PASS_TTL_MS = 24 * 60 * 60_000;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function phone(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 15) : "";
}

function publicName(value: unknown) {
  return publicAthleteName(text(value, 80));
}

function timestampMillis(value: unknown) {
  return value instanceof Timestamp ? value.toMillis() : 0;
}

function passUrl(request: Request, id: string, token: string) {
  return `${new URL(request.url).origin}/pase-invitado/${id}?token=${encodeURIComponent(token)}`;
}

async function passResponse(request: Request, id: string, token: string) {
  const url = passUrl(request, id, token);
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 420,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#08090d", light: "#ffffff" },
  });
  return { id, url, qrDataUrl, validUntil: new Date(Date.now() + PASS_TTL_MS).toISOString() };
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, mensaje: message }, { status });
}

export async function POST(request: Request) {
  try {
    const ipRate = await checkRateLimit(request, {
      scope: "ipad-pases",
      limit: 24,
      windowMs: 10 * 60_000,
    });
    if (!ipRate.allowed) return fail("Demasiados intentos. Espera unos minutos.", 429);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const action = text(body?.accion, 40);

    if (action === "buscar_agenda") {
      const normalizedPhone = phone(body?.telefono);
      if (normalizedPhone.length < 10) return fail("Escribe el teléfono completo de la cita.");
      const phoneRate = await checkRateLimitForIdentifier(hash(normalizedPhone), {
        scope: "ipad-pases-agenda",
        limit: 6,
        windowMs: 15 * 60_000,
      });
      if (!phoneRate.allowed) return fail("Espera unos minutos antes de buscar nuevamente.", 429);
      const snapshot = await adminDb
        .collection("SolicitudesClasePrueba")
        .where("telefono", "==", normalizedPhone)
        .limit(10)
        .get();
      const oldest = Date.now() - 60 * 24 * 60 * 60_000;
      const appointments = snapshot.docs
        .filter((document) => {
          const data = document.data();
          const status = String(data.estado || "pendiente");
          return (
            data.sede === "MMA" &&
            status !== "cancelada" &&
            timestampMillis(data.creadoEn) >= oldest
          );
        })
        .map((document) => {
          const data = document.data();
          return {
            id: document.id,
            nombre: publicName(data.nombre),
            disciplina: text(data.disciplina, 50),
            horario: text(data.horario, 100),
            estado: text(data.estado || "pendiente", 20),
          };
        });
      return NextResponse.json({ ok: true, citas: appointments });
    }

    if (action === "crear_invitado") {
      const athlete = await kioskAthleteFromPin(body?.pin);
      if (!athlete || !athlete.active) return fail("PIN incorrecto o no disponible.", 401);
      const guestName = text(body?.nombreInvitado, 80);
      const discipline = text(body?.disciplina, 50);
      if (guestName.length < 2 || !DISCIPLINES.includes(discipline as (typeof DISCIPLINES)[number])) {
        return fail("Escribe el nombre del invitado y selecciona su disciplina.");
      }
      const athleteRate = await checkRateLimitForIdentifier(athlete.id, {
        scope: "ipad-pases-atleta",
        limit: 3,
        windowMs: 24 * 60 * 60_000,
      });
      if (!athleteRate.allowed) return fail("Ya generaste el máximo de pases por hoy.", 429);
      const token = randomBytes(24).toString("base64url");
      const reference = adminDb.collection("PasesInvitados").doc();
      const now = Date.now();
      await reference.create({
        sede: "MMA",
        guestName,
        discipline,
        hostName: publicAthleteName(athlete.name),
        notes: "Pase generado por atleta desde el kiosco iPad.",
        active: true,
        uses: 0,
        maxUses: 1,
        tokenHash: hash(token),
        validFrom: Timestamp.fromMillis(now),
        validUntil: Timestamp.fromMillis(now + PASS_TTL_MS),
        history: [],
        createdBy: `kiosco-ipad:${athlete.id}`,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, pase: await passResponse(request, reference.id, token) });
    }

    if (action === "crear_desde_agenda") {
      const normalizedPhone = phone(body?.telefono);
      const appointmentId = text(body?.citaId, 100);
      if (normalizedPhone.length < 10 || !appointmentId) return fail("No se pudo validar la cita.");
      const appointmentRef = adminDb.collection("SolicitudesClasePrueba").doc(appointmentId);
      const passRef = adminDb.collection("PasesInvitados").doc(`trial_${appointmentId}`);
      const token = randomBytes(24).toString("base64url");
      const now = Date.now();
      await adminDb.runTransaction(async (transaction) => {
        const [appointmentSnapshot, currentPass] = await Promise.all([
          transaction.get(appointmentRef),
          transaction.get(passRef),
        ]);
        const appointment = appointmentSnapshot.data() || {};
        if (
          !appointmentSnapshot.exists ||
          phone(appointment.telefono) !== normalizedPhone ||
          appointment.sede !== "MMA" ||
          appointment.estado === "cancelada"
        ) {
          throw new Error("INVALID_APPOINTMENT");
        }
        if (currentPass.exists && Number(currentPass.data()?.uses) > 0) {
          throw new Error("PASS_USED");
        }
        const passData = {
          sede: "MMA",
          guestName: text(appointment.nombre, 80) || "Visitante",
          discipline: text(appointment.disciplina, 50),
          hostName: "Clase de prueba Albatros",
          notes: `Cita: ${text(appointment.horario, 100)}`,
          active: true,
          uses: 0,
          maxUses: 1,
          tokenHash: hash(token),
          validFrom: Timestamp.fromMillis(now),
          validUntil: Timestamp.fromMillis(now + PASS_TTL_MS),
          history: [],
          createdBy: `kiosco-ipad-cita:${appointmentId}`,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (currentPass.exists) transaction.update(passRef, passData);
        else transaction.create(passRef, { ...passData, createdAt: FieldValue.serverTimestamp() });
        transaction.update(appointmentRef, {
          paseInvitadoId: passRef.id,
          paseGeneradoEn: FieldValue.serverTimestamp(),
          actualizadoEn: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ ok: true, pase: await passResponse(request, passRef.id, token) });
    }

    return fail("Acción no válida.");
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_APPOINTMENT") return fail("La cita no existe o fue cancelada.", 404);
    if (code === "PASS_USED") return fail("El pase de esta cita ya fue utilizado.", 409);
    console.error("ERROR_IPAD_PASES:", error);
    return fail("No se pudo generar el pase. Inténtalo nuevamente.", 500);
  }
}
