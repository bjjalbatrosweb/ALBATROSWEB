import type { WellnessCheckin } from "@/lib/athlete-progress";

export const WELLNESS_TIME_ZONE = "America/Mexico_City";

export const WELLNESS_PAIN_ZONES = [
  "Cabeza/cuello",
  "Hombro/brazo",
  "Espalda",
  "Pecho/abdomen",
  "Cadera/glúteo",
  "Rodilla",
  "Tobillo/pie",
  "General",
] as const;

function numberValue(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function requiredInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): string {
  const number = numberValue(value);
  return number === undefined || !Number.isInteger(number) || number < minimum || number > maximum
    ? `${label} debe ser un número entero entre ${minimum} y ${maximum}.`
    : "";
}

function optionalRange(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): string {
  const number = numberValue(value);
  if (number === undefined) {
    return value === "" || value === null || value === undefined
      ? ""
      : `${label} no es válido.`;
  }
  return number < minimum || number > maximum
    ? `${label} debe estar entre ${minimum} y ${maximum}.`
    : "";
}

export function wellnessDateKey(
  date = new Date(),
  timeZone = WELLNESS_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function wellnessCheckinError(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "El check-in no tiene un formato válido.";
  }
  const input = value as Record<string, unknown>;
  const notes = typeof input.notas === "string" ? input.notas.trim() : "";
  const painZone = typeof input.zonaDolor === "string" ? input.zonaDolor.trim() : "";

  return (
    requiredInteger(input.energia, "La energía", 1, 5) ||
    requiredInteger(input.sueno, "El sueño", 1, 5) ||
    requiredInteger(input.dolor, "El dolor", 0, 5) ||
    requiredInteger(input.animo, "El ánimo", 1, 5) ||
    optionalRange(input.horasSueno, "Las horas de sueño", 0, 16) ||
    optionalRange(input.pulsoReposo, "El pulso en reposo", 25, 220) ||
    optionalRange(input.presionSistolica, "La presión sistólica", 50, 260) ||
    optionalRange(input.presionDiastolica, "La presión diastólica", 30, 180) ||
    optionalRange(input.aguaLitros, "El agua", 0, 10) ||
    (painZone && !WELLNESS_PAIN_ZONES.includes(painZone as (typeof WELLNESS_PAIN_ZONES)[number])
      ? "Selecciona una ubicación del dolor válida."
      : "") ||
    (notes.length > 300 ? "Las notas no pueden superar 300 caracteres." : "")
  );
}

export function parseWellnessCheckin(
  value: unknown,
  date = wellnessDateKey(),
): WellnessCheckin {
  const error = wellnessCheckinError(value);
  if (error) throw new Error(error);
  const input = value as Record<string, unknown>;
  const result: WellnessCheckin = {
    fecha: date,
    energia: Number(input.energia),
    sueno: Number(input.sueno),
    dolor: Number(input.dolor),
    animo: Number(input.animo),
  };

  for (const key of [
    "horasSueno",
    "pulsoReposo",
    "presionSistolica",
    "presionDiastolica",
    "aguaLitros",
  ] as const) {
    const number = numberValue(input[key]);
    if (number !== undefined) result[key] = Math.round(number * 10) / 10;
  }
  const painZone = typeof input.zonaDolor === "string" ? input.zonaDolor.trim() : "";
  const notes = typeof input.notas === "string" ? input.notas.trim() : "";
  if (painZone) result.zonaDolor = painZone;
  if (notes) result.notas = notes;
  return result;
}

export function normalizeStoredWellness(
  value: Record<string, unknown>,
): WellnessCheckin | null {
  const date = typeof value.fecha === "string" ? value.fecha : wellnessDateKey();
  try {
    return parseWellnessCheckin(value, date);
  } catch {
    return null;
  }
}

