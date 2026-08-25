export type HydrationStatus = "stable" | "attention" | "high" | "gain";

export type HydrationSession = {
  id: string;
  fecha: string;
  schemaVersion?: number;
  protocolVersion?: string;
  contextKey?: string;
  duracionMin: number;
  pesoAntesKg: number;
  pesoDespuesKg: number;
  ingestaMl: number;
  orinaMl?: number;
  temperaturaC?: number;
  humedadPct?: number;
  ambiente?: "interior" | "exterior";
  intensidad?: "suave" | "moderada" | "alta";
  ropa?: "ligera" | "uniforme" | "proteccion";
  bebida?: "agua" | "electrolitos" | "otra";
  esfuerzoRpe?: number;
  sedAntes?: number;
  colorOrina?: number;
  notas?: string;
  perdidaSudorL: number;
  tasaSudorLh: number;
  cambioMasaPct: number;
  tasaIngestaLh?: number;
  reposicionPct?: number | null;
  deficitNetoL?: number;
  calidadProtocolo?: number;
  protocolo?: {
    sameScale: boolean;
    dryBody: boolean;
    sameClothes: boolean;
    allFluids: boolean;
  };
  registradoPor?: string;
};

export type HydrationInput = {
  durationMin: number;
  preKg: number;
  postKg: number;
  intakeMl: number;
  urineMl?: number;
};

export type HydrationResult = {
  sweatLossL: number;
  sweatRateLh: number;
  intakeRateLh: number;
  netMassChangeKg: number;
  massChangePct: number;
  fluidBalanceL: number;
  netDeficitL: number;
  replacementPct: number | null;
  recoveryMinMl: number;
  recoveryMaxMl: number;
  projected90MinL: number;
  controlScore: number;
  status: HydrationStatus;
  warnings: string[];
};

const round = (value: number, places = 2) =>
  Math.round(value * 10 ** places) / 10 ** places;

/**
 * Field estimate based on mass balance:
 * sweat loss = pre mass - post mass + drinks - urine.
 * One kilogram of acute mass change is treated as approximately one litre.
 */
export function calculateHydration(input: HydrationInput): HydrationResult {
  const { durationMin, preKg, postKg, intakeMl } = input;
  const urineMl = input.urineMl || 0;

  if (![durationMin, preKg, postKg, intakeMl, urineMl].every(Number.isFinite)) {
    throw new Error("Completa todos los valores numéricos requeridos.");
  }
  if (durationMin < 15 || durationMin > 360) {
    throw new Error("La duración debe estar entre 15 y 360 minutos.");
  }
  if (preKg < 20 || preKg > 350 || postKg < 20 || postKg > 350) {
    throw new Error("Revisa los pesos y confirma que estén en kilogramos.");
  }
  if (intakeMl < 0 || intakeMl > 10000 || urineMl < 0 || urineMl > 5000) {
    throw new Error("Revisa los líquidos y confirma que estén en mililitros.");
  }

  const hours = durationMin / 60;
  const netMassChangeKg = preKg - postKg;
  const sweatLossL = netMassChangeKg + intakeMl / 1000 - urineMl / 1000;
  const sweatRateLh = sweatLossL / hours;
  const intakeRateLh = intakeMl / 1000 / hours;
  const massChangePct = (netMassChangeKg / preKg) * 100;
  const fluidBalanceL = -netMassChangeKg;
  const netDeficitL = Math.max(0, netMassChangeKg);
  const replacementPct = sweatLossL > 0 ? (intakeMl / 1000 / sweatLossL) * 100 : null;
  const warnings: string[] = [];

  if (sweatLossL < 0) {
    warnings.push("El balance produjo sudor negativo: revisa pesajes, bebida, orina y ropa mojada.");
  }
  if (sweatRateLh > 3) {
    warnings.push("La tasa supera 3 L/h; confirma unidades y repite el protocolo antes de usarla como referencia.");
  }
  if (massChangePct >= 2) {
    warnings.push("La pérdida neta alcanzó 2% o más de la masa inicial.");
  }
  if (massChangePct < 0) {
    warnings.push("Terminó con mayor masa corporal. No conviene beber por encima de las pérdidas reales.");
  }

  const status: HydrationStatus =
    massChangePct < 0 ? "gain" : massChangePct >= 2 ? "high" : massChangePct >= 1 ? "attention" : "stable";
  const absoluteChange = Math.abs(massChangePct);
  let controlScore = absoluteChange <= 0.5 ? 100 : absoluteChange <= 1 ? 90 : absoluteChange < 2 ? 75 : absoluteChange < 3 ? 55 : 35;
  if (massChangePct < 0) controlScore = Math.min(controlScore, 60);
  if (sweatLossL < 0 || sweatRateLh > 3) controlScore = Math.min(controlScore, 40);

  return {
    sweatLossL: round(sweatLossL),
    sweatRateLh: round(sweatRateLh),
    intakeRateLh: round(intakeRateLh),
    netMassChangeKg: round(netMassChangeKg),
    massChangePct: round(massChangePct),
    fluidBalanceL: round(fluidBalanceL),
    netDeficitL: round(netDeficitL),
    replacementPct: replacementPct === null ? null : round(replacementPct, 0),
    recoveryMinMl: Math.round(netDeficitL * 1250),
    recoveryMaxMl: Math.round(netDeficitL * 1500),
    projected90MinL: round(Math.max(0, sweatRateLh) * 1.5),
    controlScore,
    status,
    warnings,
  };
}
