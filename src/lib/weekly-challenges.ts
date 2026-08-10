export type ChallengeCategory =
  | "tecnica"
  | "asistencia"
  | "fisico"
  | "habito"
  | "competencia";

export type ChallengeStatus = "activo" | "completado" | "cancelado";

export type WeeklyChallenge = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: ChallengeCategory;
  objetivo: number;
  progreso: number;
  unidad: string;
  fechaInicio: string;
  fechaFin: string;
  estado: ChallengeStatus;
  coach: string;
  creadoEn: string;
  completadoEn?: string;
};

export type ChallengeTemplate = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: ChallengeCategory;
  objetivo: number;
  unidad: string;
};

export const CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  tecnica: "Técnica",
  asistencia: "Asistencia",
  fisico: "Preparación física",
  habito: "Hábito",
  competencia: "Competencia",
};

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: "asistencias-3",
    titulo: "Entrenar 3 veces",
    descripcion: "Completar tres sesiones durante la semana.",
    categoria: "asistencia",
    objetivo: 3,
    unidad: "sesiones",
  },
  {
    id: "tecnica-20",
    titulo: "20 repeticiones de calidad",
    descripcion: "Practicar la técnica prioritaria con ejecución controlada.",
    categoria: "tecnica",
    objetivo: 20,
    unidad: "repeticiones",
  },
  {
    id: "rounds-5",
    titulo: "5 rounds con objetivo",
    descripcion: "Realizar rounds enfocados en el objetivo indicado por el coach.",
    categoria: "competencia",
    objetivo: 5,
    unidad: "rounds",
  },
  {
    id: "movilidad-4",
    titulo: "Movilidad 4 días",
    descripcion: "Completar una rutina corta de movilidad antes o después de entrenar.",
    categoria: "habito",
    objetivo: 4,
    unidad: "días",
  },
  {
    id: "acondicionamiento-3",
    titulo: "3 bloques de acondicionamiento",
    descripcion: "Completar los bloques físicos asignados manteniendo buena técnica.",
    categoria: "fisico",
    objetivo: 3,
    unidad: "bloques",
  },
];

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentWeekRange(reference = new Date()) {
  const start = new Date(reference);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  start.setHours(12, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: localDate(start), end: localDate(end) };
}

export function challengeProgress(challenge: Pick<WeeklyChallenge, "objetivo" | "progreso">) {
  const target = Math.max(1, Number(challenge.objetivo) || 1);
  const current = Math.max(0, Number(challenge.progreso) || 0);
  return Math.min(100, Math.round((current / target) * 100));
}

export function createWeeklyChallenge(input: {
  title: string;
  description: string;
  category: ChallengeCategory;
  target: number;
  unit: string;
  startDate: string;
  endDate: string;
  coach: string;
}): WeeklyChallenge {
  const now = new Date();
  return {
    id: `challenge-${now.getTime()}`,
    titulo: input.title.trim(),
    descripcion: input.description.trim(),
    categoria: input.category,
    objetivo: Math.max(1, Math.round(Number(input.target) || 1)),
    progreso: 0,
    unidad: input.unit.trim() || "veces",
    fechaInicio: input.startDate,
    fechaFin: input.endDate,
    estado: "activo",
    coach: input.coach.trim(),
    creadoEn: now.toISOString(),
  };
}

export function updateChallengeProgress(challenge: WeeklyChallenge, progress: number) {
  const nextProgress = Math.max(0, Math.min(challenge.objetivo, Math.round(Number(progress) || 0)));
  const completed = nextProgress >= challenge.objetivo;
  return {
    ...challenge,
    progreso: nextProgress,
    estado: completed ? ("completado" as const) : ("activo" as const),
    completadoEn: completed ? challenge.completadoEn || new Date().toISOString() : undefined,
  };
}

export function isChallengeOverdue(challenge: WeeklyChallenge, today = localDate(new Date())) {
  return challenge.estado === "activo" && Boolean(challenge.fechaFin) && challenge.fechaFin < today;
}

