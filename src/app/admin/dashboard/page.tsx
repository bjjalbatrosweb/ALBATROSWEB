"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileUp,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Weight,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import { recordAdminAudit } from "@/lib/admin-audit";
import {
  DAILY_NOTIFICATION_KEY,
  notificationsEnabled,
  showAlbatrosNotification,
} from "@/lib/pwa-notifications";
import { cn } from "@/lib/utils";
import {
  useAuth,
  useCollection,
  useFirestore,
  useMemoFirebase,
} from "@/firebase";
type PaymentStatus = "Pagado" | "Falta de Pago" | "Retraso";
type PaymentMethod = "Efectivo" | "Transferencia" | "Tarjeta" | "Otro";
type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type StudentSort =
  | "nombre-asc"
  | "nombre-desc"
  | "pago-retrasos"
  | "pago-pagados"
  | "asistencia-desc"
  | "asistencia-asc";
type PeriodReportType = "pagos" | "asistencias" | "resumen";
type ReminderAudience = "morosos" | "proximos" | "pendientes";

type BackupRecord = Record<string, unknown> & { id: string };
type AlbatrosBackup = {
  sistema: "ALBATROS";
  sede: Sede;
  generadoEn?: string;
  version?: number;
  alumnos: BackupRecord[];
  pagos: BackupRecord[];
  asistencias: BackupRecord[];
};
type RestoreCategory = "alumnos" | "pagos" | "asistencias";
type RestorePreviewItem = {
  total: number;
  nuevos: number;
  duplicados: number;
  invalidos: number;
};
type RestorePreview = Record<RestoreCategory, RestorePreviewItem>;

type AdminAlumno = {
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

type NewStudentForm = {
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
  sede: Sede;
};

type EditableAlumno = Omit<
  AdminAlumno,
  "diaPago" | "descuento" | "montoPago" | "pesoActual" | "pesoObjetivo"
> & {
  diaPago: string;
  descuento: string;
  montoPago: string;
  pesoActual: string;
  pesoObjetivo: string;
};

type Asistencia = {
  id: string;
  alumnoId: string;
  fecha: any;
  sede?: Sede;
};

type Pago = {
  id: string;
  alumnoId: string;
  nombre: string;
  sede: Sede;
  monto: number;
  periodo: string;
  metodoPago: PaymentMethod;
  fecha: any;
};

type ComparacionMensual = {
  periodo: string;
  etiqueta: string;
  recaudacion: number;
  asistencias: number;
  nuevosAlumnos: number;
};

type PreviousMonthMetrics = {
  periodo: string;
  etiqueta: string;
  recaudacion: number;
  asistencias: number;
  nuevosAlumnos: number;
  morosos: number;
};

const SEDES_VALIDAS: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];

function normalizarSede(valor: unknown): Sede {
  if (typeof valor !== "string") return "MMA";

  const sede = valor.trim().toUpperCase().replace(/\s+/g, "_");

  return SEDES_VALIDAS.includes(sede as Sede) ? (sede as Sede) : "MMA";
}

function obtenerPeriodoFecha(valor: unknown): string | null {
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

function calcularMesesAdeudados(
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
    alumno.periodoUltimoPago ||
    obtenerPeriodoFecha(alumno.fechaUltimoPago);
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

const NUEVO_ALUMNO_BASE = {
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
};

const DISCIPLINAS_ALBATROS = [
  "Jiu-Jitsu",
  "Kick Boxing",
  "MMA",
  "Taekwondo",
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [userSede, setUserSede] = useState<Sede | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [studentActivityFilter, setStudentActivityFilter] = useState<
    "todos" | "activos" | "inactivos"
  >("activos");
  const [studentPaymentFilter, setStudentPaymentFilter] = useState<
    "todos" | "pagado" | "pendiente" | "retraso"
  >("todos");
  const [studentRfidFilter, setStudentRfidFilter] = useState<
    "todos" | "con" | "sin"
  >("todos");
  const [studentSort, setStudentSort] =
    useState<StudentSort>("nombre-asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<EditableAlumno | null>(
    null,
  );
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [linkingStudentId, setLinkingStudentId] = useState<string | null>(null);
  const [phoneLinkingStudentId, setPhoneLinkingStudentId] =
    useState<string | null>(null);
  const [linkingInitialCardCount, setLinkingInitialCardCount] = useState(0);
  const [isMergingDuplicates, setIsMergingDuplicates] =
  useState(false);

  // Radix bloquea temporalmente los eventos del body mientras un diálogo
  // modal está abierto. Si el diálogo se cierra desde una operación asíncrona,
  // algunos navegadores pueden conservar ese estilo. Se limpia únicamente
  // cuando no queda ningún diálogo abierto para no interferir con otros modales.
  useEffect(() => {
    if (isEditDialogOpen) return;

    const liberarBloqueoResidual = () => {
      const dialogoAbierto = document.querySelector(
        '[role="dialog"][data-state="open"]',
      );
      if (!dialogoAbierto && document.body.style.pointerEvents === "none") {
        document.body.style.removeProperty("pointer-events");
      }
    };

    const frame = window.requestAnimationFrame(liberarBloqueoResidual);
    const timer = window.setTimeout(liberarBloqueoResidual, 250);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isEditDialogOpen]);
  const [paymentStudent, setPaymentStudent] =
    useState<AdminAlumno | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentPeriod, setPaymentPeriod] = useState(
    format(new Date(), "yyyy-MM"),
  );
  const [paymentDate, setPaymentDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("Efectivo");
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentsCurrentMonth, setPaymentsCurrentMonth] =
    useState<Pago[]>([]);
  const [historyStudent, setHistoryStudent] =
    useState<AdminAlumno | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Pago[]>([]);
  const [isLoadingPaymentHistory, setIsLoadingPaymentHistory] =
    useState(false);
  const [profileStudent, setProfileStudent] =
    useState<AdminAlumno | null>(null);
  const [profilePayments, setProfilePayments] = useState<Pago[]>([]);
  const [isLoadingProfilePayments, setIsLoadingProfilePayments] =
    useState(false);
  const [editingPayment, setEditingPayment] = useState<Pago | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentPeriod, setEditPaymentPeriod] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] =
    useState<PaymentMethod>("Efectivo");
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [attendanceStudent, setAttendanceStudent] =
    useState<AdminAlumno | null>(null);
  const [manualAttendanceDate, setManualAttendanceDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [manualAttendanceTime, setManualAttendanceTime] = useState(
    format(new Date(), "HH:mm"),
  );
  const [isSavingManualAttendance, setIsSavingManualAttendance] =
    useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [reminderAudience, setReminderAudience] =
    useState<ReminderAudience>("morosos");
  const [selectedReminderIds, setSelectedReminderIds] = useState<string[]>([]);
  const [sentReminderIds, setSentReminderIds] = useState<string[]>([]);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isAnalyzingBackup, setIsAnalyzingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreFileName, setRestoreFileName] = useState("");
  const [restoreBackup, setRestoreBackup] =
    useState<AlbatrosBackup | null>(null);
  const [restorePreview, setRestorePreview] =
    useState<RestorePreview | null>(null);
  const [restoreSelection, setRestoreSelection] = useState<
    Record<RestoreCategory, boolean>
  >({
    alumnos: true,
    pagos: true,
    asistencias: true,
  });
  const [isPeriodReportOpen, setIsPeriodReportOpen] = useState(false);
  const [periodReportType, setPeriodReportType] =
    useState<PeriodReportType>("resumen");
  const [periodReportStart, setPeriodReportStart] = useState(() =>
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
  );
  const [periodReportEnd, setPeriodReportEnd] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [isExportingPeriodReport, setIsExportingPeriodReport] =
    useState(false);
  const [isUpdatingSelectedStudents, setIsUpdatingSelectedStudents] =
    useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Pago | null>(null);
  const [isMonthlyComparisonOpen, setIsMonthlyComparisonOpen] =
    useState(false);
  const [isLoadingMonthlyComparison, setIsLoadingMonthlyComparison] =
    useState(false);
  const [monthlyComparison, setMonthlyComparison] = useState<
    ComparacionMensual[]
  >([]);
  const [previousMonthMetrics, setPreviousMonthMetrics] =
    useState<PreviousMonthMetrics | null>(null);
  const [isLoadingPreviousMonth, setIsLoadingPreviousMonth] =
    useState(false);
  const [isPreviousMonthExpanded, setIsPreviousMonthExpanded] =
    useState(true);
  const migratedLegacyPaymentsRef = useRef<Set<string>>(new Set());

  const [newStudent, setNewStudent] = useState<NewStudentForm>({
    ...NUEVO_ALUMNO_BASE,
    sede: "MMA",
  });

  useEffect(() => {
    setSelectedIds([]);
  }, [
    searchTerm,
    studentActivityFilter,
    studentPaymentFilter,
    studentRfidFilter,
    studentSort,
  ]);

  useEffect(() => {
    const sedeGuardada = localStorage.getItem("userSede");

    if (!sedeGuardada) {
      router.push("/login-profesor");
      return;
    }

    setUserSede(normalizarSede(sedeGuardada));
  }, [router]);

  useEffect(() => {
    if (!userSede) return;

    setNewStudent((prev) => ({
      ...prev,
      sede: userSede,
    }));
  }, [userSede]);

  const alumnosQuery = useMemoFirebase(() => {
    if (!firestore || !userSede) return null;

    return query(
      collection(firestore, "Alumnos"),
      where("sede", "==", userSede),
    );
  }, [firestore, userSede]);

  const { data: alumnos, isLoading: isLoadingAlumnos } =
    useCollection<AdminAlumno>(alumnosQuery);

  const startOfMonthDate = useMemo(() => {
    const fecha = new Date();
    fecha.setDate(1);
    fecha.setHours(0, 0, 0, 0);
    return fecha;
  }, []);

  /*
   * Solo se descargan las asistencias de la sede y del mes actual.
   * Esto reduce las lecturas y evita cargar todo el historial.
   */
  const asistenciasQuery = useMemoFirebase(() => {
    if (!firestore || !userSede) return null;

    return query(
      collection(firestore, "Asistencias"),
      where("sede", "==", userSede),
      where("fecha", ">=", Timestamp.fromDate(startOfMonthDate)),
      orderBy("fecha", "desc"),
    );
  }, [firestore, userSede, startOfMonthDate]);

  const { data: asistencias, isLoading: isLoadingAsistencias } =
    useCollection<Asistencia>(asistenciasQuery);

  const periodoActual = format(new Date(), "yyyy-MM");

  useEffect(() => {
    if (!firestore || !userSede) return;

    let activo = true;

    const cargarPagosDelMes = async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(firestore, "Pagos"),
            where("sede", "==", userSede),
            where("periodo", "==", periodoActual),
          ),
        );

        if (!activo) return;

        setPaymentsCurrentMonth(
          snapshot.docs.map((documento) => ({
            id: documento.id,
            ...(documento.data() as Omit<Pago, "id">),
          })),
        );
      } catch (error) {
        console.error("No se pudo cargar el historial mensual:", error);
        if (activo) setPaymentsCurrentMonth([]);
      }
    };

    void cargarPagosDelMes();

    return () => {
      activo = false;
    };
  }, [firestore, userSede, periodoActual]);

  useEffect(() => {
    if (!firestore || !alumnos?.length) return;

    const legacyPaidStudents = alumnos.filter(
      (alumno) =>
        alumno.estadoPago === "Pagado" &&
        !alumno.periodoUltimoPago &&
        !obtenerPeriodoFecha(alumno.fechaUltimoPago) &&
        !migratedLegacyPaymentsRef.current.has(alumno.id),
    );

    if (legacyPaidStudents.length === 0) return;

    legacyPaidStudents.forEach((alumno) => {
      migratedLegacyPaymentsRef.current.add(alumno.id);
    });

    const migrateLegacyPayments = async () => {
      try {
        const batch = writeBatch(firestore);

        legacyPaidStudents.forEach((alumno) => {
          batch.update(doc(firestore, "Alumnos", alumno.id), {
            periodoUltimoPago: periodoActual,
          });
        });

        await batch.commit();
      } catch (error) {
        legacyPaidStudents.forEach((alumno) => {
          migratedLegacyPaymentsRef.current.delete(alumno.id);
        });
        console.error("No se pudieron migrar pagos antiguos:", error);
      }
    };

    void migrateLegacyPayments();
  }, [firestore, alumnos, periodoActual]);

  useEffect(() => {
    if (!firestore || !userSede || !alumnos) return;

    let activo = true;
    const cargarMesAnterior = async () => {
      const inicioMesActual = new Date();
      inicioMesActual.setDate(1);
      inicioMesActual.setHours(0, 0, 0, 0);
      const inicioMesAnterior = new Date(inicioMesActual);
      inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);
      const periodoAnterior = format(inicioMesAnterior, "yyyy-MM");

      try {
        setIsLoadingPreviousMonth(true);

        const [pagosSnapshot, asistenciasSnapshot] = await Promise.all([
          getDocs(
            query(
              collection(firestore, "Pagos"),
              where("sede", "==", userSede),
              where("periodo", "==", periodoAnterior),
            ),
          ),
          getDocs(
            query(
              collection(firestore, "Asistencias"),
              where("sede", "==", userSede),
              where("fecha", ">=", Timestamp.fromDate(inicioMesAnterior)),
              where("fecha", "<", Timestamp.fromDate(inicioMesActual)),
              orderBy("fecha", "desc"),
            ),
          ),
        ]);

        if (!activo) return;

        const pagos = pagosSnapshot.docs.map((documento) => documento.data());
        const alumnosPagados = new Set(
          pagos.map((pago) => String(pago.alumnoId || "")),
        );
        const alumnosExistentes = alumnos.filter((alumno) => {
          const periodoRegistro = obtenerPeriodoFecha(alumno.fechaRegistro);

          return (
            alumno.activo !== false &&
            (!periodoRegistro || periodoRegistro <= periodoAnterior)
          );
        });
        const asistenciasUnicas = new Set(
          asistenciasSnapshot.docs.map((documento) => {
            const asistencia = documento.data();
            const fecha = asistencia.fecha?.toDate
              ? asistencia.fecha.toDate()
              : new Date(asistencia.fecha);

            return `${asistencia.alumnoId}-${format(fecha, "yyyy-MM-dd")}`;
          }),
        ).size;

        setPreviousMonthMetrics({
          periodo: periodoAnterior,
          etiqueta: format(inicioMesAnterior, "MMMM yyyy", { locale: es }),
          recaudacion: pagos.reduce(
            (total, pago) => total + (Number(pago.monto) || 0),
            0,
          ),
          asistencias: asistenciasUnicas,
          nuevosAlumnos: alumnos.filter(
            (alumno) =>
              obtenerPeriodoFecha(alumno.fechaRegistro) === periodoAnterior,
          ).length,
          morosos: alumnosExistentes.filter(
            (alumno) => !alumnosPagados.has(alumno.id),
          ).length,
        });
      } catch (error) {
        console.error("No se pudo cargar el mes anterior:", error);
        if (activo) setPreviousMonthMetrics(null);
      } finally {
        if (activo) setIsLoadingPreviousMonth(false);
      }
    };

    void cargarMesAnterior();

    return () => {
      activo = false;
    };
  }, [firestore, userSede, alumnos]);

  const todayDay = new Date().getDate();

  useEffect(() => {
    if (!linkingStudentId || !alumnos) return;
  
    const student = alumnos.find(
      (alumno) => alumno.id === linkingStudentId,
    );
  
    if (!student) return;
  
    const currentCards =
      student.rfids?.length
        ? student.rfids
        : student.rfid
          ? [student.rfid]
          : [];
  
    if (currentCards.length <= linkingInitialCardCount) {
      return;
    }
  
    setIsLinking(false);
    setLinkingStudentId(null);
    setLinkingInitialCardCount(0);
  
    toast({
      title: "¡Vinculación exitosa!",
      description: `La nueva tarjeta fue asignada a ${student.nombre}.`,
    });
  }, [
    alumnos,
    linkingStudentId,
    linkingInitialCardCount,
    toast,
  ]);

  const getAutomaticStatus = (alumno: AdminAlumno): PaymentStatus => {
    const tienePagoEnHistorial = paymentsCurrentMonth.some(
      (pago) => pago.alumnoId === alumno.id,
    );
    const periodoFechaUltimoPago = obtenerPeriodoFecha(
      alumno.fechaUltimoPago,
    );
    const esPagoAntiguoSinPeriodo =
      alumno.estadoPago === "Pagado" &&
      !alumno.periodoUltimoPago &&
      !periodoFechaUltimoPago;

    if (
      alumno.estadoPago === "Pagado" &&
      (tienePagoEnHistorial ||
        alumno.periodoUltimoPago === periodoActual ||
        periodoFechaUltimoPago === periodoActual ||
        esPagoAntiguoSinPeriodo)
    ) {
      return "Pagado";
    }

    if (todayDay > Number(alumno.diaPago || 1)) return "Retraso";

    return "Falta de Pago";
  };

  /*
   * IMPORTANTE:
   * El estado visual de retraso se calcula con getAutomaticStatus().
   * No se escribe automáticamente en Firestore al abrir el dashboard,
   * evitando ciclos y miles de escrituras innecesarias.
   */

  const filteredAlumnos = useMemo(() => {
    if (!alumnos) return [];

    const termino = searchTerm.trim().toLowerCase();
    const attendanceDays = new Map<string, Set<string>>();

    (asistencias ?? []).forEach((asistencia) => {
      const fecha = asistencia.fecha?.toDate
        ? asistencia.fecha.toDate()
        : new Date(asistencia.fecha);

      if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return;

      const dias =
        attendanceDays.get(asistencia.alumnoId) || new Set<string>();
      dias.add(format(fecha, "yyyy-MM-dd"));
      attendanceDays.set(asistencia.alumnoId, dias);
    });

    const paymentRank: Record<PaymentStatus, number> = {
      Retraso: 0,
      "Falta de Pago": 1,
      Pagado: 2,
    };

    const compararNombre = (a: AdminAlumno, b: AdminAlumno) =>
      (a.nombre || "").localeCompare(b.nombre || "", "es", {
        sensitivity: "base",
      });

    return [...alumnos]
      .filter((alumno) => {
        const estaActivo = alumno.activo !== false;
        const coincideEstado =
          studentActivityFilter === "todos" ||
          (studentActivityFilter === "activos" && estaActivo) ||
          (studentActivityFilter === "inactivos" && !estaActivo);

        const tarjetas =
          alumno.rfids?.length
            ? alumno.rfids
            : alumno.rfid
              ? [alumno.rfid]
              : [];
        const estadoPago = getAutomaticStatus(alumno);
        const coincidePago =
          studentPaymentFilter === "todos" ||
          (studentPaymentFilter === "pagado" && estadoPago === "Pagado") ||
          (studentPaymentFilter === "pendiente" &&
            estadoPago === "Falta de Pago") ||
          (studentPaymentFilter === "retraso" && estadoPago === "Retraso");
        const coincideRfid =
          studentRfidFilter === "todos" ||
          (studentRfidFilter === "con" && tarjetas.length > 0) ||
          (studentRfidFilter === "sin" && tarjetas.length === 0);
        const coincideBusqueda =
          !termino ||
          alumno.nombre?.toLowerCase().includes(termino) ||
          tarjetas.some((rfid) => rfid.toLowerCase().includes(termino)) ||
          alumno.telefono?.toLowerCase().includes(termino);

        return (
          coincideEstado &&
          coincidePago &&
          coincideRfid &&
          coincideBusqueda
        );
      })
      .sort((a, b) => {
        if (studentSort === "nombre-desc") {
          return compararNombre(b, a);
        }

        if (studentSort === "pago-retrasos") {
          const diferencia =
            paymentRank[getAutomaticStatus(a)] -
            paymentRank[getAutomaticStatus(b)];

          return diferencia || compararNombre(a, b);
        }

        if (studentSort === "pago-pagados") {
          const diferencia =
            paymentRank[getAutomaticStatus(b)] -
            paymentRank[getAutomaticStatus(a)];

          return diferencia || compararNombre(a, b);
        }

        if (
          studentSort === "asistencia-desc" ||
          studentSort === "asistencia-asc"
        ) {
          const diferencia =
            (attendanceDays.get(b.id)?.size || 0) -
            (attendanceDays.get(a.id)?.size || 0);

          return (
            (studentSort === "asistencia-desc"
              ? diferencia
              : -diferencia) || compararNombre(a, b)
          );
        }

        return compararNombre(a, b);
      });
  }, [
    alumnos,
    asistencias,
    searchTerm,
    studentActivityFilter,
    studentPaymentFilter,
    studentRfidFilter,
    studentSort,
    paymentsCurrentMonth,
    periodoActual,
    todayDay,
  ]);

  const attendanceDataMap = useMemo(() => {
    const map: Record<string, { count: number; history: Date[] }> = {};
  
    const listaAsistencias = asistencias ?? [];
  
    listaAsistencias.forEach((asistencia) => {
      const fecha = asistencia.fecha?.toDate
        ? asistencia.fecha.toDate()
        : new Date(asistencia.fecha);

      if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
        return;
      }

      if (!map[asistencia.alumnoId]) {
        map[asistencia.alumnoId] = {
          count: 0,
          history: [],
        };
      }

      const dayKey = format(fecha, "yyyy-MM-dd");

      const yaRegistradoEseDia = map[asistencia.alumnoId].history.some(
        (dia) => format(dia, "yyyy-MM-dd") === dayKey,
      );

      if (!yaRegistradoEseDia) {
        map[asistencia.alumnoId].count += 1;
        map[asistencia.alumnoId].history.push(fecha);
      }
    });

    Object.values(map).forEach((registro) => {
      registro.history.sort((a, b) => b.getTime() - a.getTime());
    });

    return map;
  }, [asistencias]);

  const handleStartVinculation = async (
    studentId: string,
    nombre: string,
  ) => {
    const student = alumnos?.find(
      (alumno) => alumno.id === studentId,
    );
  
    const initialCards =
      student?.rfids?.length
        ? student.rfids
        : student?.rfid
          ? [student.rfid]
          : [];
  
    setLinkingInitialCardCount(initialCards.length);
    setIsLinking(true);
    setLinkingStudentId(studentId);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("La sesión expiró. Inicia sesión de nuevo.");

      const response = await fetch("/api/rfid/solicitar-vinculacion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alumnoId: studentId,
          dispositivo: "Recepcion",
          sede: userSede,
        }),
      });

      let data: {
        ok?: boolean;
        mensaje?: string;
      } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.mensaje || "Error al solicitar vinculación");
      }

      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: "editar",
          entity: "rfid",
          entityId: studentId,
          entityName: nombre,
          summary: `Se inició la vinculación RFID de ${nombre}.`,
          details: { dispositivo: "Recepcion" },
        });
      }

      toast({
        title: "Protocolo iniciado",
        description: `Acerca la TARJETA DE CONFIGURACIÓN al lector para vincular a ${nombre}.`,
      });

      window.setTimeout(() => {
        setIsLinking(false);
        setLinkingStudentId(null);
        setLinkingInitialCardCount(0);
      }, 60000);
    } catch (error: unknown) {
      setIsLinking(false);
      setLinkingStudentId(null);
      setLinkingInitialCardCount(0);

      toast({
        variant: "destructive",
        title: "Fallo de comunicación",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la vinculación.",
      });
    }
  };

  const handleStartPhoneVinculation = async (
    studentId: string,
    nombre: string,
  ) => {
    if (!userSede || phoneLinkingStudentId) return;

    setPhoneLinkingStudentId(studentId);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("La sesión expiró. Inicia sesión de nuevo.");

      const response = await fetch("/api/rfid/solicitar-vinculacion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alumnoId: studentId,
          dispositivo: "Recepcion",
          sede: userSede,
        }),
      });

      let data: {
        ok?: boolean;
        vinculacionId?: string;
        mensaje?: string;
      } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.ok || !data.vinculacionId) {
        throw new Error(
          data.mensaje || "No se pudo iniciar la vinculación con el teléfono",
        );
      }

      void recordAdminAudit(auth, {
        sede: userSede,
        action: "editar",
        entity: "rfid",
        entityId: studentId,
        entityName: nombre,
        summary: `Se inició la vinculación NFC desde Android para ${nombre}.`,
        details: { vinculacionId: data.vinculacionId },
      });

      const parametros = new URLSearchParams({
        vinculacionId: data.vinculacionId,
        alumno: nombre,
      });

      router.push(`/admin/asistencia-nfc?${parametros.toString()}`);
    } catch (error: unknown) {
      setPhoneLinkingStudentId(null);

      toast({
        variant: "destructive",
        title: "No se pudo iniciar",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la vinculación con el teléfono.",
      });
    }
  };

  const handleAddStudent = async (autoLink = false): Promise<string | null> => {
    if (isSavingStudent) return null;

    if (!firestore || !userSede) {
      toast({
        variant: "destructive",
        title: "Error de sesión",
        description: "No se pudo identificar la sede actual.",
      });
      return null;
    }

    const nombre = newStudent.nombre.trim();
    const diaPago = Number(newStudent.diaPago);
    const montoPago = Number(newStudent.montoPago);
    const descuento = Number(newStudent.descuento);
    const pesoActual = newStudent.pesoActual
      ? Number(newStudent.pesoActual)
      : 0;
    const pesoObjetivo = newStudent.pesoObjetivo
      ? Number(newStudent.pesoObjetivo)
      : 0;

    if (!nombre) {
      toast({
        variant: "destructive",
        title: "Nombre obligatorio",
        description: "Escribe el nombre completo del alumno.",
      });
      return null;
    }

    if (!Number.isInteger(diaPago) || diaPago < 1 || diaPago > 31) {
      toast({
        variant: "destructive",
        title: "Día de pago inválido",
        description: "Escribe un día de pago entre 1 y 31.",
      });
      return null;
    }

    if (!Number.isFinite(montoPago) || montoPago < 0) {
      toast({
        variant: "destructive",
        title: "Monto inválido",
        description: "Escribe un monto de pago válido.",
      });
      return null;
    }

    if (!Number.isFinite(descuento) || descuento < 0) {
      toast({
        variant: "destructive",
        title: "Descuento inválido",
        description: "Escribe un descuento válido.",
      });
      return null;
    }

    if (
      !Number.isFinite(pesoActual) ||
      pesoActual < 0 ||
      !Number.isFinite(pesoObjetivo) ||
      pesoObjetivo < 0
    ) {
      toast({
        variant: "destructive",
        title: "Peso inválido",
        description: "Escribe pesos válidos o deja ambos campos vacíos.",
      });
      return null;
    }

    const rfidNormalizado = newStudent.rfid
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

    try {
      setIsSavingStudent(true);

      const alumnoData = {
        nombre,
        rfid: rfidNormalizado,
        rfids: rfidNormalizado ? [rfidNormalizado] : [],
        telefono: newStudent.telefono.trim(),
        disciplina: newStudent.disciplina.trim(),
        grado: newStudent.grado.trim(),
        fechaPromocion: newStudent.fechaPromocion,
        objetivo: newStudent.objetivo.trim(),
        pesoActual,
        pesoObjetivo,
        proximaCompetencia: newStudent.proximaCompetencia.trim(),
        fechaCompetencia: newStudent.fechaCompetencia,
        diaPago,
        esAfiliado: newStudent.esAfiliado,
        descuento,
        montoPago,
        estadoPago: newStudent.estadoPago,
        activo: true,
        sede: userSede,
        fechaRegistro: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(firestore, "Alumnos"),
        alumnoData,
      );

      void recordAdminAudit(auth, {
        sede: userSede,
        action: "crear",
        entity: "alumno",
        entityId: docRef.id,
        entityName: nombre,
        summary: `Se registró al alumno ${nombre}.`,
        details: { diaPago, montoPago, rfid: rfidNormalizado || "Sin RFID" },
      });

      if (!autoLink) {
        setIsAddDialogOpen(false);
        setNewStudent({
          ...NUEVO_ALUMNO_BASE,
          sede: userSede,
        });
      }

      toast({
        title: "Alumno registrado",
        description: `${nombre} fue añadido a la sede ${userSede}.`,
      });

      return docRef.id;
    } catch (error: unknown) {
      console.error("Error al guardar alumno:", error);

      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description:
          error instanceof Error
            ? error.message
            : "Error desconocido al guardar el alumno.",
      });

      return null;
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleVincularNuevo = async () => {
    const nombre = newStudent.nombre.trim();
    const studentId = await handleAddStudent(true);

    if (!studentId) return;

    await handleStartVinculation(studentId, nombre);
  };

  const handleOpenEditDialog = (alumno: AdminAlumno) => {
    setEditingStudent({
      ...alumno,
      sede: normalizarSede(alumno.sede),
      diaPago: String(alumno.diaPago ?? ""),
      descuento: String(alumno.descuento ?? 0),
      montoPago: String(alumno.montoPago ?? 0),
      pesoActual: alumno.pesoActual ? String(alumno.pesoActual) : "",
      pesoObjetivo: alumno.pesoObjetivo ? String(alumno.pesoObjetivo) : "",
    });
    setIsEditDialogOpen(true);
  };

