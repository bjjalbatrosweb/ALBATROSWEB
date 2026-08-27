import type { ManualFinanceRecord } from "./finance-manual-movements";

export type MovementFilters = {
  type: "all" | "ingreso" | "egreso";
  category: string;
  concept: string;
  from: string;
  to: string;
  minAmount: string;
  maxAmount: string;
  sort: "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
};
export const EMPTY_MOVEMENT_FILTERS: MovementFilters = { type: "all", category: "", concept: "", from: "", to: "", minAmount: "", maxAmount: "", sort: "date-desc" };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
export function movementDate(record: ManualFinanceRecord) {
  const date = record.fecha?.toDate?.();
  if (!date || !Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T12:00:00`);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}
export function movementFilterError(filters: MovementFilters) {
  if ((filters.from && !validDate(filters.from)) || (filters.to && !validDate(filters.to))) return "Selecciona fechas válidas.";
  if (filters.from && filters.to && filters.from > filters.to) return "La fecha inicial no puede ser posterior a la final.";
  for (const value of [filters.minAmount, filters.maxAmount]) {
    if (value !== "" && (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < 0)) return "Los montos del filtro deben ser positivos o cero, con máximo dos decimales.";
  }
  if (filters.minAmount !== "" && filters.maxAmount !== "" && Number(filters.minAmount) > Number(filters.maxAmount)) return "El monto mínimo no puede superar el máximo.";
  return "";
}
export function filterManualMovements(records: ManualFinanceRecord[], filters: MovementFilters, month: string) {
  if (movementFilterError(filters)) return [];
  const text = normalize(filters.concept);
  return records.filter(record => {
    const date = movementDate(record);
    return date.startsWith(`${month}-`)
      && (filters.type === "all" || record.tipo === filters.type)
      && (!filters.category || record.categoria === filters.category)
      && (!text || normalize(record.concepto || "").includes(text))
      && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
      && (filters.minAmount === "" || record.monto >= Number(filters.minAmount))
      && (filters.maxAmount === "" || record.monto <= Number(filters.maxAmount));
  }).sort((a, b) => {
    const difference = filters.sort.startsWith("amount") ? a.monto - b.monto : (a.fecha?.toMillis?.() || 0) - (b.fecha?.toMillis?.() || 0);
    return (filters.sort.endsWith("desc") ? -difference : difference) || a.id.localeCompare(b.id);
  });
}
export function activeMovementFilters(filters: MovementFilters) {
  return Number(filters.type !== "all") + Number(Boolean(filters.category)) + Number(Boolean(filters.concept.trim()))
    + Number(Boolean(filters.from)) + Number(Boolean(filters.to))
    + Number(filters.minAmount !== "") + Number(filters.maxAmount !== "");
}
function csvText(value: string) {
  // Quoting alone does not stop spreadsheet formula execution in user-supplied text.
  const safe = /^[\s\u0000-\u001f\u007f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function manualMovementsCsv(records: ManualFinanceRecord[], site: string) {
  const rows = ["Fecha,Tipo,Categoría,Concepto,Monto (MXN),Sede"];
  for (const record of records) {
    rows.push([
      csvText(movementDate(record)), csvText(record.tipo === "egreso" ? "Egreso" : "Ingreso"),
      csvText(record.categoria || ""), csvText(record.concepto || ""),
      Number.isFinite(record.monto) ? record.monto.toFixed(2) : "",
      csvText(record.sede || site),
    ].join(","));
  }
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}
export function movementExportFilename(site: string, month: string, filtered: boolean) {
  const siteName = normalize(site).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sede";
  const period = /^\d{4}-\d{2}$/.test(month) ? month : "periodo";
  return `movimientos-manuales-${siteName}-${period}${filtered ? "-filtrados" : ""}.csv`;
}
