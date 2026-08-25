import { healthyBodyFatRange, type PhysicalAssessment } from "./athlete-progress.ts";
import { latestNumericPair, latestPhysicalSnapshot } from "./physical-records.ts";

export type AnalyticsAthlete = { id: string; nombre: string; historialFisico?: unknown[] };
export type AthleteAnalytics = {
  id: string;
  nombre: string;
  latest?: PhysicalAssessment;
  healthScore?: number;
  healthIndicatorCount: number;
  performanceScore?: number;
  performanceMetricsCount: number;
  balanceScore?: number;
  improvementScore?: number;
  performanceRank?: number;
  peerLabel: string;
  peerSize: number;
  dataQuality: number;
  trend: "up" | "stable" | "down" | "baseline";
  strengths: string[];
  priorities: string[];
};

const higher = ["lagartijas", "sentadillas", "abdominales", "burpees", "planchaSegundos", "saltoHorizontalCm", "saltoVerticalCm", "sitAndReachCm", "equilibrioSegundos", "fuerzaAgarreKg", "navetteNivel"] as const;
const lower = ["sprint10mSegundos", "agilidad505Segundos"] as const;
const measures = ["cuelloCm", "hombrosCm", "pechoCm", "brazoCm", "antebrazoCm", "cinturaCm", "abdomenCm", "caderaCm", "gluteoCm", "musloCm", "pantorrillaCm"] as const;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
const round = (value: number) => Math.round(value);
const ageBand = (age?: number) => age === undefined ? "edad sin registrar" : age < 13 ? "≤12" : age < 18 ? "13–17" : age < 30 ? "18–29" : age < 40 ? "30–39" : age < 50 ? "40–49" : age < 60 ? "50–59" : "60+";
const weightBand = (weight?: number) => weight === undefined ? "peso sin registrar" : `${Math.floor(weight / 10) * 10}–${Math.floor(weight / 10) * 10 + 9} kg`;

function percentile(value: number, pool: number[], inverse = false) {
  const below = pool.filter((item) => inverse ? item > value : item < value).length;
  const equal = pool.filter((item) => item === value).length;
  return round(((below + equal * 0.5) / pool.length) * 100);
}

function healthScreening(record?: PhysicalAssessment) {
  if (!record) return { score: undefined, count: 0 };
  const scores: number[] = [];
  if (record.edad !== undefined && record.edad >= 20 && record.imc !== undefined) {
    scores.push(record.imc >= 18.5 && record.imc < 25 ? 100 : record.imc >= 17 && record.imc < 30 ? 70 : record.imc >= 15 && record.imc < 35 ? 40 : 15);
  }
  if (record.edad !== undefined && record.edad >= 20 && record.cinturaEstatura !== undefined) {
    scores.push(record.cinturaEstatura < 0.5 ? 100 : record.cinturaEstatura < 0.6 ? 55 : 20);
  }
  const fatRange = healthyBodyFatRange(record.edad, record.sexoCalculo);
  if (fatRange && record.grasaPorcentaje !== undefined) {
    const [low, high] = fatRange;
    scores.push(record.grasaPorcentaje >= low && record.grasaPorcentaje <= high ? 100 : record.grasaPorcentaje >= low - 3 && record.grasaPorcentaje <= high + 5 ? 65 : 30);
  }
  return { score: scores.length ? round(mean(scores)!) : undefined, count: scores.length };
}

function coverageScore(record?: PhysicalAssessment) {
  if (!record) return undefined;
  const captured = measures.filter((key) => number(record[key]) !== undefined).length;
  return round((captured / measures.length) * 100);
}

function improvement(records: PhysicalAssessment[]) {
  const changes: number[] = [];
  for (const key of higher) {
    const { current, previous } = latestNumericPair(records, key);
    if (current !== undefined && previous !== undefined && previous > 0) changes.push(Math.max(-20, Math.min(20, ((current - previous) / previous) * 100)));
  }
  for (const key of lower) {
    const { current, previous } = latestNumericPair(records, key);
    if (current !== undefined && previous !== undefined && previous > 0) changes.push(Math.max(-20, Math.min(20, ((previous - current) / previous) * 100)));
  }
  return changes.length >= 2 ? Math.round(mean(changes)! * 10) / 10 : undefined;
}

