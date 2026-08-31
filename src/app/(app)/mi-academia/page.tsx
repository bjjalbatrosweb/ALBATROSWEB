"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Bell,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CheckCheck,
  Clock3,
  CreditCard,
  FileText,
  Flame,
  HeartPulse,
  HelpCircle,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Megaphone,
  Medal,
  Info,
  IdCard,
  ShieldCheck,
  Printer,
  Radio,
  Moon,
  Phone,
  Pill,
  PencilLine,
  ReceiptText,
  Target,
  Sun,
  TrendingUp,
  Trophy,
  TriangleAlert,
  UserRound,
  Weight,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirestore, useUser } from "@/firebase";
import {
  ATHLETE_NOTIFICATION_PREFERENCE_KEY,
  disableAthletePushNotifications,
  enableAthletePushNotifications,
  listenForAthletePushNotifications,
  syncAthletePushNotifications,
} from "@/lib/athlete-push-notifications";
import {
  getPrimaryAthleteBadge,
  normalizeAthleteBadgeIds,
  type AthleteBadgeId,
} from "@/lib/athlete-badges";
import { normalizeAthletePhotoUrl } from "@/lib/athlete-photo";

type UsuarioAcceso = {
  activo?: boolean;
  rol?: string;
  alumnoId?: string;
  sede?: string;
};

type Alumno = {
  id: string;
  nombre: string;
  sede?: string;
  activo?: boolean;
  estadoPago?: "Pagado" | "Falta de Pago" | "Retraso";
  diaPago?: number;
  montoPago?: number;
  periodoUltimoPago?: string;
  disciplina?: string;
  grado?: string;
  fechaPromocion?: string;
  objetivo?: string;
  pesoActual?: number;
  pesoObjetivo?: number;
  proximaCompetencia?: string;
  fechaCompetencia?: string;
  fotoUrl?: string;
  insignias?: AthleteBadgeId[];
  rfid?: string;
  rfids?: string[];
  tipoSangre?: string;
  alergias?: string;
  condicionesMedicas?: string;
  medicamentos?: string;
  contactoEmergencia?: string;
  telefonoEmergencia?: string;
  emergencia?: {
    fechaNacimiento?: string;
    tipoSangre?: string;
    alergias?: string;
    condicionesMedicas?: string;
    medicamentos?: string;
    contactoNombre?: string;
    contactoParentesco?: string;
    contactoTelefono?: string;
    indicaciones?: string;
    activo?: boolean;
  };
};

type Pago = {
  id: string;
  monto?: number;
  periodo?: string;
  metodoPago?: string;
  fecha?: Timestamp;
};

type Asistencia = {
  id: string;
  fecha?: Timestamp;
};

type Aviso = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo?: "general" | "horario" | "evento" | "urgente";
  activo?: boolean;
  venceEn?: Timestamp | null;
  creadoEn?: Timestamp;
};

const HORARIOS = [
  {
    id: "kick-matutino",
    disciplina: "Kick Boxing",
    dias: "Lunes, miércoles y viernes",
    diasSemana: [1, 3, 5],
    hora: "7:00–8:00 a. m.",
    minutos: 7 * 60,
    turno: "Matutino",
  },
  {
    id: "mma-matutino",
    disciplina: "MMA",
    dias: "Lunes, miércoles y viernes",
    diasSemana: [1, 3, 5],
    hora: "8:00–9:00 a. m.",
    minutos: 8 * 60,
    turno: "Matutino",
  },
  {
    id: "bjj-matutino",
    disciplina: "Jiu-Jitsu",
    dias: "Lunes, miércoles y viernes",
    diasSemana: [1, 3, 5],
    hora: "9:00–10:00 a. m.",
    minutos: 9 * 60,
    turno: "Matutino",
  },
  {
    id: "bjj-vespertino",
    disciplina: "Jiu-Jitsu",
    dias: "Martes, jueves y sábado",
    diasSemana: [2, 4, 6],
    hora: "7:00–8:00 p. m.",
    minutos: 19 * 60,
    turno: "Vespertino",
  },
  {
    id: "kick-mma-vespertino",
    disciplina: "Kick Boxing / MMA",
    dias: "Martes, jueves y sábado",
    diasSemana: [2, 4, 6],
    hora: "8:00–9:00 p. m.",
    minutos: 20 * 60,
    turno: "Vespertino",
  },
  {
    id: "mma-vespertino",
    disciplina: "MMA",
    dias: "Martes, jueves y sábado",
    diasSemana: [2, 4, 6],
    hora: "9:00–10:00 p. m.",
    minutos: 21 * 60,
    turno: "Vespertino",
  },
] as const;