const handleUpdateStudent = async () => {
    if (!firestore || !editingStudent || !userSede) {
      return;
    }

    const nombre = editingStudent.nombre.trim();
    const diaPago = Number(editingStudent.diaPago);
    const montoPago = Number(editingStudent.montoPago);
    const descuento = Number(editingStudent.descuento);
    const pesoActual = editingStudent.pesoActual
      ? Number(editingStudent.pesoActual)
      : 0;
    const pesoObjetivo = editingStudent.pesoObjetivo
      ? Number(editingStudent.pesoObjetivo)
      : 0;

    if (!nombre) {
      toast({
        variant: "destructive",
        title: "Nombre obligatorio",
        description: "Escribe el nombre completo del alumno.",
      });
      
            return;
          }

    if (!Number.isInteger(diaPago) || diaPago < 1 || diaPago > 31) {
      toast({
        variant: "destructive",
        title: "Día de pago inválido",
        description: "Escribe un día de pago entre 1 y 31.",
      });
      return;
    }

    if (!Number.isFinite(montoPago) || montoPago < 0) {
      toast({
        variant: "destructive",
        title: "Monto inválido",
        description: "Escribe un monto de pago válido.",
      });
      return;
    }

    if (!Number.isFinite(descuento) || descuento < 0) {
      toast({
        variant: "destructive",
        title: "Descuento inválido",
        description: "Escribe un descuento válido.",
      });
      return;
    }

    if (
      !Number.isFinite(pesoActual) ||
      pesoActual < 0 ||
      !Number.isFinite(pesoObjetivo) ||
      pesoObjetivo < 0
    ) {
      toast({
        variant: "destructive",
        title: "Peso inválido",
        description: "Escribe pesos válidos o deja ambos campos vacíos.",
      });
      return;
    }

    const rfidNormalizado = (editingStudent.rfid || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

    setIsUpdatingStudent(true);
    try {
      await updateDoc(doc(firestore, "Alumnos", editingStudent.id), {
        nombre,
        telefono: editingStudent.telefono?.trim() || "",
        diaPago,
        montoPago,
        descuento,
        esAfiliado: editingStudent.esAfiliado === true,
        disciplina: editingStudent.disciplina?.trim() || "",
        grado: editingStudent.grado?.trim() || "",
        fechaPromocion: editingStudent.fechaPromocion || "",
        objetivo: editingStudent.objetivo?.trim() || "",
        pesoActual,
        pesoObjetivo,
        proximaCompetencia:
          editingStudent.proximaCompetencia?.trim() || "",
        fechaCompetencia: editingStudent.fechaCompetencia || "",
        // La sede queda bloqueada a la sesión actual.
        sede: userSede,
      });

      void recordAdminAudit(auth, {
        sede: userSede,
        action: "editar",
        entity: "alumno",
        entityId: editingStudent.id,
        entityName: nombre,
        summary: `Se actualizaron los datos de ${nombre}.`,
        details: {
          diaPago,
          montoPago,
          descuento,
          disciplina: editingStudent.disciplina || "",
          grado: editingStudent.grado || "",
        },
      });

      toast({
        title: "Registro actualizado",
        description: `Los datos de ${nombre} fueron guardados.`,
      });

      setIsUpdatingStudent(false);
      setIsEditDialogOpen(false);
      setEditingStudent(null);
    } catch (error: unknown) {
      console.error("Error al actualizar alumno:", error);

      toast({
        variant: "destructive",
        title: "No se pudo actualizar",
        description:
          error instanceof Error
            ? error.message
            : "Error desconocido al actualizar.",
      });
    } finally {
      setIsUpdatingStudent(false);
    }
  }; 

  const handleUpdateStatus = async (id: string, newStatus: PaymentStatus) => {
    if (!firestore) return;

    if (newStatus === "Pagado") {
      const alumno = alumnos?.find((item) => item.id === id);

      if (!alumno) {
        toast({
          variant: "destructive",
          title: "Alumno no encontrado",
          description: "No se pudo preparar el registro del pago.",
        });
        return;
      }

      setPaymentStudent(alumno);
      setPaymentAmount(String(Number(alumno.montoPago || 0)));
      setPaymentPeriod(format(new Date(), "yyyy-MM"));
      setPaymentDate(format(new Date(), "yyyy-MM-dd"));
      setPaymentMethod("Efectivo");
      return;
    }

    try {
      const alumnoRef = doc(firestore, "Alumnos", id);

      await updateDoc(alumnoRef, {
        estadoPago: newStatus,
      });

      const alumno = alumnos?.find((item) => item.id === id);
      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: "editar",
          entity: "alumno",
          entityId: id,
          entityName: alumno?.nombre,
          summary: `Se cambió el estado de pago de ${alumno?.nombre || "un alumno"} a ${newStatus}.`,
          details: { estadoPago: newStatus },
        });
      }

      toast({
        title: "Estado actualizado",
        description: `Estado cambiado a ${newStatus}.`,
      });
    } catch (error: unknown) {
      console.error("Error al actualizar estado:", error);

      toast({
        variant: "destructive",
        title: "No se pudo actualizar",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    }
  };

  const handleToggleStudentActivity = async (alumno: AdminAlumno) => {
    if (!firestore) return;

    const estaActivo = alumno.activo !== false;

    if (
      estaActivo &&
      !window.confirm(
        `¿Dar de baja temporal a ${alumno.nombre}? No se borrará su historial, pero su acceso RFID/NFC quedará bloqueado.`,
      )
    ) {
      return;
    }

    try {
      await updateDoc(doc(firestore, "Alumnos", alumno.id), {
        activo: !estaActivo,
        fechaCambioActividad: serverTimestamp(),
      });

      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: estaActivo ? "desactivar" : "activar",
          entity: "alumno",
          entityId: alumno.id,
          entityName: alumno.nombre,
          summary: estaActivo
            ? `Se dio de baja temporal a ${alumno.nombre}.`
            : `Se reactivó a ${alumno.nombre}.`,
        });
      }

      toast({
        title: estaActivo ? "Alumno inactivo" : "Alumno reactivado",
        description: estaActivo
          ? `${alumno.nombre} conserva su historial, pero ya no cuenta en cobros ni tiene acceso.`
          : `${alumno.nombre} vuelve a contar como alumno activo.`,
      });
    } catch (error: unknown) {
      console.error("No se pudo cambiar la actividad del alumno:", error);
      toast({
        variant: "destructive",
        title: "No se pudo cambiar el estado",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    }
  };

  const handleBulkStudentActivity = async (activar: boolean) => {
    if (
      !firestore ||
      selectedIds.length === 0 ||
      isUpdatingSelectedStudents
    ) {
      return;
    }

    const seleccionados = (alumnos ?? []).filter((alumno) =>
      selectedIds.includes(alumno.id),
    );

    if (
      seleccionados.length === 0 ||
      (!activar &&
        !window.confirm(
          `¿Dar de baja temporal a ${seleccionados.length} alumnos seleccionados? Conservarán su historial, pero se bloqueará su acceso RFID/NFC.`,
        ))
    ) {
      return;
    }

    try {
      setIsUpdatingSelectedStudents(true);

      for (let inicio = 0; inicio < seleccionados.length; inicio += 400) {
        const batch = writeBatch(firestore);

        seleccionados.slice(inicio, inicio + 400).forEach((alumno) => {
          batch.update(doc(firestore, "Alumnos", alumno.id), {
            activo: activar,
            fechaCambioActividad: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      setSelectedIds([]);
      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: activar ? "activar" : "desactivar",
          entity: "alumno",
          summary: `${activar ? "Se reactivaron" : "Se dieron de baja"} ${seleccionados.length} alumnos.`,
          details: {
            cantidad: seleccionados.length,
            alumnos: seleccionados.map((alumno) => ({
              id: alumno.id,
              nombre: alumno.nombre,
            })),
          },
        });
      }

      toast({
        title: activar ? "Alumnos reactivados" : "Baja temporal aplicada",
        description: `${seleccionados.length} registros fueron actualizados.`,
      });
    } catch (error: unknown) {
      console.error("No se pudo actualizar la selección:", error);
      toast({
        variant: "destructive",
        title: "No se pudo actualizar la selección",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setIsUpdatingSelectedStudents(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!firestore || !paymentStudent || !userSede || isSavingPayment) {
      return;
    }

    const monto = Number(paymentAmount);

    if (!Number.isFinite(monto) || monto <= 0) {
      toast({
        variant: "destructive",
        title: "Monto inválido",
        description: "Escribe una cantidad mayor que cero.",
      });
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(paymentPeriod) || !paymentDate) {
      toast({
        variant: "destructive",
        title: "Fecha inválida",
        description: "Selecciona el periodo y la fecha del pago.",
      });
      return;
    }

    const paymentId = `${paymentStudent.id}_${paymentPeriod.replace("-", "")}`;
    const paymentRef = doc(firestore, "Pagos", paymentId);

    try {
      setIsSavingPayment(true);

      const existingPayment = await getDocs(
        query(
          collection(firestore, "Pagos"),
          where("sede", "==", userSede),
          where("alumnoId", "==", paymentStudent.id),
          where("periodo", "==", paymentPeriod),
          limit(1),
        ),
      );

      if (!existingPayment.empty) {
        toast({
          variant: "destructive",
          title: "Pago ya registrado",
          description: `${paymentStudent.nombre} ya tiene un pago para ${paymentPeriod}.`,
        });
        return;
      }

      const fechaPago = Timestamp.fromDate(
        new Date(`${paymentDate}T12:00:00`),
      );
      const nuevoPago: Omit<Pago, "id"> = {
        alumnoId: paymentStudent.id,
        nombre: paymentStudent.nombre,
        sede: userSede,
        monto,
        periodo: paymentPeriod,
        metodoPago: paymentMethod,
        fecha: fechaPago,
      };

      const batch = writeBatch(firestore);

      batch.set(paymentRef, {
        ...nuevoPago,
        creadoEn: serverTimestamp(),
      });
      batch.update(doc(firestore, "Alumnos", paymentStudent.id), {
        estadoPago: "Pagado",
        fechaUltimoPago: fechaPago,
        periodoUltimoPago: paymentPeriod,
      });

      await batch.commit();

      void recordAdminAudit(auth, {
        sede: userSede,
        action: "registrar_pago",
        entity: "pago",
        entityId: paymentId,
        entityName: paymentStudent.nombre,
        summary: `Se registró el pago de ${paymentStudent.nombre} por $${monto}.`,
        details: {
          alumnoId: paymentStudent.id,
          periodo: paymentPeriod,
          metodo: paymentMethod,
          monto,
        },
      });

      if (paymentPeriod === periodoActual) {
        setPaymentsCurrentMonth((prev) => [
          ...prev.filter((pago) => pago.id !== paymentId),
          {
            id: paymentId,
            ...nuevoPago,
          },
        ]);
      }

      toast({
        title: "Pago registrado",
        description: `Se guardó el pago de ${paymentStudent.nombre}.`,
      });

      void showAlbatrosNotification("Pago registrado", {
        body: `${paymentStudent.nombre}: $${monto.toLocaleString("es-MX")} · ${paymentPeriod}`,
        tag: `pago-${paymentId}`,
        url: "/admin/dashboard",
      });

      setReceiptPayment({
        id: paymentId,
        ...nuevoPago,
      });
      setPaymentStudent(null);
    } catch (error: unknown) {
      console.error("Error al registrar pago:", error);
      toast({
        variant: "destructive",
        title: "No se pudo registrar",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleOpenPaymentHistory = async (alumno: AdminAlumno) => {
    if (!firestore || !userSede) return;

    setHistoryStudent(alumno);
    setPaymentHistory([]);
    setIsLoadingPaymentHistory(true);

    try {
      const snapshot = await getDocs(
        query(
          collection(firestore, "Pagos"),
          where("alumnoId", "==", alumno.id),
          where("sede", "==", userSede),
        ),
      );

      const historial = snapshot.docs
        .map((documento) => ({
          id: documento.id,
          ...(documento.data() as Omit<Pago, "id">),
        }))
        .sort((a, b) => {
          const fechaA = a.fecha?.toDate?.()?.getTime?.() || 0;
          const fechaB = b.fecha?.toDate?.()?.getTime?.() || 0;
          return fechaB - fechaA;
        });

      setPaymentHistory(historial);
    } catch (error: unknown) {
      console.error("Error al consultar pagos:", error);
      toast({
        variant: "destructive",
        title: "No se pudo cargar el historial",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setIsLoadingPaymentHistory(false);
    }
  };

  const handleOpenStudentProfile = async (alumno: AdminAlumno) => {
    setProfileStudent(alumno);
    setProfilePayments([]);

    if (!firestore || !userSede) return;

    setIsLoadingProfilePayments(true);

    try {
      const snapshot = await getDocs(
        query(
          collection(firestore, "Pagos"),
          where("alumnoId", "==", alumno.id),
          where("sede", "==", userSede),
        ),
      );

      setProfilePayments(
        snapshot.docs
          .map((documento) => ({
            id: documento.id,
            ...(documento.data() as Omit<Pago, "id">),
          }))
          .sort((a, b) => {
            const fechaA = a.fecha?.toDate?.()?.getTime?.() || 0;
            const fechaB = b.fecha?.toDate?.()?.getTime?.() || 0;
            return fechaB - fechaA;
          }),
      );
    } catch (error) {
      console.error("No se pudieron cargar los pagos de la ficha:", error);
    } finally {
      setIsLoadingProfilePayments(false);
    }
  };

  const handleStartEditPayment = (pago: Pago) => {
    const fechaPago = pago.fecha?.toDate
      ? pago.fecha.toDate()
      : new Date(pago.fecha);

    setEditingPayment(pago);
    setEditPaymentAmount(String(Number(pago.monto || 0)));
    setEditPaymentPeriod(pago.periodo);
    setEditPaymentDate(
      !Number.isNaN(fechaPago.getTime())
        ? format(fechaPago, "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
    );
    setEditPaymentMethod(pago.metodoPago || "Efectivo");
  };

  const handleUpdatePayment = async () => {
    if (!firestore || !editingPayment || isUpdatingPayment) return;

    const monto = Number(editPaymentAmount);

    if (!Number.isFinite(monto) || monto <= 0) {
      toast({
        variant: "destructive",
        title: "Monto inválido",
        description: "Escribe una cantidad mayor que cero.",
      });
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(editPaymentPeriod) || !editPaymentDate) {
      toast({
        variant: "destructive",
        title: "Fecha inválida",
        description: "Selecciona el periodo y la fecha del pago.",
      });
      return;
    }

    const oldRef = doc(firestore, "Pagos", editingPayment.id);
    const newId =
      `${editingPayment.alumnoId}_${editPaymentPeriod.replace("-", "")}`;
    const newRef = doc(firestore, "Pagos", newId);

    try {
      setIsUpdatingPayment(true);

      const oldSnapshot = await getDoc(oldRef);

      if (!oldSnapshot.exists()) {
        throw new Error("El pago ya no existe.");
      }

      if (newId !== editingPayment.id) {
        const duplicateSnapshot = await getDoc(newRef);

        if (duplicateSnapshot.exists()) {
          toast({
            variant: "destructive",
            title: "Periodo duplicado",
            description:
              "El alumno ya tiene un pago registrado para ese periodo.",
          });
          return;
        }
      }

      const fechaPago = Timestamp.fromDate(
        new Date(`${editPaymentDate}T12:00:00`),
      );
      const updatedPayment: Pago = {
        ...editingPayment,
        id: newId,
        monto,
        periodo: editPaymentPeriod,
        metodoPago: editPaymentMethod,
        fecha: fechaPago,
      };
      const batch = writeBatch(firestore);

      if (newId !== editingPayment.id) {
        batch.delete(oldRef);
      }

      batch.set(newRef, {
        ...oldSnapshot.data(),
        monto,
        periodo: editPaymentPeriod,
        metodoPago: editPaymentMethod,
        fecha: fechaPago,
        actualizadoEn: serverTimestamp(),
      });

      const alumno = alumnos?.find(
        (item) => item.id === editingPayment.alumnoId,
      );

      if (alumno?.periodoUltimoPago === editingPayment.periodo) {
        batch.update(doc(firestore, "Alumnos", alumno.id), {
          estadoPago:
            editPaymentPeriod === periodoActual
              ? "Pagado"
              : "Falta de Pago",
          periodoUltimoPago: editPaymentPeriod,
          fechaUltimoPago: fechaPago,
        });
      } else if (editPaymentPeriod === periodoActual) {
        batch.update(doc(firestore, "Alumnos", editingPayment.alumnoId), {
          estadoPago: "Pagado",
          periodoUltimoPago: editPaymentPeriod,
          fechaUltimoPago: fechaPago,
        });
      }

      await batch.commit();

      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: "editar_pago",
          entity: "pago",
          entityId: newId,
          entityName: editingPayment.nombre,
          summary: `Se corrigió el pago de ${editingPayment.nombre}.`,
          details: {
            idAnterior: editingPayment.id,
            montoAnterior: editingPayment.monto,
            montoNuevo: monto,
            periodoAnterior: editingPayment.periodo,
            periodoNuevo: editPaymentPeriod,
            metodo: editPaymentMethod,
          },
        });
      }

      setPaymentHistory((prev) =>
        prev
          .filter((pago) => pago.id !== editingPayment.id)
          .concat(updatedPayment)
          .sort((a, b) => b.periodo.localeCompare(a.periodo)),
      );
      setProfilePayments((prev) =>
        prev
          .filter((pago) => pago.id !== editingPayment.id)
          .concat(updatedPayment)
          .sort((a, b) => b.periodo.localeCompare(a.periodo)),
      );
      setPaymentsCurrentMonth((prev) => {
        const withoutOld = prev.filter(
          (pago) => pago.id !== editingPayment.id,
        );

        return editPaymentPeriod === periodoActual
          ? [...withoutOld, updatedPayment]
          : withoutOld;
      });

      toast({
        title: "Pago corregido",
        description: "Los cambios fueron guardados correctamente.",
      });
      setEditingPayment(null);
    } catch (error: unknown) {
      console.error("No se pudo corregir el pago:", error);
      toast({
        variant: "destructive",
        title: "No se pudo corregir",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleDeletePayment = async (pago: Pago) => {
    if (!firestore) return;

    const confirmed = window.confirm(
      `¿Cancelar el pago de ${pago.nombre} correspondiente a ${pago.periodo}?`,
    );

    if (!confirmed) return;

    try {
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, "Pagos", pago.id));

      const alumno = alumnos?.find((item) => item.id === pago.alumnoId);

      if (alumno?.periodoUltimoPago === pago.periodo) {
        batch.update(doc(firestore, "Alumnos", alumno.id), {
          estadoPago: "Falta de Pago",
          periodoUltimoPago: deleteField(),
          fechaUltimoPago: deleteField(),
        });
      }

      await batch.commit();

      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: "cancelar_pago",
          entity: "pago",
          entityId: pago.id,
          entityName: pago.nombre,
          summary: `Se canceló el pago de ${pago.nombre} del periodo ${pago.periodo}.`,
          details: {
            alumnoId: pago.alumnoId,
            monto: pago.monto,
            metodo: pago.metodoPago,
          },
        });
      }

      setPaymentHistory((prev) =>
        prev.filter((item) => item.id !== pago.id),
      );
      setProfilePayments((prev) =>
        prev.filter((item) => item.id !== pago.id),
      );
      setPaymentsCurrentMonth((prev) =>
        prev.filter((item) => item.id !== pago.id),
      );

      toast({
        title: "Pago cancelado",
        description: "El registro fue eliminado y la recaudación se actualizó.",
      });
    } catch (error: unknown) {
      console.error("No se pudo cancelar el pago:", error);
      toast({
        variant: "destructive",
        title: "No se pudo cancelar",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    }
  };

  const handleDeleteIndividual = async (id: string, nombre: string) => {
    if (!firestore) return;

    const confirmed = window.confirm(
      `¿Eliminar permanentemente a ${nombre}?\n\nEsta acción no se puede deshacer. Si solo dejará de asistir temporalmente, usa “Dar de baja temporal” para conservar su registro.`,
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(firestore, "Alumnos", id));

      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: "eliminar",
          entity: "alumno",
          entityId: id,
          entityName: nombre,
          summary: `Se eliminó permanentemente a ${nombre}.`,
        });
      }

      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));

      toast({
        title: "Registro eliminado",
        description: `${nombre} fue removido del sistema.`,
      });
    } catch (error: unknown) {
      console.error("Error al eliminar alumno:", error);

      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    }
  };

  const handleResetMonthlyAttendance = async () => {
    if (!firestore || !asistencias || asistencias.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay asistencias registradas este mes.",
      });
      return;
    }

    try {
      await Promise.all(
        (asistencias ?? []).map((asistencia) =>
          deleteDoc(doc(firestore, "Asistencias", asistencia.id)),
        ),
      );

      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: "reiniciar_asistencias",
          entity: "asistencia",
          summary: `Se eliminaron ${asistencias.length} registros de asistencia del mes.`,
          details: { cantidad: asistencias.length, periodo: periodoActual },
        });
      }

      toast({
        title: "Contador reiniciado",
        description: `Se borraron las asistencias del mes de la sede ${userSede}.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron borrar las asistencias.",
      });
    }
  };

  const handleOpenManualAttendance = (alumno: AdminAlumno) => {
    if (alumno.activo === false) {
      toast({
        variant: "destructive",
        title: "Alumno inactivo",
        description: "Reactiva al alumno antes de registrar una asistencia.",
      });
      return;
    }

    setAttendanceStudent(alumno);
    setManualAttendanceDate(format(new Date(), "yyyy-MM-dd"));
    setManualAttendanceTime(format(new Date(), "HH:mm"));
  };

  const handleAddManualAttendance = async () => {
    if (
      !firestore ||
      !attendanceStudent ||
      !userSede ||
      isSavingManualAttendance
    ) {
      return;
    }

    const fecha = new Date(
      `${manualAttendanceDate}T${manualAttendanceTime || "12:00"}:00`,
    );

    if (
      Number.isNaN(fecha.getTime()) ||
      format(fecha, "yyyy-MM") !== periodoActual
    ) {
      toast({
        variant: "destructive",
        title: "Fecha inválida",
        description: "Selecciona una fecha dentro del mes actual.",
      });
      return;
    }

    const yaExiste = (
      attendanceDataMap[attendanceStudent.id]?.history || []
    ).some(
      (registro) =>
        format(registro, "yyyy-MM-dd") ===
        format(fecha, "yyyy-MM-dd"),
    );

    if (yaExiste) {
      toast({
        variant: "destructive",
        title: "Asistencia duplicada",
        description: `${attendanceStudent.nombre} ya tiene asistencia ese día.`,
      });
      return;
    }

    try {
      setIsSavingManualAttendance(true);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("La sesión expiró. Vuelve a iniciar sesión.");

      const { response, data } = await apiRequest<{
        ok?: boolean;
        duplicado?: boolean;
        mensaje?: string;
      }>("/api/recepcion/asistencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alumnoId: attendanceStudent.id,
          sede: userSede,
          fecha: fecha.toISOString(),
        }),
      });

      if (response.status === 409 || data.duplicado) {
        throw new Error(
          data.mensaje ||
            `${attendanceStudent.nombre} ya tiene asistencia ese día.`,
        );
      }
      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudo registrar la asistencia.",
          ),
        );
      }

      toast({
        title: "Asistencia agregada",
        description: `Se registró la asistencia de ${attendanceStudent.nombre}.`,
      });
      setAttendanceStudent(null);
    } catch (error: unknown) {
      console.error("No se pudo agregar la asistencia:", error);
      toast({
        variant: "destructive",
        title: "No se pudo registrar",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setIsSavingManualAttendance(false);
    }
  };

  const handleDeleteAttendanceDay = async (
    alumno: AdminAlumno,
    fecha: Date,
  ) => {
    if (!firestore) return;

    const registrosDelDia = (asistencias ?? []).filter((asistencia) => {
      if (asistencia.alumnoId !== alumno.id) return false;

      const fechaRegistro = asistencia.fecha?.toDate
        ? asistencia.fecha.toDate()
        : new Date(asistencia.fecha);

      return (
        !Number.isNaN(fechaRegistro.getTime()) &&
        format(fechaRegistro, "yyyy-MM-dd") === format(fecha, "yyyy-MM-dd")
      );
    });

    if (
      registrosDelDia.length === 0 ||
      !window.confirm(
        `¿Eliminar la asistencia de ${alumno.nombre} del ${format(fecha, "dd/MM/yyyy", { locale: es })}?`,
      )
    ) {
      return;
    }

    try {
      const batch = writeBatch(firestore);

      registrosDelDia.forEach((asistencia) => {
        batch.delete(doc(firestore, "Asistencias", asistencia.id));
      });

      await batch.commit();

      if (userSede) {
        void recordAdminAudit(auth, {
          sede: userSede,
          action: "eliminar_asistencia",
          entity: "asistencia",
          entityId: registrosDelDia.map((registro) => registro.id).join(","),
          entityName: alumno.nombre,
          summary: `Se eliminó la asistencia de ${alumno.nombre} del ${format(fecha, "dd/MM/yyyy")}.`,
          details: {
            alumnoId: alumno.id,
            fecha: format(fecha, "yyyy-MM-dd"),
            cantidad: registrosDelDia.length,
          },
        });
      }

      toast({
        title: "Asistencia eliminada",
        description: "El conteo mensual fue corregido.",
      });
    } catch (error: unknown) {
      console.error("No se pudo eliminar la asistencia:", error);
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const idsVisibles = filteredAlumnos.map((alumno) => alumno.id);
    const todosVisiblesSeleccionados =
      idsVisibles.length > 0 &&
      idsVisibles.every((id) => selectedIds.includes(id));

    if (todosVisiblesSeleccionados) {
      setSelectedIds((prev) =>
        prev.filter((id) => !idsVisibles.includes(id)),
      );
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...idsVisibles])));
  };

  const getStatusBadge = (alumno: AdminAlumno) => {
    const status = getAutomaticStatus(alumno);

    switch (status) {
      case "Pagado":
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-black uppercase text-[11px] italic">
            PAGADO
          </Badge>
        );

      case "Retraso":
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-black uppercase text-[11px] italic">
            RETRASO
          </Badge>
        );

      default:
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground font-bold uppercase text-[11px] italic"
          >
            FALTA PAGO
          </Badge>
        );
    }
  };

  const isLoading = isLoadingAlumnos || isLoadingAsistencias;

  const alumnosActivos =
    alumnos?.filter((alumno) => alumno.activo !== false) || [];
  const alumnosInactivos =
    alumnos?.filter((alumno) => alumno.activo === false) || [];
  const totalAlumnos = alumnosActivos.length;
  const auditoriaDatos = useMemo(() => {
    const lista = alumnos ?? [];
    const nombres = new Map<string, AdminAlumno[]>();
    const tarjetas = new Map<string, AdminAlumno[]>();

    lista.forEach((alumno) => {
      const nombreNormalizado = String(alumno.nombre || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

      if (nombreNormalizado) {
        nombres.set(nombreNormalizado, [
          ...(nombres.get(nombreNormalizado) || []),
          alumno,
        ]);
      }

      const rfids = alumno.rfids?.length
        ? alumno.rfids
        : alumno.rfid
          ? [alumno.rfid]
          : [];

      Array.from(
        new Set(
          rfids
            .map((rfid) => String(rfid).trim().toUpperCase())
            .filter(Boolean),
        ),
      ).forEach((codigo) => {
        if (codigo) {
          tarjetas.set(codigo, [
            ...(tarjetas.get(codigo) || []),
            alumno,
          ]);
        }
      });
    });

    return {
      nombresDuplicados: Array.from(nombres.entries())
        .filter(([, coincidencias]) => coincidencias.length > 1)
        .map(([clave, coincidencias]) => ({
          clave,
          alumnos: coincidencias,
        })),
      rfidsDuplicados: Array.from(tarjetas.entries())
        .filter(([, coincidencias]) => coincidencias.length > 1)
        .map(([rfid, coincidencias]) => ({
          rfid,
          alumnos: coincidencias,
        })),
      sinTelefono: lista.filter((alumno) => !alumno.telefono?.trim()),
      sinRfid: lista.filter(
        (alumno) =>
          !alumno.rfids?.length && !String(alumno.rfid || "").trim(),
      ),
    };
  }, [alumnos]);
  const totalAlertasDatos =
    auditoriaDatos.nombresDuplicados.length +
    auditoriaDatos.rfidsDuplicados.length +
    auditoriaDatos.sinTelefono.length +
    auditoriaDatos.sinRfid.length;

  const asistenciasUnicasMes = Object.values(attendanceDataMap).reduce(
    (total, registro) => total + registro.count,
    0,
  );
  const reporteAsistenciasMes = (alumnos ?? [])
    .map((alumno) => {
      const registro = attendanceDataMap[alumno.id] || {
        count: 0,
        history: [],
      };

      return {
        id: alumno.id,
        nombre: alumno.nombre,
        asistencias: registro.count,
        porcentaje: Math.min((registro.count / 12) * 100, 100),
        dias: [...registro.history].sort(
          (a, b) => a.getTime() - b.getTime(),
        ),
      };
    })
    .sort(
      (a, b) =>
        b.asistencias - a.asistencias ||
        a.nombre.localeCompare(b.nombre, "es"),
    );
  const alumnosSinAsistencia = reporteAsistenciasMes.filter(
    (alumno) => alumno.asistencias === 0,
  ).length;
  const promedioAsistencia =
    reporteAsistenciasMes.length > 0
      ? reporteAsistenciasMes.reduce(
          (total, alumno) => total + alumno.asistencias,
          0,
        ) / reporteAsistenciasMes.length
      : 0;
  const idsAlumnosActivos = new Set(
    alumnosActivos.map((alumno) => alumno.id),
  );
  const rankingAsistencia = reporteAsistenciasMes
    .filter(
      (alumno) =>
        idsAlumnosActivos.has(alumno.id) && alumno.asistencias > 0,
    )
    .slice(0, 3);

  const claveHoy = format(new Date(), "yyyy-MM-dd");
  const asistenciasHoy = (alumnos ?? [])
    .flatMap((alumno) => {
      const fechaHoy = attendanceDataMap[alumno.id]?.history.find(
        (fecha) => format(fecha, "yyyy-MM-dd") === claveHoy,
      );

      return fechaHoy
        ? [
            {
              alumno,
              fecha: fechaHoy,
            },
          ]
        : [];
    })
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  const alumnosConPagoRegistrado = new Set(
    paymentsCurrentMonth.map((pago) => pago.alumnoId),
  );
  const totalHistorialMes = paymentsCurrentMonth.reduce(
    (total, pago) => total + (Number(pago.monto) || 0),
    0,
  );
  const totalPagadosAnteriores =
    alumnos
      ?.filter(
        (alumno) =>
          getAutomaticStatus(alumno) === "Pagado" &&
          !alumnosConPagoRegistrado.has(alumno.id),
      )
      .reduce(
        (total, alumno) => total + (Number(alumno.montoPago) || 0),
        0,
      ) || 0;
  const recaudacion = totalHistorialMes + totalPagadosAnteriores;
  const recaudacionEstimada = alumnosActivos.reduce(
    (total, alumno) => total + (Number(alumno.montoPago) || 0),
    0,
  );
  const pagosReporteMes = [
    ...paymentsCurrentMonth.map((pago) => ({
      id: pago.id,
      nombre: pago.nombre,
      monto: Number(pago.monto) || 0,
      metodo: pago.metodoPago || "Sin especificar",
      fecha: pago.fecha?.toDate?.() || null,
    })),
    ...(alumnos ?? [])
      .filter(
        (alumno) =>
          getAutomaticStatus(alumno) === "Pagado" &&
          !alumnosConPagoRegistrado.has(alumno.id),
      )
      .map((alumno) => ({
        id: `legacy-${alumno.id}`,
        nombre: alumno.nombre,
        monto: Number(alumno.montoPago) || 0,
        metodo: "Registro anterior",
        fecha:
          alumno.fechaUltimoPago &&
          typeof alumno.fechaUltimoPago === "object" &&
          "toDate" in alumno.fechaUltimoPago &&
          typeof (alumno.fechaUltimoPago as { toDate?: unknown }).toDate ===
            "function"
            ? (alumno.fechaUltimoPago as { toDate: () => Date }).toDate()
            : null,
      })),
  ].sort(
    (a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0),
  );
  const recaudacionPendiente = Math.max(
    0,
    recaudacionEstimada - recaudacion,
  );

  const alumnosMorosos = alumnosActivos.filter(
    (alumno) => getAutomaticStatus(alumno) === "Retraso",
  );
  const adeudosMorosos = new Map(
    alumnosMorosos.map((alumno) => {
      const meses = calcularMesesAdeudados(alumno, periodoActual);

      return [
        alumno.id,
        {
          meses,
          total: meses * (Number(alumno.montoPago) || 0),
        },
      ];
    }),
  );
  const totalAdeudoMorosos = Array.from(adeudosMorosos.values()).reduce(
    (total, adeudo) => total + adeudo.total,
    0,
  );

  const alumnosProximosPago = alumnosActivos.filter((alumno) => {
      if (getAutomaticStatus(alumno) === "Pagado") {
        return false;
      }

      const diasRestantes =
        Number(alumno.diaPago || 1) - todayDay;

      return diasRestantes >= 0 && diasRestantes <= 4;
    });

  const totalRetrasos = alumnosMorosos.length;

  useEffect(() => {
    if (
      !userSede ||
      isLoading ||
      !notificationsEnabled() ||
      (alumnosMorosos.length === 0 && alumnosProximosPago.length === 0)
    ) {
      return;
    }

    const todayKey = `${format(new Date(), "yyyy-MM-dd")}-${userSede}`;
    if (localStorage.getItem(DAILY_NOTIFICATION_KEY) === todayKey) return;

    const timer = window.setTimeout(() => {
      const parts = [
        alumnosMorosos.length > 0
          ? `${alumnosMorosos.length} ${alumnosMorosos.length === 1 ? "alumno moroso" : "alumnos morosos"}`
          : "",
        alumnosProximosPago.length > 0
          ? `${alumnosProximosPago.length} ${alumnosProximosPago.length === 1 ? "pago próximo" : "pagos próximos"}`
          : "",
      ].filter(Boolean);

      void showAlbatrosNotification(`Resumen de ${userSede}`, {
        body: parts.join(" · "),
        tag: `resumen-diario-${todayKey}`,
        url: "/admin/dashboard",
      }).then((shown) => {
        if (shown) {
          localStorage.setItem(DAILY_NOTIFICATION_KEY, todayKey);
        }
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    alumnosMorosos.length,
    alumnosProximosPago.length,
    isLoading,
    userSede,
  ]);

  const normalizarTelefonoWhatsApp = (value: unknown) => {
    let phone = String(value || "").replace(/\D/g, "");

    if (phone.length === 10) {
      phone = `52${phone}`;
    } else if (phone.length === 13 && phone.startsWith("521")) {
      phone = `52${phone.slice(3)}`;
    }

    return phone;
  };

  const crearMensajeRecordatorio = (
    alumno: AdminAlumno,
    tipo: "retraso" | "proximo" | "general",
  ) => {
    const adeudo = adeudosMorosos.get(alumno.id);
    const montoMensual = Number(alumno.montoPago || 0);
    const monto =
      tipo === "retraso" && adeudo
        ? adeudo.total.toLocaleString("es-MX")
        : montoMensual.toLocaleString("es-MX");
    return tipo === "retraso"
      ? `Hola ${alumno.nombre}, te recordamos que tienes ${adeudo?.meses || 1} ${adeudo?.meses === 1 ? "mensualidad pendiente" : "mensualidades pendientes"} en ALBATROS, por un total de $${monto}. Por favor, comunícate con nosotros para regularizar tu pago.`
      : tipo === "proximo"
        ? `Hola ${alumno.nombre}, te recordamos que tu mensualidad de ALBATROS por $${monto} vence el día ${alumno.diaPago}.`
        : `Hola ${alumno.nombre}, te recordamos que tienes una mensualidad pendiente en ALBATROS por $${monto}. Si ya realizaste tu pago, puedes ignorar este mensaje.`;
  };

  const abrirWhatsApp = async (
    alumno: AdminAlumno,
    tipo: "retraso" | "proximo" | "general",
  ): Promise<boolean> => {
    const telefono = normalizarTelefonoWhatsApp(alumno.telefono);

    if (!telefono) {
      toast({
        variant: "destructive",
        title: "Sin teléfono",
        description: `${alumno.nombre} no tiene un número registrado.`,
      });
      return false;
    }

    const mensaje = crearMensajeRecordatorio(alumno, tipo);
    const whatsappWindow = window.open("", "_blank");

    if (!whatsappWindow) {
      toast({
        variant: "destructive",
        title: "Ventana bloqueada",
        description:
          "Permite las ventanas emergentes para abrir WhatsApp.",
      });
      return false;
    }

    whatsappWindow.opener = null;
    whatsappWindow.location.href =
      `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

    if (firestore && userSede) {
      try {
        await updateDoc(doc(firestore, "Alumnos", alumno.id), {
          ultimoRecordatorioPago: serverTimestamp(),
          tipoUltimoRecordatorio: tipo,
        });

        void recordAdminAudit(auth, {
          sede: userSede,
          action: "editar",
          entity: "alumno",
          entityId: alumno.id,
          entityName: alumno.nombre,
          summary: `Se abrió un recordatorio de pago para ${alumno.nombre}.`,
          details: { tipo },
        });
      } catch (error) {
        console.error("No se pudo registrar el recordatorio:", error);
      }
    }

    return true;
  };

  const reminderCandidates =
    reminderAudience === "morosos"
      ? alumnosMorosos
      : reminderAudience === "proximos"
        ? alumnosProximosPago
        : alumnosActivos.filter(
            (alumno) => getAutomaticStatus(alumno) !== "Pagado",
          );
  const reminderType =
    reminderAudience === "morosos"
      ? "retraso"
      : reminderAudience === "proximos"
        ? "proximo"
        : "general";
  const pendingReminderStudents = reminderCandidates.filter(
    (alumno) =>
      selectedReminderIds.includes(alumno.id) &&
      !sentReminderIds.includes(alumno.id) &&
      Boolean(normalizarTelefonoWhatsApp(alumno.telefono)),
  );

  const changeReminderAudience = (audience: ReminderAudience) => {
    setReminderAudience(audience);
    const candidates =
      audience === "morosos"
        ? alumnosMorosos
        : audience === "proximos"
          ? alumnosProximosPago
          : alumnosActivos.filter(
              (alumno) => getAutomaticStatus(alumno) !== "Pagado",
            );

    setSelectedReminderIds(
      candidates
        .filter((alumno) =>
          Boolean(normalizarTelefonoWhatsApp(alumno.telefono)),
        )
        .map((alumno) => alumno.id),
    );
    setSentReminderIds([]);
  };

  const sendNextReminder = async () => {
    const student = pendingReminderStudents[0];
    if (!student || isSendingReminder) return;

    try {
      setIsSendingReminder(true);
      const opened = await abrirWhatsApp(student, reminderType);

      if (opened) {
        setSentReminderIds((previous) => [...previous, student.id]);
      }
    } finally {
      setIsSendingReminder(false);
    }
  };

  const formatLastReminder = (value: unknown) => {
    const date =
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
        ? (value as { toDate: () => Date }).toDate()
        : typeof value === "string" || typeof value === "number"
          ? new Date(value)
          : null;

    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("es-MX", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(date)
      : "Nunca";
  };

  const descargarReportePagos = () => {
    const protegerCelda = (valor: unknown) => {
      const texto = String(valor ?? "");
      const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;

      return `"${seguro.replace(/"/g, '""')}"`;
    };
    const filas = [
      ["Alumno", "Monto", "Método", "Fecha", "Periodo", "Sede"],
      ...pagosReporteMes.map((pago) => [
        pago.nombre,
        pago.monto.toFixed(2),
        pago.metodo,
        pago.fecha
          ? format(pago.fecha, "dd/MM/yyyy", { locale: es })
          : "Sin fecha",
        periodoActual,
        userSede?.replace("_", " ") || "",
      ]),
    ];
    const contenido = filas
      .map((fila) => fila.map(protegerCelda).join(";"))
      .join("\r\n");
    const archivo = new Blob([`\uFEFF${contenido}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = `pagos_${userSede || "sede"}_${periodoActual}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);

    toast({
      title: "Reporte descargado",
      description: `Se exportaron ${pagosReporteMes.length} pagos del periodo ${periodoActual}.`,
    });
  };

  const descargarReporteAsistencias = () => {
    const protegerCelda = (valor: unknown) => {
      const texto = String(valor ?? "");
      const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;

      return `"${seguro.replace(/"/g, '""')}"`;
    };
    const filas = [
      [
        "Alumno",
        "Asistencias",
        "Porcentaje",
        "Días asistidos",
        "Periodo",
        "Sede",
      ],
      ...reporteAsistenciasMes.map((alumno) => [
        alumno.nombre,
        alumno.asistencias,
        `${Math.round(alumno.porcentaje)}%`,
        alumno.dias
          .map((fecha) => format(fecha, "dd/MM/yyyy", { locale: es }))
          .join(", "),
        periodoActual,
        userSede?.replace("_", " ") || "",
      ]),
    ];
    const contenido = filas
      .map((fila) => fila.map(protegerCelda).join(";"))
      .join("\r\n");
    const archivo = new Blob([`\uFEFF${contenido}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = `asistencias_${userSede || "sede"}_${periodoActual}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);

    toast({
      title: "Reporte descargado",
      description: `Se exportó la asistencia de ${reporteAsistenciasMes.length} alumnos.`,
    });
  };

  const exportarReportePorPeriodo = async () => {
    if (
      !firestore ||
      !userSede ||
      isExportingPeriodReport ||
      !periodReportStart ||
      !periodReportEnd
    ) {
      return;
    }

    const inicio = new Date(`${periodReportStart}T00:00:00`);
    const fin = new Date(`${periodReportEnd}T23:59:59.999`);

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fin.getTime()) ||
      inicio > fin
    ) {
      toast({
        variant: "destructive",
        title: "Periodo inválido",
        description: "La fecha inicial debe ser anterior a la fecha final.",
      });
      return;
    }

    const obtenerFecha = (valor: unknown): Date | null => {
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

        return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
      } catch {
        return null;
      }
    };
    const dentroDelPeriodo = (fecha: Date | null) =>
      Boolean(fecha && fecha >= inicio && fecha <= fin);
    const protegerCelda = (valor: unknown) => {
      const texto = String(valor ?? "");
      const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;

      return `"${seguro.replace(/"/g, '""')}"`;
    };
    const descargarCsv = (filas: unknown[][]) => {
      const contenido = filas
        .map((fila) => fila.map(protegerCelda).join(";"))
        .join("\r\n");
      const archivo = new Blob([`\uFEFF${contenido}`], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = `reporte_${periodReportType}_${userSede}_${periodReportStart}_${periodReportEnd}.csv`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    };

    try {
      setIsExportingPeriodReport(true);

      const necesitaPagos =
        periodReportType === "pagos" || periodReportType === "resumen";
      const necesitaAsistencias =
        periodReportType === "asistencias" || periodReportType === "resumen";
      const [pagosSnapshot, asistenciasSnapshot] = await Promise.all([
        necesitaPagos
          ? getDocs(
              query(
                collection(firestore, "Pagos"),
                where("sede", "==", userSede),
              ),
            )
          : Promise.resolve(null),
        necesitaAsistencias
          ? getDocs(
              query(
                collection(firestore, "Asistencias"),
                where("sede", "==", userSede),
              ),
            )
          : Promise.resolve(null),
      ]);
      const pagosPeriodo = (pagosSnapshot?.docs || [])
        .map((documento) => ({
          id: documento.id,
          ...(documento.data() as Omit<Pago, "id">),
        }))
        .map((pago) => ({
          ...pago,
          fechaNormalizada: obtenerFecha(pago.fecha),
        }))
        .filter((pago) => dentroDelPeriodo(pago.fechaNormalizada));
      const asistenciasPeriodo = (asistenciasSnapshot?.docs || [])
        .map((documento) => ({
          id: documento.id,
          ...(documento.data() as Omit<Asistencia, "id">),
        }))
        .map((asistencia) => ({
          ...asistencia,
          fechaNormalizada: obtenerFecha(asistencia.fecha),
        }))
        .filter((asistencia) => dentroDelPeriodo(asistencia.fechaNormalizada));
      const nombres = new Map(
        (alumnos ?? []).map((alumno) => [alumno.id, alumno.nombre]),
      );

      if (periodReportType === "pagos") {
        descargarCsv([
          ["Alumno", "Monto", "Método", "Fecha", "Periodo", "Sede"],
          ...pagosPeriodo.map((pago) => [
            pago.nombre || nombres.get(pago.alumnoId) || "Alumno",
            Number(pago.monto || 0).toFixed(2),
            pago.metodoPago || "Sin método",
            pago.fechaNormalizada
              ? format(pago.fechaNormalizada, "dd/MM/yyyy HH:mm", {
                  locale: es,
                })
              : "",
            pago.periodo || "",
            userSede.replace("_", " "),
          ]),
        ]);
      } else if (periodReportType === "asistencias") {
        const registrosUnicos = Array.from(
          new Map(
            asistenciasPeriodo.map((asistencia) => [
              `${asistencia.alumnoId}-${asistencia.fechaNormalizada ? format(asistencia.fechaNormalizada, "yyyy-MM-dd") : asistencia.id}`,
              asistencia,
            ]),
          ).values(),
        );

        descargarCsv([
          ["Alumno", "Fecha", "Hora", "Sede"],
          ...registrosUnicos.map((asistencia) => [
            nombres.get(asistencia.alumnoId) || "Alumno",
            asistencia.fechaNormalizada
              ? format(asistencia.fechaNormalizada, "dd/MM/yyyy", {
                  locale: es,
                })
              : "",
            asistencia.fechaNormalizada
              ? format(asistencia.fechaNormalizada, "HH:mm")
              : "",
            userSede.replace("_", " "),
          ]),
        ]);
      } else {
        const resumen = (alumnos ?? [])
          .map((alumno) => {
            const totalPagado = pagosPeriodo
              .filter((pago) => pago.alumnoId === alumno.id)
              .reduce(
                (total, pago) => total + (Number(pago.monto) || 0),
                0,
              );
            const diasAsistencia = new Set(
              asistenciasPeriodo
                .filter(
                  (asistencia) => asistencia.alumnoId === alumno.id,
                )
                .map((asistencia) =>
                  asistencia.fechaNormalizada
                    ? format(asistencia.fechaNormalizada, "yyyy-MM-dd")
                    : asistencia.id,
                ),
            ).size;

            return {
              alumno,
              totalPagado,
              diasAsistencia,
            };
          })
          .filter(
            (registro) =>
              registro.totalPagado > 0 || registro.diasAsistencia > 0,
          );

        descargarCsv([
          [
            "Alumno",
            "Total pagado",
            "Días de asistencia",
            "Estado actual",
            "Periodo inicial",
            "Periodo final",
            "Sede",
          ],
          ...resumen.map((registro) => [
            registro.alumno.nombre,
            registro.totalPagado.toFixed(2),
            registro.diasAsistencia,
            getAutomaticStatus(registro.alumno),
            periodReportStart,
            periodReportEnd,
            userSede.replace("_", " "),
          ]),
        ]);
      }

      toast({
        title: "Reporte descargado",
        description: `Periodo: ${format(inicio, "dd/MM/yyyy")}–${format(fin, "dd/MM/yyyy")}.`,
      });
      setIsPeriodReportOpen(false);
    } catch (error) {
      console.error("No se pudo exportar el reporte por periodo:", error);
      toast({
        variant: "destructive",
        title: "No se pudo exportar",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setIsExportingPeriodReport(false);
    }
  };

  const descargarRespaldoSede = async () => {
    if (!firestore || !userSede || isCreatingBackup) return;

    const serializarDato = (valor: unknown): unknown => {
      if (
        valor &&
        typeof valor === "object" &&
        "toDate" in valor &&
        typeof (valor as { toDate?: unknown }).toDate === "function"
      ) {
        return (valor as { toDate: () => Date }).toDate().toISOString();
      }

      if (valor instanceof Date) return valor.toISOString();

      if (Array.isArray(valor)) return valor.map(serializarDato);

      if (valor && typeof valor === "object") {
        return Object.fromEntries(
          Object.entries(valor).map(([clave, dato]) => [
            clave,
            serializarDato(dato),
          ]),
        );
      }

      return valor;
    };

    try {
      setIsCreatingBackup(true);

      const [pagosSnapshot, asistenciasSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(firestore, "Pagos"),
            where("sede", "==", userSede),
          ),
        ),
        getDocs(
          query(
            collection(firestore, "Asistencias"),
            where("sede", "==", userSede),
          ),
        ),
      ]);
      const respaldo = {
        sistema: "ALBATROS",
        sede: userSede,
        generadoEn: new Date().toISOString(),
        version: 1,
        alumnos: (alumnos ?? []).map((alumno) =>
          serializarDato(alumno),
        ),
        pagos: pagosSnapshot.docs.map((documento) =>
          serializarDato({
            id: documento.id,
            ...documento.data(),
          }),
        ),
        asistencias: asistenciasSnapshot.docs.map((documento) =>
          serializarDato({
            id: documento.id,
            ...documento.data(),
          }),
        ),
      };
      const archivo = new Blob([JSON.stringify(respaldo, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = `respaldo_albatros_${userSede}_${format(
        new Date(),
        "yyyy-MM-dd_HHmm",
      )}.json`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);

      toast({
        title: "Respaldo descargado",
        description: `${alumnos?.length || 0} alumnos, ${pagosSnapshot.size} pagos y ${asistenciasSnapshot.size} asistencias incluidos.`,
      });
    } catch (error: unknown) {
      console.error("No se pudo generar el respaldo:", error);
      toast({
        variant: "destructive",
        title: "No se pudo crear el respaldo",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const resetRestoreState = () => {
    setRestoreFileName("");
    setRestoreBackup(null);
    setRestorePreview(null);
    setRestoreSelection({
      alumnos: true,
      pagos: true,
      asistencias: true,
    });
  };

  const normalizeBackupId = (value: unknown) =>
    typeof value === "string" ? value.trim().slice(0, 200) : "";

  const normalizeTextKey = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

  const normalizeRfidKey = (value: unknown) =>
    String(value ?? "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

  const parseBackupDate = (value: unknown) => {
    if (typeof value !== "string" && typeof value !== "number") return value;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : Timestamp.fromDate(date);
  };

  const sanitizeRestoreRecord = (
    category: RestoreCategory,
    record: BackupRecord,
  ) => {
    const allowedKeys: Record<RestoreCategory, string[]> = {
      alumnos: [
        "rfid",
        "rfids",
        "nombre",
        "telefono",
        "diaPago",
        "esAfiliado",
        "descuento",
        "montoPago",
        "estadoPago",
        "activo",
        "fechaRegistro",
        "fechaUltimoPago",
        "periodoUltimoPago",
        "fotoUrl",
        "emergenciaToken",
        "emergencia",
        "fechaCambioActividad",
      ],
      pagos: [
        "alumnoId",
        "nombre",
        "monto",
        "periodo",
        "metodoPago",
        "fecha",
        "creadoEn",
        "actualizadoEn",
      ],
      asistencias: [
        "alumnoId",
        "nombre",
        "fecha",
        "acceso",
        "dispositivo",
        "registroManual",
        "creadoEn",
      ],
    };
    const dateKeys = new Set([
      "fecha",
      "creadoEn",
      "actualizadoEn",
      "fechaRegistro",
      "fechaUltimoPago",
      "fechaCambioActividad",
    ]);
    const sanitized: Record<string, unknown> = { sede: userSede };

    allowedKeys[category].forEach((key) => {
      if (!(key in record)) return;
      const value = record[key];
      sanitized[key] = dateKeys.has(key) ? parseBackupDate(value) : value;
    });

    return sanitized;
  };

  const prepareBackupRestore = async (backup: AlbatrosBackup) => {
    if (!firestore || !userSede) {
      throw new Error("No se pudo identificar la sesión o la sede.");
    }

    const [paymentSnapshot, attendanceSnapshot] = await Promise.all([
      getDocs(
        query(
          collection(firestore, "Pagos"),
          where("sede", "==", userSede),
        ),
      ),
      getDocs(
        query(
          collection(firestore, "Asistencias"),
          where("sede", "==", userSede),
        ),
      ),
    ]);
    const currentStudents = alumnos ?? [];
    const studentIds = new Set(currentStudents.map((student) => student.id));
    const studentNames = new Set(
      currentStudents.map((student) => normalizeTextKey(student.nombre)),
    );
    const studentRfids = new Set(
      currentStudents.flatMap((student) => [
        normalizeRfidKey(student.rfid),
        ...(student.rfids || []).map(normalizeRfidKey),
      ]).filter(Boolean),
    );
    const paymentIds = new Set(
      paymentSnapshot.docs.map((document) => document.id),
    );
    const paymentKeys = new Set(
      paymentSnapshot.docs.map((document) => {
        const data = document.data();
        return `${data.alumnoId || ""}|${data.periodo || ""}`;
      }),
    );
    const attendanceIds = new Set(
      attendanceSnapshot.docs.map((document) => document.id),
    );
    const attendanceKeys = new Set(
      attendanceSnapshot.docs.map((document) => {
        const data = document.data();
        const date = data.fecha?.toDate?.();
        return `${data.alumnoId || ""}|${
          date && !Number.isNaN(date.getTime())
            ? format(date, "yyyy-MM-dd")
            : ""
        }`;
      }),
    );
    const newRecords: Record<RestoreCategory, BackupRecord[]> = {
      alumnos: [],
      pagos: [],
      asistencias: [],
    };
    const preview: RestorePreview = {
      alumnos: { total: backup.alumnos.length, nuevos: 0, duplicados: 0, invalidos: 0 },
      pagos: { total: backup.pagos.length, nuevos: 0, duplicados: 0, invalidos: 0 },
      asistencias: { total: backup.asistencias.length, nuevos: 0, duplicados: 0, invalidos: 0 },
    };

    backup.alumnos.forEach((record) => {
      const id = normalizeBackupId(record.id);
      const name = normalizeTextKey(record.nombre);
      const rfids = [
        normalizeRfidKey(record.rfid),
        ...(Array.isArray(record.rfids)
          ? record.rfids.map(normalizeRfidKey)
          : []),
      ].filter(Boolean);

      if (!id || !name) {
        preview.alumnos.invalidos += 1;
        return;
      }

      if (
        studentIds.has(id) ||
        studentNames.has(name) ||
        rfids.some((rfid) => studentRfids.has(rfid))
      ) {
        preview.alumnos.duplicados += 1;
        return;
      }

      studentIds.add(id);
      studentNames.add(name);
      rfids.forEach((rfid) => studentRfids.add(rfid));
      newRecords.alumnos.push({ ...record, id });
      preview.alumnos.nuevos += 1;
    });

    backup.pagos.forEach((record) => {
      const id = normalizeBackupId(record.id);
      const studentId = normalizeBackupId(record.alumnoId);
      const period = String(record.periodo || "");
      const key = `${studentId}|${period}`;

      if (!id || !studentId || !/^\d{4}-\d{2}$/.test(period) || !studentIds.has(studentId)) {
        preview.pagos.invalidos += 1;
        return;
      }

      if (paymentIds.has(id) || paymentKeys.has(key)) {
        preview.pagos.duplicados += 1;
        return;
      }

      paymentIds.add(id);
      paymentKeys.add(key);
      newRecords.pagos.push({ ...record, id });
      preview.pagos.nuevos += 1;
    });

    backup.asistencias.forEach((record) => {
      const id = normalizeBackupId(record.id);
      const studentId = normalizeBackupId(record.alumnoId);
      const date = new Date(String(record.fecha || ""));
      const day =
        Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
      const key = `${studentId}|${day}`;

      if (!id || !studentId || !day || !studentIds.has(studentId)) {
        preview.asistencias.invalidos += 1;
        return;
      }

      if (attendanceIds.has(id) || attendanceKeys.has(key)) {
        preview.asistencias.duplicados += 1;
        return;
      }

      attendanceIds.add(id);
      attendanceKeys.add(key);
      newRecords.asistencias.push({ ...record, id });
      preview.asistencias.nuevos += 1;
    });

    return { preview, newRecords };
  };

  const handleRestoreFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userSede) return;

    if (file.size > 15 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Archivo demasiado grande",
        description: "El respaldo no debe superar 15 MB.",
      });
      return;
    }

    try {
      setIsAnalyzingBackup(true);
      resetRestoreState();
      const parsed = JSON.parse(await file.text()) as Partial<AlbatrosBackup>;
      const rawSite =
        typeof parsed.sede === "string"
          ? parsed.sede.trim().toUpperCase().replace(/\s+/g, "_")
          : "";

      if (
        parsed.sistema !== "ALBATROS" ||
        !SEDES_VALIDAS.includes(rawSite as Sede) ||
        rawSite !== userSede ||
        !Array.isArray(parsed.alumnos) ||
        !Array.isArray(parsed.pagos) ||
        !Array.isArray(parsed.asistencias)
      ) {
        throw new Error(
          `Selecciona un respaldo ALBATROS correspondiente a la sede ${userSede}.`,
        );
      }

      const backup: AlbatrosBackup = {
        sistema: "ALBATROS",
        sede: userSede,
        generadoEn: parsed.generadoEn,
        version: parsed.version,
        alumnos: parsed.alumnos as BackupRecord[],
        pagos: parsed.pagos as BackupRecord[],
        asistencias: parsed.asistencias as BackupRecord[],
      };
      const { preview } = await prepareBackupRestore(backup);

      setRestoreFileName(file.name);
      setRestoreBackup(backup);
      setRestorePreview(preview);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Respaldo no válido",
        description:
          error instanceof Error ? error.message : "No se pudo leer el archivo.",
      });
    } finally {
      setIsAnalyzingBackup(false);
    }
  };

  const restoreSelectedBackup = async () => {
    if (
      !firestore ||
      !userSede ||
      !restoreBackup ||
      !restorePreview ||
      isRestoringBackup
    ) {
      return;
    }

    const selectedCount = (
      Object.keys(restoreSelection) as RestoreCategory[]
    ).reduce(
      (total, category) =>
        total +
        (restoreSelection[category] ? restorePreview[category].nuevos : 0),
      0,
    );

    if (
      selectedCount === 0 ||
      !window.confirm(
        `¿Restaurar ${selectedCount} registros nuevos en ${userSede}? Los registros existentes no se reemplazarán.`,
      )
    ) {
      return;
    }

    try {
      setIsRestoringBackup(true);
      // Se vuelve a analizar justo antes de escribir para evitar duplicados
      // creados por otra sesión después de abrir la vista previa.
      const { newRecords } = await prepareBackupRestore(restoreBackup);
      const restored: Record<RestoreCategory, number> = {
        alumnos: 0,
        pagos: 0,
        asistencias: 0,
      };
      const allowedStudentIds = new Set(
        (alumnos ?? []).map((student) => student.id),
      );

      if (restoreSelection.alumnos) {
        newRecords.alumnos.forEach((student) =>
          allowedStudentIds.add(student.id),
        );
      }

      for (const category of [
        "alumnos",
        "pagos",
        "asistencias",
      ] as RestoreCategory[]) {
        if (!restoreSelection[category]) continue;

        const collectionName = {
          alumnos: "Alumnos",
          pagos: "Pagos",
          asistencias: "Asistencias",
        }[category];
        const records =
          category === "alumnos"
            ? newRecords[category]
            : newRecords[category].filter((record) =>
                allowedStudentIds.has(
                  normalizeBackupId(record.alumnoId),
                ),
              );

        for (let start = 0; start < records.length; start += 350) {
          const batch = writeBatch(firestore);

          records.slice(start, start + 350).forEach((record) => {
            batch.set(
              doc(firestore, collectionName, record.id),
              sanitizeRestoreRecord(category, record),
            );
          });

          await batch.commit();
        }

        restored[category] = records.length;
      }

      void recordAdminAudit(auth, {
        sede: userSede,
        action: "crear",
        entity: "alumno",
        summary: `Se restauró el respaldo ${restoreFileName}.`,
        details: {
          archivo: restoreFileName,
          alumnos: restored.alumnos,
          pagos: restored.pagos,
          asistencias: restored.asistencias,
        },
      });

      toast({
        title: "Restauración completada",
        description: `${restored.alumnos} alumnos, ${restored.pagos} pagos y ${restored.asistencias} asistencias recuperados.`,
      });
      setIsRestoreDialogOpen(false);
      resetRestoreState();
    } catch (error) {
      console.error("No se pudo restaurar el respaldo:", error);
      toast({
        variant: "destructive",
        title: "Restauración incompleta",
        description:
          error instanceof Error
            ? error.message
            : "No se pudieron recuperar los registros.",
      });
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const obtenerFechaPago = (pago: Pago) => {
    const fecha = pago.fecha?.toDate
      ? pago.fecha.toDate()
      : new Date(pago.fecha);

    return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
  };

  const imprimirRecibo = (pago: Pago) => {
    const escaparHtml = (valor: unknown) =>
      String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const fecha = obtenerFechaPago(pago);
    const ventana = window.open("", "_blank", "width=720,height=760");

    if (!ventana) {
      toast({
        variant: "destructive",
        title: "Ventana bloqueada",
        description:
          "Permite las ventanas emergentes para imprimir o guardar el recibo.",
      });
      return;
    }

    ventana.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Recibo ${escaparHtml(pago.id)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; color: #111; }
            .receipt { max-width: 620px; margin: 32px auto; padding: 32px; border: 2px solid #111; }
            .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 20px; }
            h1 { margin: 0; font-size: 28px; }
            .muted { color: #666; font-size: 12px; }
            .folio { text-align: right; font-size: 12px; }
            .paid { margin: 28px 0; font-size: 38px; font-weight: 800; color: #17803d; }
            .row { display: flex; justify-content: space-between; gap: 24px; padding: 12px 0; border-bottom: 1px solid #ddd; }
            .label { color: #666; }
            .footer { margin-top: 28px; text-align: center; font-size: 11px; color: #666; }
            @media print { .receipt { margin: 0 auto; border: 0; } }
          </style>
        </head>
        <body>
          <main class="receipt">
            <div class="header">
              <div>
                <h1>ALBATROS</h1>
                <div class="muted">Centro de Alto Rendimiento · ${escaparHtml(
                  pago.sede.replace("_", " "),
                )}</div>
              </div>
              <div class="folio">
                <strong>RECIBO DE PAGO</strong><br />
                Folio: ${escaparHtml(pago.id.toUpperCase())}
              </div>
            </div>
            <div class="paid">$${escaparHtml(
              Number(pago.monto || 0).toLocaleString("es-MX"),
            )}</div>
            <div class="row"><span class="label">Alumno</span><strong>${escaparHtml(
              pago.nombre,
            )}</strong></div>
            <div class="row"><span class="label">Periodo</span><strong>${escaparHtml(
              pago.periodo,
            )}</strong></div>
            <div class="row"><span class="label">Método</span><strong>${escaparHtml(
              pago.metodoPago,
            )}</strong></div>
            <div class="row"><span class="label">Fecha</span><strong>${escaparHtml(
              format(fecha, "dd/MM/yyyy", { locale: es }),
            )}</strong></div>
            <p class="footer">Comprobante interno generado por el sistema ALBATROS.</p>
          </main>
          <script>window.addEventListener('load', () => window.print());</script>
        </body>
      </html>
    `);
    ventana.document.close();
  };

  const enviarReciboWhatsApp = (pago: Pago) => {
    const alumno = (alumnos ?? []).find(
      (registro) => registro.id === pago.alumnoId,
    );

    if (!alumno) return;

    let telefono = String(alumno.telefono || "").replace(/\D/g, "");

    if (telefono.length === 10) telefono = `52${telefono}`;
    if (telefono.length === 13 && telefono.startsWith("521")) {
      telefono = `52${telefono.slice(3)}`;
    }

    if (!telefono) {
      toast({
        variant: "destructive",
        title: "Sin teléfono",
        description: `${pago.nombre} no tiene teléfono registrado.`,
      });
      return;
    }

    const mensaje =
      `ALBATROS confirma el pago de ${pago.nombre}.\n\n` +
      `Monto: $${Number(pago.monto || 0).toLocaleString("es-MX")}\n` +
      `Periodo: ${pago.periodo}\n` +
      `Método: ${pago.metodoPago}\n` +
      `Fecha: ${format(obtenerFechaPago(pago), "dd/MM/yyyy", { locale: es })}\n` +
      `Folio: ${pago.id.toUpperCase()}`;

    window.open(
      `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const cargarComparacionMensual = async () => {
    if (!firestore || !userSede || isLoadingMonthlyComparison) return;

    setIsMonthlyComparisonOpen(true);

    try {
      setIsLoadingMonthlyComparison(true);

      const [pagosSnapshot, asistenciasSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(firestore, "Pagos"),
            where("sede", "==", userSede),
          ),
        ),
        getDocs(
          query(
            collection(firestore, "Asistencias"),
            where("sede", "==", userSede),
          ),
        ),
      ]);
      const meses = Array.from({ length: 6 }, (_, indice) => {
        const fecha = new Date();
        fecha.setDate(1);
        fecha.setMonth(fecha.getMonth() - (5 - indice));

        return {
          periodo: format(fecha, "yyyy-MM"),
          etiqueta: format(fecha, "MMM yyyy", { locale: es }),
        };
      });
      const pagos = pagosSnapshot.docs.map((documento) => documento.data());
      const asistenciasHistoricas = asistenciasSnapshot.docs.map(
        (documento) => documento.data(),
      );
      const comparacion = meses.map((mes) => {
        const recaudacionMes = pagos
          .filter(
            (pago) =>
              pago.periodo === mes.periodo ||
              obtenerPeriodoFecha(pago.fecha) === mes.periodo,
          )
          .reduce(
            (total, pago) => total + (Number(pago.monto) || 0),
            0,
          );
        const asistenciasUnicas = new Set(
          asistenciasHistoricas
            .filter(
              (asistencia) =>
                obtenerPeriodoFecha(asistencia.fecha) === mes.periodo,
            )
            .map((asistencia) => {
              const fecha = asistencia.fecha?.toDate
                ? asistencia.fecha.toDate()
                : new Date(asistencia.fecha);

              return `${asistencia.alumnoId}-${format(fecha, "yyyy-MM-dd")}`;
            }),
        ).size;
        const nuevosAlumnos = (alumnos ?? []).filter(
          (alumno) =>
            obtenerPeriodoFecha(alumno.fechaRegistro) === mes.periodo,
        ).length;

        return {
          ...mes,
          recaudacion: recaudacionMes,
          asistencias: asistenciasUnicas,
          nuevosAlumnos,
        };
      });

      setMonthlyComparison(comparacion);
    } catch (error: unknown) {
      console.error("No se pudo cargar la comparación mensual:", error);
      toast({
        variant: "destructive",
        title: "No se pudo comparar",
        description:
          error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setIsLoadingMonthlyComparison(false);
    }
  };
  const maxRecaudacionComparacion = Math.max(
    1,
    ...monthlyComparison.map((mes) => mes.recaudacion),
  );
  const maxAsistenciasComparacion = Math.max(
    1,
    ...monthlyComparison.map((mes) => mes.asistencias),
  );
  const nuevosAlumnosMesActual = (alumnos ?? []).filter(
    (alumno) => obtenerPeriodoFecha(alumno.fechaRegistro) === periodoActual,
  ).length;
  const calcularVariacion = (actual: number, anterior: number) => {
    if (anterior === 0) return actual === 0 ? 0 : 100;

    return ((actual - anterior) / anterior) * 100;
  };
  const indicadoresComparativos = previousMonthMetrics
    ? [
        {
          id: "recaudacion",
          label: "Recaudación",
          actual: recaudacion,
          anterior: previousMonthMetrics.recaudacion,
          formato: (valor: number) => `$${valor.toLocaleString("es-MX")}`,
          menorEsMejor: false,
        },
        {
          id: "asistencias",
          label: "Asistencias",
          actual: asistenciasUnicasMes,
          anterior: previousMonthMetrics.asistencias,
          formato: (valor: number) => valor.toLocaleString("es-MX"),
          menorEsMejor: false,
        },
        {
          id: "nuevos",
          label: "Alumnos nuevos",
          actual: nuevosAlumnosMesActual,
          anterior: previousMonthMetrics.nuevosAlumnos,
          formato: (valor: number) => valor.toLocaleString("es-MX"),
          menorEsMejor: false,
        },
        {
          id: "morosidad",
          label: "Morosidad",
          actual: totalRetrasos,
          anterior: previousMonthMetrics.morosos,
          formato: (valor: number) => valor.toLocaleString("es-MX"),
          menorEsMejor: true,
        },
      ]
    : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-primary border-primary/20 bg-primary/5 flex gap-1 items-center font-black italic text-[11px]"
            >
              <MapPin className="h-3 w-3" />
              SEDE: {userSede || "..."}
            </Badge>
          </div>

          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-primary">
            Gestión Administración
          </h1>

          <p className="text-muted-foreground">
            Control táctico del equipo Albatros BJJ.
          </p>
        </div>

        <div className="flex items-center gap-3">
  <Dialog
    open={isAddDialogOpen}
    onOpenChange={setIsAddDialogOpen}
  >
    <DialogTrigger asChild>
      <Button className="font-bold uppercase tracking-widest">
        <Plus className="mr-2 h-4 w-4" />
        Nuevo Atleta
      </Button>
    </DialogTrigger>

    <DialogContent className="max-h-[92vh] overflow-y-auto bg-card sm:max-w-[760px] border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic">
                Registrar Nuevo Atleta
              </DialogTitle>

              <DialogDescription>
                El alumno se guardará en la sede{" "}
                <strong>{userSede || "..."}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-4">
              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-primary">
                  Datos personales y acceso
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre Completo</Label>

                <Input
                  id="name"
                  value={newStudent.nombre}
                  onChange={(event) =>
                    setNewStudent({
                      ...newStudent,
                      nombre: event.target.value,
                    })
                  }
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={newStudent.telefono}
                  onChange={(event) =>
                    setNewStudent({
                      ...newStudent,
                      telefono: event.target.value,
                    })
                  }
                  placeholder="999 000 0000"
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="rfid" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Código RFID
                </Label>

                <div className="flex gap-2">
                  <Input
                    id="rfid"
                    value={newStudent.rfid}
                    onChange={(event) =>
                      setNewStudent({
                        ...newStudent,
                        rfid: event.target.value,
                      })
                    }
                    placeholder="UID manual o vinculación"
                    className="bg-background/50 font-mono text-xs"
                  />

                </div>
              </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-primary">
                  Progreso deportivo
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="new-discipline">Disciplina</Label>
                  <Input
                    id="new-discipline"
                    list="new-disciplines-albatros"
                    value={newStudent.disciplina}
                    onChange={(event) =>
                      setNewStudent({
                        ...newStudent,
                        disciplina: event.target.value,
                      })
                    }
                    placeholder="Selecciona o escribe una disciplina"
                  />
                  <datalist id="new-disciplines-albatros">
                    {DISCIPLINAS_ALBATROS.map((disciplina) => (
                      <option key={disciplina} value={disciplina} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-grade">Grado / nivel</Label>
                  <Input
                    id="new-grade"
                    value={newStudent.grado}
                    onChange={(event) =>
                      setNewStudent({
                        ...newStudent,
                        grado: event.target.value,
                      })
                    }
                    placeholder="Cinta blanca, intermedio..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-promotion">Última promoción</Label>
                  <Input
                    id="new-promotion"
                    type="date"
                    value={newStudent.fechaPromocion}
                    onChange={(event) =>
                      setNewStudent({
                        ...newStudent,
                        fechaPromocion: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-goal">Objetivo</Label>
                  <Input
                    id="new-goal"
                    value={newStudent.objetivo}
                    onChange={(event) =>
                      setNewStudent({
                        ...newStudent,
                        objetivo: event.target.value,
                      })
                    }
                    placeholder="Competir, bajar de peso..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-weight">Peso actual (kg)</Label>
                  <Input id="new-weight" type="number" min="0" step="0.1" value={newStudent.pesoActual} onChange={(event) => setNewStudent({ ...newStudent, pesoActual: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-target-weight">Peso objetivo (kg)</Label>
                  <Input id="new-target-weight" type="number" min="0" step="0.1" value={newStudent.pesoObjetivo} onChange={(event) => setNewStudent({ ...newStudent, pesoObjetivo: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-competition">Próxima competencia</Label>
                  <Input id="new-competition" value={newStudent.proximaCompetencia} onChange={(event) => setNewStudent({ ...newStudent, proximaCompetencia: event.target.value })} placeholder="Nombre del torneo" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-competition-date">Fecha de competencia</Label>
                  <Input id="new-competition-date" type="date" value={newStudent.fechaCompetencia} onChange={(event) => setNewStudent({ ...newStudent, fechaCompetencia: event.target.value })} />
                </div>
              </div>
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-primary">
                  Pago y afiliación
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2"><Label htmlFor="payday">Día de Pago</Label><Input id="payday" type="number" min="1" max="31" value={newStudent.diaPago} onChange={(event) => setNewStudent({ ...newStudent, diaPago: event.target.value })} /></div>
                  <div className="grid gap-2"><Label htmlFor="amount">Monto Pago ($)</Label><Input id="amount" type="number" min="0" value={newStudent.montoPago} onChange={(event) => setNewStudent({ ...newStudent, montoPago: event.target.value })} /></div>
                  <div className="grid gap-2"><Label htmlFor="discount">Descuento ($)</Label><Input id="discount" type="number" min="0" value={newStudent.descuento} onChange={(event) => setNewStudent({ ...newStudent, descuento: event.target.value })} /></div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Estado Inicial</Label>
                    <Select value={newStudent.estadoPago} onValueChange={(value: PaymentStatus) => setNewStudent({ ...newStudent, estadoPago: value })}>
                      <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Falta de Pago">Pendiente</SelectItem><SelectItem value="Pagado">Pagado</SelectItem><SelectItem value="Retraso">Retraso</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 flex items-center space-x-2">
                <Checkbox
                  id="affiliate"
                  checked={newStudent.esAfiliado}
                  onCheckedChange={(checked) =>
                    setNewStudent({
                      ...newStudent,
                      esAfiliado: checked === true,
                    })
                  }
                />

                <Label htmlFor="affiliate" className="cursor-pointer">
                  ¿Es afiliado Albatros?
                </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                className="w-full font-bold uppercase"
                disabled={isSavingStudent || !firestore || !userSede}
                onClick={() => {
                  void handleAddStudent();
                }}
              >
                {isSavingStudent ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Registro"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">
              Atletas ({userSede})
            </CardTitle>

            <div className="flex items-center gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 hover:bg-primary/10",
                    totalAlertasDatos > 0
                      ? "text-amber-500 hover:text-amber-500"
                      : "text-primary hover:text-primary",
                  )}
                  title="Revisar calidad de datos"
                  aria-label="Revisar calidad de datos"
                >
                  {totalAlertasDatos > 0 ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Auditoría de datos de alumnos</DialogTitle>
                  <DialogDescription>
                    Revisión de posibles duplicados y datos faltantes en{" "}
                    {userSede?.replace("_", " ") || "la sede actual"}. No se
                    modifica ningún registro.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-black text-amber-500">
                      {auditoriaDatos.nombresDuplicados.length}
                    </p>
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Nombres repetidos
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-black text-red-500">
                      {auditoriaDatos.rfidsDuplicados.length}
                    </p>
                    <p className="text-[11px] uppercase text-muted-foreground">
                      RFID repetidos
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-black text-blue-500">
                      {auditoriaDatos.sinTelefono.length}
                    </p>
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Sin teléfono
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-black text-purple-500">
                      {auditoriaDatos.sinRfid.length}
                    </p>
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Sin RFID
                    </p>
                  </div>
                </div>

                {totalAlertasDatos === 0 ? (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center font-bold text-green-500">
                    No se encontraron problemas en los registros.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[50vh] pr-4">
                    <div className="space-y-4">
                      {auditoriaDatos.rfidsDuplicados.map((grupo) => (
                        <div
                          key={`rfid-${grupo.rfid}`}
                          className="rounded-lg border border-red-500/20 bg-red-500/5 p-3"
                        >
                          <p className="text-xs font-black text-red-500">
                            RFID repetido: {grupo.rfid}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {grupo.alumnos
                              .map((alumno) => alumno.nombre)
                              .join(", ")}
                          </p>
                        </div>
                      ))}

                      {auditoriaDatos.nombresDuplicados.map((grupo) => (
                        <div
                          key={`nombre-${grupo.clave}`}
                          className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                        >
                          <p className="text-xs font-black text-amber-500">
                            Posible nombre duplicado
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {grupo.alumnos
                              .map((alumno) => alumno.nombre)
                              .join(", ")}
                          </p>
                        </div>
                      ))}

                      {auditoriaDatos.sinTelefono.length > 0 && (
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-black">Sin teléfono</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {auditoriaDatos.sinTelefono
                              .map((alumno) => alumno.nombre)
                              .join(", ")}
                          </p>
                        </div>
                      )}

                      {auditoriaDatos.sinRfid.length > 0 && (
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-black">
                            Sin tarjeta RFID
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {auditoriaDatos.sinRfid
                              .map((alumno) => alumno.nombre)
                              .join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </DialogContent>
            </Dialog>
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-black tracking-tighter">
              {isLoading ? "..." : totalAlumnos}
            </div>
            {!isLoading && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {alumnosInactivos.length}{" "}
                {alumnosInactivos.length === 1 ? "inactivo" : "inactivos"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-yellow-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">
              Próximos pagos
            </CardTitle>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                  title="Ver pagos próximos"
                  aria-label="Ver pagos próximos"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-yellow-500">
                    <Clock className="h-5 w-5" />
                    Pagos próximos
                  </DialogTitle>
                  <DialogDescription>
                    Alumnos de la sede{" "}
                    {userSede?.replace("_", " ") || "actual"} cuyo pago
                    vence entre hoy y los próximos cuatro días.
                  </DialogDescription>
                </DialogHeader>

                {alumnosProximosPago.length === 0 ? (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center">
                    <p className="font-bold text-green-500">
                      No hay pagos próximos.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-3">
                      {alumnosProximosPago.map((alumno) => {
                        const diasRestantes =
                          Number(alumno.diaPago || 1) - todayDay;

                        return (
                          <div
                            key={alumno.id}
                            className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black uppercase">
                                  {alumno.nombre}
                                </p>
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {alumno.telefono || "Sin teléfono"}
                                </p>
                              </div>

                              <Badge
                                variant="outline"
                                className="shrink-0 border-yellow-500/40 text-yellow-500"
                              >
                                {diasRestantes === 0
                                  ? "Vence hoy"
                                  : diasRestantes === 1
                                    ? "Vence mañana"
                                    : `Faltan ${diasRestantes} días`}
                              </Badge>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-yellow-500/10 pt-3">
                              <span className="font-black text-yellow-600 dark:text-yellow-400">
                                $
                                {Number(
                                  alumno.montoPago || 0,
                                ).toLocaleString("es-MX")}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-green-500/30 text-green-600 hover:bg-green-500/10 dark:text-green-400"
                                disabled={!alumno.telefono}
                                onClick={() =>
                                  abrirWhatsApp(alumno, "proximo")
                                }
                              >
                                <Phone className="mr-2 h-3.5 w-3.5" />
                                WhatsApp
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-yellow-500">
              {isLoading ? "..." : alumnosProximosPago.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">
              Asistencias Totales (Mes)
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                onClick={handleResetMonthlyAttendance}
                title="Reiniciar asistencias del mes"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary hover:bg-primary/10 hover:text-primary"
                    title="Ver reporte mensual de asistencias"
                    aria-label="Ver reporte mensual de asistencias"
                  >
                    <CalendarCheck className="h-4 w-4" />
                  </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Reporte mensual de asistencias</DialogTitle>
                    <DialogDescription>
                      Periodo {periodoActual} ·{" "}
                      {userSede?.replace("_", " ") || "Sede actual"}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs font-bold uppercase text-primary">
                        Registros
                      </p>
                      <p className="mt-1 text-xl font-black">
                        {asistenciasUnicasMes}
                      </p>
                    </div>
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                      <p className="text-xs font-bold uppercase text-blue-500">
                        Promedio
                      </p>
                      <p className="mt-1 text-xl font-black text-blue-500">
                        {promedioAsistencia.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-xs font-bold uppercase text-amber-500">
                        Sin asistencia
                      </p>
                      <p className="mt-1 text-xl font-black text-amber-500">
                        {alumnosSinAsistencia}
                      </p>
                    </div>
                  </div>

                  {rankingAsistencia.length > 0 && (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                      <p className="mb-3 text-xs font-black uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
                        Ranking de asistencia
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {rankingAsistencia.map((alumno, index) => (
                          <div
                            key={alumno.id}
                            className="flex items-center gap-3 rounded-md border border-yellow-500/10 bg-background/60 p-3"
                          >
                            <span
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black",
                                index === 0
                                  ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                  : index === 1
                                    ? "bg-slate-400/20 text-slate-500"
                                    : "bg-orange-500/20 text-orange-600",
                              )}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">
                                {alumno.nombre}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {alumno.asistencias} asistencias
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reporteAsistenciasMes.length === 0 ? (
                    <div className="rounded-lg border p-6 text-center text-muted-foreground">
                      No hay alumnos registrados en esta sede.
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[48vh] pr-4">
                      <div className="space-y-2">
                        {reporteAsistenciasMes.map((alumno) => (
                          <div
                            key={alumno.id}
                            className="rounded-lg border border-primary/10 p-3"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate font-bold">
                                  {alumno.nombre}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {alumno.asistencias === 1
                                    ? "1 día asistido"
                                    : `${alumno.asistencias} días asistidos`}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "shrink-0",
                                  alumno.asistencias === 0
                                    ? "border-destructive/40 text-destructive"
                                    : "border-green-500/40 text-green-500",
                                )}
                              >
                                {Math.round(alumno.porcentaje)}%
                              </Badge>
                            </div>
                            <Progress
                              className="mt-3 h-1.5"
                              value={alumno.porcentaje}
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={descargarReporteAsistencias}
                      disabled={reporteAsistenciasMes.length === 0}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Descargar CSV
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-black tracking-tighter">
              {isLoading ? "..." : asistenciasUnicasMes}
            </div>
            {!isLoading && rankingAsistencia[0] && (
              <p
                className="mt-1 truncate text-[11px] text-muted-foreground"
                title={rankingAsistencia[0].nombre}
              >
                Líder:{" "}
                <strong className="text-primary">
                  {rankingAsistencia[0].nombre}
                </strong>{" "}
                ({rankingAsistencia[0].asistencias})
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">
              Asistencias de hoy
            </CardTitle>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-blue-500 hover:text-blue-500 hover:bg-blue-500/10"
                  title="Ver asistencias de hoy"
                  aria-label="Ver asistencias de hoy"
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-blue-500">
                    <CalendarDays className="h-5 w-5" />
                    Asistencias de hoy
                  </DialogTitle>
                  <DialogDescription>
                    Entradas registradas hoy en la sede{" "}
                    {userSede?.replace("_", " ") || "actual"}.
                  </DialogDescription>
                </DialogHeader>

                {asistenciasHoy.length === 0 ? (
                  <div className="rounded-lg border border-muted p-6 text-center">
                    <p className="font-bold text-muted-foreground">
                      Todavía no hay asistencias registradas hoy.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-2">
                      {asistenciasHoy.map(({ alumno, fecha }) => (
                        <div
                          key={alumno.id}
                          className="flex items-center justify-between gap-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4"
                        >
                          <div>
                            <p className="font-black uppercase">
                              {alumno.nombre}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {alumno.telefono || "Sin teléfono"}
                            </p>
                          </div>

                          <Badge
                            variant="outline"
                            className="shrink-0 border-blue-500/40 text-blue-500"
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            {format(fecha, "h:mm a", {
                              locale: es,
                            })}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-blue-500">
              {isLoading ? "..." : asistenciasHoy.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">
              Recaudación
            </CardTitle>

            <div className="flex items-center gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary hover:bg-primary/10 hover:text-primary"
                  title="Ver reporte mensual de pagos"
                  aria-label="Ver reporte mensual de pagos"
                >
                  <DollarSign className="h-4 w-4" />
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Reporte de pagos del mes</DialogTitle>
                  <DialogDescription>
                    Periodo {periodoActual} ·{" "}
                    {userSede?.replace("_", " ") || "Sede actual"}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-xs font-bold uppercase text-red-500">
                      Estimada
                    </p>
                    <p className="mt-1 text-xl font-black text-red-500">
                      ${recaudacionEstimada.toLocaleString("es-MX")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                    <p className="text-xs font-bold uppercase text-green-500">
                      Efectiva
                    </p>
                    <p className="mt-1 text-xl font-black text-green-500">
                      ${recaudacion.toLocaleString("es-MX")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs font-bold uppercase text-amber-500">
                      Pendiente
                    </p>
                    <p className="mt-1 text-xl font-black text-amber-500">
                      ${recaudacionPendiente.toLocaleString("es-MX")}
                    </p>
                  </div>
                </div>

                {pagosReporteMes.length === 0 ? (
                  <div className="rounded-lg border p-6 text-center text-muted-foreground">
                    Todavía no hay pagos registrados en este periodo.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[48vh] pr-4">
                    <div className="space-y-2">
                      {pagosReporteMes.map((pago) => (
                        <div
                          key={pago.id}
                          className="flex items-center justify-between gap-4 rounded-lg border border-primary/10 p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold">{pago.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {pago.metodo} ·{" "}
                              {pago.fecha
                                ? format(pago.fecha, "dd/MM/yyyy", {
                                    locale: es,
                                  })
                                : "Sin fecha"}
                            </p>
                          </div>
                          <span className="shrink-0 font-black text-green-500">
                            ${pago.monto.toLocaleString("es-MX")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    onClick={descargarReportePagos}
                    disabled={pagosReporteMes.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar CSV
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-500 hover:bg-blue-500/10 hover:text-blue-500"
                title="Comparar últimos seis meses"
                aria-label="Comparar últimos seis meses"
                onClick={() => void cargarComparacionMensual()}
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-red-500">
                  Estimada
                </p>
                <p className="mt-1 text-xl font-black tracking-tighter text-red-500">
                  ${recaudacionEstimada.toLocaleString("es-MX")}
                </p>
              </div>

              <div className="border-l border-primary/10 pl-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-green-500">
                  Efectiva
                </p>
                <p className="mt-1 text-xl font-black tracking-tighter text-green-500">
                  ${recaudacion.toLocaleString("es-MX")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">
              Retrasos
            </CardTitle>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Ver alumnos con retraso de pago"
                  aria-label="Ver alumnos con retraso de pago"
                >
                  <AlertCircle className="h-4 w-4" />
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Alumnos con retraso
                  </DialogTitle>
                  <DialogDescription>
                    Morosos de la sede{" "}
                    {userSede?.replace("_", " ") || "actual"}. Adeudo
                    acumulado:{" "}
                    <strong className="text-destructive">
                      ${totalAdeudoMorosos.toLocaleString("es-MX")}
                    </strong>
                  </DialogDescription>
                </DialogHeader>

                {alumnosMorosos.length === 0 ? (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center">
                    <p className="font-bold text-green-500">
                      No hay alumnos con pagos atrasados.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-3">
                      {alumnosMorosos.map((alumno) => {
                        const adeudo = adeudosMorosos.get(alumno.id) || {
                          meses: 1,
                          total: Number(alumno.montoPago) || 0,
                        };

                        return (
                          <div
                            key={alumno.id}
                            className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"
                          >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black uppercase">
                                {alumno.nombre}
                              </p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {alumno.telefono || "Sin teléfono"}
                              </p>
                            </div>

                            <Badge
                              variant="outline"
                              className="shrink-0 border-destructive/40 text-destructive"
                            >
                              Día {alumno.diaPago}
                            </Badge>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-destructive/10 pt-3 text-sm">
                            <div>
                              <span className="block text-muted-foreground">
                                {adeudo.meses === 1
                                  ? "1 mensualidad pendiente"
                                  : `${adeudo.meses} mensualidades pendientes`}
                              </span>
                              <span className="font-black text-destructive">
                                $
                                {adeudo.total.toLocaleString("es-MX")}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                (${Number(
                                  alumno.montoPago || 0,
                                ).toLocaleString("es-MX")}{" "}
                                al mes)
                              </span>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-500/30 text-green-600 hover:bg-green-500/10 dark:text-green-400"
                              disabled={!alumno.telefono}
                              onClick={() =>
                                abrirWhatsApp(alumno, "retraso")
                              }
                            >
                              <Phone className="mr-2 h-3.5 w-3.5" />
                              WhatsApp
                            </Button>
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-destructive">
              {isLoading ? "..." : totalRetrasos}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-primary/10 bg-card/40">
        <CardHeader className="border-b border-primary/10 bg-secondary/15 p-0">
          <button
            type="button"
            className="group flex w-full items-center justify-between gap-4 p-6 pb-4 text-left transition-colors hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            aria-expanded={isPreviousMonthExpanded}
            aria-controls="previous-month-performance"
            onClick={() => setIsPreviousMonthExpanded((expanded) => !expanded)}
          >
            <div>
              <CardTitle className="text-sm font-black uppercase italic tracking-wide">
                Rendimiento frente al mes anterior
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Mes actual comparado con{" "}
                {previousMonthMetrics?.etiqueta || "el periodo anterior"}.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {previousMonthMetrics && (
                <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                  {previousMonthMetrics.periodo}
                </Badge>
              )}
              <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/10 bg-background/50 text-muted-foreground transition-colors group-hover:text-foreground">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-300 ease-out",
                    isPreviousMonthExpanded && "rotate-180",
                  )}
                />
              </span>
            </div>
          </button>
        </CardHeader>
        <div
          id="previous-month-performance"
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            isPreviousMonthExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <CardContent className="p-4">
              {isLoadingPreviousMonth ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[...Array(4)].map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : indicadoresComparativos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-primary/15 py-8 text-center text-sm text-muted-foreground">
                  No fue posible cargar los datos del mes anterior.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {indicadoresComparativos.map((indicador) => {
                    const variacion = calcularVariacion(
                      indicador.actual,
                      indicador.anterior,
                    );
                    const subio = variacion > 0;
                    const bajo = variacion < 0;
                    const mejoro = indicador.menorEsMejor ? bajo : subio;
                    const empeoro = indicador.menorEsMejor ? subio : bajo;

                    return (
                      <div
                        key={indicador.id}
                        className="rounded-xl border border-primary/10 bg-background/35 p-4"
                      >
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          {indicador.label}
                        </p>
                        <div className="mt-2 flex items-end justify-between gap-3">
                          <p className="text-2xl font-black tracking-tighter">
                            {indicador.formato(indicador.actual)}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 text-[10px]",
                              mejoro &&
                                "border-green-500/30 bg-green-500/10 text-green-500",
                              empeoro &&
                                "border-destructive/30 bg-destructive/10 text-destructive",
                              !mejoro &&
                                !empeoro &&
                                "border-muted text-muted-foreground",
                            )}
                          >
                            {subio ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : bajo ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              <span aria-hidden="true">—</span>
                            )}
                            {Math.abs(variacion).toFixed(0)}%
                          </Badge>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Anterior: {indicador.formato(indicador.anterior)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </div>
        </div>
      </Card>

      <Card className="bg-card/40 border-primary/10">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-black uppercase italic">
              Base de Datos de Alumnos
            </CardTitle>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:justify-end">
              <Dialog
                open={isReminderDialogOpen}
                onOpenChange={(open) => {
                  setIsReminderDialogOpen(open);
                  if (open) {
                    changeReminderAudience("morosos");
                  } else {
                    setSelectedReminderIds([]);
                    setSentReminderIds([]);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 border-green-500/25 text-green-600 hover:bg-green-500/10 dark:text-green-400"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Recordatorios
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
                      <MessageCircle className="h-5 w-5 text-green-500" />
                      Recordatorios de pago
                    </DialogTitle>
                    <DialogDescription>
                      Prepara la lista y abre cada conversación en WhatsApp. El
                      envío es guiado para mantenerlo gratuito y evitar bloqueos.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5 py-2">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label>Grupo de alumnos</Label>
                        <Select
                          value={reminderAudience}
                          onValueChange={(value) =>
                            changeReminderAudience(value as ReminderAudience)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morosos">
                              Morosos ({alumnosMorosos.length})
                            </SelectItem>
                            <SelectItem value="proximos">
                              Próximos a vencer ({alumnosProximosPago.length})
                            </SelectItem>
                            <SelectItem value="pendientes">
                              Todos los pendientes (
                              {
                                alumnosActivos.filter(
                                  (alumno) =>
                                    getAutomaticStatus(alumno) !== "Pagado",
                                ).length
                              }
                              )
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedReminderIds(
                              reminderCandidates
                                .filter((alumno) =>
                                  Boolean(
                                    normalizarTelefonoWhatsApp(
                                      alumno.telefono,
                                    ),
                                  ),
                                )
                                .map((alumno) => alumno.id),
                            )
                          }
                        >
                          Seleccionar todos
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReminderIds([])}
                        >
                          Limpiar
                        </Button>
                      </div>
                    </div>

                    {reminderCandidates[0] && (
                      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-green-600 dark:text-green-400">
                          Mensaje prediseñado
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {crearMensajeRecordatorio(
                            reminderCandidates[0],
                            reminderType,
                          )}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          El nombre, monto y fecha se personalizan para cada
                          alumno.
                        </p>
                      </div>
                    )}

                    {reminderCandidates.length === 0 ? (
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-6 text-center">
                        <CheckCheck className="mx-auto mb-3 h-7 w-7 text-emerald-500" />
                        <p className="font-bold text-emerald-500">
                          No hay alumnos en este grupo.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[42vh] pr-3">
                        <div className="space-y-2">
                          {reminderCandidates.map((alumno) => {
                            const hasPhone = Boolean(
                              normalizarTelefonoWhatsApp(alumno.telefono),
                            );
                            const selected =
                              selectedReminderIds.includes(alumno.id);
                            const sent = sentReminderIds.includes(alumno.id);

                            return (
                              <div
                                key={alumno.id}
                                className={cn(
                                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                                  selected
                                    ? "border-green-500/30 bg-green-500/5"
                                    : "border-border/70",
                                  sent && "border-emerald-500/30",
                                )}
                              >
                                <Checkbox
                                  checked={selected}
                                  disabled={!hasPhone || sent}
                                  onCheckedChange={(checked) =>
                                    setSelectedReminderIds((previous) =>
                                      checked === true
                                        ? [...new Set([...previous, alumno.id])]
                                        : previous.filter(
                                            (id) => id !== alumno.id,
                                          ),
                                    )
                                  }
                                  aria-label={`Seleccionar a ${alumno.nombre}`}
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-black uppercase">
                                      {alumno.nombre}
                                    </p>
                                    {sent && (
                                      <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
                                        Abierto
                                      </Badge>
                                    )}
                                    {!hasPhone && (
                                      <Badge variant="destructive">
                                        Sin teléfono
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {alumno.telefono || "Sin número"} · Último:
                                    {" "}
                                    {formatLastReminder(
                                      alumno.ultimoRecordatorioPago,
                                    )}
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0 border-green-500/25 text-green-600 dark:text-green-400"
                                  disabled={!hasPhone || sent}
                                  onClick={async () => {
                                    const opened = await abrirWhatsApp(
                                      alumno,
                                      reminderType,
                                    );
                                    if (opened) {
                                      setSentReminderIds((previous) => [
                                        ...new Set([...previous, alumno.id]),
                                      ]);
                                    }
                                  }}
                                >
                                  <Send className="mr-2 h-3.5 w-3.5" />
                                  Abrir
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}

                    <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
                      WhatsApp no permite envíos masivos automáticos gratuitos.
                      “Abrir siguiente” recorre la selección uno por uno para
                      que revises y envíes cada mensaje.
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsReminderDialogOpen(false)}
                    >
                      Cerrar
                    </Button>
                    <Button
                      type="button"
                      className="bg-green-600 font-black uppercase hover:bg-green-700"
                      disabled={
                        pendingReminderStudents.length === 0 ||
                        isSendingReminder
                      }
                      onClick={() => void sendNextReminder()}
                    >
                      {isSendingReminder ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {pendingReminderStudents.length > 0
                        ? `Abrir siguiente (${pendingReminderStudents.length})`
                        : "Lista completada"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="hidden" aria-hidden="true">
              <Dialog
                open={isPeriodReportOpen}
                onOpenChange={setIsPeriodReportOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Reportes
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      Exportar por periodo
                    </DialogTitle>
                    <DialogDescription>
                      Genera un archivo CSV compatible con Excel para la sede{" "}
                      {userSede?.replace("_", " ") || "actual"}.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5 py-2">
                    <div className="space-y-2">
                      <Label>Contenido del reporte</Label>
                      <Select
                        value={periodReportType}
                        onValueChange={(value) =>
                          setPeriodReportType(value as PeriodReportType)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="resumen">
                            Resumen de pagos y asistencia
                          </SelectItem>
                          <SelectItem value="pagos">
                            Detalle de pagos
                          </SelectItem>
                          <SelectItem value="asistencias">
                            Detalle de asistencias
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="period-report-start">
                          Fecha inicial
                        </Label>
                        <Input
                          id="period-report-start"
                          type="date"
                          value={periodReportStart}
                          max={periodReportEnd}
                          onChange={(event) =>
                            setPeriodReportStart(event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="period-report-end">Fecha final</Label>
                        <Input
                          id="period-report-end"
                          type="date"
                          value={periodReportEnd}
                          min={periodReportStart}
                          onChange={(event) =>
                            setPeriodReportEnd(event.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
                      El resumen incluye el total pagado y los días únicos de
                      asistencia de cada alumno dentro del periodo.
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsPeriodReportOpen(false)}
                      disabled={isExportingPeriodReport}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      className="font-black uppercase"
                      disabled={
                        isExportingPeriodReport ||
                        !periodReportStart ||
                        !periodReportEnd
                      }
                      onClick={() => void exportarReportePorPeriodo()}
                    >
                      {isExportingPeriodReport ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {isExportingPeriodReport
                        ? "Generando..."
                        : "Descargar CSV"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isRestoreDialogOpen}
                onOpenChange={(open) => {
                  if (isRestoringBackup) return;
                  setIsRestoreDialogOpen(open);
                  if (!open) resetRestoreState();
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    title="Restaurar un respaldo de esta sede"
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    Restaurar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      Restaurar respaldo
                    </DialogTitle>
                    <DialogDescription>
                      Analiza el archivo antes de modificar la sede {userSede}.
                      Los registros existentes se omiten automáticamente.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5 py-2">
                    <Label
                      htmlFor="restore-backup-file"
                      className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-5 text-center transition-colors hover:bg-primary/10"
                    >
                      {isAnalyzingBackup ? (
                        <>
                          <Loader2 className="mb-3 h-7 w-7 animate-spin text-primary" />
                          <span className="font-black uppercase">
                            Analizando respaldo...
                          </span>
                        </>
                      ) : (
                        <>
                          <FileUp className="mb-3 h-7 w-7 text-primary" />
                          <span className="font-black uppercase">
                            Seleccionar archivo JSON
                          </span>
                          <span className="mt-1 text-xs font-normal text-muted-foreground">
                            Solo respaldos ALBATROS de {userSede} · máximo 15 MB
                          </span>
                        </>
                      )}
                    </Label>
                    <Input
                      id="restore-backup-file"
                      type="file"
                      accept=".json,application/json"
                      className="sr-only"
                      disabled={isAnalyzingBackup || isRestoringBackup}
                      onChange={(event) => void handleRestoreFile(event)}
                    />

                    {restorePreview && restoreBackup && (
                      <>
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                          <p className="truncate text-sm font-bold">
                            {restoreFileName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Respaldo de {restoreBackup.sede}
                            {restoreBackup.generadoEn
                              ? ` · ${new Intl.DateTimeFormat("es-MX", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }).format(new Date(restoreBackup.generadoEn))}`
                              : ""}
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          {(
                            [
                              ["alumnos", "Alumnos"],
                              ["pagos", "Pagos"],
                              ["asistencias", "Asistencias"],
                            ] as [RestoreCategory, string][]
                          ).map(([category, label]) => {
                            const item = restorePreview[category];

                            return (
                              <label
                                key={category}
                                className={cn(
                                  "cursor-pointer rounded-xl border p-4 transition-colors",
                                  restoreSelection[category]
                                    ? "border-primary/40 bg-primary/5"
                                    : "border-border bg-muted/20 opacity-70",
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-black uppercase">
                                    {label}
                                  </span>
                                  <Checkbox
                                    checked={restoreSelection[category]}
                                    onCheckedChange={(checked) =>
                                      setRestoreSelection((previous) => ({
                                        ...previous,
                                        [category]: checked === true,
                                      }))
                                    }
                                  />
                                </div>
                                <p className="mt-4 text-2xl font-black text-primary">
                                  {item.nuevos}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  registros nuevos
                                </p>
                                <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                                  <p>{item.duplicados} duplicados omitidos</p>
                                  <p>{item.invalidos} registros no válidos</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm">
                          <p className="font-bold text-emerald-500">
                            Restauración segura
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            No se sobrescribirá ningún alumno, pago o asistencia
                            existente. Puedes desmarcar las categorías que no
                            quieras recuperar.
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isRestoringBackup}
                      onClick={() => {
                        setIsRestoreDialogOpen(false);
                        resetRestoreState();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      className="font-black uppercase"
                      disabled={
                        !restorePreview ||
                        isAnalyzingBackup ||
                        isRestoringBackup ||
                        (
                          Object.keys(
                            restoreSelection,
                          ) as RestoreCategory[]
                        ).every(
                          (category) =>
                            !restoreSelection[category] ||
                            restorePreview[category].nuevos === 0,
                        )
                      }
                      onClick={() => void restoreSelectedBackup()}
                    >
                      {isRestoringBackup ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      {isRestoringBackup
                        ? "Restaurando..."
                        : "Confirmar restauración"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={isCreatingBackup}
                onClick={() => void descargarRespaldoSede()}
                title="Descargar respaldo completo de esta sede"
              >
                {isCreatingBackup ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isCreatingBackup ? "Preparando..." : "Respaldo"}
              </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="relative shrink-0"
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filtros
                    {[
                      studentActivityFilter !== "activos",
                      studentPaymentFilter !== "todos",
                      studentRfidFilter !== "todos",
                      studentSort !== "nombre-asc",
                    ].filter(Boolean).length > 0 && (
                      <Badge className="ml-2 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                        {
                          [
                            studentActivityFilter !== "activos",
                            studentPaymentFilter !== "todos",
                            studentRfidFilter !== "todos",
                            studentSort !== "nombre-asc",
                          ].filter(Boolean).length
                        }
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>

                <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
                  <div className="mb-4">
                    <p className="font-black uppercase tracking-wide">
                      Filtrar y ordenar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Combina uno o varios criterios.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Estado del alumno</Label>
                      <Select
                        value={studentActivityFilter}
                        onValueChange={(value) =>
                          setStudentActivityFilter(
                            value as "todos" | "activos" | "inactivos",
                          )
                        }
                      >
                        <SelectTrigger className="w-full bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="activos">Activos</SelectItem>
                          <SelectItem value="inactivos">Inactivos</SelectItem>
                          <SelectItem value="todos">Todos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Estado de pago</Label>
                      <Select
                        value={studentPaymentFilter}
                        onValueChange={(value) =>
                          setStudentPaymentFilter(
                            value as
                              | "todos"
                              | "pagado"
                              | "pendiente"
                              | "retraso",
                          )
                        }
                      >
                        <SelectTrigger className="w-full bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los pagos</SelectItem>
                          <SelectItem value="pagado">Pagados</SelectItem>
                          <SelectItem value="pendiente">Pendientes</SelectItem>
                          <SelectItem value="retraso">Con retraso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Tarjeta de acceso</Label>
                      <Select
                        value={studentRfidFilter}
                        onValueChange={(value) =>
                          setStudentRfidFilter(
                            value as "todos" | "con" | "sin",
                          )
                        }
                      >
                        <SelectTrigger className="w-full bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los RFID</SelectItem>
                          <SelectItem value="con">Con tarjeta</SelectItem>
                          <SelectItem value="sin">Sin tarjeta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border-t border-border/60 pt-4">
                      <div className="space-y-1.5">
                        <Label>Ordenar resultados</Label>
                        <Select
                          value={studentSort}
                          onValueChange={(value) =>
                            setStudentSort(value as StudentSort)
                          }
                        >
                          <SelectTrigger className="w-full bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nombre-asc">
                              Nombre: A–Z
                            </SelectItem>
                            <SelectItem value="nombre-desc">
                              Nombre: Z–A
                            </SelectItem>
                            <SelectItem value="pago-retrasos">
                              Pago: retrasos primero
                            </SelectItem>
                            <SelectItem value="pago-pagados">
                              Pago: pagados primero
                            </SelectItem>
                            <SelectItem value="asistencia-desc">
                              Asistencia: mayor primero
                            </SelectItem>
                            <SelectItem value="asistencia-asc">
                              Asistencia: menor primero
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          La asistencia corresponde al mes actual.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-4 w-full"
                    disabled={
                      studentActivityFilter === "activos" &&
                      studentPaymentFilter === "todos" &&
                      studentRfidFilter === "todos" &&
                      studentSort === "nombre-asc"
                    }
                    onClick={() => {
                      setStudentActivityFilter("activos");
                      setStudentPaymentFilter("todos");
                      setStudentRfidFilter("todos");
                      setStudentSort("nombre-asc");
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restablecer filtros y orden
                  </Button>
                </PopoverContent>
              </Popover>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, RFID o teléfono..."
                  className="bg-background/50 pl-8 border-primary/10"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              {selectedIds.length > 0 && (
                <div className="mb-3 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold">
                    {selectedIds.length}{" "}
                    {selectedIds.length === 1
                      ? "alumno seleccionado"
                      : "alumnos seleccionados"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUpdatingSelectedStudents}
                      onClick={() => void handleBulkStudentActivity(true)}
                    >
                      {isUpdatingSelectedStudents && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      Reactivar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10 hover:text-blue-500"
                      disabled={isUpdatingSelectedStudents}
                      onClick={() => void handleBulkStudentActivity(false)}
                    >
                      Dar de baja temporal
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isUpdatingSelectedStudents}
                      onClick={() => setSelectedIds([])}
                    >
                      Cancelar selección
                    </Button>
                  </div>
                </div>
              )}

              {/* Tarjetas para celular: mismas funciones, sin desplazamiento horizontal */}
              <div className="grid gap-4 md:hidden">
                {filteredAlumnos.map((alumno) => {
                  const attendance = attendanceDataMap[alumno.id] || {
                    count: 0,
                    history: [],
                  };
                  const attendanceCount = attendance.count;
                  const attendancePercent = Math.min(
                    (attendanceCount / 12) * 100,
                    100,
                  );
                  const currentlyLinking =
                    isLinking && linkingStudentId === alumno.id;
                  const studentRfids = alumno.rfids?.length
                    ? alumno.rfids
                    : alumno.rfid
                      ? [alumno.rfid]
                      : [];

                  return (
                    <Card
                      key={alumno.id}
                      className={cn(
                        "overflow-hidden border-primary/15 bg-background/45",
                        alumno.activo === false && "opacity-65",
                      )}
                    >
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="break-words text-left text-base font-black uppercase leading-tight hover:text-primary hover:underline underline-offset-4"
                              onClick={() => handleOpenStudentProfile(alumno)}
                            >
                              {alumno.nombre}
                            </button>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[11px] font-black italic"
                              >
                                {normalizarSede(alumno.sede)}
                              </Badge>
                              {alumno.activo === false && (
                                <Badge
                                  variant="outline"
                                  className="border-blue-500/40 text-[11px] text-blue-500"
                                >
                                  INACTIVO
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Checkbox
                            checked={selectedIds.includes(alumno.id)}
                            onCheckedChange={() => toggleSelection(alumno.id)}
                            aria-label={`Seleccionar a ${alumno.nombre}`}
                          />
                        </div>

                        <div className="rounded-lg border border-primary/10 bg-secondary/20 p-3">
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4 shrink-0 text-primary" />
                            {alumno.telefono || "Sin teléfono registrado"}
                          </p>
                          <div className="mt-2 space-y-1">
                            {studentRfids.length > 0 ? (
                              studentRfids.map((codigo) => (
                                <p
                                  key={codigo}
                                  className="flex items-center gap-2 break-all font-mono text-xs text-green-500"
                                >
                                  <CreditCard className="h-3.5 w-3.5 shrink-0" />
                                  RFID: {codigo}
                                </p>
                              ))
                            ) : (
                              <p className="flex items-center gap-2 text-xs italic text-destructive/70">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                Sin tarjeta vinculada
                              </p>
                            )}
                          </div>
                        </div>

                        <Select
                          value={getAutomaticStatus(alumno)}
                          disabled={alumno.activo === false}
                          onValueChange={(value: PaymentStatus) =>
                            handleUpdateStatus(alumno.id, value)
                          }
                        >
                          <SelectTrigger className="h-11 w-full bg-secondary/25">
                            {getStatusBadge(alumno)}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pagado">
                              Registrar pago
                            </SelectItem>
                            <SelectItem value="Falta de Pago">
                              Marcar: Pendiente
                            </SelectItem>
                            <SelectItem value="Retraso">
                              Marcar: Retraso
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-primary/10 bg-secondary/20 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                              Día de pago
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-xl font-black",
                                todayDay > Number(alumno.diaPago || 1) &&
                                  getAutomaticStatus(alumno) !== "Pagado"
                                  ? "text-destructive"
                                  : "text-primary",
                              )}
                            >
                              {alumno.diaPago}
                            </p>
                          </div>
                          <div className="rounded-lg border border-primary/10 bg-secondary/20 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                              Mensualidad
                            </p>
                            <p className="mt-1 text-xl font-black">
                              $
                              {Number(alumno.montoPago || 0).toLocaleString(
                                "es-MX",
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-primary/10 bg-secondary/20 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                Asistencia del mes
                              </p>
                              <p className="text-sm font-black">
                                {attendanceCount}/12 días ·{" "}
                                {Math.round(attendancePercent)}%
                              </p>
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 shrink-0 text-xs"
                                >
                                  <CalendarDays className="mr-1.5 h-4 w-4" />
                                  Ver días
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[calc(100vw-2rem)] max-w-sm border-primary/20 bg-card p-0"
                                align="end"
                              >
                                <div className="flex items-center justify-between gap-2 border-b border-primary/10 bg-secondary/30 p-3">
                                  <p className="text-xs font-black uppercase text-primary">
                                    Asistencias de {alumno.nombre}
                                  </p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-500"
                                    disabled={alumno.activo === false}
                                    title="Agregar asistencia manual"
                                    onClick={() =>
                                      handleOpenManualAttendance(alumno)
                                    }
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                <ScrollArea className="h-56">
                                  <div className="space-y-1 p-2">
                                    {attendance.history.length > 0 ? (
                                      attendance.history.map((date, index) => (
                                        <div
                                          key={`${date.toISOString()}-${index}`}
                                          className="flex items-center justify-between gap-2 rounded bg-primary/5 p-2"
                                        >
                                          <span className="text-xs font-bold">
                                            {format(date, "dd MMM yyyy", {
                                              locale: es,
                                            })}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <span className="font-mono text-xs text-primary">
                                              {format(date, "HH:mm")}
                                            </span>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-destructive"
                                              title="Eliminar asistencia"
                                              onClick={() =>
                                                void handleDeleteAttendanceDay(
                                                  alumno,
                                                  date,
                                                )
                                              }
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="py-10 text-center text-xs text-muted-foreground">
                                        Sin registros este mes
                                      </p>
                                    )}
                                  </div>
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Progress
                            value={attendancePercent}
                            className="h-2 bg-primary/10"
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-2 rounded-xl border border-primary/10 bg-secondary/15 p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-14 flex-col gap-1 px-1 text-[10px] font-black uppercase"
                            disabled={alumno.activo === false}
                            onClick={() =>
                              handleUpdateStatus(alumno.id, "Pagado")
                            }
                          >
                            <DollarSign className="h-4 w-4 text-green-500" />
                            Pagar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-14 flex-col gap-1 px-1 text-[10px] font-black uppercase"
                            disabled={!alumno.telefono}
                            onClick={() =>
                              abrirWhatsApp(alumno, "general")
                            }
                          >
                            <MessageCircle className="h-4 w-4 text-green-500" />
                            WhatsApp
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-14 flex-col gap-1 px-1 text-[10px] font-black uppercase"
                            disabled={alumno.activo === false}
                            onClick={() =>
                              handleOpenManualAttendance(alumno)
                            }
                          >
                            <CalendarCheck className="h-4 w-4 text-primary" />
                            Asistencia
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-14 flex-col gap-1 px-1 text-[10px] font-black uppercase"
                                aria-label={`Más acciones para ${alumno.nombre}`}
                              >
                                {currentlyLinking ||
                                phoneLinkingStudentId === alumno.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                                Más
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-[calc(100vw-2rem)] max-w-sm"
                            >
                            <DropdownMenuItem
                              onSelect={() =>
                                handleOpenStudentProfile(alumno)
                              }
                            >
                              <Users className="h-4 w-4 text-primary" />
                              Ver ficha completa
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                handleOpenEditDialog(alumno)
                              }
                            >
                              <Pencil className="h-4 w-4 text-primary" />
                              Editar alumno
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isLinking || alumno.activo === false}
                              onSelect={() =>
                                handleStartVinculation(
                                  alumno.id,
                                  alumno.nombre,
                                )
                              }
                            >
                              <Link2 className="h-4 w-4 text-green-500" />
                              Vincular con ESP32
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={
                                phoneLinkingStudentId !== null ||
                                alumno.activo === false
                              }
                              onSelect={() =>
                                handleStartPhoneVinculation(
                                  alumno.id,
                                  alumno.nombre,
                                )
                              }
                            >
                              <Smartphone className="h-4 w-4 text-blue-500" />
                              Vincular con teléfono Android
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                handleOpenPaymentHistory(alumno)
                              }
                            >
                              <DollarSign className="h-4 w-4 text-yellow-500" />
                              Historial de pagos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={alumno.activo === false}
                              onSelect={() =>
                                handleOpenManualAttendance(alumno)
                              }
                            >
                              <CalendarCheck className="h-4 w-4 text-primary" />
                              Agregar asistencia manual
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                void handleToggleStudentActivity(alumno)
                              }
                            >
                              <Users
                                className={cn(
                                  "h-4 w-4",
                                  alumno.activo === false
                                    ? "text-green-500"
                                    : "text-blue-500",
                                )}
                              />
                              {alumno.activo === false
                                ? "Reactivar alumno"
                                : "Dar de baja temporal"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() =>
                                void handleDeleteIndividual(
                                  alumno.id,
                                  alumno.nombre,
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar alumno
                            </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {filteredAlumnos.length === 0 && (
                  <div className="rounded-lg border border-dashed border-primary/15 py-12 text-center text-sm text-muted-foreground">
                    No hay alumnos que coincidan con la búsqueda y los filtros.
                  </div>
                )}
              </div>

              {/* Tabla original de escritorio */}
              <div className="hidden md:block border rounded-md overflow-x-auto bg-background/20 backdrop-blur-sm">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow className="border-primary/10">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={
                          filteredAlumnos.length > 0 &&
                          filteredAlumnos.every((alumno) =>
                            selectedIds.includes(alumno.id),
                          )
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[11px] tracking-widest text-primary">
                      Atleta
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[11px] tracking-widest text-primary text-center">
                      Sede
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[11px] tracking-widest text-primary text-center">
                      Estado Pago
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[11px] tracking-widest text-primary text-center min-w-[200px]">
                      Asistencia (Mes)
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[11px] tracking-widest text-primary text-center">
                      Día Pago
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[11px] tracking-widest text-primary text-right">
                      Monto
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[11px] tracking-widest text-primary text-right">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredAlumnos.map((alumno) => {
                    const attendance = attendanceDataMap[alumno.id] || {
                      count: 0,
                      history: [],
                    };

                    const attendanceCount = attendance.count;

                    const attendancePercent = Math.min(
                      (attendanceCount / 12) * 100,
                      100,
                    );

                    const currentlyLinking =
                      isLinking && linkingStudentId === alumno.id;

                    return (
                      <TableRow
                        key={alumno.id}
                        className={cn(
                          "hover:bg-primary/5 transition-colors border-primary/5",
                          alumno.activo === false && "opacity-60",
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(alumno.id)}
                            onCheckedChange={() => toggleSelection(alumno.id)}
                          />
                        </TableCell>

                        <TableCell className="font-bold uppercase text-xs">
                          <button
                            type="button"
                            className="text-left hover:text-primary hover:underline underline-offset-4 transition-colors"
                            onClick={() =>
                              handleOpenStudentProfile(alumno)
                            }
                            title="Abrir ficha del alumno"
                          >
                            {alumno.nombre}
                          </button>
                          {alumno.activo === false && (
                            <Badge
                              variant="outline"
                              className="ml-2 border-blue-500/40 text-[11px] text-blue-500"
                            >
                              INACTIVO
                            </Badge>
                          )}

                          <div className="space-y-0.5 mt-1">
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                              <Phone className="h-2 w-2" />
                              {alumno.telefono || "Sin teléfono"}
                            </span>

                            {(
  alumno.rfids?.length
    ? alumno.rfids
    : alumno.rfid
      ? [alumno.rfid]
      : []
).length > 0 ? (
  (
    alumno.rfids?.length
      ? alumno.rfids
      : alumno.rfid
        ? [alumno.rfid]
        : []
  ).map((codigo) => (
    <span
      key={codigo}
      className="flex items-center gap-1 text-[11px] text-green-500 font-mono"
    >
      <CreditCard className="h-2 w-2" />
      RFID: {codigo}
    </span>
  ))
) : (
  <span className="flex items-center gap-1 text-[11px] text-destructive/60 font-mono italic">
    <AlertCircle className="h-2 w-2" />
    Sin tarjeta vinculada
  </span>
)}
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-black italic"
                          >
                            {normalizarSede(alumno.sede)}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center">
                          <Select
                            value={getAutomaticStatus(alumno)}
                            disabled={alumno.activo === false}
                            onValueChange={(value: PaymentStatus) =>
                              handleUpdateStatus(alumno.id, value)
                            }
                          >
                            <SelectTrigger className="w-fit mx-auto h-7 border-none bg-transparent hover:bg-secondary/30">
                              {getStatusBadge(alumno)}
                            </SelectTrigger>

                            <SelectContent>
                              <SelectItem value="Pagado">
                                Marcar: Pagado
                              </SelectItem>

                              <SelectItem value="Falta de Pago">
                                Marcar: Pendiente
                              </SelectItem>

                              <SelectItem value="Retraso">
                                Marcar: Retraso
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[11px] font-black uppercase italic">
                              <div className="flex items-center gap-2">
                                <span>Días: {attendanceCount}/12</span>

                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 text-primary hover:bg-primary/20"
                                    >
                                      <CalendarDays className="h-3 w-3" />
                                    </Button>
                                  </PopoverTrigger>

                                  <PopoverContent
                                    className="w-64 p-0 bg-card border-primary/20"
                                    align="start"
                                  >
                                    <div className="p-3 border-b border-primary/10 bg-secondary/30 flex items-center justify-between gap-2">
                                      <p className="text-[11px] font-black uppercase italic text-primary">
                                        Asistencias del mes
                                      </p>

                                      <div className="flex items-center gap-1">
                                        <Badge
                                          variant="outline"
                                          className="text-[11px] font-bold border-primary/20"
                                        >
                                          {attendanceCount}/12
                                        </Badge>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-green-500 hover:bg-green-500/10 hover:text-green-500"
                                          disabled={alumno.activo === false}
                                          title="Agregar asistencia manual"
                                          onClick={() =>
                                            handleOpenManualAttendance(alumno)
                                          }
                                        >
                                          <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>

                                    <ScrollArea className="h-48">
                                      <div className="p-2 space-y-1">
                                        {attendance.history.length > 0 ? (
                                          attendance.history.map(
                                            (date, index) => (
                                              <div
                                                key={`${date.toISOString()}-${index}`}
                                                className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/5"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <CalendarDays className="h-3 w-3 text-primary/50" />

                                                  <span className="text-[11px] font-bold uppercase">
                                                    {format(
                                                      date,
                                                      "dd MMM yyyy",
                                                      {
                                                        locale: es,
                                                      },
                                                    )}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                  <div className="flex items-center gap-1 text-primary">
                                                    <Clock className="h-3 w-3" />
                                                    <span className="text-[11px] font-mono font-black">
                                                      {format(date, "HH:mm")}
                                                    </span>
                                                  </div>
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    title="Eliminar esta asistencia"
                                                    onClick={() =>
                                                      void handleDeleteAttendanceDay(
                                                        alumno,
                                                        date,
                                                      )
                                                    }
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ),
                                          )
                                        ) : (
                                          <div className="py-8 text-center">
                                            <p className="text-[11px] text-muted-foreground italic uppercase">
                                              Sin registros este mes
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </ScrollArea>
                                  </PopoverContent>
                                </Popover>
                              </div>

                              <span
                                className={cn(
                                  attendancePercent >= 100
                                    ? "text-primary"
                                    : "text-muted-foreground",
                                )}
                              >
                                {Math.round(attendancePercent)}%
                              </span>
                            </div>

                            <Progress
                              value={attendancePercent}
                              className="h-1.5 bg-primary/10"
                            />
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-black border-primary/20 bg-background/40",
                              todayDay > Number(alumno.diaPago || 1) &&
                                getAutomaticStatus(alumno) !== "Pagado"
                                ? "text-destructive border-destructive/40"
                                : "text-primary",
                            )}
                          >
                            {alumno.diaPago}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right font-black text-xs">
                          $
                          {Number(alumno.montoPago || 0).toLocaleString(
                            "es-MX",
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "h-8 w-8 hover:text-green-500 hover:bg-green-500/10",
                                    currentlyLinking &&
                                      "animate-pulse text-green-500",
                                  )}
                                  title="Opciones de vinculación"
                                >
                                  {currentlyLinking ||
                                  phoneLinkingStudentId === alumno.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <span
                                      aria-hidden="true"
                                      className="text-xl leading-none"
                                    >
                                      ⋮
                                    </span>
                                  )}
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent
                                align="end"
                                className="w-64"
                              >
                                <DropdownMenuItem
                                  disabled={
                                    isLinking || alumno.activo === false
                                  }
                                  onSelect={() =>
                                    handleStartVinculation(
                                      alumno.id,
                                      alumno.nombre,
                                    )
                                  }
                                >
                                  <Link2 className="h-4 w-4 text-green-500" />
                                  Vincular con ESP32
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  disabled={
                                    phoneLinkingStudentId !== null ||
                                    alumno.activo === false
                                  }
                                  onSelect={() =>
                                    handleStartPhoneVinculation(
                                      alumno.id,
                                      alumno.nombre,
                                    )
                                  }
                                >
                                  <Smartphone className="h-4 w-4 text-blue-500" />
                                  Vincular con teléfono Android
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onSelect={() =>
                                    handleOpenPaymentHistory(alumno)
                                  }
                                >
                                  <DollarSign className="h-4 w-4 text-yellow-500" />
                                  Historial de pagos
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onSelect={() =>
                                    void handleToggleStudentActivity(alumno)
                                  }
                                >
                                  <Users
                                    className={cn(
                                      "h-4 w-4",
                                      alumno.activo === false
                                        ? "text-green-500"
                                        : "text-blue-500",
                                    )}
                                  />
                                  {alumno.activo === false
                                    ? "Reactivar alumno"
                                    : "Dar de baja temporal"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-primary hover:bg-primary/10"
                              onClick={() => handleOpenEditDialog(alumno)}
                              title="Editar alumno"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                handleDeleteIndividual(alumno.id, alumno.nombre)
                              }
                              title="Eliminar alumno"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={attendanceStudent !== null}
        onOpenChange={(open) => {
          if (!open && !isSavingManualAttendance) {
            setAttendanceStudent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar asistencia manual</DialogTitle>
            <DialogDescription>
              {attendanceStudent?.nombre || "Alumno seleccionado"} · solo se
              permite registrar una asistencia por día.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="manual-attendance-date">Fecha</Label>
              <Input
                id="manual-attendance-date"
                type="date"
                value={manualAttendanceDate}
                onChange={(event) =>
                  setManualAttendanceDate(event.target.value)
                }
                disabled={isSavingManualAttendance}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-attendance-time">Hora</Label>
              <Input
                id="manual-attendance-time"
                type="time"
                value={manualAttendanceTime}
                onChange={(event) =>
                  setManualAttendanceTime(event.target.value)
                }
                disabled={isSavingManualAttendance}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingManualAttendance}
              onClick={() => setAttendanceStudent(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSavingManualAttendance}
              onClick={() => void handleAddManualAttendance()}
            >
              {isSavingManualAttendance ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar asistencia"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={isEditDialogOpen} onOpenChange={(open) => {
        if (!open && !isUpdatingStudent) {
          setIsEditDialogOpen(false);
          setEditingStudent(null);
        }
      }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto bg-card sm:max-w-[720px] border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic text-primary">
              Editar Atleta
            </DialogTitle>
          </DialogHeader>

          {editingStudent && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre Completo</Label>

                <Input
                  id="edit-name"
                  value={editingStudent.nombre}
                  onChange={(event) =>
                    setEditingStudent({
                      ...editingStudent,
                      nombre: event.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
  <Label className="flex items-center gap-2">
    <CreditCard className="h-4 w-4 text-primary" />
    Tarjetas RFID vinculadas
  </Label>

  <div className="rounded-md border border-primary/10 bg-background/50 p-3 space-y-2">
    {(
      editingStudent.rfids?.length
        ? editingStudent.rfids
        : editingStudent.rfid
          ? [editingStudent.rfid]
          : []
    ).length > 0 ? (
      (
        editingStudent.rfids?.length
          ? editingStudent.rfids
          : editingStudent.rfid
            ? [editingStudent.rfid]
            : []
      ).map((codigo) => (
        <div
          key={codigo}
          className="flex items-center gap-2 text-xs font-mono text-green-500"
        >
          <CreditCard className="h-3 w-3" />
          <span>{codigo}</span>
        </div>
      ))
    ) : (
      <span className="text-xs italic text-muted-foreground">
        Sin tarjetas vinculadas
      </span>
    )}

    <p className="text-[11px] text-muted-foreground">
      Para agregar otra tarjeta, cierra esta ventana y pulsa el icono de cadena
      junto al alumno.
    </p>
  </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-sede">Sede</Label>

                <Select value={editingStudent.sede} disabled>
                  <SelectTrigger id="edit-sede">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="MMA">MMA</SelectItem>

                    <SelectItem value="CAUCEL">CAUCEL</SelectItem>

                    <SelectItem value="JUAN_PABLO">JUAN PABLO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-primary">
                  Progreso deportivo
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-discipline">Disciplina</Label>
                    <Input
                      id="edit-discipline"
                      list="edit-disciplines-albatros"
                      placeholder="Selecciona o escribe una disciplina"
                      value={editingStudent.disciplina || ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          disciplina: event.target.value,
                        })
                      }
                    />
                    <datalist id="edit-disciplines-albatros">
                      {DISCIPLINAS_ALBATROS.map((disciplina) => (
                        <option key={disciplina} value={disciplina} />
                      ))}
                    </datalist>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-grade">Grado / nivel</Label>
                    <Input
                      id="edit-grade"
                      placeholder="Cinta blanca, intermedio..."
                      value={editingStudent.grado || ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          grado: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-promotion">Última promoción</Label>
                    <Input
                      id="edit-promotion"
                      type="date"
                      value={editingStudent.fechaPromocion || ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          fechaPromocion: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-goal">Objetivo</Label>
                    <Input
                      id="edit-goal"
                      placeholder="Competir, bajar de peso..."
                      value={editingStudent.objetivo || ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          objetivo: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-weight">Peso actual (kg)</Label>
                    <Input
                      id="edit-weight"
                      type="number"
                      min="0"
                      step="0.1"
                      value={editingStudent.pesoActual}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          pesoActual: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-target-weight">Peso objetivo (kg)</Label>
                    <Input
                      id="edit-target-weight"
                      type="number"
                      min="0"
                      step="0.1"
                      value={editingStudent.pesoObjetivo}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          pesoObjetivo: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-competition">Próxima competencia</Label>
                    <Input
                      id="edit-competition"
                      placeholder="Nombre del torneo"
                      value={editingStudent.proximaCompetencia || ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          proximaCompetencia: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-competition-date">Fecha</Label>
                    <Input
                      id="edit-competition-date"
                      type="date"
                      value={editingStudent.fechaCompetencia || ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          fechaCompetencia: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Teléfono</Label>

                  <Input
                    id="edit-phone"
                    value={editingStudent.telefono || ""}
                    onChange={(event) =>
                      setEditingStudent({
                        ...editingStudent,
                        telefono: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-payday">Día de Pago</Label>

                  <Input
                    id="edit-payday"
                    type="number"
                    min="1"
                    max="31"
                    value={editingStudent.diaPago}
                    onChange={(event) =>
                      setEditingStudent({
                        ...editingStudent,
                        diaPago: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-amount">Monto Pago ($)</Label>

                  <Input
                    id="edit-amount"
                    type="number"
                    min="0"
                    value={editingStudent.montoPago}
                    onChange={(event) =>
                      setEditingStudent({
                        ...editingStudent,
                        montoPago: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-status">Estado de Pago</Label>

                  <Select
                    value={editingStudent.estadoPago}
                    disabled
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="Falta de Pago">Pendiente</SelectItem>

                      <SelectItem value="Pagado">Pagado</SelectItem>

                      <SelectItem value="Retraso">Retraso</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Cambia el estado desde la tabla para registrar correctamente
                    el historial.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="edit-affiliate"
                  checked={editingStudent.esAfiliado}
                  onCheckedChange={(checked) =>
                    setEditingStudent({
                      ...editingStudent,
                      esAfiliado: checked === true,
                    })
                  }
                />

                <Label htmlFor="edit-affiliate" className="cursor-pointer">
                  ¿Es afiliado Albatros?
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              className="w-full font-bold uppercase tracking-widest"
              onClick={handleUpdateStudent}
              disabled={isUpdatingStudent}
            >
              {isUpdatingStudent ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentStudent !== null}
        onOpenChange={(open) => {
          if (!open && !isSavingPayment) {
            setPaymentStudent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {paymentStudent
                ? `Pago de ${paymentStudent.nombre}.`
                : "Completa los datos del pago."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="payment-amount">Monto recibido ($)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="payment-method">Método</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value: PaymentMethod) =>
                    setPaymentMethod(value)
                  }
                >
                  <SelectTrigger id="payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">
                      Transferencia
                    </SelectItem>
                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="payment-period">Mes correspondiente</Label>
                <Input
                  id="payment-period"
                  type="month"
                  value={paymentPeriod}
                  onChange={(event) => setPaymentPeriod(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="payment-date">Fecha del pago</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full font-bold uppercase"
              disabled={isSavingPayment}
              onClick={handleConfirmPayment}
            >
              {isSavingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Confirmar pago"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyStudent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryStudent(null);
            setPaymentHistory([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Historial de pagos</DialogTitle>
            <DialogDescription>
              {historyStudent?.nombre || "Alumno seleccionado"}
            </DialogDescription>
          </DialogHeader>

          {isLoadingPaymentHistory ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : paymentHistory.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              Todavía no hay pagos guardados en el historial.
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-3">
                {paymentHistory.map((pago) => (
                  <div
                    key={pago.id}
                    className="rounded-lg border border-primary/10 bg-background/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">
                          {pago.periodo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pago.metodoPago}
                        </p>
                      </div>
                      <span className="font-black text-green-500">
                        ${Number(pago.monto || 0).toLocaleString("es-MX")}
                      </span>
                    </div>

                    <p className="mt-3 border-t border-primary/10 pt-3 text-xs text-muted-foreground">
                      Fecha:{" "}
                      {pago.fecha?.toDate
                        ? format(pago.fecha.toDate(), "dd/MM/yyyy", {
                            locale: es,
                          })
                        : "Sin fecha"}
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReceiptPayment(pago)}
                      >
                        <DollarSign className="mr-2 h-3.5 w-3.5" />
                        Recibo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEditPayment(pago)}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleDeletePayment(pago)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingPayment !== null}
        onOpenChange={(open) => {
          if (!open && !isUpdatingPayment) setEditingPayment(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar pago</DialogTitle>
            <DialogDescription>
              Corrige los datos del pago. El historial y la recaudación se
              actualizarán automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-payment-amount">Monto pagado</Label>
              <Input
                id="edit-payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={editPaymentAmount}
                onChange={(event) => setEditPaymentAmount(event.target.value)}
                disabled={isUpdatingPayment}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-payment-method">Método de pago</Label>
              <Select
                value={editPaymentMethod}
                onValueChange={(value) =>
                  setEditPaymentMethod(value as PaymentMethod)
                }
                disabled={isUpdatingPayment}
              >
                <SelectTrigger id="edit-payment-method">
                  <SelectValue placeholder="Selecciona un método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-payment-period">Periodo</Label>
              <Input
                id="edit-payment-period"
                type="month"
                value={editPaymentPeriod}
                onChange={(event) => setEditPaymentPeriod(event.target.value)}
                disabled={isUpdatingPayment}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-payment-date">Fecha de pago</Label>
              <Input
                id="edit-payment-date"
                type="date"
                value={editPaymentDate}
                onChange={(event) => setEditPaymentDate(event.target.value)}
                disabled={isUpdatingPayment}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isUpdatingPayment}
              onClick={() => setEditingPayment(null)}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={isUpdatingPayment}
              onClick={() => void handleUpdatePayment()}
            >
              {isUpdatingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isMonthlyComparisonOpen}
        onOpenChange={setIsMonthlyComparisonOpen}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comparación de los últimos seis meses</DialogTitle>
            <DialogDescription>
              Recaudación efectiva, asistencias únicas y nuevos alumnos ·{" "}
              {userSede?.replace("_", " ") || "Sede actual"}
            </DialogDescription>
          </DialogHeader>

          {isLoadingMonthlyComparison ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : monthlyComparison.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              No fue posible obtener datos para la comparación.
            </div>
          ) : (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-3">
                {monthlyComparison.map((mes) => (
                  <div
                    key={mes.periodo}
                    className="rounded-lg border border-primary/10 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-black uppercase">{mes.etiqueta}</p>
                      <Badge variant="outline">
                        {mes.nuevosAlumnos}{" "}
                        {mes.nuevosAlumnos === 1
                          ? "nuevo alumno"
                          : "nuevos alumnos"}
                      </Badge>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Recaudación
                          </span>
                          <strong className="text-green-500">
                            ${mes.recaudacion.toLocaleString("es-MX")}
                          </strong>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-green-500/10">
                          <div
                            className="h-full rounded-full bg-green-500"
                            style={{
                              width: `${Math.max(
                                mes.recaudacion > 0 ? 3 : 0,
                                (mes.recaudacion /
                                  maxRecaudacionComparacion) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Asistencias
                          </span>
                          <strong className="text-blue-500">
                            {mes.asistencias}
                          </strong>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-blue-500/10">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width: `${Math.max(
                                mes.asistencias > 0 ? 3 : 0,
                                (mes.asistencias /
                                  maxAsistenciasComparacion) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={receiptPayment !== null}
        onOpenChange={(open) => {
          if (!open) setReceiptPayment(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {receiptPayment && (
            <>
              <DialogHeader>
                <DialogTitle>Recibo de pago</DialogTitle>
                <DialogDescription>
                  Comprobante interno · Folio{" "}
                  {receiptPayment.id.toUpperCase()}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border-2 border-primary/20 bg-background p-5">
                <div className="flex items-start justify-between gap-4 border-b pb-4">
                  <div>
                    <p className="text-xl font-black">ALBATROS</p>
                    <p className="text-xs text-muted-foreground">
                      {receiptPayment.sede.replace("_", " ")}
                    </p>
                  </div>
                  <Badge className="bg-green-500/15 text-green-500">
                    PAGADO
                  </Badge>
                </div>

                <p className="my-5 text-4xl font-black text-green-500">
                  $
                  {Number(receiptPayment.monto || 0).toLocaleString("es-MX")}
                </p>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-muted-foreground">Alumno</span>
                    <strong className="text-right">
                      {receiptPayment.nombre}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-muted-foreground">Periodo</span>
                    <strong>{receiptPayment.periodo}</strong>
                  </div>
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-muted-foreground">Método</span>
                    <strong>{receiptPayment.metodoPago}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Fecha</span>
                    <strong>
                      {format(obtenerFechaPago(receiptPayment), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </strong>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => enviarReciboWhatsApp(receiptPayment)}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  onClick={() => imprimirRecibo(receiptPayment)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Imprimir / PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={profileStudent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProfileStudent(null);
            setProfilePayments([]);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {profileStudent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-secondary/30">
                    {profileStudent.fotoUrl ? (
                      <img
                        src={profileStudent.fotoUrl}
                        alt={profileStudent.nombre}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Users className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black uppercase">
                      {profileStudent.nombre}
                    </DialogTitle>
                    <DialogDescription>
                      Ficha individual ·{" "}
                      {profileStudent.sede.replace("_", " ")}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground">
                      Asistencia mensual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-black">
                      {attendanceDataMap[profileStudent.id]?.count || 0}
                    </p>
                    <Progress
                      className="mt-3 h-2"
                      value={Math.min(
                        ((attendanceDataMap[profileStudent.id]?.count || 0) /
                          12) *
                          100,
                        100,
                      )}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Math.round(
                        Math.min(
                          ((attendanceDataMap[profileStudent.id]?.count || 0) /
                            12) *
                            100,
                          100,
                        ),
                      )}
                      % de la meta mensual
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground">
                      Estado de pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getStatusBadge(profileStudent)}
                    <p className="mt-3 text-sm">
                      Día de pago:{" "}
                      <strong>{profileStudent.diaPago}</strong>
                    </p>
                    <p className="text-sm">
                      Mensualidad:{" "}
                      <strong>
                        $
                        {Number(
                          profileStudent.montoPago || 0,
                        ).toLocaleString("es-MX")}
                      </strong>
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground">
                      Contacto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      {profileStudent.telefono || "Sin teléfono"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full border-green-500/30 text-green-600 dark:text-green-400"
                      disabled={!profileStudent.telefono}
                      onClick={() =>
                        abrirWhatsApp(profileStudent, "general")
                      }
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      WhatsApp
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Trophy className="h-4 w-4 text-primary" />
                      Progreso deportivo
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Datos de entrenamiento, objetivo y próxima meta.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const alumno = profileStudent;
                      setProfileStudent(null);
                      window.setTimeout(() => handleOpenEditDialog(alumno), 220);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-primary/10 bg-background/55 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Disciplina
                    </p>
                    <p className="mt-1 font-bold">
                      {profileStudent.disciplina || "Sin registrar"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {profileStudent.grado || "Grado pendiente"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary/10 bg-background/55 p-3">
                    <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <Target className="h-3 w-3" />
                      Objetivo
                    </p>
                    <p className="mt-1 font-bold">
                      {profileStudent.objetivo || "Sin objetivo definido"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Promoción: {profileStudent.fechaPromocion || "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary/10 bg-background/55 p-3">
                    <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <Weight className="h-3 w-3" />
                      Peso
                    </p>
                    <p className="mt-1 font-bold">
                      {profileStudent.pesoActual
                        ? `${profileStudent.pesoActual} kg`
                        : "Sin registrar"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Meta:{" "}
                      {profileStudent.pesoObjetivo
                        ? `${profileStudent.pesoObjetivo} kg`
                        : "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary/10 bg-background/55 p-3">
                    <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      Competencia
                    </p>
                    <p className="mt-1 font-bold">
                      {profileStudent.proximaCompetencia || "Sin programar"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {profileStudent.fechaCompetencia || "Fecha pendiente"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-primary/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="h-4 w-4" />
                      Tarjetas vinculadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(profileStudent.rfids?.length
                      ? profileStudent.rfids
                      : profileStudent.rfid
                        ? [profileStudent.rfid]
                        : []
                    ).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin tarjetas vinculadas.
                      </p>
                    ) : (
                      (profileStudent.rfids?.length
                        ? profileStudent.rfids
                        : [profileStudent.rfid as string]
                      ).map((codigo) => (
                        <div
                          key={codigo}
                          className="rounded-md bg-green-500/10 px-3 py-2 font-mono text-xs text-green-500"
                        >
                          {codigo}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-4 w-4" />
                      Días asistidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(attendanceDataMap[profileStudent.id]?.history || [])
                      .length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin asistencias este mes.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(
                          attendanceDataMap[profileStudent.id]?.history || []
                        ).map((fecha) => (
                          <Badge key={fecha.getTime()} variant="secondary">
                            {format(fecha, "dd MMM", { locale: es })}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="h-4 w-4" />
                    Pagos anteriores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingProfilePayments ? (
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  ) : profilePayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin pagos guardados en el historial.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-primary/10 bg-secondary/10 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                            Evolución de pagos
                          </p>
                          <Badge variant="outline">
                            Últimos {Math.min(profilePayments.length, 6)}
                          </Badge>
                        </div>
                        <div className="flex h-28 items-end gap-2">
                          {profilePayments
                            .slice(0, 6)
                            .reverse()
                            .map((pago) => {
                              const maximo = Math.max(
                                ...profilePayments
                                  .slice(0, 6)
                                  .map((item) => Number(item.monto || 0)),
                                1,
                              );
                              const altura = Math.max(
                                (Number(pago.monto || 0) / maximo) * 100,
                                8,
                              );

                              return (
                                <div
                                  key={`chart-${pago.id}`}
                                  className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                                  title={`${pago.periodo}: $${Number(
                                    pago.monto || 0,
                                  ).toLocaleString("es-MX")}`}
                                >
                                  <span className="text-[9px] font-bold opacity-0 transition-opacity group-hover:opacity-100">
                                    ${Number(pago.monto || 0).toLocaleString("es-MX")}
                                  </span>
                                  <div
                                    className="w-full rounded-t-md bg-primary/75 transition-all duration-500 group-hover:bg-primary"
                                    style={{ height: `${altura}%` }}
                                  />
                                  <span className="max-w-full truncate text-[9px] text-muted-foreground">
                                    {pago.periodo.slice(5)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                      <div className="space-y-2">
                      {profilePayments.map((pago) => (
                        <div
                          key={pago.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div>
                            <p className="font-bold">{pago.periodo}</p>
                            <p className="text-xs text-muted-foreground">
                              {pago.metodoPago}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-green-500">
                              $
                              {Number(pago.monto || 0).toLocaleString("es-MX")}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Abrir recibo"
                              onClick={() => setReceiptPayment(pago)}
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Editar pago"
                              onClick={() => handleStartEditPayment(pago)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Cancelar pago"
                              className="text-destructive hover:text-destructive"
                              onClick={() => void handleDeletePayment(pago)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-base">
                    Información de emergencia
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      Tipo de sangre:{" "}
                      <strong>
                        {profileStudent.emergencia?.tipoSangre ||
                          "No registrado"}
                      </strong>
                    </p>
                    <p>
                      Contacto:{" "}
                      <strong>
                        {profileStudent.emergencia?.contactoNombre ||
                          "No registrado"}
                      </strong>
                    </p>
                    <p>
                      Teléfono de emergencia:{" "}
                      <strong>
                        {profileStudent.emergencia?.contactoTelefono ||
                          "No registrado"}
                      </strong>
                    </p>
                    <p>
                      Alergias:{" "}
                      <strong>
                        {profileStudent.emergencia?.alergias ||
                          "No registradas"}
                      </strong>
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (profileStudent.emergenciaToken) {
                        window.open(
                          `/emergencia/${profileStudent.emergenciaToken}`,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      } else {
                        setProfileStudent(null);
                        router.push("/admin/emergencias");
                      }
                    }}
                  >
                    {profileStudent.emergenciaToken
                      ? "Abrir ficha de emergencia"
                      : "Crear ficha en Archivero"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