export function buildAthleteAnalytics(athletes: AnalyticsAthlete[]): AthleteAnalytics[] {
  const raw = athletes.map((athlete) => {
    const records = (athlete.historialFisico || []) as PhysicalAssessment[];
    const latest = latestPhysicalSnapshot(records);
    const peerKey = `${latest?.sexoCalculo || "sin sexo"}|${ageBand(latest?.edad)}|${weightBand(latest?.pesoKg)}`;
    return {
      athlete,
      records,
      latest,
      peerKey,
      peerLabel: `${latest?.sexoCalculo || "sin sexo"} · ${ageBand(latest?.edad)} años · ${weightBand(latest?.pesoKg)}`,
      improvement: improvement(records),
    };
  });

  const scored = raw.map((item) => {
    const exactPeers = raw.filter((peer) => peer.peerKey === item.peerKey && peer.latest);
    const ageSexPeers = raw.filter((peer) => peer.latest && peer.latest.sexoCalculo === item.latest?.sexoCalculo && ageBand(peer.latest.edad) === ageBand(item.latest?.edad));
    const peers = exactPeers.length >= 5 ? exactPeers : ageSexPeers.length >= 5 ? ageSexPeers : [];
    const metricScores: number[] = [];

    if (item.latest && peers.length >= 5) {
      for (const key of higher) {
        const value = number(item.latest[key]);
        const pool = peers.map((peer) => number(peer.latest?.[key])).filter((entry): entry is number => entry !== undefined);
        if (value !== undefined && pool.length >= 5) metricScores.push(percentile(value, pool));
      }
      for (const key of lower) {
        const value = number(item.latest[key]);
        const pool = peers.map((peer) => number(peer.latest?.[key])).filter((entry): entry is number => entry !== undefined);
        if (value !== undefined && pool.length >= 5) metricScores.push(percentile(value, pool, true));
      }
    }

    const performanceScore = metricScores.length >= 3 ? round(mean(metricScores)!) : undefined;
    const health = healthScreening(item.latest);
    const coverage = coverageScore(item.latest);
    const improvementScore = item.improvement === undefined ? undefined : Math.max(0, Math.min(100, round(50 + item.improvement * 3)));
    const coreFields = [item.latest?.edad, item.latest?.pesoKg, item.latest?.estaturaCm, item.latest?.sexoCalculo];
    const testFields = [...higher, ...lower].map((key) => item.latest?.[key]);
    const dataQuality = round(([...coreFields, ...testFields].filter((value) => value !== undefined).length / (coreFields.length + testFields.length)) * 100);
    const strengths: string[] = [];
    const priorities: string[] = [];

    if (performanceScore !== undefined) {
      if (performanceScore >= 70) strengths.push("Rendimiento favorable dentro de una cohorte comparable");
      else if (performanceScore < 40) priorities.push("Construir una base física más uniforme");
    } else priorities.push("Completar al menos tres capacidades y una cohorte comparable");
    if (health.score !== undefined && health.count >= 2) {
      if (health.score >= 80) strengths.push("Indicadores de cribado disponibles en rango favorable");
      else if (health.score < 55) priorities.push("Confirmar las mediciones y revisar indicadores de salud");
    }
    if ((coverage || 0) < 70) priorities.push("Completar perímetros si se necesita seguimiento antropométrico");
    const trend = item.improvement === undefined ? "baseline" : item.improvement > 2 ? "up" : item.improvement < -2 ? "down" : "stable";

    return {
      id: item.athlete.id,
      nombre: item.athlete.nombre,
      latest: item.latest,
      healthScore: health.score,
      healthIndicatorCount: health.count,
      performanceScore,
      performanceMetricsCount: metricScores.length,
      balanceScore: coverage,
      improvementScore,
      peerLabel: item.peerLabel,
      peerSize: peers.length,
      dataQuality,
      trend,
      strengths,
      priorities,
    } satisfies AthleteAnalytics;
  });

  const ranked = scored
    .filter((item) => item.performanceScore !== undefined && item.peerSize >= 5 && item.performanceMetricsCount >= 3)
    .sort((left, right) => (right.performanceScore || 0) - (left.performanceScore || 0) || (right.improvementScore || 0) - (left.improvementScore || 0));
  return scored.map((item) => ({ ...item, performanceRank: ranked.findIndex((entry) => entry.id === item.id) + 1 || undefined }));
}
