export type TrainingDiscipline = "BJJ" | "MMA" | "Taekwondo" | "Funcional";
export type TrainingFocus = "tecnica" | "fisico" | "sparring" | "mixto";
export type TrainingLevel = "principiante" | "intermedio" | "avanzado";
export type TrainingPhase =
  | "activacion"
  | "tecnica"
  | "aplicacion"
  | "acondicionamiento"
  | "cierre";

export type TrainingExercise = {
  id: string;
  title: string;
  instruction: string;
  disciplines: Array<TrainingDiscipline | "Todas">;
  phases: TrainingPhase[];
  focuses: TrainingFocus[];
  levels: TrainingLevel[];
  equipment: "ninguno" | "pareja" | "costal" | "paletas" | "balon" | "dummy";
  intensity: 1 | 2 | 3;
};

export type TrainingBlock = {
  id: string;
  phase: TrainingPhase;
  title: string;
  instruction: string;
  minutes: number;
  equipment: TrainingExercise["equipment"];
};

export type TrainingPlan = {
  id: string;
  createdAt: string;
  title: string;
  discipline: TrainingDiscipline;
  focus: TrainingFocus;
  level: TrainingLevel;
  duration: number;
  groupSize: number;
  blocks: TrainingBlock[];
};

const ALL_LEVELS: TrainingLevel[] = ["principiante", "intermedio", "avanzado"];

