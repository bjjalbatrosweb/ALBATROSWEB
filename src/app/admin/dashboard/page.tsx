"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  Clock,
  CreditCard,
  DollarSign,
  Link2,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
type PaymentStatus = "Pagado" | "Falta de Pago" | "Retraso";
type PaymentMethod = "Efectivo" | "Transferencia" | "Tarjeta" | "Otro";
type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";

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
  fechaRegistro: unknown;
  fechaUltimoPago?: unknown;
  periodoUltimoPago?: string;
  fotoUrl?: string;
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
  diaPago: string;
  esAfiliado: boolean;
  descuento: string;
  montoPago: string;
  estadoPago: PaymentStatus;
  sede: Sede;
};

type EditableAlumno = Omit<
  AdminAlumno,
  "diaPago" | "descuento" | "montoPago"
> & {
  diaPago: string;
  descuento: string;
  montoPago: string;
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

const NUEVO_ALUMNO_BASE = {
  nombre: "",
  rfid: "",
  telefono: "",
  diaPago: "1",
  esAfiliado: false,
  descuento: "0",
  montoPago: "600",
  estadoPago: "Falta de Pago" as PaymentStatus,
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [userSede, setUserSede] = useState<Sede | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<EditableAlumno | null>(
    null,
  );
  const [isLinking, setIsLinking] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [linkingStudentId, setLinkingStudentId] = useState<string | null>(null);
  const [phoneLinkingStudentId, setPhoneLinkingStudentId] =
    useState<string | null>(null);
  const [linkingInitialCardCount, setLinkingInitialCardCount] = useState(0);
  const [isMergingDuplicates, setIsMergingDuplicates] =
  useState(false);
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
  const migratedLegacyPaymentsRef = useRef<Set<string>>(new Set());

  const [newStudent, setNewStudent] = useState<NewStudentForm>({
    ...NUEVO_ALUMNO_BASE,
    sede: "MMA",
  });

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

    return [...alumnos]
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"))
      .filter((alumno) => {
        if (!termino) return true;

        const tarjetas =
  alumno.rfids?.length
    ? alumno.rfids
    : alumno.rfid
      ? [alumno.rfid]
      : [];

return (
  alumno.nombre?.toLowerCase().includes(termino) ||
  tarjetas.some((rfid) =>
    rfid.toLowerCase().includes(termino),
  ) ||
  alumno.telefono?.toLowerCase().includes(termino)
);
      });
  }, [alumnos, searchTerm]);

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
      const response = await fetch("/api/rfid/solicitar-vinculacion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

      toast({
        title: "Protocolo iniciado",
        description: `Acerca la TARJETA MAESTRA al lector para vincular a ${nombre}.`,
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
      const response = await fetch("/api/rfid/solicitar-vinculacion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
        diaPago,
        esAfiliado: newStudent.esAfiliado,
        descuento,
        montoPago,
        estadoPago: newStudent.estadoPago,
        sede: userSede,
        fechaRegistro: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(firestore, "Alumnos"),
        alumnoData,
      );

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

    const rfidNormalizado = (editingStudent.rfid || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

    try {
      await updateDoc(doc(firestore, "Alumnos", editingStudent.id), {
        nombre,
        telefono: editingStudent.telefono?.trim() || "",
        diaPago,
        montoPago,
        descuento,
        esAfiliado: editingStudent.esAfiliado === true,
        // La sede queda bloqueada a la sesión actual.
        sede: userSede,
      });

      toast({
        title: "Registro actualizado",
        description: `Los datos de ${nombre} fueron guardados.`,
      });

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

      const existingPayment = await getDoc(paymentRef);

      if (existingPayment.exists()) {
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
    if (!firestore) return;

    setHistoryStudent(alumno);
    setPaymentHistory([]);
    setIsLoadingPaymentHistory(true);

    try {
      const snapshot = await getDocs(
        query(
          collection(firestore, "Pagos"),
          where("alumnoId", "==", alumno.id),
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

    if (!firestore) return;

    setIsLoadingProfilePayments(true);

    try {
      const snapshot = await getDocs(
        query(
          collection(firestore, "Pagos"),
          where("alumnoId", "==", alumno.id),
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

  const handleDeleteIndividual = async (id: string, nombre: string) => {
    if (!firestore) return;

    try {
      await deleteDoc(doc(firestore, "Alumnos", id));

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

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (
      filteredAlumnos.length > 0 &&
      selectedIds.length === filteredAlumnos.length
    ) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(filteredAlumnos.map((alumno) => alumno.id));
  };

  const getStatusBadge = (alumno: AdminAlumno) => {
    const status = getAutomaticStatus(alumno);

    switch (status) {
      case "Pagado":
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-black uppercase text-[10px] italic">
            PAGADO
          </Badge>
        );

      case "Retraso":
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-black uppercase text-[10px] italic animate-pulse">
            RETRASO
          </Badge>
        );

      default:
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground font-bold uppercase text-[10px] italic"
          >
            FALTA PAGO
          </Badge>
        );
    }
  };

  const isLoading = isLoadingAlumnos || isLoadingAsistencias;

  const totalAlumnos = alumnos?.length || 0;

  const asistenciasUnicasMes = Object.values(attendanceDataMap).reduce(
    (total, registro) => total + registro.count,
    0,
  );

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
  const recaudacionEstimada =
    alumnos?.reduce(
      (total, alumno) => total + (Number(alumno.montoPago) || 0),
      0,
    ) || 0;

  const alumnosMorosos =
    alumnos?.filter(
      (alumno) => getAutomaticStatus(alumno) === "Retraso",
    ) || [];

  const alumnosProximosPago =
    alumnos?.filter((alumno) => {
      if (getAutomaticStatus(alumno) === "Pagado") {
        return false;
      }

      const diasRestantes =
        Number(alumno.diaPago || 1) - todayDay;

      return diasRestantes >= 0 && diasRestantes <= 4;
    }) || [];

  const totalRetrasos = alumnosMorosos.length;

  const abrirWhatsApp = (
    alumno: AdminAlumno,
    tipo: "retraso" | "proximo" | "general",
  ) => {
    let telefono = String(alumno.telefono || "").replace(/\D/g, "");

    if (telefono.length === 10) {
      telefono = `52${telefono}`;
    } else if (telefono.length === 13 && telefono.startsWith("521")) {
      telefono = `52${telefono.slice(3)}`;
    }

    if (!telefono) {
      toast({
        variant: "destructive",
        title: "Sin teléfono",
        description: `${alumno.nombre} no tiene un número registrado.`,
      });
      return;
    }

    const monto = Number(alumno.montoPago || 0).toLocaleString("es-MX");
    const mensaje =
      tipo === "retraso"
        ? `Hola ${alumno.nombre}, te recordamos que tu mensualidad de ALBATROS por $${monto}, con fecha de pago el día ${alumno.diaPago}, se encuentra pendiente. Por favor, comunícate con nosotros para regularizarla.`
        : tipo === "proximo"
          ? `Hola ${alumno.nombre}, te recordamos que tu mensualidad de ALBATROS por $${monto} vence el día ${alumno.diaPago}.`
          : `Hola ${alumno.nombre}, nos comunicamos contigo de parte de ALBATROS BJJ.`;

    window.open(
      `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-primary border-primary/20 bg-primary/5 flex gap-1 items-center font-black italic text-[10px]"
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

    <DialogContent className="sm:max-w-[460px] bg-card border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic">
                Registrar Nuevo Atleta
              </DialogTitle>

              <DialogDescription>
                El alumno se guardará en la sede{" "}
                <strong>{userSede || "..."}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payday">Día de Pago</Label>

                  <Input
                    id="payday"
                    type="number"
                    min="1"
                    max="31"
                    value={newStudent.diaPago}
                    onChange={(event) =>
                      setNewStudent({
                        ...newStudent,
                        diaPago: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Monto Pago ($)</Label>

                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    value={newStudent.montoPago}
                    onChange={(event) =>
                      setNewStudent({
                        ...newStudent,
                        montoPago: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Estado Inicial</Label>

                  <Select
                    value={newStudent.estadoPago}
                    onValueChange={(value: PaymentStatus) =>
                      setNewStudent({
                        ...newStudent,
                        estadoPago: value,
                      })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="Falta de Pago">Pendiente</SelectItem>

                      <SelectItem value="Pagado">Pagado</SelectItem>

                      <SelectItem value="Retraso">Retraso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
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

            <Users className="h-4 w-4 text-primary" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-black tracking-tighter">
              {isLoading ? "..." : totalAlumnos}
            </div>
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

              <CalendarCheck className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-black tracking-tighter">
              {isLoading ? "..." : asistenciasUnicasMes}
            </div>
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

            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-red-500">
                  Estimada
                </p>
                <p className="mt-1 text-xl font-black tracking-tighter text-red-500">
                  ${recaudacionEstimada.toLocaleString("es-MX")}
                </p>
              </div>

              <div className="border-l border-primary/10 pl-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-green-500">
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
                    {userSede?.replace("_", " ") || "actual"}.
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
                      {alumnosMorosos.map((alumno) => (
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
                                Pago pendiente
                              </span>
                              <span className="font-black text-destructive">
                                $
                                {Number(
                                  alumno.montoPago || 0,
                                ).toLocaleString("es-MX")}
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
                      ))}
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

      <Card className="bg-card/40 border-primary/10">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-black uppercase italic">
              Base de Datos de Alumnos
            </CardTitle>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

              <Input
                placeholder="Buscar por nombre, RFID o teléfono..."
                className="pl-8 bg-background/50 border-primary/10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
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
            <div className="border rounded-md overflow-x-auto bg-background/20 backdrop-blur-sm">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow className="border-primary/10">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={
                          filteredAlumnos.length > 0 &&
                          selectedIds.length === filteredAlumnos.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary">
                      Atleta
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-center">
                      Sede
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-center">
                      Estado Pago
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-center min-w-[200px]">
                      Asistencia (Mes)
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-center">
                      Día Pago
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-right">
                      Monto
                    </TableHead>

                    <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-right">
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
                        className="hover:bg-primary/5 transition-colors border-primary/5"
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

                          <div className="space-y-0.5 mt-1">
                            <span className="flex items-center gap-1 text-[8px] text-muted-foreground font-mono">
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
      className="flex items-center gap-1 text-[8px] text-green-500 font-mono"
    >
      <CreditCard className="h-2 w-2" />
      RFID: {codigo}
    </span>
  ))
) : (
  <span className="flex items-center gap-1 text-[8px] text-destructive/60 font-mono italic">
    <AlertCircle className="h-2 w-2" />
    Sin tarjeta vinculada
  </span>
)}
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className="text-[9px] font-black italic"
                          >
                            {normalizarSede(alumno.sede)}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center">
                          <Select
                            value={getAutomaticStatus(alumno)}
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
                            <div className="flex justify-between items-center text-[8px] font-black uppercase italic">
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
                                    <div className="p-3 border-b border-primary/10 bg-secondary/30 flex items-center justify-between">
                                      <p className="text-[10px] font-black uppercase italic text-primary">
                                        Asistencias del mes
                                      </p>

                                      <Badge
                                        variant="outline"
                                        className="text-[8px] font-bold border-primary/20"
                                      >
                                        {attendanceCount}/12
                                      </Badge>
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

                                                  <span className="text-[10px] font-bold uppercase">
                                                    {format(
                                                      date,
                                                      "dd MMM yyyy",
                                                      {
                                                        locale: es,
                                                      },
                                                    )}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-1 text-primary">
                                                  <Clock className="h-3 w-3" />

                                                  <span className="text-[10px] font-mono font-black">
                                                    {format(date, "HH:mm")}
                                                  </span>
                                                </div>
                                              </div>
                                            ),
                                          )
                                        ) : (
                                          <div className="py-8 text-center">
                                            <p className="text-[10px] text-muted-foreground italic uppercase">
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
                                  disabled={isLinking}
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
                                    phoneLinkingStudentId !== null
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border-primary/20">
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

    <p className="text-[10px] text-muted-foreground">
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
                  <p className="text-[10px] text-muted-foreground">
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
            >
              Guardar Cambios
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
                  </div>
                ))}
              </div>
            </ScrollArea>
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
                          <span className="font-black text-green-500">
                            $
                            {Number(pago.monto || 0).toLocaleString("es-MX")}
                          </span>
                        </div>
                      ))}
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
