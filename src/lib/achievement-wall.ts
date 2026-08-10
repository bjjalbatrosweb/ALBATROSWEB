export type AchievementKind =
  | "oro"
  | "plata"
  | "bronce"
  | "victoria"
  | "participacion"
  | "especial";

export type AchievementWallTheme = "dorado" | "neon" | "academia";

export type AchievementAthlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  resultados: Array<{ fecha: string; evento: string; resultado: string }>;
};

export type Achievement = {
  id: string;
  athleteId: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  fecha: string;
  evento: string;
  resultado: string;
  kind: AchievementKind;
  source: "ficha" | "manual";
};

export type AchievementWallState = {
  titulo: string;
  subtitulo: string;
  theme: AchievementWallTheme;
  intervalSeconds: number;
  selectedIds: string[];
  manualAchievements: Achievement[];
};

export const ACHIEVEMENT_KIND_LABELS: Record<AchievementKind, string> = {
  oro: "Oro",
  plata: "Plata",
  bronce: "Bronce",
  victoria: "Victoria",
  participacion: "Participación",
  especial: "Reconocimiento",
};

export const ACHIEVEMENT_WALL_THEME_LABELS: Record<AchievementWallTheme, string> = {
  dorado: "Dorado de campeones",
  neon: "Neón deportivo",
  academia: "Academia Albatros",
};

export function achievementKind(result: string): AchievementKind {
  const normalized = result.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("oro") || normalized.includes("1er") || normalized.includes("primer lugar")) return "oro";
  if (normalized.includes("plata") || normalized.includes("2do") || normalized.includes("segundo lugar")) return "plata";
  if (normalized.includes("bronce") || normalized.includes("3er") || normalized.includes("tercer lugar")) return "bronce";
  if (normalized.includes("victoria") || normalized.includes("ganador") || normalized.includes("campeon")) return "victoria";
  if (normalized.includes("particip")) return "participacion";
  return "especial";
}

export function buildAthleteAchievements(athletes: AchievementAthlete[]) {
  return athletes
    .flatMap((athlete) =>
      athlete.resultados.map((result, index) => ({
        id: `result-${athlete.id}-${index}-${result.fecha}`,
        athleteId: athlete.id,
        nombre: athlete.nombre,
        fotoUrl: athlete.fotoUrl,
        disciplina: athlete.disciplina,
        fecha: result.fecha,
        evento: result.evento,
        resultado: result.resultado,
        kind: achievementKind(result.resultado),
        source: "ficha" as const,
      })),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function createManualAchievement(input: {
  athlete: Omit<AchievementAthlete, "resultados">;
  date: string;
  event: string;
  result: string;
  kind: AchievementKind;
}) {
  return {
    id: `manual-${input.athlete.id}-${Date.now()}`,
    athleteId: input.athlete.id,
    nombre: input.athlete.nombre,
    fotoUrl: input.athlete.fotoUrl,
    disciplina: input.athlete.disciplina,
    fecha: input.date,
    evento: input.event.trim(),
    resultado: input.result.trim(),
    kind: input.kind,
    source: "manual" as const,
  } satisfies Achievement;
}

export function defaultAchievementWallState(): AchievementWallState {
  return {
    titulo: "Muro de campeones",
    subtitulo: "Disciplina · constancia · comunidad",
    theme: "dorado",
    intervalSeconds: 8,
    selectedIds: [],
    manualAchievements: [],
  };
}

export function clampWallInterval(value: number) {
  return Math.max(4, Math.min(30, Math.round(Number(value) || 8)));
}

