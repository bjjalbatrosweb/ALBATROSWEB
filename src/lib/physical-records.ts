import type { PhysicalAssessment } from "./athlete-progress.ts";

export const PERFORMANCE_METRIC_KEYS = [
  "lagartijas",
  "sentadillas",
  "abdominales",
  "burpees",
  "suicidios",
  "planchaSegundos",
  "saltoHorizontalCm",
  "saltoVerticalCm",
  "sprint10mSegundos",
  "agilidad505Segundos",
  "sitAndReachCm",
  "equilibrioSegundos",
  "fuerzaAgarreKg",
  "navetteNivel",
  "navetteIdas",
  "navetteVelocidadFinal",
  "vo2MaxEstimado",
] as const satisfies readonly (keyof PhysicalAssessment)[];

export const BODY_METRIC_KEYS = [
  "pesoKg",
  "estaturaCm",
  "imc",
  "cinturaEstatura",
  "cinturaCadera",
  "grasaPorcentaje",
  "cinturaCm",
  "caderaCm",
  "pechoCm",
  "cuelloCm",
  "hombrosCm",
  "abdomenCm",
  "gluteoCm",
  "brazoCm",
  "antebrazoCm",
  "musloCm",
  "pantorrillaCm",
  "masaGrasaKg",
  "masaLibreGrasaKg",
  "ffmi",
  "sumaPlieguesMm",
  "calidadPliegues",
  "calidadMedicion",
] as const satisfies readonly (keyof PhysicalAssessment)[];

const SNAPSHOT_KEYS = [
  ...BODY_METRIC_KEYS,
  ...PERFORMANCE_METRIC_KEYS,
  "edad",
  "sexoCalculo",
  "grasaAutomatica",
  "metodoGrasa",
  "plieguesMm",
  "plieguesLecturasMm",
  "protocoloPliegues",
  "plicometro",
  "horaMedicion",
  "ayunoHoras",
  "ejercicioPrevioHoras",
  "hidratacion",
  "contextoMenstrual",
  "faseMenstrual",
  "anticoncepcionHormonal",
  "cicloIrregular",
  "dolorMenstrual",
  "fatigaMenstrual",
  "retencionLiquidos",
  "sangradoMenstrual",
  "suenoCalidad",
  "esfuerzoPercibido",
  "notas",
  "registradoPor",
] as const satisfies readonly (keyof PhysicalAssessment)[];

export function sortPhysicalRecords(records: PhysicalAssessment[]) {
  return [...records].sort((left, right) => {
    const date = String(right.fecha || "").localeCompare(String(left.fecha || ""));
    return date || String(right.id || "").localeCompare(String(left.id || ""));
  });
}

export function healthAssessments(records: PhysicalAssessment[]) {
  return sortPhysicalRecords(records).filter((record) => record.tipoRegistro !== "pruebas");
}

export function testAssessments(records: PhysicalAssessment[]) {
  return sortPhysicalRecords(records).filter((record) => record.tipoRegistro === "pruebas");
}

export function latestHealthAssessment(records: PhysicalAssessment[]) {
  return healthAssessments(records)[0];
}

export function latestMetricValue<K extends keyof PhysicalAssessment>(records: PhysicalAssessment[], key: K) {
  for (const record of sortPhysicalRecords(records)) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function metricValues<K extends keyof PhysicalAssessment>(records: PhysicalAssessment[], key: K) {
  return sortPhysicalRecords(records)
    .map((record) => ({ record, value: record[key] }))
    .filter((entry): entry is { record: PhysicalAssessment; value: NonNullable<PhysicalAssessment[K]> } =>
      entry.value !== undefined && entry.value !== null && entry.value !== "",
    );
}

export function latestPhysicalSnapshot(records: PhysicalAssessment[]): PhysicalAssessment | undefined {
  const sorted = sortPhysicalRecords(records);
  const newest = sorted[0];
  if (!newest) return undefined;
  const health = latestHealthAssessment(sorted);
  const snapshot = {
    ...(health || {}),
    id: newest.id,
    fecha: newest.fecha,
    tipoRegistro: "completo",
  } as PhysicalAssessment;

  for (const key of SNAPSHOT_KEYS) {
    const value = latestMetricValue(sorted, key);
    if (value !== undefined) Object.assign(snapshot, { [key]: value });
  }
  return snapshot;
}

export function latestProfile(records: PhysicalAssessment[]) {
  return {
    edad: latestMetricValue(records, "edad"),
    sexoCalculo: latestMetricValue(records, "sexoCalculo"),
    pesoKg: latestMetricValue(records, "pesoKg"),
    estaturaCm: latestMetricValue(records, "estaturaCm"),
  };
}

export function latestNumericPair<K extends keyof PhysicalAssessment>(records: PhysicalAssessment[], key: K) {
  const values = metricValues(records, key)
    .map((entry) => entry.value)
    .filter((value): value is Extract<PhysicalAssessment[K], number> => typeof value === "number" && Number.isFinite(value));
  return { current: values[0], previous: values[1] };
}

export function oldestMetricValue<K extends keyof PhysicalAssessment>(records: PhysicalAssessment[], key: K) {
  const values = metricValues(records, key);
  return values.at(-1)?.value;
}

export function completedHealthEvaluations(records: PhysicalAssessment[]) {
  return healthAssessments(records).length;
}
