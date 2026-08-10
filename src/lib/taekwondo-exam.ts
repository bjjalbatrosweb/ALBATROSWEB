import { TAEKWONDO_GRADES } from "@/lib/taekwondo-grades";

export type ExamCriterion = {
  id: string;
  categoria: string;
  nombre: string;
  descripcion: string;
};

export type ExamState =
  "inscripciones" | "registro_sinodales" | "evaluacion" | "finalizado";

export const DEFAULT_EXAM_CRITERIA: ExamCriterion[] = [
  {
    id: "etiqueta-saludo",
    categoria: "Disciplina y etiqueta",
    nombre: "Saludo y protocolo",
    descripcion: "Respeto, presentación y cumplimiento del protocolo.",
  },
  {
    id: "actitud-concentracion",
    categoria: "Disciplina y etiqueta",
    nombre: "Actitud y concentración",
    descripcion: "Atención, seguridad y disposición durante el examen.",
  },
  {
    id: "fundamentos-posturas",
    categoria: "Fundamentos",
    nombre: "Posturas",
    descripcion: "Base, estabilidad, orientación y cambios de postura.",
  },
  {
    id: "fundamentos-bloqueos",
    categoria: "Fundamentos",
    nombre: "Bloqueos",
    descripcion: "Trayectoria, forma, altura y terminación correcta.",
  },
  {
    id: "fundamentos-golpes",
    categoria: "Fundamentos",
    nombre: "Golpes",
    descripcion: "Precisión, alineación, potencia y recuperación.",
  },
  {
    id: "patadas-tecnica",
    categoria: "Técnica de pateo",
    nombre: "Ejecución técnica",
    descripcion: "Cámara, extensión, impacto y regreso de la pierna.",
  },
  {
    id: "patadas-altura-control",
    categoria: "Técnica de pateo",
    nombre: "Altura y control",
    descripcion: "Dominio, precisión y equilibrio al patear.",
  },
  {
    id: "patadas-combinaciones",
    categoria: "Técnica de pateo",
    nombre: "Combinaciones",
    descripcion: "Fluidez, ritmo y enlace entre técnicas.",
  },
  {
    id: "poomsae-secuencia",
    categoria: "Poomsae",
    nombre: "Secuencia",
    descripcion: "Memoria, dirección y orden correcto de movimientos.",
  },
  {
    id: "poomsae-precision",
    categoria: "Poomsae",
    nombre: "Precisión técnica",
    descripcion: "Posiciones, trayectorias y puntos finales.",
  },
  {
    id: "poomsae-ritmo-potencia",
    categoria: "Poomsae",
    nombre: "Ritmo y potencia",
    descripcion: "Cadencia, respiración, intención y explosividad.",
  },
  {
    id: "combate-guardia-distancia",
    categoria: "Combate",
    nombre: "Guardia y distancia",
    descripcion: "Protección, movilidad y administración del espacio.",
  },
  {
    id: "combate-reaccion",
    categoria: "Combate",
    nombre: "Reacción y velocidad",
    descripcion: "Respuesta, oportunidad y velocidad de ejecución.",
  },
  {
    id: "combate-control",
    categoria: "Combate",
    nombre: "Control y estrategia",
    descripcion: "Toma de decisiones, control técnico y seguridad.",
  },
  {
    id: "fisico-resistencia",
    categoria: "Preparación física",
    nombre: "Resistencia",
    descripcion: "Capacidad para mantener calidad durante el examen.",
  },
  {
    id: "fisico-flexibilidad",
    categoria: "Preparación física",
    nombre: "Flexibilidad y movilidad",
    descripcion: "Amplitud útil y control en los rangos de movimiento.",
  },
  {
    id: "fisico-coordinacion",
    categoria: "Preparación física",
    nombre: "Coordinación",
    descripcion: "Integración de desplazamiento, técnica y equilibrio.",
  },
  {
    id: "rompimiento",
    categoria: "Aplicación",
    nombre: "Rompimiento",
    descripcion: "Preparación, precisión, decisión y técnica aplicada.",
  },
  {
    id: "defensa-personal",
    categoria: "Aplicación",
    nombre: "Defensa personal",
    descripcion: "Control, realismo, seguridad y respuesta apropiada.",
  },
  {
    id: "teoria",
    categoria: "Conocimiento",
    nombre: "Teoría y terminología",
    descripcion: "Comprensión del grado, vocabulario y reglamento.",
  },
];

export function normalizeExamText(value: unknown, max = 120) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export function normalizeExamId(value: unknown) {
  return normalizeExamText(value, 30)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

export function nextTaekwondoGrade(current: unknown) {
  const value = normalizeExamText(current, 40);
  const index = TAEKWONDO_GRADES.findIndex(
    (grade) => grade.toLocaleLowerCase("es") === value.toLocaleLowerCase("es"),
  );
  return index >= 0 && index < TAEKWONDO_GRADES.length - 1
    ? TAEKWONDO_GRADES[index + 1]
    : null;
}

export function criterionScore(ratings: Record<string, number>) {
  const values = Object.values(ratings).filter(
    (value) => Number.isFinite(value) && value >= 0 && value <= 5,
  );
  if (!values.length) return 0;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
    ) / 100
  );
}

export function createExamToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
