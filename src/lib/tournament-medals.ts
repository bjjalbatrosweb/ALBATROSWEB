export const TOURNAMENT_MEDAL_IDS = [
  "federacion-jiu-jitsu",
  "universidad-autonoma-yucatan",
] as const;

export type TournamentMedalId = (typeof TOURNAMENT_MEDAL_IDS)[number];

export type TournamentMedalDefinition = {
  id: TournamentMedalId;
  nombre: string;
  nombreCorto: string;
  descripcion: string;
  imagen: string;
};

export const TOURNAMENT_MEDALS: TournamentMedalDefinition[] = [
  {
    id: "federacion-jiu-jitsu",
    nombre: "Federación Mexicana de Jiu Jitsu",
    nombreCorto: "Federación de Jiu Jitsu",
    descripcion: "Medalla digital por participación en un torneo de la Federación Mexicana de Jiu Jitsu.",
    imagen: "/medallas/medalla-federacion-jiu-jitsu.webp",
  },
  {
    id: "universidad-autonoma-yucatan",
    nombre: "Universidad Autónoma de Yucatán",
    nombreCorto: "Universidad Autónoma",
    descripcion: "Medalla digital por participación en un torneo de la Universidad Autónoma de Yucatán.",
    imagen: "/medallas/medalla-universidad-autonoma-yucatan.webp",
  },
];

const TOURNAMENT_MEDAL_ID_SET = new Set<string>(TOURNAMENT_MEDAL_IDS);

export function isTournamentMedalId(value: unknown): value is TournamentMedalId {
  return typeof value === "string" && TOURNAMENT_MEDAL_ID_SET.has(value);
}

/** Conserva solo medallas conocidas, sin duplicados y en orden de catálogo. */
export function normalizeTournamentMedalIds(value: unknown): TournamentMedalId[] {
  if (!Array.isArray(value)) return [];

  const received = new Set<TournamentMedalId>();
  value.forEach((entry) => {
    const candidate =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object" && "id" in entry
          ? (entry as { id?: unknown }).id
          : null;

    if (isTournamentMedalId(candidate)) received.add(candidate);
  });

  return TOURNAMENT_MEDAL_IDS.filter((id) => received.has(id));
}

export function tournamentMedalCount(value: unknown): number {
  return normalizeTournamentMedalIds(value).length;
}

export function getAssignedTournamentMedals(value: unknown): TournamentMedalDefinition[] {
  const ids = normalizeTournamentMedalIds(value);
  return TOURNAMENT_MEDALS.filter((medal) => ids.includes(medal.id));
}
