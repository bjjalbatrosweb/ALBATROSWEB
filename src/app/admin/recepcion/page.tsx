"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Loader2,
  Search,
  Smartphone,
  UserCheck,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import {
  collection,
  query,
  where,
} from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useAuth,
  useCollection,
  useFirestore,
  useMemoFirebase,
} from "@/firebase";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type PaymentMethod = "Efectivo" | "Transferencia" | "Tarjeta" | "Otro";

type Alumno = {
  id: string;
  nombre: string;
  telefono?: string;
  sede: Sede;
  activo?: boolean;
  estadoPago?: "Pagado" | "Falta de Pago" | "Retraso";
  montoPago?: number;
  periodoUltimoPago?: string;
  rfid?: string;
  rfids?: string[];
};

function normalizarSede(valor: string | null): Sede {
  const sede = (valor || "MMA").trim().toUpperCase().replace(/\s+/g, "_");
  return ["MMA", "CAUCEL", "JUAN_PABLO"].includes(sede)
    ? (sede as Sede)
    : "MMA";
}

function normalizarBusqueda(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function RecepcionPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [sede, setSede] = useState<Sede | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [alumnoSeleccionado, setAlumnoSeleccionado] =
    useState<Alumno | null>(null);
  const [accion, setAccion] = useState<"pago" | "asistencia" | null>(null);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<PaymentMethod>("Efectivo");
  const [periodo, setPeriodo] = useState(format(new Date(), "yyyy-MM"));
  const [fechaPago, setFechaPago] = useState(format(new Date(), "yyyy-MM-dd"));
  const [procesando, setProcesando] = useState(false);
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);

  useEffect(() => {
    const sedeGuardada = localStorage.getItem("userSede");
    if (!sedeGuardada) {
      router.replace("/login-profesor");
      return;
    }
    setSede(normalizarSede(sedeGuardada));
  }, [router]);

  const alumnosQuery = useMemoFirebase(() => {
    if (!firestore || !sede) return null;
    return query(
      collection(firestore, "Alumnos"),
      where("sede", "==", sede),
    );
  }, [firestore, sede]);

  const { data: alumnos, isLoading } = useCollection<Alumno>(alumnosQuery);

  const resultados = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);
    const activos = (alumnos || []).filter((alumno) => alumno.activo !== false);

    if (!termino) return activos.slice(0, 12);

    return activos
      .filter((alumno) => {
        const tarjetas = alumno.rfids?.length
          ? alumno.rfids
          : alumno.rfid
            ? [alumno.rfid]
            : [];
        return (
          normalizarBusqueda(alumno.nombre).includes(termino) ||
          normalizarBusqueda(alumno.telefono || "").includes(termino) ||
          tarjetas.some((codigo) =>
            normalizarBusqueda(codigo).includes(termino),
          )
        );
      })
      .slice(0, 20);
  }, [alumnos, busqueda]);

  const abrirPago = (alumno: Alumno) => {
    setAlumnoSeleccionado(alumno);
    setMonto(String(Number(alumno.montoPago || 600)));
    setPeriodo(format(new Date(), "yyyy-MM"));
    setFechaPago(format(new Date(), "yyyy-MM-dd"));
    setMetodo("Efectivo");
    setAccion("pago");
  };

  const registrarPago = async () => {
    if (!sede || !alumnoSeleccionado || procesando) return;

    const cantidad = Number(monto);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast({
        variant: "destructive",
        title: "Monto inválido",
        description: "Escribe una cantidad mayor que cero.",
      });
      return;
    }

    try {
      setProcesando(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("La sesión expiró.");

      const response = await fetch("/api/recepcion/pago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alumnoId: alumnoSeleccionado.id,
          sede,
          monto: cantidad,
          periodo,
          metodoPago: metodo,
          fechaPago,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 409 || data.duplicado) {
        toast({
          variant: "destructive",
          title: "Pago duplicado",
          description: `${alumnoSeleccionado.nombre} ya tiene un pago para ${periodo}.`,
        });
        return;
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.mensaje || "No se pudo registrar el pago.");
      }

      toast({
        title: "Pago registrado",
        description: `$${cantidad.toLocaleString("es-MX")} · ${alumnoSeleccionado.nombre}`,
      });
      setAccion(null);
      setAlumnoSeleccionado(null);
      setBusqueda("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setProcesando(false);
    }
  };

  const abrirAsistencia = (alumno: Alumno) => {
    setAlumnoSeleccionado(alumno);
    setAccion("asistencia");
  };

  const registrarAsistencia = async () => {
    if (!sede || !alumnoSeleccionado || procesando) return;

    try {
      setProcesando(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("La sesión expiró.");

      const response = await fetch("/api/recepcion/asistencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alumnoId: alumnoSeleccionado.id,
          sede,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 409 || data.duplicado) {
        toast({
          title: "Asistencia ya registrada",
          description: `${alumnoSeleccionado.nombre} ya ingresó hoy.`,
        });
        setAccion(null);
        return;
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.mensaje || "No se pudo registrar la asistencia.");
      }

      toast({
        title: "Asistencia registrada",
        description: `${alumnoSeleccionado.nombre} · ${format(new Date(), "HH:mm")}`,
      });
      setAccion(null);
      setAlumnoSeleccionado(null);
      setBusqueda("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setProcesando(false);
    }
  };

  const iniciarVinculacion = async (alumno: Alumno, android = false) => {
    if (!sede || vinculandoId) return;

    try {
      setVinculandoId(alumno.id);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("La sesión expiró.");

      const response = await fetch("/api/rfid/solicitar-vinculacion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alumnoId: alumno.id,
          dispositivo: "Recepcion",
          sede,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.mensaje || "No se pudo iniciar la vinculación.");
      }

      if (android && data.vinculacionId) {
        router.push(
          `/admin/asistencia-nfc?${new URLSearchParams({
            vinculacionId: data.vinculacionId,
            alumno: alumno.nombre,
          }).toString()}`,
        );
        return;
      }

      toast({
        title: "Vinculación iniciada",
        description: `Acerca la tarjeta maestra y después el tag de ${alumno.nombre}.`,
      });
      window.setTimeout(() => setVinculandoId(null), 60000);
    } catch (error) {
      setVinculandoId(null);
      toast({
        variant: "destructive",
        title: "No se pudo iniciar",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-3xl border border-primary/15 bg-card/60 shadow-2xl shadow-primary/5">
        <div className="border-b border-primary/10 bg-gradient-to-r from-primary/10 via-transparent to-transparent p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Badge className="mb-3 bg-primary/15 text-primary hover:bg-primary/15">
                OPERACIÓN RÁPIDA · {sede?.replace("_", " ") || "..."}
              </Badge>
              <h1 className="text-3xl font-black uppercase italic tracking-tight sm:text-4xl">
                Modo recepción
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Busca al atleta y realiza la acción diaria sin entrar a todas
                las herramientas administrativas.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-500">
              <CheckCircle2 className="h-5 w-5" />
              Sesión lista
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8">
          <Label htmlFor="reception-search" className="sr-only">
            Buscar alumno
          </Label>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reception-search"
              autoFocus
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre, teléfono o RFID..."
              className="h-16 rounded-2xl border-primary/15 bg-background/70 pl-14 pr-5 text-base shadow-inner sm:text-lg"
            />
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : resultados.length === 0 ? (
        <Card className="border-dashed border-primary/20 bg-card/30">
          <CardContent className="py-16 text-center">
            <Users className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
            <p className="font-bold">No encontramos alumnos activos.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisa el nombre, teléfono o código RFID.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {resultados.map((alumno) => {
            const tarjetas = alumno.rfids?.length
              ? alumno.rfids
              : alumno.rfid
                ? [alumno.rfid]
                : [];
            const pagado =
              alumno.estadoPago === "Pagado" &&
              alumno.periodoUltimoPago === format(new Date(), "yyyy-MM");

            return (
              <Card
                key={alumno.id}
                className="group overflow-hidden border-primary/10 bg-card/55 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black uppercase">
                        {alumno.nombre}
                      </h2>
                      <Badge
                        variant="outline"
                        className={
                          pagado
                            ? "border-green-500/30 bg-green-500/10 text-green-500"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                        }
                      >
                        {pagado ? "Pago al corriente" : "Pago pendiente"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{alumno.telefono || "Sin teléfono"}</span>
                      <span>
                        {tarjetas.length
                          ? `${tarjetas.length} tag${tarjetas.length > 1 ? "s" : ""}`
                          : "Sin RFID"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 lg:flex">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-12"
                      onClick={() => abrirAsistencia(alumno)}
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      Asistencia
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      className="h-12 font-bold"
                      onClick={() => abrirPago(alumno)}
                    >
                      <CircleDollarSign className="mr-2 h-4 w-4" />
                      Cobrar
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-12"
                      disabled={vinculandoId !== null}
                      onClick={() => void iniciarVinculacion(alumno)}
                    >
                      {vinculandoId === alumno.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      RFID
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-12"
                      disabled={vinculandoId !== null}
                      onClick={() => void iniciarVinculacion(alumno, true)}
                    >
                      <Smartphone className="mr-2 h-4 w-4" />
                      Android
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={accion === "pago"}
        onOpenChange={(open) => !open && !procesando && setAccion(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
              <CircleDollarSign className="h-5 w-5 text-primary" />
              Registrar pago
            </DialogTitle>
            <DialogDescription>{alumnoSeleccionado?.nombre}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="reception-amount">Monto</Label>
              <Input
                id="reception-amount"
                type="number"
                min="1"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="reception-period">Periodo</Label>
                <Input
                  id="reception-period"
                  type="month"
                  value={periodo}
                  onChange={(event) => setPeriodo(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reception-date">Fecha</Label>
                <Input
                  id="reception-date"
                  type="date"
                  value={fechaPago}
                  onChange={(event) => setFechaPago(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Método</Label>
              <Select
                value={metodo}
                onValueChange={(value) => setMetodo(value as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="w-full font-black uppercase"
              disabled={procesando}
              onClick={() => void registrarPago()}
            >
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={accion === "asistencia"}
        onOpenChange={(open) => !open && !procesando && setAccion(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
              <UserCheck className="h-5 w-5 text-primary" />
              Confirmar asistencia
            </DialogTitle>
            <DialogDescription>
              Se registrará la entrada de {alumnoSeleccionado?.nombre} con la
              fecha y hora actuales.
            </DialogDescription>
          </DialogHeader>
          {alumnoSeleccionado?.estadoPago === "Retraso" && (
            <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-500">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              El alumno aparece con retraso de pago. Puedes registrar la
              asistencia si administración autorizó el acceso.
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              className="w-full font-black uppercase"
              disabled={procesando}
              onClick={() => void registrarAsistencia()}
            >
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

}