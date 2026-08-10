export type EvaluationDiscipline =
  | "jiujitsu"
  | "mma"
  | "taekwondo"
  | "general";

export type EvaluationCriterion = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
};

export type TechnicalEvaluation = {
  id: string;
  fecha: string;
  disciplina: EvaluationDiscipline;
  disciplinaLabel: string;
  gradoActual: string;
  gradoObjetivo: string;
  coach: string;
  notas: string;
  proximoObjetivo: string;
  puntuaciones: Record<string, number>;
  preparacion: number;
  recomendacion: EvaluationRecommendation;
};

export type EvaluationRecommendation =
  | "En desarrollo"
  | "Cerca de revisión"
  | "Listo para revisión del coach";

const RUBRICS: Record<EvaluationDiscipline, EvaluationCriterion[]> = {
  jiujitsu: [
    { id: "base", label: "Base y postura", shortLabel: "Base", description: "Equilibrio, postura y desplazamiento seguro." },
    { id: "escapes", label: "Escapes", shortLabel: "Escapes", description: "Reconoce peligro, crea espacio y recupera posición." },
    { id: "guardia", label: "Trabajo de guardia", shortLabel: "Guardia", description: "Control, retención, barridos y ataques desde guardia." },
    { id: "pases", label: "Pases de guardia", shortLabel: "Pases", description: "Presión, dirección y estabilización al pasar." },
    { id: "control", label: "Control posicional", shortLabel: "Control", description: "Mantiene posiciones y progresa con intención." },
    { id: "sumisiones", label: "Sumisiones", shortLabel: "Sumisión", description: "Entradas, mecánica y liberación responsable." },
    { id: "decisiones", label: "Decisiones en sparring", shortLabel: "Decisión", description: "Ritmo, estrategia y respuesta bajo presión." },
    { id: "seguridad", label: "Seguridad y compañerismo", shortLabel: "Seguridad", description: "Control, comunicación y cuidado de la pareja." },
  ],
  mma: [
    { id: "golpeo", label: "Golpeo", shortLabel: "Golpeo", description: "Precisión, combinaciones y selección de golpes." },
    { id: "defensa", label: "Defensa", shortLabel: "Defensa", description: "Guardia, bloqueos, esquivas y respuestas." },
    { id: "distancia", label: "Distancia y desplazamiento", shortLabel: "Distancia", description: "Ángulos, entradas, salidas y control del espacio." },
    { id: "clinch", label: "Clinch", shortLabel: "Clinch", description: "Posición, controles, golpes y salidas." },
    { id: "derribos", label: "Derribos", shortLabel: "Derribos", description: "Preparación, ejecución y defensa de derribo." },
    { id: "suelo", label: "Trabajo de suelo", shortLabel: "Suelo", description: "Control, transición y defensa en piso." },
    { id: "condicion", label: "Condición aplicada", shortLabel: "Condición", description: "Mantiene técnica y decisiones con fatiga." },
    { id: "control", label: "Control y seguridad", shortLabel: "Control", description: "Intensidad adecuada y protección del compañero." },
  ],
  taekwondo: [
    { id: "postura", label: "Postura y movilidad", shortLabel: "Postura", description: "Base, distancia y desplazamientos." },
    { id: "patadas", label: "Técnica de patadas", shortLabel: "Patadas", description: "Cámara, trayectoria, impacto y recuperación." },
    { id: "combinaciones", label: "Combinaciones", shortLabel: "Combos", description: "Encadena técnicas con fluidez e intención." },
    { id: "defensa", label: "Defensa", shortLabel: "Defensa", description: "Bloqueos, evasiones y contraataques." },
    { id: "tiempo", label: "Tiempo y distancia", shortLabel: "Tiempo", description: "Lectura del rival y elección del momento." },
    { id: "poomsae", label: "Poomsae / formas", shortLabel: "Poomsae", description: "Secuencia, dirección, potencia y presentación." },
    { id: "combate", label: "Aplicación en combate", shortLabel: "Combate", description: "Estrategia, adaptación y control emocional." },
    { id: "disciplina", label: "Disciplina y seguridad", shortLabel: "Disciplina", description: "Respeto, autocontrol y hábitos de entrenamiento." },
  ],
  general: [
    { id: "movimiento", label: "Calidad de movimiento", shortLabel: "Movimiento", description: "Control corporal y patrones fundamentales." },
    { id: "fuerza", label: "Fuerza aplicada", shortLabel: "Fuerza", description: "Produce y controla fuerza con buena técnica." },
    { id: "resistencia", label: "Resistencia", shortLabel: "Resistencia", description: "Sostiene el trabajo y recupera adecuadamente." },
    { id: "coordinacion", label: "Coordinación", shortLabel: "Coordinación", description: "Ritmo, precisión y aprendizaje motor." },
    { id: "movilidad", label: "Movilidad", shortLabel: "Movilidad", description: "Rangos útiles y controlados." },
    { id: "tecnica", label: "Técnica", shortLabel: "Técnica", description: "Ejecuta consignas con calidad y consistencia." },
    { id: "constancia", label: "Constancia", shortLabel: "Constancia", description: "Participación, actitud y continuidad." },
    { id: "seguridad", label: "Seguridad", shortLabel: "Seguridad", description: "Reconoce límites y entrena de forma responsable." },
  ],
};

