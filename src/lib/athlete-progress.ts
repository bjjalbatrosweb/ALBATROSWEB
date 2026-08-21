export type SkillStatus = "pendiente" | "practicando" | "dominada";
export type SkillProgress = Record<string, SkillStatus>;

export type PhysicalAssessment = {
  id: string;
  fecha: string;
  pesoKg: number;
  estaturaCm: number;
  imc: number;
  cinturaEstatura?: number;
  cinturaCadera?: number;
  grasaPorcentaje?: number;
  grasaAutomatica?: boolean;
  edad?: number;
  sexoCalculo?: "masculino" | "femenino";
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

export type IndicatorLevel = "green" | "yellow" | "red" | "neutral";

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

export function calculateWaistHeight(waistCm?: number, heightCm?: number) {
  if (!waistCm || !heightCm) return undefined;
  return Math.round((waistCm / heightCm) * 100) / 100;
}

export function calculateWaistHip(waistCm?: number, hipCm?: number) {
  if (!waistCm || !hipCm) return undefined;
  return Math.round((waistCm / hipCm) * 100) / 100;
}

export function estimateAdultBodyFat(bmi: number, age?: number, sex?: "masculino" | "femenino") {
  if (!bmi || !age || age < 18 || !sex) return undefined;
  const sexValue = sex === "masculino" ? 1 : 0;
  return Math.max(2, Math.min(60, Math.round((1.2 * bmi + 0.23 * age - 10.8 * sexValue - 5.4) * 10) / 10));
}

export function bmiLevel(bmi?: number): IndicatorLevel {
  if (!bmi) return "neutral";
  if (bmi >= 18.5 && bmi < 25) return "green";
  if ((bmi >= 17 && bmi < 18.5) || (bmi >= 25 && bmi < 30)) return "yellow";
  return "red";
}

export function waistHeightLevel(ratio?: number): IndicatorLevel {
  if (ratio === undefined) return "neutral";
  if (ratio < 0.5) return "green";
  if (ratio < 0.6) return "yellow";
  return "red";
}

export function bodyFatLevel(percent?: number, sex?: "masculino" | "femenino"): IndicatorLevel {
  if (percent === undefined || !sex) return "neutral";
  const green = sex === "masculino" ? [10, 25] : [20, 35];
  const yellow = sex === "masculino" ? [6, 30] : [16, 40];
  if (percent >= green[0] && percent <= green[1]) return "green";
  if (percent >= yellow[0] && percent <= yellow[1]) return "yellow";
  return "red";
}

export function wellnessScore(input: { bmi?: number; waistHeight?: number; bodyFat?: number; sex?: "masculino" | "femenino" }) {
  const metrics = [
    { level: bmiLevel(input.bmi), weight: 30 },
    { level: waistHeightLevel(input.waistHeight), weight: 40 },
    { level: bodyFatLevel(input.bodyFat, input.sex), weight: 30 },
  ];
  const available = metrics.filter(metric => metric.level !== "neutral");
  if (!available.length) return undefined;
  const earned = available.reduce((sum, metric) => sum + metric.weight * (metric.level === "green" ? 1 : metric.level === "yellow" ? 0.6 : 0.25), 0);
  const possible = available.reduce((sum, metric) => sum + metric.weight, 0);
  return Math.round((earned / possible) * 100);
}

export function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
