export type EquipmentCategory =
  | "proteccion"
  | "uniforme"
  | "entrenamiento"
  | "electronica"
  | "otro";

export type EquipmentCondition = "bueno" | "uso" | "danado";
export type EquipmentLoanStatus = "prestado" | "devuelto" | "perdido";

export type EquipmentLoan = {
  id: string;
  articulo: string;
  categoria: EquipmentCategory;
  identificador: string;
  talla: string;
  condicionSalida: EquipmentCondition;
  condicionEntrada?: EquipmentCondition;
  fechaPrestamo: string;
  fechaLimite: string;
  fechaDevolucion?: string;
  estado: EquipmentLoanStatus;
  notas: string;
  notaDevolucion?: string;
  responsable: string;
  creadoEn: string;
};

export type EquipmentTemplate = {
  id: string;
  articulo: string;
  categoria: EquipmentCategory;
};

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  proteccion: "Protección",
  uniforme: "Uniforme",
  entrenamiento: "Entrenamiento",
  electronica: "Electrónica",
  otro: "Otro",
};

export const EQUIPMENT_CONDITION_LABELS: Record<EquipmentCondition, string> = {
  bueno: "Buen estado",
  uso: "Con señales de uso",
  danado: "Dañado",
};

export const EQUIPMENT_TEMPLATES: EquipmentTemplate[] = [
  { id: "guantes", articulo: "Guantes", categoria: "proteccion" },
  { id: "espinilleras", articulo: "Espinilleras", categoria: "proteccion" },
  { id: "peto", articulo: "Peto", categoria: "proteccion" },
  { id: "casco", articulo: "Casco", categoria: "proteccion" },
  { id: "dobok", articulo: "Dobok", categoria: "uniforme" },
  { id: "gi", articulo: "Gi / kimono", categoria: "uniforme" },
  { id: "cinturon", articulo: "Cinturón", categoria: "uniforme" },
  { id: "monitor", articulo: "Monitor de ritmo", categoria: "electronica" },
];

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultLoanDates(reference = new Date()) {
  const due = new Date(reference);
  due.setDate(due.getDate() + 7);
  return { loanDate: localDate(reference), dueDate: localDate(due) };
}

export function createEquipmentLoan(input: {
  item: string;
  category: EquipmentCategory;
  identifier: string;
  size: string;
  condition: EquipmentCondition;
  loanDate: string;
  dueDate: string;
  notes: string;
  responsible: string;
}): EquipmentLoan {
  const now = new Date();
  return {
    id: `loan-${now.getTime()}`,
    articulo: input.item.trim(),
    categoria: input.category,
    identificador: input.identifier.trim(),
    talla: input.size.trim(),
    condicionSalida: input.condition,
    fechaPrestamo: input.loanDate,
    fechaLimite: input.dueDate,
    estado: "prestado",
    notas: input.notes.trim(),
    responsable: input.responsible.trim(),
    creadoEn: now.toISOString(),
  };
}

export function returnEquipmentLoan(
  loan: EquipmentLoan,
  condition: EquipmentCondition,
  note: string,
  returnDate = localDate(),
) {
  return {
    ...loan,
    estado: "devuelto" as const,
    condicionEntrada: condition,
    notaDevolucion: note.trim(),
    fechaDevolucion: returnDate,
  };
}

export function markEquipmentLost(loan: EquipmentLoan, note: string) {
  return {
    ...loan,
    estado: "perdido" as const,
    notaDevolucion: note.trim(),
  };
}

export function isLoanOverdue(loan: EquipmentLoan, today = localDate()) {
  return loan.estado === "prestado" && Boolean(loan.fechaLimite) && loan.fechaLimite < today;
}

export function loanDaysRemaining(loan: EquipmentLoan, reference = new Date()) {
  if (!loan.fechaLimite) return null;
  const due = new Date(`${loan.fechaLimite}T12:00:00`);
  const current = new Date(reference);
  current.setHours(12, 0, 0, 0);
  if (Number.isNaN(due.getTime())) return null;
  return Math.ceil((due.getTime() - current.getTime()) / 86400000);
}

