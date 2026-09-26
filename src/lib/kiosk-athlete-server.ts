import { adminDb } from "@/lib/firebase-admin";
import {
  isValidKioskPin,
  kioskPinDigest,
  normalizeKioskPin,
} from "@/lib/kiosk-pin";
import { normalizeMemberRole } from "@/lib/member-role";

const EVENT_TTL_MS = 30_000;

export type KioskAthlete = {
  id: string;
  name: string;
  site: "MMA";
  active: boolean;
  role: ReturnType<typeof normalizeMemberRole>;
  amount: number;
  baseAmount: number;
  discount: number;
  discipline: string;
};

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

async function loadAthlete(alumnoId: string): Promise<KioskAthlete | null> {
  if (!alumnoId) return null;
  const snapshot = await adminDb.collection("Alumnos").doc(alumnoId).get();
  const data = snapshot.data() || {};
  if (
    !snapshot.exists ||
    String(data.sede || "").trim().toUpperCase() !== "MMA"
  ) {
    return null;
  }
  const baseAmount = Math.max(0, Number(data.montoPago) || 0);
  const discount = Math.max(0, Number(data.descuento) || 0);
  return {
    id: snapshot.id,
    name: String(data.nombre || "Atleta"),
    site: "MMA",
    active: data.activo !== false,
    role: normalizeMemberRole(data.rol),
    amount: Math.max(0, baseAmount - discount),
    baseAmount,
    discount,
    discipline: String(data.disciplina || ""),
  };
}

export async function kioskAthleteFromPin(value: unknown) {
  const pin = normalizeKioskPin(value);
  if (!isValidKioskPin(pin)) return null;
  const snapshot = await adminDb
    .collection("KioscoPins")
    .doc(kioskPinDigest(pin))
    .get();
  const data = snapshot.data() || {};
  if (
    !snapshot.exists ||
    data.activo !== true ||
    data.sede !== "MMA"
  ) {
    return null;
  }
  return loadAthlete(String(data.alumnoId || ""));
}

export async function kioskAthleteFromEvent(value: unknown) {
  const eventId = typeof value === "string" ? value.trim().slice(0, 80) : "";
  if (!eventId) return null;
  const snapshot = await adminDb.collection("KioscoEventos").doc("MMA").get();
  const data = snapshot.data() || {};
  const occurredAt = timestampMillis(data.ocurridoEn);
  const now = Date.now();
  if (
    !snapshot.exists ||
    String(data.eventoId || "") !== eventId ||
    occurredAt < now - EVENT_TTL_MS ||
    occurredAt > now + 2_000
  ) {
    return null;
  }
  return loadAthlete(String(data.alumnoId || ""));
}

export function publicAthleteName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0]} ${parts[1].slice(0, 1)}.`
    : parts[0] || "Atleta";
}
