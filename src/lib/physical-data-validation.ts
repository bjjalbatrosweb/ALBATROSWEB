export type PhysicalDataIssue = {
  field: string;
  level: "error" | "warning";
  message: string;
};

type NumericRecord = Record<string, number | undefined>;

const LIMITS: Record<string, [number, number, string]> = {
  edad: [5, 100, "Edad"],
  pesoKg: [15, 350, "Peso"],
  estaturaCm: [80, 230, "Estatura"],
  grasaPorcentaje: [2, 70, "Grasa corporal"],
  cuelloCm: [15, 80, "Cuello"],
  hombrosCm: [30, 220, "Hombros"],
  pechoCm: [35, 220, "Pecho"],
  brazoCm: [10, 80, "Brazo"],
  antebrazoCm: [8, 65, "Antebrazo"],
  cinturaCm: [30, 220, "Cintura"],
  abdomenCm: [30, 240, "Abdomen"],
  caderaCm: [35, 240, "Cadera"],
  gluteoCm: [35, 240, "Glúteo"],
  musloCm: [15, 110, "Muslo"],
  pantorrillaCm: [10, 75, "Pantorrilla"],
  lagartijas: [0, 300, "Lagartijas"],
  sentadillas: [0, 400, "Sentadillas"],
  abdominales: [0, 300, "Abdominales"],
  burpees: [0, 150, "Burpees"],
  suicidios: [0, 200, "Suicidios"],
  planchaSegundos: [0, 1800, "Plancha"],
  saltoHorizontalCm: [0, 450, "Salto horizontal"],
  saltoVerticalCm: [0, 150, "Salto vertical"],
  sprint10mSegundos: [0.8, 30, "Sprint 10 m"],
  agilidad505Segundos: [1, 30, "Agilidad 5-0-5"],
  sitAndReachCm: [-40, 80, "Sit and reach"],
  equilibrioSegundos: [0, 1800, "Equilibrio"],
  fuerzaAgarreKg: [0, 120, "Fuerza de agarre"],
  navetteNivel: [0, 21, "Course Navette"],
  navetteIdas: [0, 300, "Idas de Navette"],
};

const CIRCUMFERENCE_KEYS = [
  "cuelloCm", "hombrosCm", "pechoCm", "brazoCm", "antebrazoCm",
  "cinturaCm", "abdomenCm", "caderaCm", "gluteoCm", "musloCm",
  "pantorrillaCm",
];

export function validatePhysicalData(values: NumericRecord): PhysicalDataIssue[] {
  const issues: PhysicalDataIssue[] = [];
  for (const [field, [minimum, maximum, label]] of Object.entries(LIMITS)) {
    const value = values[field];
    if (value === undefined) continue;
    if (!Number.isFinite(value)) {
      issues.push({ field, level: "error", message: `${label} no es un número válido.` });
    } else if (value < minimum || value > maximum) {
      issues.push({ field, level: "error", message: `${label}: confirma la unidad y el dato (${minimum}–${maximum}).` });
    }
  }

  const height = values.estaturaCm;
  if (height) {
    for (const field of CIRCUMFERENCE_KEYS) {
      const value = values[field];
      if (value !== undefined && value > height * 1.35) {
        issues.push({ field, level: "warning", message: `${LIMITS[field][2]} parece desproporcionado respecto a la estatura; repite la medición.` });
      }
    }
  }

  if (values.cinturaCm && values.caderaCm && values.cinturaCm > values.caderaCm * 1.45) {
    issues.push({ field: "cinturaCm", level: "warning", message: "La relación cintura/cadera es inusual; confirma ambos perímetros." });
  }
  return issues;
}

export function physicalDataErrorMessage(issues: PhysicalDataIssue[]) {
  const errors = issues.filter((issue) => issue.level === "error");
  return errors.length ? errors.map((issue) => issue.message).join(" ") : "";
}