function normalizarDisciplina(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function fechaLegible(valor?: Timestamp) {
  const fecha = valor?.toDate?.();
  return fecha && !Number.isNaN(fecha.getTime())
    ? format(fecha, "dd MMM yyyy", { locale: es })
    : "Sin fecha";
}

function escaparHtml(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function calcularVencimiento(diaPago: number, pagadoMesActual: boolean) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const crearFecha = (anio: number, mes: number) => {
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    return new Date(anio, mes, Math.min(Math.max(diaPago, 1), ultimoDia));
  };

  let vencimiento = crearFecha(hoy.getFullYear(), hoy.getMonth());
  if (pagadoMesActual) {
    vencimiento = crearFecha(hoy.getFullYear(), hoy.getMonth() + 1);
  }

  vencimiento.setHours(0, 0, 0, 0);
  const dias = Math.round(
    (vencimiento.getTime() - hoy.getTime()) / 86_400_000,
  );

  return { vencimiento, dias };
}

export default function MiAcademiaPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinVincular, setSinVincular] = useState(false);
  const [error, setError] = useState("");
  const [nombreSolicitud, setNombreSolicitud] = useState("");
  const [telefonoSolicitud, setTelefonoSolicitud] = useState("");
  const [sedeSolicitud, setSedeSolicitud] = useState("MMA");
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [reciboSeleccionado, setReciboSeleccionado] =
    useState<Pago | null>(null);
  const [asistenciaExpandida, setAsistenciaExpandida] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [avisosExpandidos, setAvisosExpandidos] = useState(false);
  const [avisosLeidos, setAvisosLeidos] = useState<Set<string>>(new Set());
  const [notificacionesAvisos, setNotificacionesAvisos] = useState(false);
  const [cambiandoNotificaciones, setCambiandoNotificaciones] =
    useState(false);
  const [credencialAbierta, setCredencialAbierta] = useState(false);
  const [horariosExpandidos, setHorariosExpandidos] = useState(false);
  const [emergenciaExpandida, setEmergenciaExpandida] = useState(false);
  const [ayudaExpandida, setAyudaExpandida] = useState(false);
  const [logrosExpandidos, setLogrosExpandidos] = useState(false);
  const [correccionAbierta, setCorreccionAbierta] = useState(false);
  const [categoriaCorreccion, setCategoriaCorreccion] = useState("datos");
  const [detalleCorreccion, setDetalleCorreccion] = useState("");
  const [enviandoCorreccion, setEnviandoCorreccion] = useState(false);
  const [imagenPerfilConError, setImagenPerfilConError] = useState(false);
  const fotoPerfilUrl = useMemo(
    () => normalizeAthletePhotoUrl(alumno?.fotoUrl),
    [alumno?.fotoUrl],
  );

  useEffect(() => {
    setImagenPerfilConError(false);
  }, [fotoPerfilUrl]);

  useEffect(() => {
    if (!user) return;
    try {
      const leidos = JSON.parse(
        localStorage.getItem(`albatrosAvisosLeidos:${user.uid}`) || "[]",
      ) as string[];
      setAvisosLeidos(new Set(Array.isArray(leidos) ? leidos : []));
    } catch {
      setAvisosLeidos(new Set());
    }
    setNotificacionesAvisos(
      localStorage.getItem(ATHLETE_NOTIFICATION_PREFERENCE_KEY) === "true" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted",
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    if (
      localStorage.getItem(ATHLETE_NOTIFICATION_PREFERENCE_KEY) === "true" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      void syncAthletePushNotifications(user).catch((notificationError) => {
        console.error(
          "No se pudo sincronizar la suscripción push:",
          notificationError,
        );
      });

      void listenForAthletePushNotifications()
        .then((stop) => {
          if (mounted) unsubscribe = stop;
          else stop();
        })
        .catch((notificationError) => {
          console.error(
            "No se pudo escuchar notificaciones push:",
            notificationError,
          );
        });
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [user, notificacionesAvisos]);

  const marcarAvisoLeido = (avisoId: string) => {
    if (!user) return;
    setAvisosLeidos((anteriores) => {
      const siguientes = new Set(anteriores);
      siguientes.add(avisoId);
      localStorage.setItem(
        `albatrosAvisosLeidos:${user.uid}`,
        JSON.stringify(Array.from(siguientes)),
      );
      return siguientes;
    });
  };

  const marcarTodosLeidos = () => {
    if (!user) return;
    const siguientes = new Set(avisos.map((aviso) => aviso.id));
    setAvisosLeidos(siguientes);
    localStorage.setItem(
      `albatrosAvisosLeidos:${user.uid}`,
      JSON.stringify(Array.from(siguientes)),
    );
  };

  const activarNotificaciones = async () => {
    if (!user || cambiandoNotificaciones) return;

    try {
      setCambiandoNotificaciones(true);
      if (notificacionesAvisos) {
        await disableAthletePushNotifications(user);
        setNotificacionesAvisos(false);
      } else {
        await enableAthletePushNotifications(user);
        setNotificacionesAvisos(true);
      }
    } catch (notificationError) {
      window.alert(
        notificationError instanceof Error
          ? notificationError.message
          : "No se pudieron configurar las notificaciones.",
      );
    } finally {
      setCambiandoNotificaciones(false);
    }
  };

  useEffect(() => {
    if (!user || !firestore) return;

    let activo = true;

    const cargarPortal = async () => {
      setCargando(true);
      setError("");

      try {
        const accesoSnapshot = await getDoc(
          doc(firestore, "usuarios", user.uid),
        );
        const acceso = accesoSnapshot.exists()
          ? (accesoSnapshot.data() as UsuarioAcceso)
          : null;

        if (
          !acceso ||
          acceso.activo !== true ||
          acceso.rol !== "atleta" ||
          !acceso.alumnoId
        ) {
          if (activo) setSinVincular(true);
          return;
        }

        const alumnoId = acceso.alumnoId;
        const alumnoSnapshot = await getDoc(
          doc(firestore, "Alumnos", alumnoId),
        );

        if (!alumnoSnapshot.exists()) {
          throw new Error("La ficha vinculada ya no existe.");
        }

        const datosAlumno = alumnoSnapshot.data() as Omit<Alumno, "id">;
        const sedeAlumno = datosAlumno.sede || acceso.sede || "MMA";
        const [pagosSnapshot, asistenciasSnapshot, avisosSnapshot] =
          await Promise.all([
          getDocs(
            query(
              collection(firestore, "Pagos"),
              where("alumnoId", "==", alumnoId),
            ),
          ),
          getDocs(
            query(
              collection(firestore, "Asistencias"),
              where("alumnoId", "==", alumnoId),
            ),
          ),
          getDocs(
            query(
              collection(firestore, "Anuncios"),
              where("sede", "==", sedeAlumno),
            ),
          ),
        ]);

        if (!activo) return;

        setAlumno({
          id: alumnoSnapshot.id,
          ...datosAlumno,
        });
        setPagos(
          pagosSnapshot.docs
            .map((documento) => ({
              id: documento.id,
              ...(documento.data() as Omit<Pago, "id">),
            }))
            .sort(
              (a, b) =>
                (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0),
            ),
        );
        setAsistencias(
          asistenciasSnapshot.docs
            .map((documento) => ({
              id: documento.id,
              ...(documento.data() as Omit<Asistencia, "id">),
            }))
            .sort(
              (a, b) =>
                (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0),
            ),
        );
        const ahora = Date.now();
        const avisosActivos = avisosSnapshot.docs
          .map((documento) => ({
            id: documento.id,
            ...(documento.data() as Omit<Aviso, "id">),
          }))
          .filter(
            (aviso) =>
              aviso.activo !== false &&
              (!aviso.venceEn ||
                (aviso.venceEn.toMillis?.() || Number.MAX_SAFE_INTEGER) >=
                  ahora),
          )
          .sort(
            (a, b) =>
              (b.creadoEn?.toMillis?.() || 0) -
              (a.creadoEn?.toMillis?.() || 0),
          )
          .slice(0, 8);
        setAvisos(avisosActivos);
        setAvisosExpandidos(
          avisosActivos.some((aviso) => aviso.tipo === "urgente"),
        );

        const claveConocidos = `albatrosAvisosConocidos:${user.uid}`;
        const conocidosGuardados = localStorage.getItem(claveConocidos);
        let conocidos: string[] = [];
        try {
          conocidos = conocidosGuardados
            ? (JSON.parse(conocidosGuardados) as string[])
            : [];
        } catch {
          conocidos = [];
        }
        const nuevos = conocidosGuardados
          ? avisosActivos.filter((aviso) => !conocidos.includes(aviso.id))
          : [];
        localStorage.setItem(
          claveConocidos,
          JSON.stringify(avisosActivos.map((aviso) => aviso.id)),
        );

        if (
          nuevos.length > 0 &&
          localStorage.getItem(ATHLETE_NOTIFICATION_PREFERENCE_KEY) === "true" &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          "serviceWorker" in navigator
        ) {
          const nuevo = nuevos[0];
          const registro = await navigator.serviceWorker.ready;
          await registro.showNotification(
            nuevos.length === 1
              ? nuevo.titulo
              : `${nuevos.length} avisos nuevos de ALBATROS`,
            {
              body:
                nuevos.length === 1
                  ? nuevo.mensaje.slice(0, 150)
                  : "Abre Mi Academia para consultar las novedades.",
              icon: "/milogo.png",
              badge: "/milogo.png",
              lang: "es-MX",
              data: { url: "/mi-academia" },
              tag: "albatros-athlete-announcements",
            },
          );
        }
      } catch (problema) {
        if (activo) {
          setError(
            problema instanceof Error
              ? problema.message
              : "No fue posible cargar tu información.",
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    };

    void cargarPortal();

    return () => {
      activo = false;
    };
  }, [firestore, user]);

  const asistenciasMes = useMemo(() => {
    const periodo = format(new Date(), "yyyy-MM");
    const dias = new Set(
      asistencias
        .map((registro) => registro.fecha?.toDate?.())
        .filter(
          (fecha): fecha is Date =>
            Boolean(fecha) && format(fecha as Date, "yyyy-MM") === periodo,
        )
        .map((fecha) => format(fecha, "yyyy-MM-dd")),
    );
    return dias.size;
  }, [asistencias]);

  const analiticaAsistencia = useMemo(() => {
    const fechas = new Set(
      asistencias
        .map((registro) => registro.fecha?.toDate?.())
        .filter((fecha): fecha is Date => Boolean(fecha))
        .map((fecha) => format(fecha, "yyyy-MM-dd")),
    );
    const hoy = new Date();
    const meses = Array.from({ length: 6 }, (_, indice) => {
      const fecha = new Date(
        hoy.getFullYear(),
        hoy.getMonth() - (5 - indice),
        1,
      );
      const periodo = format(fecha, "yyyy-MM");
      return {
        periodo,
        etiqueta: format(fecha, "MMM", { locale: es }).replace(".", ""),
        total: Array.from(fechas).filter((dia) => dia.startsWith(periodo))
          .length,
      };
    });

    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const totalDias = new Date(
      hoy.getFullYear(),
      hoy.getMonth() + 1,
      0,
    ).getDate();
    const espaciosIniciales = (inicioMes.getDay() + 6) % 7;
    const calendario = [
      ...Array.from({ length: espaciosIniciales }, () => null),
      ...Array.from({ length: totalDias }, (_, indice) => {
        const dia = indice + 1;
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
        return {
          dia,
          asistio: fechas.has(format(fecha, "yyyy-MM-dd")),
          futuro: fecha.getTime() > hoy.getTime(),
        };
      }),
    ];

    const semanas = new Set(
      Array.from(fechas).map((dia) => {
        const fecha = new Date(`${dia}T12:00:00`);
        const inicio = new Date(fecha);
        inicio.setDate(fecha.getDate() - ((fecha.getDay() + 6) % 7));
        return format(inicio, "yyyy-MM-dd");
      }),
    );
    const lunesActual = new Date(hoy);
    lunesActual.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    lunesActual.setHours(12, 0, 0, 0);
    if (!semanas.has(format(lunesActual, "yyyy-MM-dd"))) {
      lunesActual.setDate(lunesActual.getDate() - 7);
    }
    let rachaSemanas = 0;
    const cursor = new Date(lunesActual);
    while (semanas.has(format(cursor, "yyyy-MM-dd"))) {
      rachaSemanas += 1;
      cursor.setDate(cursor.getDate() - 7);
    }

    return {
      meses,
      calendario,
      rachaSemanas,
      maximoMensual: Math.max(...meses.map((mes) => mes.total), 1),
      nombreMes: format(hoy, "MMMM yyyy", { locale: es }),
    };
  }, [asistencias]);

  const progresoLogros = useMemo(() => {
    const totalAsistencias = new Set(
      asistencias
        .map((registro) => registro.fecha?.toDate?.())
        .filter((fecha): fecha is Date => Boolean(fecha))
        .map((fecha) => format(fecha, "yyyy-MM-dd")),
    ).size;
    const metas = [
      {
        id: "primer-paso",
        nombre: "Primer paso",
        descripcion: "Registraste tu primera asistencia.",
        meta: 1,
      },
      {
        id: "constante",
        nombre: "Atleta constante",
        descripcion: "Acumulaste 10 días de entrenamiento.",
        meta: 10,
      },
      {
        id: "disciplina",
        nombre: "Disciplina de acero",
        descripcion: "Acumulaste 25 días de entrenamiento.",
        meta: 25,
      },
      {
        id: "guerrero",
        nombre: "Guerrero ALBATROS",
        descripcion: "Acumulaste 50 días de entrenamiento.",
        meta: 50,
      },
      {
        id: "elite",
        nombre: "Constancia de élite",
        descripcion: "Acumulaste 100 días de entrenamiento.",
        meta: 100,
      },
    ].map((logro) => ({
      ...logro,
      desbloqueado: totalAsistencias >= logro.meta,
      progreso: Math.min((totalAsistencias / logro.meta) * 100, 100),
    }));
    const siguiente = metas.find((logro) => !logro.desbloqueado) || null;
    return {
      totalAsistencias,
      metas,
      siguiente,
      desbloqueados: metas.filter((logro) => logro.desbloqueado).length,
    };
  }, [asistencias]);

  const totalPagado = useMemo(
    () => pagos.reduce((total, pago) => total + Number(pago.monto || 0), 0),
    [pagos],
  );
  const avisosNoLeidos = useMemo(
    () => avisos.filter((aviso) => !avisosLeidos.has(aviso.id)).length,
    [avisos, avisosLeidos],
  );
  const resumenHorarios = useMemo(() => {
    const disciplinaAlumno = normalizarDisciplina(alumno?.disciplina || "");
    const coincide = (disciplinaClase: string) => {
      if (!disciplinaAlumno) return false;
      const clase = normalizarDisciplina(disciplinaClase);
      return (
        (disciplinaAlumno.includes("mma") && clase.includes("mma")) ||
        (disciplinaAlumno.includes("kick") && clase.includes("kick")) ||
        ((disciplinaAlumno.includes("jiujitsu") ||
          disciplinaAlumno.includes("bjj")) &&
          clase.includes("jiujitsu"))
      );
    };
    const destacados = new Set(
      HORARIOS.filter((horario) => coincide(horario.disciplina)).map(
        (horario) => horario.id,
      ),
    );
    const base = destacados.size
      ? HORARIOS.filter((horario) => destacados.has(horario.id))
      : HORARIOS;
    const ahora = new Date();
    const candidatos = base.flatMap((horario) => {
      for (let diferencia = 0; diferencia <= 7; diferencia += 1) {
        const fecha = new Date(
          ahora.getFullYear(),
          ahora.getMonth(),
          ahora.getDate() + diferencia,
        );
        if (
          !(horario.diasSemana as readonly number[]).includes(fecha.getDay())
        ) {
          continue;
        }
        fecha.setHours(
          Math.floor(horario.minutos / 60),
          horario.minutos % 60,
          0,
          0,
        );
        if (fecha.getTime() > ahora.getTime()) {
          return [{ horario, fecha }];
        }
      }
      return [];
    });
    candidatos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return { destacados, proxima: candidatos[0] || null };
  }, [alumno?.disciplina]);

  const enviarSolicitud = async () => {
    if (!user || !firestore || enviandoSolicitud) return;

    const nombre = nombreSolicitud.trim();
    if (nombre.length < 3) {
      setError("Escribe tu nombre completo para que recepción te identifique.");
      return;
    }

    try {
      setEnviandoSolicitud(true);
      setError("");
      await setDoc(
        doc(firestore, "SolicitudesAcceso", user.uid),
        {
          uid: user.uid,
          email: user.email || "",
          nombre,
          telefono: telefonoSolicitud.trim(),
          sede: sedeSolicitud,
          estado: "pendiente",
          creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        },
        { merge: true },
      );
      setSolicitudEnviada(true);
    } catch (problema) {
      setError(
        problema instanceof Error
          ? problema.message
          : "No fue posible enviar la solicitud.",
      );
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const enviarCorreccion = async () => {
    if (
      !user ||
      !firestore ||
      !alumno ||
      enviandoCorreccion ||
      detalleCorreccion.trim().length < 8
    ) {
      return;
    }

    try {
      setEnviandoCorreccion(true);
      await addDoc(collection(firestore, "SolicitudesCorreccion"), {
        uid: user.uid,
        alumnoId: alumno.id,
        alumnoNombre: alumno.nombre,
        sede: alumno.sede || "MMA",
        categoria: categoriaCorreccion,
        detalle: detalleCorreccion.trim(),
        estado: "pendiente",
        creadoEn: serverTimestamp(),
      });
      setDetalleCorreccion("");
      setCorreccionAbierta(false);
    } catch (problema) {
      setError(
        problema instanceof Error
          ? problema.message
          : "No fue posible enviar la solicitud de corrección.",
      );
    } finally {
      setEnviandoCorreccion(false);
    }
  };

  const imprimirRecibo = () => {
    if (!reciboSeleccionado || !alumno) return;

    const ventana = window.open("", "_blank", "width=760,height=900");
    if (!ventana) return;

    const nombre = escaparHtml(alumno.nombre);
    const sede = escaparHtml(alumno.sede?.replace("_", " ") || "ALBATROS");
    const periodo = escaparHtml(reciboSeleccionado.periodo || "Sin periodo");
    const metodo = escaparHtml(
      reciboSeleccionado.metodoPago || "No registrado",
    );
    const fecha = escaparHtml(fechaLegible(reciboSeleccionado.fecha));
    const monto = Number(reciboSeleccionado.monto || 0).toLocaleString(
      "es-MX",
      { minimumFractionDigits: 2 },
    );

    ventana.document.open();
    ventana.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Recibo ${periodo} · ${nombre}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 48px 24px;
              background: #f3f4f6;
              color: #101114;
              font-family: Arial, Helvetica, sans-serif;
            }
            .receipt {
              max-width: 620px;
              margin: 0 auto;
              overflow: hidden;
              border: 1px solid #e5e7eb;
              border-radius: 24px;
              background: white;
              box-shadow: 0 24px 70px rgba(0,0,0,.12);
            }
            .head {
              padding: 30px;
              background: #090a0d;
              color: white;
              border-bottom: 5px solid #ff1010;
            }
            .brand {
              margin: 0;
              color: #ff1616;
              font-size: 30px;
              font-weight: 900;
              letter-spacing: .08em;
            }
            .subtitle {
              margin: 8px 0 0;
              color: #aeb0b6;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: .16em;
              text-transform: uppercase;
            }
            .body { padding: 30px; }
            .status {
              display: inline-block;
              padding: 8px 12px;
              border: 1px solid #86efac;
              border-radius: 999px;
              background: #dcfce7;
              color: #15803d;
              font-size: 11px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .amount {
              margin: 22px 0 5px;
              font-size: 48px;
              font-weight: 900;
              letter-spacing: -.05em;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-top: 26px;
            }
            .item {
              padding: 16px;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
            }
            .label {
              margin: 0 0 6px;
              color: #6b7280;
              font-size: 10px;
              font-weight: 800;
              letter-spacing: .1em;
              text-transform: uppercase;
            }
            .value { margin: 0; font-weight: 800; }
            .foot {
              padding: 18px 30px;
              border-top: 1px dashed #d1d5db;
              color: #6b7280;
              font-size: 11px;
              text-align: center;
            }
            @media print {
              body { padding: 0; background: white; }
              .receipt { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <article class="receipt">
            <header class="head">
              <h1 class="brand">ALBATROS</h1>
              <p class="subtitle">Comprobante de mensualidad</p>
            </header>
            <main class="body">
              <span class="status">Pago registrado</span>
              <p class="amount">$${monto}</p>
              <p>${nombre}</p>
              <div class="grid">
                <div class="item">
                  <p class="label">Periodo</p>
                  <p class="value">${periodo}</p>
                </div>
                <div class="item">
                  <p class="label">Fecha</p>
                  <p class="value">${fecha}</p>
                </div>
                <div class="item">
                  <p class="label">Método</p>
                  <p class="value">${metodo}</p>
                </div>
                <div class="item">
                  <p class="label">Sede</p>
                  <p class="value">${sede}</p>
                </div>
              </div>
            </main>
            <footer class="foot">
              Comprobante generado desde el portal privado del atleta.
            </footer>
          </article>
          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>`);
    ventana.document.close();
  };

  const imprimirCredencial = () => {
    if (!alumno) return;
    const ventana = window.open("", "_blank", "width=900,height=680");
    if (!ventana) return;

    const nombre = escaparHtml(alumno.nombre);
    const sede = escaparHtml(alumno.sede?.replace("_", " ") || "ALBATROS");
    const disciplina = escaparHtml(alumno.disciplina || "Atleta ALBATROS");
    const grado = escaparHtml(alumno.grado || "Nivel no registrado");
    const identificador = escaparHtml(alumno.id.slice(0, 12).toUpperCase());
    const estado =
      alumno.estadoPago === "Pagado" &&
      alumno.periodoUltimoPago === format(new Date(), "yyyy-MM")
        ? "PAGO AL CORRIENTE"
        : "VALIDAR PAGO EN RECEPCIÓN";

    ventana.document.open();
    ventana.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Credencial · ${nombre}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              min-height: 100vh;
              margin: 0;
              display: grid;
              place-items: center;
              padding: 32px;
              background: #eceef2;
              font-family: Arial, Helvetica, sans-serif;
            }
            .card {
              position: relative;
              width: 760px;
              min-height: 430px;
              overflow: hidden;
              border: 1px solid #2a2b30;
              border-radius: 30px;
              background:
                radial-gradient(circle at 85% 15%, rgba(255,0,0,.24), transparent 28%),
                linear-gradient(135deg, #15161a, #07080a 62%);
              color: white;
              box-shadow: 0 30px 80px rgba(0,0,0,.32);
            }
            .stripe {
              position: absolute;
              inset: 0 auto 0 0;
              width: 12px;
              background: #ff1010;
            }
            .content { padding: 42px 46px 36px 58px; }
            .top {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 24px;
            }
            .brand {
              margin: 0;
              color: #ff1515;
              font-size: 36px;
              font-weight: 900;
              letter-spacing: .08em;
            }
            .type {
              margin: 6px 0 0;
              color: #8e919a;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: .2em;
            }
            .status {
              padding: 9px 13px;
              border: 1px solid #ff3434;
              border-radius: 999px;
              background: rgba(255,0,0,.1);
              color: #ff5b5b;
              font-size: 10px;
              font-weight: 900;
              letter-spacing: .08em;
            }
            .name {
              margin: 68px 0 8px;
              font-size: 42px;
              font-weight: 900;
              font-style: italic;
              letter-spacing: -.04em;
              text-transform: uppercase;
            }
            .discipline {
              margin: 0;
              color: #c4c6cc;
              font-size: 17px;
              font-weight: 700;
            }
            .bottom {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 14px;
              margin-top: 60px;
              padding-top: 20px;
              border-top: 1px solid #2e3036;
            }
            .label {
              margin: 0 0 5px;
              color: #747780;
              font-size: 9px;
              font-weight: 900;
              letter-spacing: .14em;
            }
            .value { margin: 0; font-size: 13px; font-weight: 800; }
            @media print {
              @page { size: landscape; margin: 12mm; }
              body { min-height: auto; padding: 0; background: white; }
              .card { box-shadow: none; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <article class="card">
            <div class="stripe"></div>
            <div class="content">
              <div class="top">
                <div>
                  <h1 class="brand">ALBATROS</h1>
                  <p class="type">CREDENCIAL DIGITAL DE ATLETA</p>
                </div>
                <span class="status">${estado}</span>
              </div>
              <h2 class="name">${nombre}</h2>
              <p class="discipline">${disciplina} · ${grado}</p>
              <div class="bottom">
                <div>
                  <p class="label">SEDE</p>
                  <p class="value">${sede}</p>
                </div>
                <div>
                  <p class="label">ID DE ATLETA</p>
                  <p class="value">${identificador}</p>
                </div>
                <div>
                  <p class="label">VERIFICACIÓN</p>
                  <p class="value">RFID / NFC EN RECEPCIÓN</p>
                </div>
              </div>
            </div>
          </article>
          <script>
            window.addEventListener("load", () => window.print());
          </script>
        </body>
      </html>`);
    ventana.document.close();
  };

  const imprimirResumenMensual = () => {
    if (!alumno) return;
    const ventana = window.open("", "_blank", "width=900,height=1000");
    if (!ventana) return;

    const hoy = new Date();
    const nombre = escaparHtml(alumno.nombre);
    const sede = escaparHtml(alumno.sede?.replaceAll("_", " ") || "ALBATROS");
    const disciplina = escaparHtml(alumno.disciplina || "Sin registrar");
    const grado = escaparHtml(alumno.grado || "Sin registrar");
    const mes = escaparHtml(
      format(hoy, "MMMM yyyy", { locale: es }).toUpperCase(),
    );
    const estado = alCorriente ? "PAGO AL CORRIENTE" : "PAGO PENDIENTE";
    const estadoClase = alCorriente ? "ok" : "warning";
    const proximaClase = resumenHorarios.proxima
      ? `${resumenHorarios.proxima.horario.disciplina} · ${format(
          resumenHorarios.proxima.fecha,
          "EEEE dd MMM, h:mm a",
          { locale: es },
        )}`
      : "Sin clase programada";
    const pagosMes = pagos.filter((pago) => {
      const fechaPago = pago.fecha?.toDate?.();
      return (
        fechaPago &&
        fechaPago.getMonth() === hoy.getMonth() &&
        fechaPago.getFullYear() === hoy.getFullYear()
      );
    });
    const pagadoMes = pagosMes.reduce(
      (total, pago) => total + Number(pago.monto || 0),
      0,
    );

    ventana.document.open();
    ventana.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Resumen ${mes} · ${nombre}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 36px 22px;
              background: #edf0f4;
              color: #101114;
              font-family: Arial, Helvetica, sans-serif;
            }
            .report {
              max-width: 760px;
              margin: 0 auto;
              overflow: hidden;
              border: 1px solid #dfe2e8;
              border-radius: 26px;
              background: white;
              box-shadow: 0 24px 70px rgba(0,0,0,.12);
            }
            .head {
              padding: 34px;
              background:
                radial-gradient(circle at 88% 12%, rgba(255,0,0,.24), transparent 30%),
                #090a0d;
              color: white;
              border-bottom: 5px solid #ff1010;
            }
            .brand {
              margin: 0;
              color: #ff1717;
              font-size: 34px;
              font-weight: 900;
              letter-spacing: .08em;
            }
            .eyebrow {
              margin: 9px 0 24px;
              color: #aeb1b8;
              font-size: 10px;
              font-weight: 900;
              letter-spacing: .18em;
            }
            h2 { margin: 0; font-size: 30px; text-transform: uppercase; }
            .meta { margin: 8px 0 0; color: #c1c3c8; }
            .body { padding: 30px 34px; }
            .status {
              display: inline-block;
              padding: 8px 12px;
              border-radius: 999px;
              font-size: 10px;
              font-weight: 900;
              letter-spacing: .06em;
            }
            .ok { background: #dcfce7; color: #15803d; }
            .warning { background: #fef3c7; color: #b45309; }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
              margin-top: 24px;
            }
            .item {
              min-height: 112px;
              padding: 18px;
              border: 1px solid #e5e7eb;
              border-radius: 17px;
              background: #fafafa;
            }
            .label {
              margin: 0;
              color: #6b7280;
              font-size: 9px;
              font-weight: 900;
              letter-spacing: .12em;
              text-transform: uppercase;
            }
            .value {
              margin: 10px 0 0;
              font-size: 26px;
              font-weight: 900;
            }
            .detail { margin: 7px 0 0; color: #6b7280; font-size: 12px; }
            .wide {
              margin-top: 12px;
              padding: 18px;
              border-left: 4px solid #ff1010;
              border-radius: 12px;
              background: #f7f7f8;
            }
            .wide strong { display: block; margin-top: 7px; }
            .foot {
              padding: 17px 34px;
              border-top: 1px dashed #d1d5db;
              color: #737780;
              font-size: 10px;
              text-align: center;
            }
            @media print {
              @page { margin: 10mm; }
              body { padding: 0; background: white; }
              .report { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <article class="report">
            <header class="head">
              <h1 class="brand">ALBATROS</h1>
              <p class="eyebrow">RESUMEN PERSONAL · ${mes}</p>
              <h2>${nombre}</h2>
              <p class="meta">${disciplina} · ${grado} · ${sede}</p>
            </header>
            <main class="body">
              <span class="status ${estadoClase}">${estado}</span>
              <div class="grid">
                <section class="item">
                  <p class="label">Asistencias del mes</p>
                  <p class="value">${asistenciasMes}</p>
                  <p class="detail">Meta sugerida: 12 clases</p>
                </section>
                <section class="item">
                  <p class="label">Racha de entrenamiento</p>
                  <p class="value">${analiticaAsistencia.rachaSemanas}</p>
                  <p class="detail">Semanas consecutivas activas</p>
                </section>
                <section class="item">
                  <p class="label">Pagos registrados este mes</p>
                  <p class="value">$${pagadoMes.toLocaleString("es-MX")}</p>
                  <p class="detail">${pagosMes.length} movimiento(s)</p>
                </section>
                <section class="item">
                  <p class="label">Próximo pago</p>
                  <p class="value">${format(
                    vencimiento.vencimiento,
                    "dd MMM",
                    { locale: es },
                  )}</p>
                  <p class="detail">$${Number(
                    alumno.montoPago || 0,
                  ).toLocaleString("es-MX")}</p>
                </section>
              </div>
              <section class="wide">
                <p class="label">Próxima clase</p>
                <strong>${escaparHtml(proximaClase)}</strong>
              </section>
              <section class="wide">
                <p class="label">Objetivo actual</p>
                <strong>${escaparHtml(
                  alumno.objetivo || "Aún no se ha definido un objetivo.",
                )}</strong>
              </section>
            </main>
            <footer class="foot">
              Generado el ${format(hoy, "dd/MM/yyyy HH:mm")} desde el portal
              privado del atleta. Documento informativo.
            </footer>
          </article>
          <script>
            window.addEventListener("load", () => window.print());
          </script>
        </body>
      </html>`);
    ventana.document.close();
  };

  if (cargando) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <Skeleton className="h-32 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (sinVincular) {
    return (
      <div className="grid min-h-[70vh] place-items-center p-4">
        <Card className="w-full max-w-xl border-amber-500/25 bg-amber-500/5">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
            <CardTitle className="mt-3 text-2xl font-black uppercase italic">
              Cuenta pendiente de vinculación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {solicitudEnviada ? (
              <div className="rounded-2xl border border-green-500/25 bg-green-500/10 p-6">
                <ShieldCheck className="mx-auto h-9 w-9 text-green-500" />
                <p className="mt-3 font-black uppercase text-green-500">
                  Solicitud enviada
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Administración podrá localizar tu cuenta y asociarla con tu
                  ficha. Vuelve a entrar cuando te confirmen la activación.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Envía tus datos a recepción para que vinculen esta cuenta con
                  tu ficha de alumno.
                </p>
                <div className="space-y-4 rounded-2xl border bg-background/60 p-4 text-left">
                  <div className="space-y-2">
                    <Label htmlFor="request-name">Nombre completo</Label>
                    <Input
                      id="request-name"
                      value={nombreSolicitud}
                      onChange={(event) =>
                        setNombreSolicitud(event.target.value)
                      }
                      placeholder="Como apareces en la academia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="request-phone">Teléfono</Label>
                    <Input
                      id="request-phone"
                      inputMode="tel"
                      value={telefonoSolicitud}
                      onChange={(event) =>
                        setTelefonoSolicitud(event.target.value)
                      }
                      placeholder="999 000 0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="request-site">Sede</Label>
                    <select
                      id="request-site"
                      value={sedeSolicitud}
                      onChange={(event) => setSedeSolicitud(event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="MMA">MMA</option>
                      <option value="CAUCEL">Caucel</option>
                      <option value="JUAN_PABLO">Juan Pablo</option>
                    </select>
                  </div>
                  {error && (
                    <p className="text-xs font-medium text-destructive">
                      {error}
                    </p>
                  )}
                  <Button
                    type="button"
                    className="w-full font-black uppercase"
                    disabled={enviandoSolicitud}
                    onClick={() => void enviarSolicitud()}
                  >
                    {enviandoSolicitud && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Solicitar acceso
                  </Button>
                </div>
                <details className="rounded-xl border bg-background/40 p-3 text-left">
                  <summary className="cursor-pointer text-xs font-bold uppercase text-muted-foreground">
                    Vinculación manual
                  </summary>
                  <p className="mt-3 break-all font-mono text-xs">
                    {user?.uid}
                  </p>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !alumno) {
    return (
      <div className="grid min-h-[70vh] place-items-center p-4">
        <Card className="w-full max-w-lg border-destructive/30">
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto mb-3 h-9 w-9 text-destructive" />
            <p className="font-black uppercase">No pudimos abrir tu ficha</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || "Intenta iniciar sesión nuevamente."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alCorriente =
    alumno.estadoPago === "Pagado" &&
    alumno.periodoUltimoPago === format(new Date(), "yyyy-MM");
  const vencimiento = calcularVencimiento(
    Number(alumno.diaPago || 1),
    alCorriente,
  );
  const tarjetasVinculadas = alumno.rfids?.length
    ? alumno.rfids
    : alumno.rfid
      ? [alumno.rfid]
      : [];
  const insigniasAtleta = normalizeAthleteBadgeIds(alumno.insignias);
  const insigniaPrincipal = getPrimaryAthleteBadge(insigniasAtleta);
  const fichaEmergencia = {
    fechaNacimiento: alumno.emergencia?.fechaNacimiento || "",
    tipoSangre:
      alumno.emergencia?.tipoSangre || alumno.tipoSangre || "",
    alergias: alumno.emergencia?.alergias || alumno.alergias || "",
    condicionesMedicas:
      alumno.emergencia?.condicionesMedicas ||
      alumno.condicionesMedicas ||
      "",
    medicamentos:
      alumno.emergencia?.medicamentos || alumno.medicamentos || "",
    contactoNombre:
      alumno.emergencia?.contactoNombre ||
      alumno.contactoEmergencia ||
      "",
    contactoParentesco:
      alumno.emergencia?.contactoParentesco || "",
    contactoTelefono:
      alumno.emergencia?.contactoTelefono ||
      alumno.telefonoEmergencia ||
      "",
    indicaciones: alumno.emergencia?.indicaciones || "",
  };
  const whatsappAcademia = (
    process.env.NEXT_PUBLIC_WHATSAPP_ACADEMIA || ""
  ).replace(/\D/g, "");
  const mensajeAyuda = encodeURIComponent(
    `Hola, soy ${alumno.nombre} de la sede ${
      alumno.sede?.replaceAll("_", " ") || "ALBATROS"
    }. Necesito ayuda con mi perfil de Mi Academia.`,
  );
  const enlaceWhatsApp = whatsappAcademia
    ? `https://wa.me/${whatsappAcademia}?text=${mensajeAyuda}`
    : "";

  return (
    <div className="space-y-6 p-4 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/15 via-card to-card shadow-2xl shadow-primary/5">
        <div className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-end md:p-8">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative w-fit shrink-0">
              <div className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-[2rem] border border-white/15 bg-black/25 shadow-[0_18px_50px_rgba(0,0,0,.35)] sm:h-32 sm:w-32">
                {fotoPerfilUrl && !imagenPerfilConError ? (
                  <Image
                    src={fotoPerfilUrl}
                    alt={`Foto de ${alumno.nombre}`}
                    fill
                    sizes="(max-width: 640px) 112px, 128px"
                    unoptimized
                    className="object-cover"
                    priority
                    referrerPolicy="no-referrer"
                    onError={() => setImagenPerfilConError(true)}
                  />
                ) : (
                  <UserRound className="h-12 w-12 text-white/45" />
                )}
                <span className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/10" />
              </div>
              {insigniaPrincipal && (
                <div
                  className="absolute -bottom-3 -right-3 z-10 grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-[#101114]/95 p-1 shadow-[0_10px_30px_rgba(0,0,0,.55)]"
                  title={insigniaPrincipal.nombre}
                  aria-label={insigniaPrincipal.nombre}
                >
                  <Image
                    src={insigniaPrincipal.imagen}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain p-1 drop-shadow-[0_4px_8px_rgba(0,0,0,.5)]"
                  />
                  {insigniasAtleta.length > 1 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border border-amber-200/40 bg-amber-300 px-1 text-[9px] font-black text-slate-950">
                      +{insigniasAtleta.length - 1}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <Badge className="mb-3 bg-primary/15 text-primary hover:bg-primary/15">
                MI ACADEMIA · {alumno.sede?.replace("_", " ") || "ALBATROS"}
              </Badge>
              <h1 className="break-words text-3xl font-black uppercase italic tracking-tight md:text-5xl">
                {alumno.nombre}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tu asistencia, pagos y progreso deportivo en un solo lugar.
              </p>
              {insigniaPrincipal && (
                <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-amber-200">
                  <Medal className="h-4 w-4" />
                  {insigniaPrincipal.nombre}
                  {insigniasAtleta.length > 1 && ` · ${insigniasAtleta.length} obtenidas`}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
            <Badge
              variant="outline"
              className={
                alCorriente
                  ? "w-fit border-green-500/30 bg-green-500/10 px-4 py-2 text-green-500"
                  : "w-fit border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-500"
              }
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {alCorriente ? "Pago al corriente" : "Pago pendiente"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="border-primary/20 bg-background/40 font-black uppercase"
              onClick={() => setCredencialAbierta(true)}
            >
              <IdCard className="mr-2 h-4 w-4 text-primary" />
              Mi credencial
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-primary/20 bg-background/40 font-black uppercase"
              onClick={imprimirResumenMensual}
            >
              <FileText className="mr-2 h-4 w-4 text-primary" />
              Mi resumen
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-primary/20 bg-background/40 font-black uppercase"
              onClick={() => setCorreccionAbierta(true)}
            >
              <PencilLine className="mr-2 h-4 w-4 text-primary" />
              Corregir datos
            </Button>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-primary/15 bg-card/55">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-primary/[0.04]"
            aria-expanded={avisosExpandidos}
            aria-controls="athlete-announcements"
            onClick={() => setAvisosExpandidos((valor) => !valor)}
          >
            <div className="flex items-center gap-3">
              <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Megaphone className="h-5 w-5" />
                {avisosNoLeidos > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
                    {avisosNoLeidos}
                  </span>
                )}
              </div>
              <div>
                <p className="font-black uppercase italic">
                  Avisos de la academia
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Novedades, eventos y cambios de horario de tu sede.
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                avisosExpandidos ? "rotate-180" : ""
              }`}
            />
          </button>
          <div
            id="athlete-announcements"
            className={`grid transition-[grid-template-rows,opacity] duration-300 ${
              avisosExpandidos
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <CardContent className="grid gap-3 border-t border-primary/10 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    disabled={cambiandoNotificaciones}
                    onClick={() => void activarNotificaciones()}
                  >
                    {cambiandoNotificaciones ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : notificacionesAvisos ? (
                      <BellRing className="mr-2 h-4 w-4 text-green-500" />
                    ) : (
                      <Bell className="mr-2 h-4 w-4" />
                    )}
                    {cambiandoNotificaciones
                      ? "Guardando configuración"
                      : notificacionesAvisos
                        ? "Desactivar notificaciones"
                      : "Activar notificaciones"}
                  </Button>
                  {avisosNoLeidos > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={marcarTodosLeidos}
                    >
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Marcar todos como leídos
                    </Button>
                  )}
                </div>
                {avisos.length === 0 && (
                  <p className="rounded-2xl border border-primary/10 bg-background/35 p-4 text-sm text-muted-foreground">
                    No hay avisos publicados en este momento.
                  </p>
                )}
                {avisos.map((aviso) => {
                  const urgente = aviso.tipo === "urgente";
                  const Icono = urgente
                    ? TriangleAlert
                    : aviso.tipo === "horario"
                      ? CalendarDays
                      : aviso.tipo === "evento"
                        ? Megaphone
                        : Info;
                  return (
                    <article
                      key={aviso.id}
                      className={`relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                        urgente
                          ? "border-red-500/25 bg-red-500/10"
                          : "border-primary/10 bg-background/35"
                      } ${
                        avisosLeidos.has(aviso.id)
                          ? "opacity-65"
                          : "shadow-[0_8px_30px_rgba(255,0,0,.06)]"
                      }`}
                      onClick={() => marcarAvisoLeido(aviso.id)}
                    >
                      {!avisosLeidos.has(aviso.id) && (
                        <span
                          className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(255,0,0,.7)]"
                          aria-label="Aviso no leído"
                        />
                      )}
                      <Icono
                        className={`mt-0.5 h-5 w-5 shrink-0 ${
                          urgente ? "text-red-500" : "text-primary"
                        }`}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-black uppercase">
                            {aviso.titulo}
                          </h2>
                          {urgente && (
                            <Badge variant="destructive">Urgente</Badge>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {aviso.mensaje}
                        </p>
                        {aviso.venceEn && (
                          <p className="mt-3 text-[10px] text-muted-foreground">
                            Visible hasta:{" "}
                            {format(aviso.venceEn.toDate(), "dd MMM yyyy", {
                              locale: es,
                            })}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </CardContent>
            </div>
          </div>
      </Card>

      <Card className="overflow-hidden border-primary/10 bg-card/55">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-primary/[0.04]"
          aria-expanded={horariosExpandidos}
          aria-controls="athlete-schedules"
          onClick={() => setHorariosExpandidos((valor) => !valor)}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black uppercase italic">
                Horarios de entrenamiento
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {resumenHorarios.proxima
                  ? `Próxima: ${resumenHorarios.proxima.horario.disciplina} · ${format(
                      resumenHorarios.proxima.fecha,
                      "EEE dd MMM, HH:mm",
                      { locale: es },
                    )}`
                  : "Consulta los turnos disponibles."}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
              horariosExpandidos ? "rotate-180" : ""
            }`}
          />
        </button>

        <div
          id="athlete-schedules"
          className={`grid transition-[grid-template-rows,opacity] duration-300 ${
            horariosExpandidos
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <CardContent className="grid gap-5 border-t border-primary/10 p-4 md:grid-cols-2 md:p-5">
              {(["Matutino", "Vespertino"] as const).map((turno) => {
                const Icono = turno === "Matutino" ? Sun : Moon;
                return (
                  <div key={turno}>
                    <div className="mb-3 flex items-center gap-2">
                      <Icono className="h-4 w-4 text-primary" />
                      <p className="text-xs font-black uppercase tracking-wider">
                        {turno}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {HORARIOS.filter(
                        (horario) => horario.turno === turno,
                      ).map((horario) => {
                        const destacado = resumenHorarios.destacados.has(
                          horario.id,
                        );
                        return (
                          <article
                            key={horario.id}
                            className={`rounded-2xl border p-4 transition-colors ${
                              destacado
                                ? "border-primary/35 bg-primary/10 shadow-[0_8px_30px_rgba(255,0,0,.06)]"
                                : "border-primary/10 bg-background/35"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-black uppercase italic">
                                {horario.disciplina}
                              </p>
                              {destacado && (
                                <Badge className="bg-primary text-primary-foreground">
                                  Tu disciplina
                                </Badge>
                              )}
                            </div>
                            <p className="mt-2 text-lg font-black">
                              {horario.hora}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {horario.dias}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/10 bg-card/55">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Asistencias del mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{asistenciasMes}</p>
            <Progress
              className="mt-3 h-2"
              value={Math.min((asistenciasMes / 12) * 100, 100)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Meta sugerida: 12 clases
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/55">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Clock3 className="h-4 w-4 text-primary" />
              Próximo pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-black ${
                vencimiento.dias < 0 ? "text-destructive" : ""
              }`}
            >
              {vencimiento.dias < 0
                ? `${Math.abs(vencimiento.dias)} días`
                : vencimiento.dias === 0
                  ? "Hoy"
                  : `${vencimiento.dias} días`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {vencimiento.dias < 0 ? "Venció" : "Vence"} el{" "}
              {format(vencimiento.vencimiento, "dd MMM yyyy", { locale: es })}
              {" · "}$
              {Number(alumno.montoPago || 0).toLocaleString("es-MX")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/55">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              Disciplina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black uppercase">
              {alumno.disciplina || "Sin registrar"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {alumno.grado || "Grado pendiente"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/55">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Weight className="h-4 w-4 text-primary" />
              Peso / objetivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">
              {alumno.pesoActual ? `${alumno.pesoActual} kg` : "—"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Meta: {alumno.pesoObjetivo ? `${alumno.pesoObjetivo} kg` : "Pendiente"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-primary/10 bg-card/55">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-primary/[0.04] md:p-6"
          aria-expanded={emergenciaExpandida}
          aria-controls="athlete-emergency-card"
          onClick={() => setEmergenciaExpandida((valor) => !valor)}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase italic">
                Ficha de emergencia
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Datos médicos y contacto para una atención rápida.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {fichaEmergencia.tipoSangre && (
              <Badge
                variant="outline"
                className="hidden border-red-500/25 bg-red-500/10 text-red-500 sm:flex"
              >
                Sangre {fichaEmergencia.tipoSangre}
              </Badge>
            )}
            <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/10">
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${
                  emergenciaExpandida ? "rotate-180" : ""
                }`}
              />
            </span>
          </div>
        </button>

        <div
          id="athlete-emergency-card"
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            emergenciaExpandida
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <CardContent className="border-t border-primary/10 p-5 md:p-6">
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <p className="text-sm text-muted-foreground">
                  Esta información es de apoyo. Ante una emergencia llama al
                  911 y sigue las indicaciones del personal médico.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <article className="rounded-2xl border border-primary/10 bg-background/40 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Tipo de sangre
                  </p>
                  <p className="mt-2 text-xl font-black text-red-500">
                    {fichaEmergencia.tipoSangre || "No registrado"}
                  </p>
                </article>

                <article className="rounded-2xl border border-primary/10 bg-background/40 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Alergias
                  </p>
                  <p className="mt-2 text-sm font-bold">
                    {fichaEmergencia.alergias || "No registradas"}
                  </p>
                </article>

                <article className="rounded-2xl border border-primary/10 bg-background/40 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Condición médica
                  </p>
                  <p className="mt-2 text-sm font-bold">
                    {fichaEmergencia.condicionesMedicas || "No registrada"}
                  </p>
                </article>

                <article className="rounded-2xl border border-primary/10 bg-background/40 p-4 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Pill className="h-4 w-4 text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-wider">
                      Medicamentos
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-bold">
                    {fichaEmergencia.medicamentos || "No registrados"}
                  </p>
                </article>

                <article className="rounded-2xl border border-primary/10 bg-background/40 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Fecha de nacimiento
                  </p>
                  <p className="mt-2 text-sm font-bold">
                    {fichaEmergencia.fechaNacimiento || "No registrada"}
                  </p>
                </article>

                <article className="rounded-2xl border border-primary/10 bg-background/40 p-4 sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Indicaciones importantes
                  </p>
                  <p className="mt-2 text-sm font-bold">
                    {fichaEmergencia.indicaciones || "Sin indicaciones"}
                  </p>
                </article>

                <article className="rounded-2xl border border-primary/10 bg-background/40 p-4 sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Contacto de emergencia
                  </p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">
                        {fichaEmergencia.contactoNombre || "No registrado"}
                        {fichaEmergencia.contactoParentesco
                          ? ` · ${fichaEmergencia.contactoParentesco}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {fichaEmergencia.contactoTelefono || "Sin teléfono"}
                      </p>
                    </div>
                    {fichaEmergencia.contactoTelefono && (
                      <Button
                        asChild
                        className="gap-2 bg-red-600 font-black uppercase text-white hover:bg-red-700"
                      >
                        <a
                          href={`tel:${fichaEmergencia.contactoTelefono.replace(
                            /[^\d+]/g,
                            "",
                          )}`}
                        >
                          <Phone className="h-4 w-4" />
                          Llamar
                        </a>
                      </Button>
                    )}
                  </div>
                </article>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-primary/10 bg-card/55">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-primary/[0.04] md:p-6"
          aria-expanded={ayudaExpandida}
          aria-controls="athlete-help-center"
          onClick={() => setAyudaExpandida((valor) => !valor)}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase italic">
                Ayuda y contacto
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Resuelve dudas o contacta rápidamente a la academia.
              </p>
            </div>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/10">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${
                ayudaExpandida ? "rotate-180" : ""
              }`}
            />
          </span>
        </button>

        <div
          id="athlete-help-center"
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            ayudaExpandida
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <CardContent className="grid gap-5 border-t border-primary/10 p-5 md:grid-cols-[.9fr_1.1fr] md:p-6">
              <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.05] p-5">
                <MessageCircle className="h-7 w-7 text-green-500" />
                <p className="mt-4 font-black uppercase italic">
                  Hablar con recepción
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Consulta pagos, correcciones de datos, horarios o el acceso a
                  tu cuenta.
                </p>
                {enlaceWhatsApp ? (
                  <Button
                    asChild
                    className="mt-5 w-full bg-green-600 font-black uppercase text-white hover:bg-green-700"
                  >
                    <a
                      href={enlaceWhatsApp}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Abrir WhatsApp
                    </a>
                  </Button>
                ) : (
                  <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-500">
                    Recepción todavía no ha configurado el número de WhatsApp.
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Preguntas frecuentes
                </p>
                <div className="mt-3 divide-y divide-primary/10 rounded-2xl border border-primary/10 bg-background/35 px-4">
                  {[
                    {
                      pregunta: "¿Un pago no aparece?",
                      respuesta:
                        "Espera unos minutos y vuelve a abrir Mi Academia. Si continúa igual, envía el periodo y la fecha a recepción.",
                    },
                    {
                      pregunta: "¿Una asistencia está ausente?",
                      respuesta:
                        "Indica a recepción la fecha de la clase para que puedan revisar el registro.",
                    },
                    {
                      pregunta: "¿Mis datos son incorrectos?",
                      respuesta:
                        "Solicita la corrección desde WhatsApp. Los cambios aparecerán al volver a cargar tu portal.",
                    },
                    {
                      pregunta: "¿La credencial abre la puerta?",
                      respuesta:
                        "No. La credencial es informativa; el acceso requiere tu tag RFID o NFC validado.",
                    },
                  ].map((item) => (
                    <details key={item.pregunta} className="group py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black">
                        {item.pregunta}
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="mt-2 pr-6 text-sm text-muted-foreground">
                        {item.respuesta}
                      </p>
                    </details>
                  ))}
                </div>
                <a
                  href="tel:911"
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-sm font-black text-red-500 transition-colors hover:bg-red-500/10"
                >
                  <Phone className="h-4 w-4" />
                  Emergencias: llamar al 911
                </a>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-primary/10 bg-card/55">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-primary/[0.04] md:p-6"
          aria-expanded={asistenciaExpandida}
          aria-controls="athlete-attendance-progress"
          onClick={() => setAsistenciaExpandida((valor) => !valor)}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black uppercase italic">
                Mi constancia de entrenamiento
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Calendario, racha semanal y últimos seis meses.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className="hidden border-orange-500/25 bg-orange-500/10 text-orange-500 sm:flex"
            >
              <Flame className="mr-1 h-3 w-3" />
              {analiticaAsistencia.rachaSemanas} semanas
            </Badge>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/10">
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${
                  asistenciaExpandida ? "rotate-180" : ""
                }`}
              />
            </span>
          </div>
        </button>

        <div
          id="athlete-attendance-progress"
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            asistenciaExpandida
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <CardContent className="grid gap-6 border-t border-primary/10 p-5 md:grid-cols-2 md:p-6">
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-muted-foreground">
                      Calendario mensual
                    </p>
                    <p className="mt-1 capitalize">
                      {analiticaAsistencia.nombreMes}
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                    {asistenciasMes} asistencias
                  </Badge>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["L", "M", "M", "J", "V", "S", "D"].map(
                    (dia, indice) => (
                      <span
                        key={`${dia}-${indice}`}
                        className="py-1 text-[9px] font-black text-muted-foreground"
                      >
                        {dia}
                      </span>
                    ),
                  )}
                  {analiticaAsistencia.calendario.map((registro, indice) =>
                    registro ? (
                      <div
                        key={registro.dia}
                        className={`grid aspect-square place-items-center rounded-lg text-xs font-bold transition-colors ${
                          registro.asistio
                            ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(255,0,0,.18)]"
                            : registro.futuro
                              ? "bg-secondary/20 text-muted-foreground/35"
                              : "bg-secondary/50 text-muted-foreground"
                        }`}
                        title={
                          registro.asistio
                            ? `Asistencia registrada el día ${registro.dia}`
                            : undefined
                        }
                      >
                        {registro.dia}
                      </div>
                    ) : (
                      <span key={`empty-${indice}`} />
                    ),
                  )}
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <p className="text-xs font-black uppercase text-muted-foreground">
                    Evolución de seis meses
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cada barra representa días únicos de entrenamiento.
                  </p>
                </div>
                <div className="flex h-48 items-end gap-2 rounded-2xl border border-primary/10 bg-background/35 p-4">
                  {analiticaAsistencia.meses.map((mes) => {
                    const altura =
                      mes.total === 0
                        ? 4
                        : Math.max(
                            (mes.total /
                              analiticaAsistencia.maximoMensual) *
                              100,
                            10,
                          );
                    return (
                      <div
                        key={mes.periodo}
                        className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span className="text-xs font-black">{mes.total}</span>
                        <div
                          className="w-full rounded-t-lg bg-primary/70 transition-all duration-500 group-hover:bg-primary"
                          style={{ height: `${altura}%` }}
                        />
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">
                          {mes.etiqueta}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <p className="text-sm">
                    Racha actual:{" "}
                    <strong>
                      {analiticaAsistencia.rachaSemanas}{" "}
                      {analiticaAsistencia.rachaSemanas === 1
                        ? "semana"
                        : "semanas"}
                    </strong>{" "}
                    con al menos una asistencia.
                  </p>
                </div>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-primary/10 bg-card/55">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-primary/[0.04] md:p-6"
          aria-expanded={logrosExpandidos}
          aria-controls="athlete-achievements"
          onClick={() => setLogrosExpandidos((valor) => !valor)}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
              <Medal className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase italic">
                Mis logros de constancia
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {progresoLogros.desbloqueados} de{" "}
                {progresoLogros.metas.length} insignias desbloqueadas.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className="hidden border-amber-500/25 bg-amber-500/10 text-amber-500 sm:flex"
            >
              {progresoLogros.totalAsistencias} entrenamientos
            </Badge>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/10">
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${
                  logrosExpandidos ? "rotate-180" : ""
                }`}
              />
            </span>
          </div>
        </button>

        <div
          id="athlete-achievements"
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            logrosExpandidos
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <CardContent className="border-t border-primary/10 p-5 md:p-6">
              {progresoLogros.siguiente ? (
                <div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                        Próximo logro
                      </p>
                      <p className="mt-1 font-black">
                        {progresoLogros.siguiente.nombre}
                      </p>
                    </div>
                    <strong className="text-sm text-amber-500">
                      {progresoLogros.totalAsistencias}/
                      {progresoLogros.siguiente.meta}
                    </strong>
                  </div>
                  <Progress
                    className="mt-3 h-2"
                    value={progresoLogros.siguiente.progreso}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Te faltan{" "}
                    {progresoLogros.siguiente.meta -
                      progresoLogros.totalAsistencias}{" "}
                    entrenamientos para desbloquearlo.
                  </p>
                </div>
              ) : (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-green-500/20 bg-green-500/[0.06] p-4 text-green-500">
                  <Trophy className="h-6 w-6" />
                  <p className="font-black uppercase">
                    Has desbloqueado todas las insignias
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {progresoLogros.metas.map((logro) => (
                  <article
                    key={logro.id}
                    className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                      logro.desbloqueado
                        ? "border-amber-500/25 bg-amber-500/[0.07]"
                        : "border-primary/10 bg-background/30 opacity-65"
                    }`}
                  >
                    <div
                      className={`grid h-11 w-11 place-items-center rounded-full ${
                        logro.desbloqueado
                          ? "bg-amber-500 text-slate-900 shadow-[0_0_22px_rgba(245,158,11,.25)]"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {logro.desbloqueado ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <LockKeyhole className="h-4 w-4" />
                      )}
                    </div>
                    <p className="mt-4 text-sm font-black uppercase italic">
                      {logro.nombre}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {logro.descripcion}
                    </p>
                    <Badge
                      variant="outline"
                      className="mt-3 text-[9px] font-black"
                    >
                      META: {logro.meta}
                    </Badge>
                  </article>
                ))}
              </div>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Las insignias son motivacionales y se calculan con tus días
                únicos de asistencia registrados.
              </p>
            </CardContent>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/10 bg-card/55">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic">
              <CalendarDays className="h-5 w-5 text-primary" />
              Últimas asistencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {asistencias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay asistencias guardadas.
              </p>
            ) : (
              <div className="space-y-2">
                {asistencias.slice(0, 8).map((asistencia) => (
                  <div
                    key={asistencia.id}
                    className="flex items-center justify-between rounded-xl border border-primary/10 bg-background/40 p-3"
                  >
                    <span className="text-sm font-bold">
                      {fechaLegible(asistencia.fecha)}
                    </span>
                    <Badge variant="secondary">Asistió</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/55">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic">
              <CreditCard className="h-5 w-5 text-primary" />
              Historial de pagos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pagos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay pagos guardados.
              </p>
            ) : (
              <div className="space-y-2">
                {pagos.slice(0, 8).map((pago) => (
                  <div
                    key={pago.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-background/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-bold">
                        {pago.periodo || fechaLegible(pago.fecha)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pago.metodoPago || "Método no registrado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-green-500">
                        ${Number(pago.monto || 0).toLocaleString("es-MX")}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Abrir recibo"
                        onClick={() => setReciboSeleccionado(pago)}
                      >
                        <ReceiptText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t border-primary/10 pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Total histórico visible
                  </span>
                  <strong>${totalPagado.toLocaleString("es-MX")}</strong>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/10 bg-card/55">
          <CardContent className="flex gap-3 p-5">
            <Target className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-black uppercase text-muted-foreground">
                Objetivo actual
              </p>
              <p className="mt-1 font-bold">
                {alumno.objetivo || "Aún no se ha definido un objetivo."}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/10 bg-card/55">
          <CardContent className="flex gap-3 p-5">
            <MapPin className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-black uppercase text-muted-foreground">
                Próxima competencia
              </p>
              <p className="mt-1 font-bold">
                {alumno.proximaCompetencia || "Sin competencia programada"}
              </p>
              {alumno.fechaCompetencia && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {alumno.fechaCompetencia}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center justify-center gap-2 pb-4 text-center text-xs text-muted-foreground">
        <UserRound className="h-3.5 w-3.5" />
        Solo tú y el personal autorizado pueden consultar esta ficha.
      </p>

      <Dialog open={correccionAbierta} onOpenChange={setCorreccionAbierta}>
        <DialogContent className="border-primary/20 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
              <PencilLine className="h-5 w-5 text-primary" />
              Solicitar corrección
            </DialogTitle>
            <DialogDescription>
              Indica qué dato debe revisar recepción. Tu ficha no se modifica
              automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="correction-category">Categoría</Label>
              <select
                id="correction-category"
                value={categoriaCorreccion}
                onChange={(event) =>
                  setCategoriaCorreccion(event.target.value)
                }
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="datos">Datos personales</option>
                <option value="pago">Pago o mensualidad</option>
                <option value="asistencia">Asistencia</option>
                <option value="progreso">Progreso deportivo</option>
                <option value="emergencia">Ficha de emergencia</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction-detail">Detalle de la corrección</Label>
              <textarea
                id="correction-detail"
                value={detalleCorreccion}
                onChange={(event) => setDetalleCorreccion(event.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Ejemplo: mi asistencia del 28 de julio no aparece..."
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-right text-[10px] text-muted-foreground">
                {detalleCorreccion.length}/500
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCorreccionAbierta(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                enviandoCorreccion || detalleCorreccion.trim().length < 8
              }
              onClick={enviarCorreccion}
            >
              {enviandoCorreccion && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credencialAbierta} onOpenChange={setCredencialAbierta}>
        <DialogContent className="border-primary/20 bg-black p-0 text-white sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Credencial digital de atleta</DialogTitle>
            <DialogDescription>
              Identificación informativa del atleta en ALBATROS.
            </DialogDescription>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-xl bg-[radial-gradient(circle_at_88%_12%,rgba(255,0,0,.25),transparent_28%),linear-gradient(135deg,#17181d,#07080a_65%)]">
            <span className="absolute inset-y-0 left-0 w-2 bg-primary" />
            <div className="p-6 pl-8 sm:p-9 sm:pl-11">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-black tracking-[0.08em] text-primary sm:text-3xl">
                    ALBATROS
                  </p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/70">
                    Credencial digital de atleta
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    alCorriente
                      ? "border-green-500/30 bg-green-500/10 text-green-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }
                >
                  {alCorriente ? "Al corriente" : "Validar pago"}
                </Badge>
              </div>

              <div className="mt-10 flex items-center gap-4">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {fotoPerfilUrl && !imagenPerfilConError ? (
                    <Image
                      src={fotoPerfilUrl}
                      alt={alumno.nombre}
                      fill
                      sizes="80px"
                      unoptimized
                      className="object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setImagenPerfilConError(true)}
                    />
                  ) : (
                    <UserRound className="h-8 w-8 text-white/70" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-black uppercase italic tracking-tight sm:text-3xl">
                    {alumno.nombre}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-white/60">
                    {alumno.disciplina || "Atleta ALBATROS"}
                    {alumno.grado ? ` · ${alumno.grado}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-9 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-white/70">
                    Sede
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {alumno.sede?.replace("_", " ") || "ALBATROS"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-white/70">
                    ID de atleta
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold">
                    {alumno.id.slice(0, 12).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-white/70">
                    Tags vinculados
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-bold">
                    <Radio className="h-3.5 w-3.5 text-primary" />
                    {tarjetasVinculadas.length}
                  </p>
                </div>
              </div>

              <p className="mt-7 text-center text-[9px] uppercase tracking-wider text-white/70">
                La entrada se valida mediante RFID o NFC en recepción.
              </p>
            </div>
          </div>
          <DialogFooter className="p-4 pt-0">
            <Button
              type="button"
              className="w-full font-black uppercase"
              onClick={imprimirCredencial}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir o guardar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reciboSeleccionado !== null}
        onOpenChange={(open) => !open && setReciboSeleccionado(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
              <ReceiptText className="h-5 w-5 text-primary" />
              Recibo de pago
            </DialogTitle>
            <DialogDescription>
              Comprobante individual de la mensualidad registrada.
            </DialogDescription>
          </DialogHeader>
          {reciboSeleccionado && (
            <div className="overflow-hidden rounded-2xl border border-primary/15">
              <div className="border-b-4 border-primary bg-black p-5 text-white">
                <p className="text-2xl font-black tracking-wider text-primary">
                  ALBATROS
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                  Comprobante de mensualidad
                </p>
              </div>
              <div className="space-y-4 p-5">
                <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/10">
                  Pago registrado
                </Badge>
                <div>
                  <p className="text-4xl font-black tracking-tighter">
                    $
                    {Number(reciboSeleccionado.monto || 0).toLocaleString(
                      "es-MX",
                      { minimumFractionDigits: 2 },
                    )}
                  </p>
                  <p className="mt-1 font-bold">{alumno.nombre}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Periodo
                    </p>
                    <p className="mt-1 font-bold">
                      {reciboSeleccionado.periodo || "Sin periodo"}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Fecha
                    </p>
                    <p className="mt-1 font-bold">
                      {fechaLegible(reciboSeleccionado.fecha)}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Método
                    </p>
                    <p className="mt-1 font-bold">
                      {reciboSeleccionado.metodoPago || "No registrado"}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Sede
                    </p>
                    <p className="mt-1 font-bold">
                      {alumno.sede?.replace("_", " ") || "ALBATROS"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              className="w-full font-black uppercase"
              onClick={imprimirRecibo}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir o guardar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
