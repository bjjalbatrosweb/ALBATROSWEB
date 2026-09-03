export const TOURNAMENT_MEDAL_IDS = [
  "federacion-jiu-jitsu",
  "universidad-autonoma-yucatan",
  "adcc-open-mexico",
  "open-no-gi-redonda",
  "open-no-gi-geometrica",
  "famm",
  "ajp-tour",
  "wbc-world-champion",
  "wsl-rojo-negro",
  "on-coespe-2020",
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
  {
    id: "adcc-open-mexico",
    nombre: "ADCC Open México",
    nombreCorto: "ADCC Open México",
    descripcion: "Medalla digital por participación o resultado en ADCC Open México.",
    imagen: "/medallas/medalla-adcc-open-mexico.webp",
  },
  {
    id: "open-no-gi-redonda",
    nombre: "Open No-Gi · Medalla redonda",
    nombreCorto: "Open No-Gi",
    descripcion: "Medalla digital de Open No-Gi en su diseño circular.",
    imagen: "/medallas/medalla-open-no-gi-redonda.webp",
  },
  {
    id: "open-no-gi-geometrica",
    nombre: "Open No-Gi · Medalla geométrica",
    nombreCorto: "Open No-Gi Geométrica",
    descripcion: "Medalla digital de Open No-Gi en su diseño geométrico.",
    imagen: "/medallas/medalla-open-no-gi-geometrica.webp",
  },
  {
    id: "famm",
    nombre: "FAMM",
    nombreCorto: "FAMM",
    descripcion: "Medalla digital por participación o resultado en un torneo FAMM.",
    imagen: "/medallas/medalla-famm.webp",
  },
  {
    id: "ajp-tour",
    nombre: "AJP Tour",
    nombreCorto: "AJP Tour",
    descripcion: "Medalla digital por participación o resultado en AJP Tour.",
    imagen: "/medallas/medalla-ajp-tour.webp",
  },
  {
    id: "wbc-world-champion",
    nombre: "WBC World Champion",
    nombreCorto: "WBC World Champion",
    descripcion: "Medalla digital de reconocimiento WBC World Champion.",
    imagen: "/medallas/medalla-wbc-world-champion.webp",
  },
  {
    id: "wsl-rojo-negro",
    nombre: "Emblema WSL Rojo y Negro",
    nombreCorto: "WSL",
    descripcion: "Medalla digital con el emblema WSL rojo y negro.",
    imagen: "/medallas/medalla-wsl-rojo-negro.webp",
  },
  {
    id: "on-coespe-2020",
    nombre: "ON COESPE 2020",
    nombreCorto: "ON COESPE 2020",
    descripcion: "Medalla digital conmemorativa ON COESPE 2020.",
    imagen: "/medallas/medalla-on-coespe-2020.webp",
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
