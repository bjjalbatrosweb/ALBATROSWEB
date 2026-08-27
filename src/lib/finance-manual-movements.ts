import type { Timestamp } from "firebase/firestore";

export const EXPENSE_CATEGORIES = [
  "Renta", "Nómina", "Servicios", "Mantenimiento", "Equipo", "Limpieza",
  "Marketing", "Impuestos", "Transporte", "Comida", "Casa", "Gastos personales", "Otros",
];
export const INCOME_CATEGORIES = ["Venta de equipo", "Inscripción", "Evento", "Clase privada", "Patrocinio", "Otros ingresos"];

export type ManualFinanceRecord = {
  id: string;
  sede: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  categoria: string;
  concepto: string;
  fecha: Timestamp;
  creadoPor?: string;
  creadoEn?: Timestamp;
  actualizadoPor?: string;
  actualizadoEn?: Timestamp;
  revision?: number;
};

export type MovementDraft = { amount: string; category: string; concept: string; date: string };

export function canManageManualMovement(record: Pick<ManualFinanceRecord, "creadoPor">, userId: string | undefined, isAdmin: boolean) {
  return Boolean(userId && (isAdmin || record.creadoPor === userId));
}

export function validateMovementDraft(draft: MovementDraft, type: "ingreso" | "egreso", existingCategory?: string) {
  const rawAmount = draft.amount.trim();
  const amount = Number(rawAmount);
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount) || !Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
    throw new Error("Ingresa un monto mayor a cero, de hasta $10,000,000 y con máximo dos decimales.");
  }
  const concept = draft.concept.trim();
  if (concept.length < 2 || concept.length > 140) throw new Error("El concepto debe tener entre 2 y 140 caracteres.");
  const categories = type === "egreso" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (draft.category.length < 2 || draft.category.length > 60 || (!categories.includes(draft.category) && draft.category !== existingCategory)) {
    throw new Error("Selecciona una categoría válida.");
  }
  const date = new Date(`${draft.date}T12:00:00`);
  const [year, month, day] = draft.date.split("-").map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || year < 1900 || year > 9999 || Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error("Selecciona una fecha válida.");
  }
  return { monto: Math.round(amount * 100) / 100, categoria: draft.category, concepto: concept, date };
}

// Avoid overwriting an expense edited/deleted by another open tab or staff member.
export function sameManualExpenseVersion(original: ManualFinanceRecord, current: ManualFinanceRecord) {
  return original.tipo === "egreso" && current.tipo === "egreso"
    && original.id === current.id && original.sede === current.sede
    && original.creadoPor === current.creadoPor
    && original.monto === current.monto && original.categoria === current.categoria
    && original.concepto === current.concepto
    && original.fecha?.toMillis() === current.fecha?.toMillis()
    && (original.revision || 0) === (current.revision || 0)
    && original.actualizadoEn?.toMillis() === current.actualizadoEn?.toMillis();
}
