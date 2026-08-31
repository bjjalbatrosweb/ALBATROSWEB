export const ATHLETE_BADGE_IDS = ["bronce", "plata", "oro"] as const;

export type AthleteBadgeId = (typeof ATHLETE_BADGE_IDS)[number];

export type AthleteBadgeDefinition = {
  id: AthleteBadgeId;
  nombre: string;
  descripcion: string;
  imagen: string;
  accentClass: string;
  selectedClass: string;
};

export const ATHLETE_BADGES: AthleteBadgeDefinition[] = [
  {
    id: "bronce",
    nombre: "Insignia Bronce",
    descripcion: "Reconocimiento de progreso y constancia.",
    imagen: "/insignias/insignia-bronce-albatros.webp",
    accentClass: "text-orange-300",
    selectedClass:
      "border-orange-400/70 bg-orange-500/10 shadow-[0_0_30px_rgba(251,146,60,.16)]",
  },
  {
    id: "plata",
    nombre: "Insignia Plata",
    descripcion: "Reconocimiento de desempeño destacado.",
    imagen: "/insignias/insignia-plata-albatros.webp",
    accentClass: "text-slate-200",
    selectedClass:
      "border-slate-300/70 bg-slate-300/10 shadow-[0_0_30px_rgba(203,213,225,.14)]",
  },
  {
    id: "oro",
    nombre: "Insignia Oro",
    descripcion: "Máximo reconocimiento a la excelencia.",
    imagen: "/insignias/insignia-oro-albatros.webp",
    accentClass: "text-amber-300",
    selectedClass:
      "border-amber-300/70 bg-amber-400/10 shadow-[0_0_34px_rgba(251,191,36,.18)]",
  },
];

const ATHLETE_BADGE_ID_SET = new Set<string>(ATHLETE_BADGE_IDS);

export function isAthleteBadgeId(value: unknown): value is AthleteBadgeId {
  return typeof value === "string" && ATHLETE_BADGE_ID_SET.has(value);
}

/**
 * Acepta el formato actual (string[]) y registros anteriores con `{ id }`.
 * El resultado siempre queda sin duplicados y en el orden Bronce → Plata → Oro.
 */
export function normalizeAthleteBadgeIds(value: unknown): AthleteBadgeId[] {
  if (!Array.isArray(value)) return [];

  const received = new Set<AthleteBadgeId>();

  value.forEach((entry) => {
    const candidate =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object" && "id" in entry
          ? (entry as { id?: unknown }).id
          : null;

    if (isAthleteBadgeId(candidate)) received.add(candidate);
  });

  return ATHLETE_BADGE_IDS.filter((id) => received.has(id));
}

export function athleteBadgeCount(value: unknown): number {
  return normalizeAthleteBadgeIds(value).length;
}

export function getPrimaryAthleteBadge(value: unknown): AthleteBadgeDefinition | null {
  const assigned = normalizeAthleteBadgeIds(value);

  for (let index = ATHLETE_BADGES.length - 1; index >= 0; index -= 1) {
    const badge = ATHLETE_BADGES[index];
    if (assigned.includes(badge.id)) return badge;
  }

  return null;
}
