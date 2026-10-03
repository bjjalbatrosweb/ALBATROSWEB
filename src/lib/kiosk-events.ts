import { randomUUID } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase-admin";

export type KioskEventMethod = "RFID" | "CELULAR" | "PIN";

export type KioskEventInput = {
  alumnoId: string;
  nombre: string;
  sede: string;
  duplicado: boolean;
  permitido: boolean;
  estadoLed: "verde" | "amarillo" | "rojo";
  metodo: KioskEventMethod;
  mensaje: string;
  claseActiva: { disciplina: string; tema: string } | null;
};

const QUEUE_LIMIT = 24;
const QUEUE_MAX_AGE_MS = 10 * 60_000;

function timestampMillis(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/**
 * Conserva una cola pequeña dentro del documento de la sede. La transacción
 * evita que dos registros casi simultáneos se sobrescriban y el límite impide
 * que el documento crezca indefinidamente.
 */
export async function publishKioskEvent(input: KioskEventInput) {
  const reference = adminDb.collection("KioscoEventos").doc("MMA");
  const now = Timestamp.now();
  const event = {
    eventoId: randomUUID(),
    alumnoId: input.alumnoId,
    nombre: input.nombre.trim().split(/\s+/)[0] || "Atleta",
    sede: input.sede,
    duplicado: input.duplicado,
    permitido: input.permitido,
    estadoLed: input.estadoLed,
    metodo: input.metodo,
    mensaje: input.mensaje,
    claseActiva: input.claseActiva,
    ocurridoEn: now,
    expiraEn: Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60_000),
  };

  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    const current = Array.isArray(data.eventos) ? data.eventos : [];
    const minimum = now.toMillis() - QUEUE_MAX_AGE_MS;
    const queue = current
      .filter((item) => item && timestampMillis(item.ocurridoEn) >= minimum)
      .slice(-(QUEUE_LIMIT - 1));

    transaction.set(
      reference,
      {
        ...event,
        eventos: [...queue, event],
        actualizadoEn: now,
      },
      { merge: true },
    );
  });

  return event;
}
