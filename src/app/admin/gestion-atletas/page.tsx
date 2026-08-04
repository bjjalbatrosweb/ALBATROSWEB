"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Medal,
  MessageCircle,
  PencilLine,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useFirestore, useUser } from "@/firebase";

type Alumno = {
  id: string;
  nombre: string;
  sede?: string;
  telefono?: string;
  estadoPago?: string;
  diaPago?: number;
  montoPago?: number;
  rfid?: string;
  rfids?: string[];
  disciplina?: string;
  grado?: string;
  fechaPromocion?: string;
  objetivo?: string;
  pesoActual?: number;
  pesoObjetivo?: number;
  proximaCompetencia?: string;
  fechaCompetencia?: string;
  categoriaDeportiva?: string;
  fechaIngreso?: string;
  historialPromociones?: Array<{
    fecha: string;
    grado: string;
  }>;
  resultadosCompetencias?: Array<{
    fecha: string;
    evento: string;
    resultado: string;
  }>;
};

type Solicitud = {
  id: string;
  uid?: string;
  alumnoId: string;
  alumnoNombre?: string;
  sede: string;
  categoria?: string;
  detalle?: string;
  estado?: "pendiente" | "resuelta";
};

const CATEGORIAS: Record<string, string> = {
  datos: "Datos personales",
  pago: "Pago",
  asistencia: "Asistencia",
  progreso: "Progreso",
  emergencia: "Emergencia",
};

