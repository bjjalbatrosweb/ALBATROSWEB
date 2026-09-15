import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import {
  RequestAccessError,
  requireActiveActorAccess,
} from "@/lib/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationItem = {
  id: string;
  categoria: "aviso" | "pago" | "reserva" | "reto" | "meta";
  prioridad: "normal" | "importante" | "urgente";
  titulo: string;
  detalle: string;
  href: string;
  fecha: string | null;
};

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== "object" || !("toMillis" in value)) return 0;
  const toMillis = (value as { toMillis?: unknown }).toMillis;
  return typeof toMillis === "function" ? Number(toMillis.call(value)) || 0 : 0;
}

function isoFromMillis(value: number): string | null {
  return value > 0 ? new Date(value).toISOString() : null;
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAccessError) {
    return NextResponse.json(
      { ok: false, mensaje: error.message },
      { status: error.status },
    );
  }
  console.error("ATHLETE_NOTIFICATION_CENTER_ERROR:", error);
  return NextResponse.json(
    { ok: false, mensaje: "No se pudo preparar tu centro de notificaciones." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const actor = await requireActiveActorAccess(request);
    if (
      actor.profile.rol !== "atleta" ||
      !actor.profile.alumnoId ||
      !actor.profile.sede ||
      actor.profile.sede === "TODAS"
    ) {
      throw new RequestAccessError(
        "Solo una cuenta de atleta vinculada puede consultar esta bandeja.",
        403,
      );
    }

    const alumnoId = actor.profile.alumnoId;
    const sede = actor.profile.sede;
    const [athleteSnapshot, announcements, classes, challenges] =
      await Promise.all([
        adminDb.collection("Alumnos").doc(alumnoId).get(),
        adminDb.collection("Anuncios").where("sede", "==", sede).get(),
        adminDb
          .collection("ReservasClases")
          .where("sede", "==", sede)
          .where("estado", "==", "publicada")
          .get(),
        adminDb
          .collection("SalasJuego")
          .doc(sede)
          .collection("invitaciones")
          .where("challengedId", "==", alumnoId)
          .limit(100)
          .get(),
      ]);

    if (!athleteSnapshot.exists) {
      throw new RequestAccessError("Tu expediente de atleta ya no existe.", 404);
    }

    const now = Date.now();
    const athlete = athleteSnapshot.data() || {};
    const items: NotificationItem[] = [];

    announcements.docs.forEach((entry) => {
      const data = entry.data() || {};
      const expiresAt = timestampMillis(data.venceEn);
      if (data.activo === false || (expiresAt > 0 && expiresAt < now)) return;
      const type = String(data.tipo || "general");
      items.push({
        id: `aviso:${entry.id}`,
        categoria: "aviso",
        prioridad: type === "urgente" ? "urgente" : type === "evento" ? "importante" : "normal",
        titulo: String(data.titulo || "Aviso de la academia"),
        detalle: String(data.mensaje || "Consulta la información publicada por tu academia."),
        href: "/mi-academia",
        fecha: isoFromMillis(timestampMillis(data.creadoEn)),
      });
    });

    const paymentStatus = String(athlete.estadoPago || "");
    if (paymentStatus === "Retraso" || paymentStatus === "Falta de Pago") {
      const period = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Merida",
        year: "numeric",
        month: "2-digit",
      }).format(new Date());
      items.push({
        id: `pago:${period}`,
        categoria: "pago",
        prioridad: paymentStatus === "Retraso" ? "urgente" : "importante",
        titulo: paymentStatus === "Retraso" ? "Mensualidad vencida" : "Mensualidad pendiente",
        detalle: `Tu ficha aparece como ${paymentStatus.toLowerCase()}${athlete.diaPago ? ` · día de pago ${athlete.diaPago}` : ""}.`,
        href: "/mi-academia",
        fecha: new Date().toISOString(),
      });
    }

    const upcomingClasses = classes.docs
      .filter((entry) => timestampMillis(entry.data().inicio) > now)
      .sort(
        (left, right) =>
          timestampMillis(left.data().inicio) - timestampMillis(right.data().inicio),
      )
      .slice(0, 100);
    if (upcomingClasses.length > 0) {
      const enrollments = await adminDb.getAll(
        ...upcomingClasses.map((entry) =>
          entry.ref.collection("inscripciones").doc(actor.uid),
        ),
      );
      enrollments.forEach((enrollment, index) => {
        if (!enrollment.exists || enrollment.data()?.estado !== "confirmada") return;
        const classEntry = upcomingClasses[index];
        const data = classEntry.data() || {};
        const startsAt = timestampMillis(data.inicio);
        items.push({
          id: `reserva:${classEntry.id}`,
          categoria: "reserva",
          prioridad: startsAt - now <= 24 * 60 * 60 * 1000 ? "importante" : "normal",
          titulo: `Reserva confirmada · ${String(data.nombre || data.disciplina || "Clase")}`,
          detalle: `${String(data.disciplina || "Entrenamiento")} · ${new Date(startsAt).toLocaleString("es-MX", { timeZone: "America/Merida", dateStyle: "medium", timeStyle: "short" })}`,
          href: "/reservas",
          fecha: isoFromMillis(startsAt),
        });
      });
    }

    challenges.docs.forEach((entry) => {
      const data = entry.data() || {};
      if (data.status !== "pendiente") return;
      const createdAt =
        Number(data.createdAtMs || 0) || timestampMillis(data.creadoEn);
      items.push({
        id: `reto:${entry.id}`,
        categoria: "reto",
        prioridad: "importante",
        titulo: "Tienes un reto PvP pendiente",
        detalle: `${String(data.challengerName || "Otro atleta")} espera tu respuesta.`,
        href: "/sala-juego",
        fecha: isoFromMillis(createdAt),
      });
    });

    if (athlete.proximaCompetencia) {
      items.push({
        id: `meta:${String(athlete.proximaCompetencia).slice(0, 80)}`,
        categoria: "meta",
        prioridad: "normal",
        titulo: "Próxima meta deportiva",
        detalle: String(athlete.proximaCompetencia),
        href: "/dashboard",
        fecha: typeof athlete.fechaCompetencia === "string" ? athlete.fechaCompetencia : null,
      });
    }

    const priority = { urgente: 0, importante: 1, normal: 2 } as const;
    items.sort(
      (left, right) =>
        priority[left.prioridad] - priority[right.prioridad] ||
        String(right.fecha || "").localeCompare(String(left.fecha || "")),
    );

    return NextResponse.json({
      ok: true,
      items: items.slice(0, 100),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
