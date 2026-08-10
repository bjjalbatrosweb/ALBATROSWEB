export type MaintenanceCondition = "operational" | "attention" | "out-of-service";
export type MaintenanceUrgency =
  | "out-of-service"
  | "overdue"
  | "due-soon"
  | "current";

export type MaintenanceInspection = {
  id: string;
  date: string;
  condition: MaintenanceCondition;
  responsible: string;
  notes: string;
  registeredAt: string;
};

export type MaintenanceAsset = {
  id: string;
  name: string;
  category: string;
  frequencyDays: number;
  critical: boolean;
  condition: MaintenanceCondition;
  lastInspection?: string;
  nextInspection: string;
  responsible: string;
  notes: string;
  inspections: MaintenanceInspection[];
  createdAt: string;
};

export const MAINTENANCE_PRESETS = [
  { name: "Tatami y uniones", category: "Entrenamiento", frequencyDays: 7, critical: true },
  { name: "Puerta y cerradura principal", category: "Accesos", frequencyDays: 14, critical: true },
  { name: "RFID / NFC y ESP32", category: "Tecnología", frequencyDays: 14, critical: true },
  { name: "Botiquín y suministros", category: "Seguridad", frequencyDays: 30, critical: true },
  { name: "Salidas y señalización", category: "Seguridad", frequencyDays: 30, critical: true },
  { name: "Ventilación y clima", category: "Instalaciones", frequencyDays: 30, critical: false },
  { name: "Pantalla TV y audio", category: "Tecnología", frequencyDays: 30, critical: false },
  { name: "Equipo de entrenamiento", category: "Entrenamiento", frequencyDays: 14, critical: false },
] as const;

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function seedMaintenanceAssets(today: string): MaintenanceAsset[] {
  return MAINTENANCE_PRESETS.map((preset, index) => ({
    id: `base-${index + 1}`,
    name: preset.name,
    category: preset.category,
    frequencyDays: preset.frequencyDays,
    critical: preset.critical,
    condition: "operational",
    nextInspection: today,
    responsible: "",
    notes: "Pendiente de primera revisión.",
    inspections: [],
    createdAt: new Date().toISOString(),
  }));
}

export function createMaintenanceAsset(input: {
  name: string;
  category: string;
  frequencyDays: number;
  critical: boolean;
  nextInspection: string;
}): MaintenanceAsset {
  if (!input.name.trim()) throw new Error("Escribe el nombre del equipo o área.");
  if (!input.category.trim()) throw new Error("Escribe una categoría.");
  if (!Number.isFinite(input.frequencyDays) || input.frequencyDays < 1) {
    throw new Error("La frecuencia debe ser de al menos un día.");
  }

  return {
    id: id("asset"),
    name: input.name.trim(),
    category: input.category.trim(),
    frequencyDays: Math.round(input.frequencyDays),
    critical: input.critical,
    condition: "operational",
    nextInspection: input.nextInspection,
    responsible: "",
    notes: "Pendiente de primera revisión.",
    inspections: [],
    createdAt: new Date().toISOString(),
  };
}

export function maintenanceUrgency(
  asset: MaintenanceAsset,
  today: string,
): MaintenanceUrgency {
  if (asset.condition === "out-of-service") return "out-of-service";
  const due = new Date(`${asset.nextInspection}T12:00:00`).getTime();
  const current = new Date(`${today}T12:00:00`).getTime();
  const difference = Math.ceil((due - current) / 86_400_000);
  if (difference < 0) return "overdue";
  if (difference <= 7) return "due-soon";
  return "current";
}

export function registerMaintenanceInspection(
  asset: MaintenanceAsset,
  input: {
    date: string;
    condition: MaintenanceCondition;
    responsible: string;
    notes: string;
    now?: string;
  },
): MaintenanceAsset {
  if (!input.responsible.trim()) throw new Error("Indica quién realizó la revisión.");
  if (!input.date) throw new Error("Selecciona la fecha de revisión.");

  const inspection: MaintenanceInspection = {
    id: id("inspection"),
    date: input.date,
    condition: input.condition,
    responsible: input.responsible.trim(),
    notes: input.notes.trim(),
    registeredAt: input.now ?? new Date().toISOString(),
  };

  return {
    ...asset,
    condition: input.condition,
    lastInspection: input.date,
    nextInspection: addDays(input.date, asset.frequencyDays),
    responsible: inspection.responsible,
    notes: inspection.notes,
    inspections: [inspection, ...asset.inspections].slice(0, 20),
  };
}

export function maintenanceStats(assets: MaintenanceAsset[], today: string) {
  const urgency = assets.map((asset) => maintenanceUrgency(asset, today));
  const outOfService = urgency.filter((value) => value === "out-of-service").length;
  const overdue = urgency.filter((value) => value === "overdue").length;
  const dueSoon = urgency.filter((value) => value === "due-soon").length;
  const current = urgency.filter((value) => value === "current").length;
  const healthy = assets.length === 0 ? 100 : Math.round((current / assets.length) * 100);
  return { total: assets.length, outOfService, overdue, dueSoon, current, healthy };
}

export function buildMaintenanceSummary(
  assets: MaintenanceAsset[],
  site: string,
  today: string,
) {
  const stats = maintenanceStats(assets, today);
  const attention = assets.filter(
    (asset) => maintenanceUrgency(asset, today) !== "current",
  );
  const lines = [
    `Mantenimiento preventivo · ${site} · ${today}`,
    `Total: ${stats.total} | Fuera de servicio: ${stats.outOfService} | Atrasados: ${stats.overdue} | Próximos: ${stats.dueSoon}`,
  ];

  if (attention.length === 0) {
    lines.push("Sin revisiones urgentes.");
  } else {
    lines.push(
      "Atención requerida:",
      ...attention.map((asset) => {
        const urgency = maintenanceUrgency(asset, today);
        return `- ${asset.name}: ${urgency} · próxima ${asset.nextInspection}`;
      }),
    );
  }

  return lines.join("\n");
}
