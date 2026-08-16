export type ReservationStatus = "borrador" | "publicada" | "cerrada" | "cancelada";

export function normalizeCapacity(value: unknown) {
  const capacity = Math.floor(Number(value));
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 200) throw new Error("El cupo debe estar entre 1 y 200.");
  return capacity;
}

export function availablePlaces(capacity: number, reserved: number) {
  return Math.max(0, normalizeCapacity(capacity) - Math.max(0, Math.floor(reserved)));
}

export function canReserve(input: { status: ReservationStatus; capacity: number; reserved: number; startsAt: Date }, now = new Date()) {
  if (input.status !== "publicada") return { allowed: false, reason: "La clase no está disponible." };
  if (input.startsAt.getTime() <= now.getTime()) return { allowed: false, reason: "La clase ya comenzó." };
  if (availablePlaces(input.capacity, input.reserved) === 0) return { allowed: false, reason: "No quedan lugares." };
  return { allowed: true, reason: "Lugar disponible." };
}