export const DISCIPLINE_LABELS: Record<EvaluationDiscipline, string> = {
  jiujitsu: "Jiu-Jitsu",
  mma: "MMA",
  taekwondo: "Taekwondo",
  general: "General / funcional",
};

export function normalizeEvaluationDiscipline(value: string): EvaluationDiscipline {
  const normalized = value.toLocaleLowerCase("es").replace(/[-_\s]/g, "");
  if (normalized.includes("jiujitsu") || normalized.includes("bjj")) return "jiujitsu";
  if (normalized.includes("taekwondo") || normalized.includes("tkd")) return "taekwondo";
  if (normalized.includes("mma") || normalized.includes("artesmarcialesmixtas")) return "mma";
  return "general";
}

export function evaluationRubric(discipline: EvaluationDiscipline) {
  return RUBRICS[discipline];
}

export function emptyEvaluationScores(discipline: EvaluationDiscipline, score = 3) {
  return Object.fromEntries(RUBRICS[discipline].map((criterion) => [criterion.id, score]));
}

export function evaluationReadiness(
  discipline: EvaluationDiscipline,
  scores: Record<string, number>,
) {
  const values = RUBRICS[discipline].map((criterion) =>
    Math.max(1, Math.min(5, Number(scores[criterion.id]) || 1)),
  );
  return Math.round((values.reduce((total, value) => total + value, 0) / (values.length * 5)) * 100);
}

export function evaluationRecommendation(readiness: number): EvaluationRecommendation {
  if (readiness >= 85) return "Listo para revisión del coach";
  if (readiness >= 65) return "Cerca de revisión";
  return "En desarrollo";
}

export function scoreDelta(current: number, previous?: number) {
  if (typeof previous !== "number") return null;
  return Math.max(-4, Math.min(4, current - previous));
}

export function createTechnicalEvaluation(input: {
  discipline: EvaluationDiscipline;
  currentGrade: string;
  targetGrade: string;
  coach: string;
  notes: string;
  nextGoal: string;
  scores: Record<string, number>;
}): TechnicalEvaluation {
  const preparation = evaluationReadiness(input.discipline, input.scores);
  const now = new Date();
  return {
    id: `evaluation-${now.getTime()}`,
    fecha: now.toISOString(),
    disciplina: input.discipline,
    disciplinaLabel: DISCIPLINE_LABELS[input.discipline],
    gradoActual: input.currentGrade.trim(),
    gradoObjetivo: input.targetGrade.trim(),
    coach: input.coach.trim(),
    notas: input.notes.trim(),
    proximoObjetivo: input.nextGoal.trim(),
    puntuaciones: Object.fromEntries(
      RUBRICS[input.discipline].map((criterion) => [
        criterion.id,
        Math.max(1, Math.min(5, Number(input.scores[criterion.id]) || 1)),
      ]),
    ),
    preparacion: preparation,
    recomendacion: evaluationRecommendation(preparation),
  };
}

