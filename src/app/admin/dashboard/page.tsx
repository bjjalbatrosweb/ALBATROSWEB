"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";

type AdminAlumno = {
  id: string;
  rfid?: string;
  nombre: string;
  telefono: string;
  diaPago: number;
  esAfiliado: boolean;
  descuento: number;
  montoPago: number;
  estadoPago: PaymentStatus;
  fechaRegistro: unknown;
  fechaUltimoPago?: unknown;
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

const SEDES_VALIDAS: Sede[] = ["MMA", "CAUCEL", "JUAN_PABLO"];

function normalizarSede(valor: unknown): Sede {
  if (typeof valor !== "string") return "MMA";

  const sede = valor.trim().toUpperCase().replace(/\s+/g, "_");

  return SEDES_VALIDAS.includes(sede as Sede) ? (sede as Sede) : "MMA";
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

  const todayDay = new Date().getDate();

  useEffect(() => {
    if (!linkingStudentId || !alumnos) return;

    const student = alumnos.find((alumno) => alumno.id === linkingStudentId);

    if (!student?.rfid) return;

    setIsLinking(false);
    setLinkingStudentId(null);

    toast({
      title: "¡Vinculación exitosa!",
      description: `La tarjeta fue asignada a ${student.nombre}.`,
    });
  }, [alumnos, linkingStudentId, toast]);

  const getAutomaticStatus = (alumno: AdminAlumno): PaymentStatus => {
    if (alumno.estadoPago === "Pagado") return "Pagado";
    if (todayDay > Number(alumno.diaPago || 1)) return "Retraso";

    return alumno.estadoPago || "Falta de Pago";
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

        return (
          alumno.nombre?.toLowerCase().includes(termino) ||
          alumno.rfid?.toLowerCase().includes(termino) ||
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

  const handleStartVinculation = async (studentId: string, nombre: string) => {
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
      }, 60000);
    } catch (error: unknown) {
      setIsLinking(false);
      setLinkingStudentId(null);

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
        rfid: rfidNormalizado,
        diaPago,
        montoPago,
        descuento,
        esAfiliado: editingStudent.esAfiliado === true,
        estadoPago: editingStudent.estadoPago,
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

    try {
      const alumnoRef = doc(firestore, "Alumnos", id);

      if (newStatus === "Pagado") {
        await updateDoc(alumnoRef, {
          estadoPago: "Pagado",
          fechaUltimoPago: serverTimestamp(),
        });
      } else {
        await updateDoc(alumnoRef, {
          estadoPago: newStatus,
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

  const recaudacion =
    alumnos
      ?.filter((alumno) => getAutomaticStatus(alumno) === "Pagado")
      .reduce((total, alumno) => total + (Number(alumno.montoPago) || 0), 0) ||
    0;

  const totalRetrasos =
    alumnos?.filter((alumno) => getAutomaticStatus(alumno) === "Retraso")
      .length || 0;

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

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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

                  <Button
                    variant="outline"
                    type="button"
                    className="font-bold uppercase text-[10px]"
                    disabled={isLinking || !newStudent.nombre.trim()}
                    onClick={handleVincularNuevo}
                  >
                    {isLinking ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Link2 className="h-3 w-3 mr-1" />
                    )}
                    {isLinking ? "Buscando..." : "Vincular"}
                  </Button>
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
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">
              Recaudación
            </CardTitle>

            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-black tracking-tighter">
              ${recaudacion.toLocaleString("es-MX")}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">
              Retrasos
            </CardTitle>

            <AlertCircle className="h-4 w-4 text-destructive" />
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
                          <div>{alumno.nombre}</div>

                          <div className="space-y-0.5 mt-1">
                            <span className="flex items-center gap-1 text-[8px] text-muted-foreground font-mono">
                              <Phone className="h-2 w-2" />
                              {alumno.telefono || "Sin teléfono"}
                            </span>

                            {alumno.rfid ? (
                              <span className="flex items-center gap-1 text-[8px] text-green-500 font-mono">
                                <CreditCard className="h-2 w-2" />
                                RFID: {alumno.rfid}
                              </span>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8 hover:text-green-500 hover:bg-green-500/10",
                                currentlyLinking &&
                                  "animate-pulse text-green-500",
                              )}
                              onClick={() =>
                                handleStartVinculation(alumno.id, alumno.nombre)
                              }
                              disabled={isLinking}
                              title="Vincular RFID"
                            >
                              {currentlyLinking ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Link2 className="h-4 w-4" />
                              )}
                            </Button>

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
                <Label htmlFor="edit-rfid" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Código RFID
                </Label>

                <div className="flex gap-2">
                  <Input
                    id="edit-rfid"
                    value={editingStudent.rfid || ""}
                    onChange={(event) =>
                      setEditingStudent({
                        ...editingStudent,
                        rfid: event.target.value,
                      })
                    }
                    className="font-mono text-xs"
                  />

                  <Button
                    variant="outline"
                    type="button"
                    className="font-bold uppercase text-[10px]"
                    disabled={isLinking}
                    onClick={() =>
                      handleStartVinculation(
                        editingStudent.id,
                        editingStudent.nombre,
                      )
                    }
                  >
                    {isLinking && linkingStudentId === editingStudent.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Link2 className="h-3 w-3 mr-1" />
                    )}
                    Vincular
                  </Button>
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
                    onValueChange={(value: PaymentStatus) =>
                      setEditingStudent({
                        ...editingStudent,
                        estadoPago: value,
                      })
                    }
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
    </div>
  );
}
