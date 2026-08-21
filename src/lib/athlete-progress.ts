export type SkillStatus = "pendiente" | "practicando" | "dominada";
export type SkillProgress = Record<string, SkillStatus>;

export type PhysicalAssessment = {
  id: string;
  fecha: string;
  pesoKg: number;
  estaturaCm: number;
  imc: number;
  grasaPorcentaje?: number;
  metodoGrasa?: string;
  cinturaCm?: number;
  caderaCm?: number;
  pechoCm?: number;
  brazoCm?: number;
  musloCm?: number;
  lagartijas?: number;
  sentadillas?: number;
  abdominales?: number;
  navetteNivel?: number;
  navetteIdas?: number;
  notas?: string;
  registradoPor?: string;
};

export const SKILL_TREES = {
  "Jiu-Jitsu": [
    ["Fundamentos", ["Postura y base", "Caídas seguras", "Escape de cadera", "Puente"]],
    ["Defensa", ["Escape de montada", "Escape de control lateral", "Defensa de espalda", "Defensa de sumisión"]],
    ["Control", ["Guardia cerrada", "Control lateral", "Montada", "Control de espalda"]],
    ["Ataque", ["Pase de guardia", "Barrida", "Armbar", "Estrangulación"]],
  ],
  "Kick Boxing": [
    ["Fundamentos", ["Guardia", "Desplazamiento", "Distancia", "Respiración"]],
    ["Boxeo", ["Jab", "Cross", "Gancho", "Uppercut"]],
    ["Patadas", ["Low kick", "Patada media", "Patada alta", "Teep"]],
    ["Aplicación", ["Defensas", "Combinaciones", "Contragolpe", "Sparring técnico"]],
  ],
  MMA: [
    ["Base", ["Guardia mixta", "Distancia", "Desplazamiento", "Caídas seguras"]],
    ["Golpeo", ["Boxeo", "Patadas", "Combinaciones", "Clinch"]],
    ["Derribos", ["Entrada a piernas", "Defensa de derribo", "Proyección", "Control de reja"]],
    ["Suelo", ["Control", "Escapes", "Ground and pound", "Sumisiones"]],
  ],
  Taekwondo: [
    ["Fundamentos", ["Guardia", "Desplazamiento", "Equilibrio", "Flexibilidad"]],
    ["Patadas", ["Ap chagui", "Dollyo chagui", "Yop chagui", "Dwit chagui"]],
    ["Técnica", ["Bloqueos", "Combinaciones", "Poomsae", "Precisión"]],
    ["Combate", ["Distancia", "Contraataque", "Ritmo", "Estrategia"]],
  ],
} as const;

export type SkillDiscipline = keyof typeof SKILL_TREES;
export const SKILL_DISCIPLINES = Object.keys(SKILL_TREES) as SkillDiscipline[];

export function normalizeSkillDiscipline(value?: string): SkillDiscipline {
  const text = (value || "").toLowerCase();
  if (text.includes("kick")) return "Kick Boxing";
  if (text.includes("tae")) return "Taekwondo";
  if (text.includes("mma")) return "MMA";
  return "Jiu-Jitsu";
}

export function nextSkillStatus(value?: SkillStatus): SkillStatus {
  return value === "pendiente" || !value ? "practicando" : value === "practicando" ? "dominada" : "pendiente";
}

export function calculateBmi(weightKg: number, heightCm: number) {
  if (!(weightKg > 0) || !(heightCm > 0)) return 0;
  return Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
}

export function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