export default function GestionAtletasPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [sede, setSede] = useState("MMA");
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [calculandoResumen, setCalculandoResumen] = useState(false);
  const [lecturasEstimadas, setLecturasEstimadas] = useState(0);
  const [alumnoEditado, setAlumnoEditado] = useState<Alumno | null>(null);
  const [progreso, setProgreso] = useState({
    disciplina: "",
    grado: "",
    fechaPromocion: "",
    objetivo: "",
    pesoActual: "",
    pesoObjetivo: "",
    proximaCompetencia: "",
    fechaCompetencia: "",
    categoriaDeportiva: "",
    fechaIngreso: "",
    historialPromociones: "",
    resultadosCompetencias: "",
  });
  const [notaPrivada, setNotaPrivada] = useState("");

  useEffect(() => {
    setSede(localStorage.getItem("userSede") || "MMA");
  }, []);

  const cargar = useCallback(async () => {
    if (!firestore || !sede) return;
    setCargando(true);
    try {
      const [alumnosSnapshot, solicitudesSnapshot] = await Promise.all([
        getDocs(
          query(collection(firestore, "Alumnos"), where("sede", "==", sede)),
        ),
        getDocs(
          query(
            collection(firestore, "SolicitudesCorreccion"),
            where("sede", "==", sede),
          ),
        ),
      ]);
      setAlumnos(
        alumnosSnapshot.docs
          .map((registro) => ({
            id: registro.id,
            ...registro.data(),
          })) as Alumno[],
      );
      const solicitudesCargadas = solicitudesSnapshot.docs
          .map((registro) => ({
            id: registro.id,
            ...registro.data(),
          })) as Solicitud[];
      setSolicitudes(
        solicitudesCargadas.filter((solicitud) => solicitud.estado !== "resuelta"),
      );
      setLecturasEstimadas(
        alumnosSnapshot.size + solicitudesSnapshot.size,
      );
    } finally {
      setCargando(false);
    }
  }, [firestore, sede]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const alumnosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase("es");
    return [...alumnos]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .filter(
        (alumno) =>
          !termino ||
          alumno.nombre.toLocaleLowerCase("es").includes(termino) ||
          alumno.telefono?.includes(termino),
      );
  }, [alumnos, busqueda]);

  const morosos = useMemo(
    () => alumnos.filter((alumno) => alumno.estadoPago !== "Pagado"),
    [alumnos],
  );
  const sinTag = useMemo(
    () =>
      alumnos.filter(
        (alumno) => !alumno.rfid && (!alumno.rfids || alumno.rfids.length === 0),
      ),
    [alumnos],
  );
  const progresoIncompleto = useMemo(
    () =>
      alumnos.filter(
        (alumno) => !alumno.disciplina || !alumno.grado || !alumno.objetivo,
      ),
    [alumnos],
  );

  const abrirProgreso = async (alumno: Alumno) => {
    setAlumnoEditado(alumno);
    setProgreso({
      disciplina: alumno.disciplina || "",
      grado: alumno.grado || "",
      fechaPromocion: alumno.fechaPromocion || "",
      objetivo: alumno.objetivo || "",
      pesoActual: alumno.pesoActual?.toString() || "",
      pesoObjetivo: alumno.pesoObjetivo?.toString() || "",
      proximaCompetencia: alumno.proximaCompetencia || "",
      fechaCompetencia: alumno.fechaCompetencia || "",
      categoriaDeportiva: alumno.categoriaDeportiva || "",
      fechaIngreso: alumno.fechaIngreso || "",
      historialPromociones: (alumno.historialPromociones || [])
        .map((item) => `${item.fecha} | ${item.grado}`)
        .join("\n"),
      resultadosCompetencias: (alumno.resultadosCompetencias || [])
        .map(
          (item) => `${item.fecha} | ${item.evento} | ${item.resultado}`,
        )
        .join("\n"),
    });
    if (firestore) {
      const notaSnapshot = await getDoc(
        doc(firestore, "NotasPrivadasAtletas", alumno.id),
      );
      setNotaPrivada(
        notaSnapshot.exists() ? String(notaSnapshot.data().nota || "") : "",
      );
    }
  };

  const registrarMovimiento = async (
    accion: string,
    alumno: Alumno,
    detalle: string,
  ) => {
    if (!firestore || !user) return;
    await addDoc(collection(firestore, "MovimientosAdmin"), {
      accion,
      alumnoId: alumno.id,
      alumnoNombre: alumno.nombre,
      sede,
      detalle,
      actorUid: user.uid,
      actorEmail: user.email || "",
      creadoEn: serverTimestamp(),
    });
  };

  const guardarProgreso = async () => {
    if (!firestore || !alumnoEditado || guardando) return;
    setGuardando(true);
    try {
      const datos = {
        disciplina: progreso.disciplina.trim(),
        grado: progreso.grado.trim(),
        fechaPromocion: progreso.fechaPromocion,
        objetivo: progreso.objetivo.trim(),
        pesoActual: progreso.pesoActual
          ? Number(progreso.pesoActual)
          : null,
        pesoObjetivo: progreso.pesoObjetivo
          ? Number(progreso.pesoObjetivo)
          : null,
        proximaCompetencia: progreso.proximaCompetencia.trim(),
        fechaCompetencia: progreso.fechaCompetencia,
        categoriaDeportiva: progreso.categoriaDeportiva.trim(),
        fechaIngreso: progreso.fechaIngreso,
        historialPromociones: progreso.historialPromociones
          .split("\n")
          .map((linea) => linea.split("|").map((valor) => valor.trim()))
          .filter(([fecha, grado]) => fecha && grado)
          .map(([fecha, grado]) => ({ fecha, grado })),
        resultadosCompetencias: progreso.resultadosCompetencias
          .split("\n")
          .map((linea) => linea.split("|").map((valor) => valor.trim()))
          .filter(
            ([fecha, evento, resultado]) => fecha && evento && resultado,
          )
          .map(([fecha, evento, resultado]) => ({
            fecha,
            evento,
            resultado,
          })),
        actualizadoEn: serverTimestamp(),
      };
      await updateDoc(doc(firestore, "Alumnos", alumnoEditado.id), datos);
      await setDoc(
        doc(firestore, "NotasPrivadasAtletas", alumnoEditado.id),
        {
          alumnoId: alumnoEditado.id,
          alumnoNombre: alumnoEditado.nombre,
          sede,
          nota: notaPrivada.trim(),
          actualizadoPor: user?.uid || "",
          actualizadoEn: serverTimestamp(),
        },
        { merge: true },
      );
      await registrarMovimiento(
        "actualizar_progreso",
        alumnoEditado,
        "Disciplina, grado, objetivo, peso o competencia.",
      );
      setAlumnoEditado(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  };

  const resolverSolicitud = async (solicitud: Solicitud) => {
    if (!firestore || guardando) return;
    const alumno = alumnos.find((item) => item.id === solicitud.alumnoId);
    if (!alumno) return;
    setGuardando(true);
    try {
      await updateDoc(doc(firestore, "SolicitudesCorreccion", solicitud.id), {
        estado: "resuelta",
        resueltaEn: serverTimestamp(),
        resueltaPor: user?.uid || "",
      });
      await registrarMovimiento(
        "resolver_correccion",
        alumno,
        solicitud.detalle || "Solicitud resuelta.",
      );
      setSolicitudes((lista) =>
        lista.filter((item) => item.id !== solicitud.id),
      );
    } finally {
      setGuardando(false);
    }
  };

  const enlaceWhatsApp = (alumno: Alumno) => {
    const telefono = (alumno.telefono || "").replace(/\D/g, "");
    const numero = telefono.startsWith("52") ? telefono : `52${telefono}`;
    const mensaje = encodeURIComponent(
      `Hola ${alumno.nombre}, te contactamos de ALBATROS ${
        sede.replaceAll("_", " ")
      } para recordarte que tu mensualidad aparece pendiente. Si ya realizaste el pago, por favor ignora este mensaje.`,
    );
    return `https://wa.me/${numero}?text=${mensaje}`;
  };

  const recalcularResumenMensual = async () => {
    if (!firestore || calculandoResumen) return;
    setCalculandoResumen(true);
    try {
      const [pagosSnapshot, asistenciasSnapshot] = await Promise.all([
        getDocs(
          query(collection(firestore, "Pagos"), where("sede", "==", sede)),
        ),
        getDocs(
          query(
            collection(firestore, "Asistencias"),
            where("sede", "==", sede),
          ),
        ),
      ]);
      setLecturasEstimadas(
        (actual) =>
          actual + pagosSnapshot.size + asistenciasSnapshot.size,
      );
      const ahora = new Date();
      const periodo = `${ahora.getFullYear()}-${String(
        ahora.getMonth() + 1,
      ).padStart(2, "0")}`;
      const pagosPorAlumno = new Map<string, number>();
      const asistenciasPorAlumno = new Map<string, Set<string>>();

      pagosSnapshot.docs.forEach((registro) => {
        const datos = registro.data();
        const fecha = datos.fecha?.toDate?.();
        if (
          fecha &&
          `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(
            2,
            "0",
          )}` === periodo
        ) {
          pagosPorAlumno.set(
            datos.alumnoId,
            (pagosPorAlumno.get(datos.alumnoId) || 0) +
              Number(datos.monto || 0),
          );
        }
      });
      asistenciasSnapshot.docs.forEach((registro) => {
        const datos = registro.data();
        const fecha = datos.fecha?.toDate?.();
        if (
          fecha &&
          `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(
            2,
            "0",
          )}` === periodo
        ) {
          const dias =
            asistenciasPorAlumno.get(datos.alumnoId) || new Set<string>();
          dias.add(fecha.toISOString().slice(0, 10));
          asistenciasPorAlumno.set(datos.alumnoId, dias);
        }
      });

      const lote = writeBatch(firestore);
      alumnos.forEach((alumno) => {
        lote.set(
          doc(
            firestore,
            "ResumenesMensuales",
            `${sede}_${periodo}_${alumno.id}`,
          ),
          {
            alumnoId: alumno.id,
            alumnoNombre: alumno.nombre,
            sede,
            periodo,
            asistencias: asistenciasPorAlumno.get(alumno.id)?.size || 0,
            pagos: pagosPorAlumno.get(alumno.id) || 0,
            actualizadoEn: serverTimestamp(),
          },
          { merge: true },
        );
      });
      await lote.commit();
      alert(`Resumen ${periodo} actualizado para ${alumnos.length} alumnos.`);
    } finally {
      setCalculandoResumen(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="outline">SEDE {sede.replaceAll("_", " ")}</Badge>
          <h1 className="mt-3 text-3xl font-black uppercase italic md:text-4xl">
            Gestión de atletas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Correcciones, progreso, recordatorios y alertas en una sola vista.
          </p>
        </div>
        <Button variant="outline" onClick={() => void cargar()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
        <Button
          variant="outline"
          disabled={calculandoResumen}
          onClick={() => void recalcularResumenMensual()}
        >
          {calculandoResumen ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          Resumen mensual
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Correcciones",
            value: solicitudes.length,
            icon: ClipboardList,
          },
          { label: "Pagos pendientes", value: morosos.length, icon: AlertTriangle },
          { label: "Sin tag", value: sinTag.length, icon: ShieldCheck },
          {
            label: "Progreso incompleto",
            value: progresoIncompleto.length,
            icon: Medal,
          },
          {
            label: "Lecturas estimadas",
            value: lecturasEstimadas,
            icon: RefreshCw,
          },
        ].map((indicador) => (
          <Card key={indicador.label} className="border-primary/10 bg-card/55">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-black uppercase text-muted-foreground">
                  {indicador.label}
                </p>
                <p className="mt-2 text-3xl font-black">{indicador.value}</p>
              </div>
              <indicador.icon className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/10 bg-card/55">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-black uppercase italic">
            <ClipboardList className="h-5 w-5 text-primary" />
            Solicitudes de corrección
          </CardTitle>
        </CardHeader>
        <CardContent>
          {solicitudes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay solicitudes pendientes en esta sede.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {solicitudes.map((solicitud) => (
                <article
                  key={solicitud.id}
                  className="rounded-2xl border border-primary/10 bg-background/35 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{solicitud.alumnoNombre}</p>
                      <Badge variant="secondary" className="mt-2">
                        {CATEGORIAS[solicitud.categoria || ""] ||
                          solicitud.categoria ||
                          "Corrección"}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      disabled={guardando}
                      onClick={() => void resolverSolicitud(solicitud)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Resolver
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {solicitud.detalle}
                  </p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/10 bg-card/55">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 font-black uppercase italic">
            <UserRound className="h-5 w-5 text-primary" />
            Expedientes y progreso
          </CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar nombre o teléfono..."
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {alumnosFiltrados.map((alumno) => (
                <article
                  key={alumno.id}
                  className="rounded-2xl border border-primary/10 bg-background/35 p-4"
                >
                  <p className="font-black uppercase italic">{alumno.nombre}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {alumno.disciplina || "Sin disciplina"} ·{" "}
                    {alumno.grado || "Sin grado"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void abrirProgreso(alumno)}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      Progreso
                    </Button>
                    {alumno.estadoPago !== "Pagado" && alumno.telefono && (
                      <Button
                        asChild
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        <a
                          href={enlaceWhatsApp(alumno)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Recordar pago
                        </a>
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(alumnoEditado)}
        onOpenChange={(abierto) => !abierto && setAlumnoEditado(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase italic">
              Progreso de {alumnoEditado?.nombre}
            </DialogTitle>
            <DialogDescription>
              Los cambios se reflejan automáticamente en Mi Academia.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {[
              ["disciplina", "Disciplina", "text"],
              ["grado", "Grado", "text"],
              ["fechaPromocion", "Fecha de promoción", "date"],
              ["objetivo", "Objetivo", "text"],
              ["pesoActual", "Peso actual (kg)", "number"],
              ["pesoObjetivo", "Peso objetivo (kg)", "number"],
              ["proximaCompetencia", "Próxima competencia", "text"],
              ["fechaCompetencia", "Fecha de competencia", "date"],
              ["categoriaDeportiva", "Categoría deportiva", "text"],
              ["fechaIngreso", "Fecha de ingreso", "date"],
            ].map(([campo, etiqueta, tipo]) => (
              <div key={campo} className="space-y-2">
                <Label htmlFor={`progress-${campo}`}>{etiqueta}</Label>
                <Input
                  id={`progress-${campo}`}
                  type={tipo}
                  value={progreso[campo as keyof typeof progreso]}
                  onChange={(event) =>
                    setProgreso((actual) => ({
                      ...actual,
                      [campo]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="promotion-history">
                Historial de promociones
              </Label>
              <textarea
                id="promotion-history"
                rows={4}
                value={progreso.historialPromociones}
                onChange={(event) =>
                  setProgreso((actual) => ({
                    ...actual,
                    historialPromociones: event.target.value,
                  }))
                }
                placeholder={"2026-07-29 | Cinta morada\n2025-02-10 | Cinta azul"}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Una promoción por línea: fecha | grado.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="competition-results">
                Resultados de competencias
              </Label>
              <textarea
                id="competition-results"
                rows={4}
                value={progreso.resultadosCompetencias}
                onChange={(event) =>
                  setProgreso((actual) => ({
                    ...actual,
                    resultadosCompetencias: event.target.value,
                  }))
                }
                placeholder={
                  "2026-06-27 | Campeonato estatal | Medalla de plata"
                }
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Un resultado por línea: fecha | evento | resultado.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="private-note">
                Notas privadas para profesores
              </Label>
              <textarea
                id="private-note"
                rows={4}
                maxLength={2000}
                value={notaPrivada}
                onChange={(event) => setNotaPrivada(event.target.value)}
                placeholder="Observaciones técnicas, seguimiento o indicaciones internas..."
                className="w-full resize-y rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Esta nota se guarda aparte y no puede verla el atleta.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlumnoEditado(null)}>
              Cancelar
            </Button>
            <Button disabled={guardando} onClick={() => void guardarProgreso()}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
