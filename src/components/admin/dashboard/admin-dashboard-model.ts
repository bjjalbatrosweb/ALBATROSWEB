import { format } from "date-fns";
import type { Timestamp } from "firebase/firestore";
import type { AthleteBadgeId } from "@/lib/athlete-badges";
import type { MemberRole } from "@/lib/member-role";

export type PaymentStatus = "Pagado" | "Falta de Pago" | "Retraso";
export type PaymentMethod = "Efectivo" | "Transferencia" | "Tarjeta" | "Otro";
export type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
export type StudentSort =
  | "nombre-asc"
  | "nombre-desc"
  | "pago-retrasos"
  | "pago-pagados"
  | "asistencia-desc"
  | "asistencia-asc";
export type PeriodReportType = "pagos" | "asistencias" | "resumen";
export type ReminderAudience = "morosos" | "proximos" | "pendientes";

export type BackupRecord = Record<string, unknown> & { id: string };
export type AlbatrosBackup = {
  sistema: "ALBATROS";
  sede: Sede;
  generadoEn?: string;
  version?: number;
  alumnos: BackupRecord[];
  pagos: BackupRecord[];
  asistencias: BackupRecord[];
};
export type RestoreCategory = "alumnos" | "pagos" | "asistencias";
export type RestorePreviewItem = {
  total: number;
  nuevos: number;
  duplicados: number;
  invalidos: number;
};
export type RestorePreview = Record<RestoreCategory, RestorePreviewItem>;

export type AdminAlumno = {
  id: string;
  rfid?: string;
  rfids?: string[];
  nombre: string;
  telefono: string;
  diaPago: number;
  esAfiliado: boolean;
  descuento: number;
  montoPago: number;
  estadoPago: PaymentStatus;
  activo?: boolean;
  rol?: MemberRole;
  insignias?: AthleteBadgeId[];
  fechaRegistro: unknown;
  fechaUltimoPago?: unknown;
  periodoUltimoPago?: string;
  ultimoRecordatorioPago?: unknown;
  tipoUltimoRecordatorio?: "retraso" | "proximo" | "general";
  fotoUrl?: string;
  disciplina?: string;
  grado?: string;
  fechaPromocion?: string;
  objetivo?: string;
  pesoActual?: number;
  pesoObjetivo?: number;
  proximaCompetencia?: string;
  fechaCompetencia?: string;
  emergenciaToken?: string;
  emergencia?: {
    tipoSangre?: string;
    alergias?: string;
    condicionesMedicas?: string;
    contactoNombre?: string;
    contactoParentesco?: string;
    contactoTelefono?: string;
  };
  sede: Sede;
};

export type NewStudentForm = {
  nombre: string;
  rfid: string;
  telefono: string;
  disciplina: string;
  grado: string;
  fechaPromocion: string;
  objetivo: string;
  pesoActual: string;
  pesoObjetivo: string;
  proximaCompetencia: string;
  fechaCompetencia: string;
  diaPago: string;
  esAfiliado: boolean;
  descuento: string;
  montoPago: string;
  estadoPago: PaymentStatus;
  rol: MemberRole;
  sede: Sede;
};

export type EditableAlumno = Omit<
  AdminAlumno,
  "diaPago" | "descuento" | "montoPago" | "pesoActual" | "pesoObjetivo"
> & {
  diaPago: string;
  descuento: string;
  montoPago: string;
  pesoActual: string;
  pesoObjetivo: string;
};

export type Asistencia = {
  id: string;
  alumnoId: string;
  fecha: Timestamp;
  sede?: Sede;
};

export type Pago = {
  id: string;
  alumnoId: string;
  nombre: string;
  sede: Sede;
  monto: number;
  periodo: string;
  metodoPago: PaymentMethod;
  fecha: Timestamp;
};

export type ComparacionMensual = {
  periodo: string;
  etiqueta: string;
  recaudacion: number;
  asistencias: number;
  nuevosAlumnos: number;
};

export type PreviousMonthMetrics = {
  periodo: string;
  etiqueta: string;
  recaudacion: number;
  asistencias: number;
  nuevosAlumnos: number;
  morosos: number;
};

export const DISCIPLINAS_ALBATROS = [
  "Jiu-Jitsu",
  "Kick Boxing",
  "MMA",
  "Taekwondo",
];

export const NUEVO_ALUMNO_BASE = {
  nombre: "",
  rfid: "",
  telefono: "",
  disciplina: "",
  grado: "",
  fechaPromocion: "",
  objetivo: "",
  pesoActual: "",
  pesoObjetivo: "",
  proximaCompetencia: "",
  fechaCompetencia: "",
  diaPago: "1",
  esAfiliado: false,
  descuento: "0",
  montoPago: "600",
  estadoPago: "Falta de Pago" as PaymentStatus,
  rol: "atleta" as MemberRole,
};

export const SEDES_VALIDAS: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];

export function normalizarSede(valor: unknown): Sede {
  if (typeof valor !== "string") return "MMA";

  const sede = valor.trim().toUpperCase().replace(/\s+/g, "_");

  return SEDES_VALIDAS.includes(sede as Sede) ? (sede as Sede) : "MMA";
}

export function obtenerPeriodoFecha(valor: unknown): string | null {
  try {
    const fecha =
      valor &&
      typeof valor === "object" &&
      "toDate" in valor &&
      typeof (valor as { toDate?: unknown }).toDate === "function"
        ? (valor as { toDate: () => Date }).toDate()
        : valor instanceof Date
          ? valor
          : typeof valor === "string" || typeof valor === "number"
            ? new Date(valor)
            : null;

    return fecha && !Number.isNaN(fecha.getTime())
      ? format(fecha, "yyyy-MM")
      : null;
  } catch {
    return null;
  }
}

export function calcularMesesAdeudados(
  alumno: AdminAlumno,
  periodoActual: string,
): number {
  const convertirPeriodoAIndice = (periodo: string | null) => {
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) return null;

    const [anio, mes] = periodo.split("-").map(Number);

    return anio * 12 + mes - 1;
  };

  const indiceActual = convertirPeriodoAIndice(periodoActual);

  if (indiceActual === null) return 1;

  const ultimoPeriodoPagado =
    alumno.periodoUltimoPago || obtenerPeriodoFecha(alumno.fechaUltimoPago);
  const indiceUltimoPago = convertirPeriodoAIndice(ultimoPeriodoPagado);

  if (indiceUltimoPago !== null) {
    return Math.max(1, indiceActual - indiceUltimoPago);
  }

  const periodoRegistro = obtenerPeriodoFecha(alumno.fechaRegistro);
  const indiceRegistro = convertirPeriodoAIndice(periodoRegistro);

  if (indiceRegistro !== null) {
    return Math.max(1, indiceActual - indiceRegistro + 1);
  }

  return 1;
}