export const TRAINING_EXERCISES: TrainingExercise[] = [
  {
    id: "movilidad-ramp",
    title: "Activación RAMP",
    instruction: "Movilidad articular, desplazamientos suaves y tres aceleraciones progresivas. Mantén respiración nasal al inicio.",
    disciplines: ["Todas"], phases: ["activacion"], focuses: ["mixto", "fisico", "tecnica"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 1,
  },
  {
    id: "reaccion-colores",
    title: "Reacción por colores",
    instruction: "El entrenador indica color o número; el grupo responde con desplazamiento, cambio de nivel o sprawl previamente asignado.",
    disciplines: ["Todas"], phases: ["activacion", "aplicacion"], focuses: ["mixto", "sparring"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 2,
  },
  {
    id: "movilidad-pareja",
    title: "Movilidad con compañero",
    instruction: "Espejo de desplazamientos, cambios de base y alcance controlado. Cambia líder cada 45 segundos.",
    disciplines: ["Todas"], phases: ["activacion"], focuses: ["tecnica", "mixto"], levels: ALL_LEVELS, equipment: "pareja", intensity: 1,
  },
  {
    id: "bjj-solo-flow",
    title: "Flow de movimientos de suelo",
    instruction: "Encadena shrimp, puente, hip heist y levantada técnica sin detenerte. Prioriza control y simetría.",
    disciplines: ["BJJ"], phases: ["activacion", "acondicionamiento"], focuses: ["tecnica", "fisico", "mixto"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 2,
  },
  {
    id: "bjj-guardia-conexiones",
    title: "Guardia: conexión y desequilibrio",
    instruction: "Desde guardia sentada conecta muñeca y tobillo, crea dos direcciones de desequilibrio y finaliza con barrido o wrestle-up.",
    disciplines: ["BJJ"], phases: ["tecnica", "aplicacion"], focuses: ["tecnica", "mixto"], levels: ALL_LEVELS, equipment: "pareja", intensity: 2,
  },
  {
    id: "bjj-pase-guardia",
    title: "Pase de guardia por reacción",
    instruction: "El pasador elige toreando o knee-cut según la posición de rodillas. Abajo recupera conexión sin cerrar la guardia.",
    disciplines: ["BJJ"], phases: ["tecnica", "aplicacion"], focuses: ["tecnica", "sparring", "mixto"], levels: ["intermedio", "avanzado"], equipment: "pareja", intensity: 2,
  },
  {
    id: "bjj-escape-lateral",
    title: "Escape de control lateral",
    instruction: "Conecta frame, puente y reposición de rodilla. Aumenta resistencia únicamente cuando la secuencia sea estable.",
    disciplines: ["BJJ"], phases: ["tecnica", "aplicacion"], focuses: ["tecnica", "mixto"], levels: ALL_LEVELS, equipment: "pareja", intensity: 2,
  },
  {
    id: "bjj-round-posicional",
    title: "Round posicional BJJ",
    instruction: "Inicia desde la posición trabajada. Reinicia cuando haya pase, barrido, escape o control estable de cinco segundos.",
    disciplines: ["BJJ"], phases: ["aplicacion", "acondicionamiento"], focuses: ["sparring", "mixto"], levels: ALL_LEVELS, equipment: "pareja", intensity: 3,
  },
  {
    id: "bjj-dummy-chain",
    title: "Cadena técnica con dummy",
    instruction: "Derribo, estabilización lateral, rodilla al abdomen y montada. Fluidez continua sin golpear articulaciones.",
    disciplines: ["BJJ", "MMA"], phases: ["tecnica", "acondicionamiento"], focuses: ["tecnica", "fisico", "mixto"], levels: ALL_LEVELS, equipment: "dummy", intensity: 2,
  },
  {
    id: "mma-shadow-reactivo",
    title: "Shadowboxing reactivo",
    instruction: "Combina jab, cross y salida angular siguiendo señales visuales. Cada combinación termina recuperando guardia y distancia.",
    disciplines: ["MMA"], phases: ["activacion", "tecnica"], focuses: ["tecnica", "mixto"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 2,
  },
  {
    id: "mma-paletas-decision",
    title: "Paletas de decisión",
    instruction: "El paletero ofrece uno de tres blancos. El atleta identifica, conecta máximo tres golpes y sale por un ángulo seguro.",
    disciplines: ["MMA"], phases: ["tecnica", "aplicacion"], focuses: ["tecnica", "sparring", "mixto"], levels: ALL_LEVELS, equipment: "paletas", intensity: 2,
  },
  {
    id: "mma-clinch-pummeling",
    title: "Pummeling y salida de clinch",
    instruction: "Busca underhook, posición de cabeza y giro. Puntúa al controlar tres segundos o salir con postura estable.",
    disciplines: ["MMA"], phases: ["tecnica", "aplicacion"], focuses: ["tecnica", "sparring", "mixto"], levels: ALL_LEVELS, equipment: "pareja", intensity: 2,
  },
  {
    id: "mma-sparring-limitado",
    title: "Sparring con herramientas limitadas",
    instruction: "Un competidor usa solo boxeo y el otro combina defensa con entrada. Cambia roles a mitad del bloque; contacto técnico.",
    disciplines: ["MMA"], phases: ["aplicacion"], focuses: ["sparring", "mixto"], levels: ["intermedio", "avanzado"], equipment: "pareja", intensity: 3,
  },
  {
    id: "mma-costal-rondas",
    title: "Rondas inteligentes en costal",
    instruction: "Alterna 20 segundos de precisión, 10 de desplazamiento y 20 de potencia controlada. No sacrifiques postura.",
    disciplines: ["MMA", "Taekwondo"], phases: ["acondicionamiento"], focuses: ["fisico", "mixto"], levels: ALL_LEVELS, equipment: "costal", intensity: 3,
  },
  {
    id: "tkd-pasos-guardia",
    title: "Pasos y guardia de combate",
    instruction: "Avance, retroceso, paso lateral y cambio de distancia manteniendo postura. Responde a señales sin cruzar los pies.",
    disciplines: ["Taekwondo"], phases: ["activacion", "tecnica"], focuses: ["tecnica", "mixto"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 1,
  },
  {
    id: "tkd-peto-precision",
    title: "Precisión al peto",
    instruction: "Series de cinco patadas con apoyo estable y regreso rápido a guardia. Cambia altura o distancia por indicación.",
    disciplines: ["Taekwondo"], phases: ["tecnica", "aplicacion"], focuses: ["tecnica", "mixto"], levels: ALL_LEVELS, equipment: "paletas", intensity: 2,
  },
  {
    id: "tkd-contraataque",
    title: "Contraataque por señal",
    instruction: "El compañero entra de forma pactada; responde con desplazamiento y una técnica válida. Sube velocidad de forma gradual.",
    disciplines: ["Taekwondo"], phases: ["tecnica", "aplicacion"], focuses: ["tecnica", "sparring", "mixto"], levels: ["intermedio", "avanzado"], equipment: "pareja", intensity: 2,
  },
  {
    id: "tkd-round-condicionado",
    title: "Round condicionado de Taekwondo",
    instruction: "Asigna una misión por atleta: controlar centro, contraatacar o sumar con pierna adelantada. Contacto y nivel adaptados.",
    disciplines: ["Taekwondo"], phases: ["aplicacion"], focuses: ["sparring", "mixto"], levels: ALL_LEVELS, equipment: "pareja", intensity: 3,
  },
  {
    id: "funcional-circuito-base",
    title: "Circuito de fuerza útil",
    instruction: "Sentadilla, empuje, tracción con pareja y plancha. Trabaja por calidad; deja dos repeticiones en reserva.",
    disciplines: ["Funcional", "Todas"], phases: ["acondicionamiento"], focuses: ["fisico", "mixto"], levels: ALL_LEVELS, equipment: "pareja", intensity: 2,
  },
  {
    id: "funcional-balon-potencia",
    title: "Potencia con balón",
    instruction: "Lanzamiento frontal y rotacional con recuperación completa. Detén la serie cuando baje claramente la velocidad.",
    disciplines: ["Funcional", "MMA", "BJJ"], phases: ["acondicionamiento"], focuses: ["fisico", "mixto"], levels: ["intermedio", "avanzado"], equipment: "balon", intensity: 3,
  },
  {
    id: "intervalos-tecnicos",
    title: "Intervalos técnicos",
    instruction: "Treinta segundos de ejecución precisa y treinta de recuperación activa. Cambia tarea cada dos rondas.",
    disciplines: ["Todas"], phases: ["acondicionamiento"], focuses: ["fisico", "mixto"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 2,
  },
  {
    id: "reto-equipo",
    title: "Reto cooperativo por equipos",
    instruction: "El equipo acumula repeticiones técnicamente válidas. Una repetición insegura no cuenta; nadie queda eliminado.",
    disciplines: ["Todas"], phases: ["aplicacion", "acondicionamiento"], focuses: ["fisico", "mixto"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 2,
  },
  {
    id: "respiracion-cierre",
    title: "Respiración y vuelta a la calma",
    instruction: "Camina suave, respira cuatro segundos al inhalar y seis al exhalar. Revisa molestias y esfuerzo percibido.",
    disciplines: ["Todas"], phases: ["cierre"], focuses: ["tecnica", "fisico", "sparring", "mixto"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 1,
  },
  {
    id: "debrief-semaforo",
    title: "Debrief de semáforo",
    instruction: "Cada atleta identifica: verde, lo que funcionó; amarillo, lo inestable; rojo, lo que necesita ayuda del entrenador.",
    disciplines: ["Todas"], phases: ["cierre"], focuses: ["tecnica", "sparring", "mixto"], levels: ALL_LEVELS, equipment: "ninguno", intensity: 1,
  },
];

const PHASE_LABELS: Record<TrainingPhase, string> = {
  activacion: "Activación",
  tecnica: "Desarrollo técnico",
  aplicacion: "Aplicación",
  acondicionamiento: "Acondicionamiento",
  cierre: "Cierre",
};

export const TRAINING_PHASE_LABELS = PHASE_LABELS;

function randomItem<T>(items: T[], excludedIds: string[] = []) {
  const available = items.filter((item) => {
    if (!item || typeof item !== "object" || !("id" in item)) return true;
    return !excludedIds.includes(String(item.id));
  });
  const source = available.length ? available : items;
  return source[Math.floor(Math.random() * source.length)];
}

export function eligibleExercises({
  discipline,
  focus,
  level,
  phase,
  equipment,
}: {
  discipline: TrainingDiscipline;
  focus: TrainingFocus;
  level: TrainingLevel;
  phase?: TrainingPhase;
  equipment?: TrainingExercise["equipment"] | "cualquiera";
}) {
  return TRAINING_EXERCISES.filter((exercise) => {
    const disciplineMatches =
      exercise.disciplines.includes("Todas") || exercise.disciplines.includes(discipline);
    const focusMatches = focus === "mixto" || exercise.focuses.includes(focus) || exercise.focuses.includes("mixto");
    const levelMatches = exercise.levels.includes(level);
    const phaseMatches = !phase || exercise.phases.includes(phase);
    const equipmentMatches = !equipment || equipment === "cualquiera" || exercise.equipment === equipment;
    return disciplineMatches && focusMatches && levelMatches && phaseMatches && equipmentMatches;
  });
}

export function generateTrainingPlan({
  discipline,
  focus,
  level,
  duration,
  groupSize,
}: {
  discipline: TrainingDiscipline;
  focus: TrainingFocus;
  level: TrainingLevel;
  duration: number;
  groupSize: number;
}): TrainingPlan {
  const safeDuration = Math.max(45, Math.min(120, Math.round(duration)));
  const minutes = [
    Math.max(6, Math.round(safeDuration * 0.13)),
    Math.max(8, Math.round(safeDuration * 0.2)),
    Math.max(8, Math.round(safeDuration * 0.2)),
    Math.max(8, Math.round(safeDuration * 0.25)),
    Math.max(5, Math.round(safeDuration * 0.14)),
  ];
  const assigned = minutes.reduce((total, value) => total + value, 0);
  minutes.push(Math.max(3, safeDuration - assigned));
  if (minutes.reduce((total, value) => total + value, 0) > safeDuration) {
    minutes[4] = Math.max(3, minutes[4] - (minutes.reduce((total, value) => total + value, 0) - safeDuration));
  }

  const phases: TrainingPhase[] = [
    "activacion",
    "tecnica",
    "tecnica",
    "aplicacion",
    "acondicionamiento",
    "cierre",
  ];
  const used: string[] = [];
  const blocks = phases.map((phase, index) => {
    const strict = eligibleExercises({ discipline, focus, level, phase });
    const fallback = TRAINING_EXERCISES.filter(
      (exercise) => exercise.phases.includes(phase) && (exercise.disciplines.includes("Todas") || exercise.disciplines.includes(discipline)),
    );
    const exercise = randomItem(strict.length ? strict : fallback, used);
    used.push(exercise.id);
    return {
      id: `${Date.now()}-${index}-${exercise.id}`,
      phase,
      title: exercise.title,
      instruction: exercise.instruction,
      minutes: minutes[index],
      equipment: exercise.equipment,
    };
  });

  const focusLabel = {
    tecnica: "técnica",
    fisico: "acondicionamiento",
    sparring: "aplicación",
    mixto: "entrenamiento mixto",
  }[focus];

  return {
    id: `plan-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: `${discipline} · ${focusLabel}`,
    discipline,
    focus,
    level,
    duration: blocks.reduce((total, block) => total + block.minutes, 0),
    groupSize: Math.max(1, Math.round(groupSize)),
    blocks,
  };
}
