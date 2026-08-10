export type CompetitionResult = {
  fecha: string;
  evento: string;
  resultado: string;
};

export type CompetitionAthlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
  pesoActual: number | null;
  pesoObjetivo: number | null;
  categoriaDeportiva: string;
  proximaCompetencia: string;
  fechaCompetencia: string;
  objetivo: string;
  resultadosCompetencias: CompetitionResult[];
};

export type CompetitionChecklist = {
  inscripcion: boolean;
  documentos: boolean;
  uniforme: boolean;
  peso: boolean;
  transporte: boolean;
  hidratacion: boolean;
};

export type CompetitionStatus =
  | "preparacion"
  | "calentamiento"
  | "llamado"
  | "combatiendo"
  | "finalizado";

export type CompetitionEntry = {
  id: string;
  athleteId: string;
  status: CompetitionStatus;
  categoria: string;
  tatami: string;
  orden: string;
  horaEstimada: string;
  notas: string;
  resultado: string;
  resultadoGuardado: boolean;
  checklist: CompetitionChecklist;
};

export type CompetitionSession = {
  id: string;
  eventName: string;
  eventDate: string;
  venue: string;
  coach: string;
  entries: CompetitionEntry[];
  updatedAt: string;
};

export const COMPETITION_STATUS_ORDER: CompetitionStatus[] = [
  "preparacion",
  "calentamiento",
  "llamado",
  "combatiendo",
  "finalizado",
];

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  preparacion: "Preparación",
  calentamiento: "Calentamiento",
  llamado: "Llamado / espera",
  combatiendo: "En combate",
  finalizado: "Finalizado",
};

export const CHECKLIST_LABELS: Record<keyof CompetitionChecklist, string> = {
  inscripcion: "Inscripción",
  documentos: "Documentos",
  uniforme: "Uniforme / equipo",
  peso: "Peso confirmado",
  transporte: "Traslado",
  hidratacion: "Hidratación",
};

export function emptyChecklist(): CompetitionChecklist {
  return {
    inscripcion: false,
    documentos: false,
    uniforme: false,
    peso: false,
    transporte: false,
    hidratacion: false,
  };
}

export function createCompetitionSession(): CompetitionSession {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `competition-${Date.now()}`,
    eventName: "Próxima competencia",
    eventDate: today,
    venue: "",
    coach: "",
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createCompetitionEntry(athlete: CompetitionAthlete): CompetitionEntry {
  return {
    id: `entry-${athlete.id}-${Date.now()}`,
    athleteId: athlete.id,
    status: "preparacion",
    categoria: athlete.categoriaDeportiva,
    tatami: "",
    orden: "",
    horaEstimada: "",
    notas: "",
    resultado: "",
    resultadoGuardado: false,
    checklist: emptyChecklist(),
  };
}

export function checklistProgress(checklist: CompetitionChecklist) {
  const values = Object.values(checklist);
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

export function passportReadiness(athlete: CompetitionAthlete) {
  const checks = [
    { label: "Fotografía", ready: Boolean(athlete.fotoUrl) },
    { label: "Disciplina", ready: Boolean(athlete.disciplina) },
    { label: "Grado", ready: Boolean(athlete.grado) },
    { label: "Peso actual", ready: Boolean(athlete.pesoActual) },
    { label: "Categoría", ready: Boolean(athlete.categoriaDeportiva) },
    { label: "Próximo evento", ready: Boolean(athlete.proximaCompetencia) },
    { label: "Fecha", ready: Boolean(athlete.fechaCompetencia) },
    { label: "Objetivo", ready: Boolean(athlete.objetivo) },
  ];
  const ready = checks.filter((check) => check.ready).length;
  return { score: Math.round((ready / checks.length) * 100), checks };
}

export function weightDifference(athlete: CompetitionAthlete) {
  if (!athlete.pesoActual || !athlete.pesoObjetivo) return null;
  return Number((athlete.pesoActual - athlete.pesoObjetivo).toFixed(1));
}

export function daysUntil(date: string) {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function moveCompetitionStatus(status: CompetitionStatus, direction: -1 | 1) {
  const current = COMPETITION_STATUS_ORDER.indexOf(status);
  return COMPETITION_STATUS_ORDER[
    Math.max(0, Math.min(COMPETITION_STATUS_ORDER.length - 1, current + direction))
  ];
}
