"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Camera,
  Activity,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FolderOpen,
  Inbox,
  KeyRound,
  Link2,
  Loader2,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  Unlink,
  UserPlus,
  UserRound,
} from "lucide-react";
import {
  collection,
  doc,
  deleteField,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

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
import { useToast } from "@/hooks/use-toast";
import {
  useAuth,
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from "@/firebase";
import { recordAdminAudit } from "@/lib/admin-audit";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import {
  athletePhotoValidationError,
  blobToDataUrl,
  prepareAthletePhoto,
} from "@/lib/athlete-photo";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";

type Alumno = {
  id: string;
  nombre: string;
  telefono?: string;
  sede: Sede;
  activo?: boolean;
};

type AccesoAtleta = {
  uid: string;
  alumnoId: string;
  sede: Sede;
  activo: boolean;
};

type SolicitudAcceso = {
  uid: string;
  nombre: string;
  telefono: string;
  email: string;
  sede: Sede;
  estado: "pendiente" | "aprobada" | "rechazada";
};

type ExpedienteAtleta = {
  alumno: {
    id: string;
    nombre: string;
    telefono: string;
    sede: string;
    disciplina: string;
    grado: string;
    objetivo: string;
    estadoPago: string;
    diaPago: number;
    pesoActual: number;
    pesoObjetivo: number;
    proximaCompetencia: string;
    activo: boolean;
  };
  acceso: {
    uid: string;
    activo: boolean;
    email: string;
    emailVerificado: boolean;
    bloqueado: boolean;
    creadoEn: string | null;
    ultimoIngreso: string | null;
    existeEnAuthentication: boolean;
  } | null;
  actividad: {
    asistenciasTotales: number;
    asistencias30Dias: number;
    ultimaAsistencia: string | null;
    pagosTotales: number;
    ultimoPago: {
      fecha: string | null;
      periodo: string;
      monto: number;
      metodo: string;
    } | null;
    evaluacionesFisicas: number;
    ultimaEvaluacion: {
      fecha: string;
      pesoKg: number;
      imc: number;
      puntaje: number;
    } | null;
  };
};

function normalizarSede(valor: string | null): Sede {
  const sede = (valor || "MMA").trim().toUpperCase().replace(/\s+/g, "_");
  return ["MMA", "CAUCEL", "JUAN_PABLO"].includes(sede)
    ? (sede as Sede)
    : "MMA";
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function fechaLegible(valor: string | null | undefined) {
  if (!valor) return "Sin registro";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? valor
    : fecha.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function AccesosAtletasPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [sede, setSede] = useState<Sede | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [accesos, setAccesos] = useState<AccesoAtleta[]>([]);
  const [cargandoAccesos, setCargandoAccesos] = useState(true);
  const [solicitudes, setSolicitudes] = useState<SolicitudAcceso[]>([]);
  const [solicitudActiva, setSolicitudActiva] =
    useState<SolicitudAcceso | null>(null);
  const [busquedaSolicitud, setBusquedaSolicitud] = useState("");
  const [solicitudUidActiva, setSolicitudUidActiva] =
    useState<string | null>(null);
  const [alumnoSeleccionado, setAlumnoSeleccionado] =
    useState<Alumno | null>(null);
  const [uid, setUid] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [desactivandoId, setDesactivandoId] = useState<string | null>(null);
  const [eliminandoSolicitudUid, setEliminandoSolicitudUid] =
    useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [iniciandoAdmin, setIniciandoAdmin] = useState(false);
  const [cuentaAlumno, setCuentaAlumno] = useState<Alumno | null>(null);
  const [cuentaEmail, setCuentaEmail] = useState("");
  const [cuentaPassword, setCuentaPassword] = useState("");
  const [creandoCuenta, setCreandoCuenta] = useState(false);
  const [fotoAlumno, setFotoAlumno] = useState<Alumno | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [fotoExistente, setFotoExistente] = useState(false);
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [guardandoFoto, setGuardandoFoto] = useState(false);
  const [expedienteAlumno, setExpedienteAlumno] = useState<Alumno | null>(null);
  const [expediente, setExpediente] = useState<ExpedienteAtleta | null>(null);
  const [cargandoExpediente, setCargandoExpediente] = useState(false);
  const [enviandoRestablecimiento, setEnviandoRestablecimiento] = useState(false);

  useEffect(() => {
    setSede(normalizarSede(localStorage.getItem("userSede")));

    if (isUserLoading || !user) {
      setEsAdmin(false);
      return;
    }

    let cancelado = false;
    void getDoc(doc(firestore, "usuarios", user.uid)).then((snapshot) => {
      if (cancelado) return;
      const perfil = snapshot.data();
      const adminActivo =
        snapshot.exists() &&
        perfil?.rol === "admin" &&
        perfil?.activo === true;
      setEsAdmin(adminActivo);
      localStorage.setItem("userRole", adminActivo ? "admin" : String(perfil?.rol || ""));
    });

    return () => {
      cancelado = true;
    };
  }, [firestore, isUserLoading, user]);

  const alumnosQuery = useMemoFirebase(() => {
    if (!firestore || !sede) return null;
    return query(
      collection(firestore, "Alumnos"),
      where("sede", "==", sede),
    );
  }, [firestore, sede]);

  const { data: alumnos, isLoading: cargandoAlumnos } =
    useCollection<Alumno>(alumnosQuery);

  const cargarAccesos = async () => {
    if (!firestore || !sede || !esAdmin) {
      setCargandoAccesos(false);
      return;
    }

    setCargandoAccesos(true);
    try {
      const [snapshot, solicitudesSnapshot] = await Promise.all([
        getDocs(
          query(collection(firestore, "usuarios"), where("sede", "==", sede)),
        ),
        getDocs(
          query(
            collection(firestore, "SolicitudesAcceso"),
            where("sede", "==", sede),
          ),
        ),
      ]);

      setAccesos(
        snapshot.docs
          .filter((documento) => documento.data().rol === "atleta")
          .map((documento) => ({
            uid: documento.id,
            alumnoId: String(documento.data().alumnoId || ""),
            sede: normalizarSede(documento.data().sede),
            activo: documento.data().activo === true,
          })),
      );
      setSolicitudes(
        solicitudesSnapshot.docs
          .map((documento) => ({
            uid: documento.id,
            nombre: String(documento.data().nombre || ""),
            telefono: String(documento.data().telefono || ""),
            email: String(documento.data().email || ""),
            sede: normalizarSede(documento.data().sede),
            estado: String(documento.data().estado || "pendiente") as
              SolicitudAcceso["estado"],
          }))
          .filter((solicitud) => solicitud.estado === "pendiente"),
      );
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudieron cargar los accesos",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setCargandoAccesos(false);
    }
  };

  useEffect(() => {
    void cargarAccesos();
    // Se actualiza cuando cambia la sede o el rol de la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, sede, esAdmin]);

  const accesoPorAlumno = useMemo(
    () => {
      const resultado = new Map<string, AccesoAtleta>();
      accesos.forEach((acceso) => {
        const actual = resultado.get(acceso.alumnoId);
        if (!actual || acceso.activo) resultado.set(acceso.alumnoId, acceso);
      });
      return resultado;
    },
    [accesos],
  );

  const resultados = useMemo(() => {
    const termino = normalizarTexto(busqueda);
    return (alumnos || [])
      .filter((alumno) => alumno.activo !== false)
      .filter(
        (alumno) =>
          !termino ||
          normalizarTexto(alumno.nombre).includes(termino) ||
          normalizarTexto(alumno.telefono || "").includes(termino),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 30);
  }, [alumnos, busqueda]);

  const abrirVinculacion = (alumno: Alumno) => {
    const acceso = accesoPorAlumno.get(alumno.id);
    setAlumnoSeleccionado(alumno);
    setUid(solicitudUidActiva || acceso?.uid || "");
  };

  const abrirCrearCuenta = (alumno: Alumno) => {
    setCuentaAlumno(alumno);
    setCuentaEmail("");
    setCuentaPassword("");
  };

  const crearCuenta = async () => {
    if (!user || !cuentaAlumno || !esAdmin || creandoCuenta) return;
    const email = cuentaEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        variant: "destructive",
        title: "Correo inválido",
        description: "Escribe un correo electrónico válido.",
      });
      return;
    }
    if (cuentaPassword.length < 8 || cuentaPassword.length > 128) {
      toast({
        variant: "destructive",
        title: "Contraseña inválida",
        description: "Debe tener entre 8 y 128 caracteres.",
      });
      return;
    }

    try {
      setCreandoCuenta(true);
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<{
        ok?: boolean;
        uid?: string;
        mensaje?: string;
      }>("/api/admin/accesos-atletas", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alumnoId: cuentaAlumno.id,
          email,
          password: cuentaPassword,
        }),
      });
      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudo crear la cuenta del atleta.",
          ),
        );
      }

      void recordAdminAudit(auth, {
        sede: cuentaAlumno.sede,
        action: "crear",
        entity: "alumno",
        entityId: cuentaAlumno.id,
        entityName: cuentaAlumno.nombre,
        summary: `Se creó y vinculó una cuenta de portal para ${cuentaAlumno.nombre}.`,
        details: { uid: data.uid || "", email },
      });
      toast({
        title: "Cuenta creada y vinculada",
        description: `${cuentaAlumno.nombre} ya puede ingresar con ${email}.`,
      });
      setCuentaAlumno(null);
      setCuentaEmail("");
      setCuentaPassword("");
      await cargarAccesos();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo crear la cuenta",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setCreandoCuenta(false);
    }
  };

  const abrirFoto = async (alumno: Alumno) => {
    if (!user || !esAdmin) return;
    setFotoAlumno(alumno);
    setFotoPreview("");
    setFotoExistente(false);
    setCargandoFoto(true);
    try {
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<{
        ok?: boolean;
        imagenDataUrl?: string;
        mensaje?: string;
      }>(
        `/api/admin/accesos-atletas/foto?alumnoId=${encodeURIComponent(alumno.id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudo cargar la fotografía.",
          ),
        );
      }
      const imagen = data.imagenDataUrl || "";
      setFotoPreview(imagen);
      setFotoExistente(Boolean(imagen));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo cargar la fotografía",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setCargandoFoto(false);
    }
  };

  const seleccionarFotoAdmin = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file || preparandoFoto || guardandoFoto) return;

    const validationError = athletePhotoValidationError(file);
    if (validationError) {
      toast({
        variant: "destructive",
        title: "Fotografía no válida",
        description: validationError,
      });
      return;
    }

    try {
      setPreparandoFoto(true);
      const optimized = await prepareAthletePhoto(file);
      setFotoPreview(await blobToDataUrl(optimized));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo preparar la fotografía",
        description: error instanceof Error ? error.message : "Prueba con otra imagen.",
      });
    } finally {
      setPreparandoFoto(false);
    }
  };

  const guardarFotoAdmin = async () => {
    if (!user || !fotoAlumno || !fotoPreview || guardandoFoto) return;
    try {
      setGuardandoFoto(true);
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
      }>("/api/admin/accesos-atletas/foto", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alumnoId: fotoAlumno.id,
          imagenDataUrl: fotoPreview,
        }),
      });
      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudo guardar la fotografía.",
          ),
        );
      }

      setFotoExistente(true);
      toast({
        title: "Fotografía actualizada",
        description: `La nueva foto de ${fotoAlumno.nombre} ya está disponible.`,
      });
      setFotoAlumno(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar la fotografía",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setGuardandoFoto(false);
    }
  };

  const eliminarFotoAdmin = async () => {
    if (!user || !fotoAlumno || !fotoExistente || guardandoFoto) return;
    if (!window.confirm(`¿Quitar la fotografía de ${fotoAlumno.nombre}?`)) return;
    try {
      setGuardandoFoto(true);
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
      }>("/api/admin/accesos-atletas/foto", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alumnoId: fotoAlumno.id }),
      });
      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudo eliminar la fotografía.",
          ),
        );
      }
      setFotoPreview("");
      setFotoExistente(false);
      toast({ title: "Fotografía eliminada" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar la fotografía",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setGuardandoFoto(false);
    }
  };

  const abrirExpediente = async (alumno: Alumno) => {
    if (!user || !esAdmin) return;
    setExpedienteAlumno(alumno);
    setExpediente(null);
    setCargandoExpediente(true);
    try {
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<
        { ok?: boolean; mensaje?: string } & Partial<ExpedienteAtleta>
      >(
        `/api/admin/accesos-atletas?alumnoId=${encodeURIComponent(alumno.id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok || !data.ok || !data.alumno || !data.actividad) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudo abrir el expediente.",
          ),
        );
      }
      setExpediente(data as ExpedienteAtleta);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo abrir el expediente",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setCargandoExpediente(false);
    }
  };

  const enviarRestablecimiento = async () => {
    const expedienteActual = expediente;
    const email = expedienteActual?.acceso?.email || "";
    if (!expedienteActual || !email || enviandoRestablecimiento) return;
    if (
      !window.confirm(
        `¿Enviar a ${email} un correo para cambiar su contraseña?`,
      )
    ) {
      return;
    }

    try {
      setEnviandoRestablecimiento(true);
      await sendPasswordResetEmail(auth, email);
      void recordAdminAudit(auth, {
        sede: normalizarSede(expedienteActual.alumno.sede),
        action: "editar",
        entity: "alumno",
        entityId: expedienteActual.alumno.id,
        entityName: expedienteActual.alumno.nombre,
        summary: "Se envió un correo de restablecimiento de contraseña.",
        details: { tipo: "restablecimiento_acceso" },
      });
      toast({
        title: "Correo enviado",
        description: `Firebase envió las instrucciones a ${email}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo enviar el correo",
        description:
          error instanceof Error
            ? error.message
            : "Revisa el correo e intenta nuevamente.",
      });
    } finally {
      setEnviandoRestablecimiento(false);
    }
  };

  const atenderSolicitud = (solicitud: SolicitudAcceso) => {
    setSolicitudActiva(solicitud);
    setBusquedaSolicitud(solicitud.nombre);
  };

  const elegirAlumnoParaSolicitud = (alumno: Alumno) => {
    setSolicitudUidActiva(solicitudActiva?.uid || null);
    setUid(solicitudActiva?.uid || "");
    setAlumnoSeleccionado(alumno);
    setSolicitudActiva(null);
  };

  const guardarAcceso = async () => {
    if (
      !firestore ||
      !sede ||
      !alumnoSeleccionado ||
      !esAdmin ||
      guardando
    ) {
      return;
    }

    const uidLimpio = uid.trim();
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(uidLimpio)) {
      toast({
        variant: "destructive",
        title: "UID inválido",
        description:
          "Pega el UID completo que aparece en la cuenta del atleta.",
      });
      return;
    }

    const accesoExistente = accesos.find(
      (acceso) => acceso.uid === uidLimpio,
    );
    if (
      accesoExistente &&
      accesoExistente.alumnoId !== alumnoSeleccionado.id
    ) {
      toast({
        variant: "destructive",
        title: "UID ya utilizado",
        description:
          "Ese UID ya está asociado con otro alumno. Desactívalo primero.",
      });
      return;
    }

    try {
      setGuardando(true);
      const perfilesDelAlumno = await getDocs(
        query(
          collection(firestore, "usuarios"),
          where("alumnoId", "==", alumnoSeleccionado.id),
        ),
      );
      const otrosPerfiles = perfilesDelAlumno.docs.filter(
        (documento) => documento.id !== uidLimpio,
      );

      const perfilProtegido = otrosPerfiles.find((documento) => {
        const rol = String(documento.data().rol || "");
        return rol && rol !== "atleta";
      });
      if (perfilProtegido) {
        toast({
          variant: "destructive",
          title: "Vinculación protegida",
          description:
            "Este alumno está asociado a un perfil administrativo o de profesor. Revisa esa cuenta antes de cambiar el UID.",
        });
        return;
      }

      const perfilUidSnapshot = await getDoc(
        doc(firestore, "usuarios", uidLimpio),
      );

      if (perfilUidSnapshot.exists()) {
        const perfilUid = perfilUidSnapshot.data();
        const rolExistente = String(perfilUid.rol || "");
        const alumnoExistente = String(perfilUid.alumnoId || "");

        if (rolExistente && rolExistente !== "atleta") {
          toast({
            variant: "destructive",
            title: "UID protegido",
            description:
              "Ese UID pertenece a una cuenta administrativa o de profesor y no puede vincularse con un atleta.",
          });
          return;
        }

        if (
          alumnoExistente &&
          alumnoExistente !== alumnoSeleccionado.id
        ) {
          toast({
            variant: "destructive",
            title: "UID ya vinculado",
            description:
              "Ese UID ya pertenece a la cuenta de otro atleta.",
          });
          return;
        }
      }

      const batch = writeBatch(firestore);
      for (const perfilAnterior of otrosPerfiles) {
        batch.update(perfilAnterior.ref, {
          activo: false,
          alumnoId: deleteField(),
          reemplazadoPorUid: uidLimpio,
          actualizadoEn: serverTimestamp(),
          actualizadoPor: auth.currentUser?.uid || "",
        });
      }
      batch.set(
        doc(firestore, "usuarios", uidLimpio),
        {
          rol: "atleta",
          activo: true,
          alumnoId: alumnoSeleccionado.id,
          sede,
          nombre: alumnoSeleccionado.nombre,
          actualizadoEn: serverTimestamp(),
          actualizadoPor: auth.currentUser?.uid || "",
        },
        { merge: true },
      );
      if (solicitudUidActiva === uidLimpio) {
        batch.update(doc(firestore, "SolicitudesAcceso", uidLimpio), {
          estado: "aprobada",
          alumnoId: alumnoSeleccionado.id,
          resueltaEn: serverTimestamp(),
          resueltaPor: auth.currentUser?.uid || "",
        });
      }
      await batch.commit();

      void recordAdminAudit(auth, {
        sede,
        action: "editar",
        entity: "alumno",
        entityId: alumnoSeleccionado.id,
        entityName: alumnoSeleccionado.nombre,
        summary: `Se activó el portal de ${alumnoSeleccionado.nombre}.`,
        details: { uid: uidLimpio },
      });

      toast({
        title: otrosPerfiles.length ? "UID actualizado" : "Acceso activado",
        description: otrosPerfiles.length
          ? `Se vinculó el UID nuevo y se desactivó ${otrosPerfiles.length === 1 ? "la cuenta anterior" : "las cuentas anteriores"}.`
          : `${alumnoSeleccionado.nombre} ya puede abrir Mi Academia.`,
      });
      setAlumnoSeleccionado(null);
      setUid("");
      setSolicitudUidActiva(null);
      await cargarAccesos();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo vincular",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarSolicitud = async (solicitud: SolicitudAcceso) => {
    if (!user || !sede || !esAdmin || eliminandoSolicitudUid) return;
    if (
      !window.confirm(
        `¿Eliminar definitivamente la solicitud pendiente de ${solicitud.nombre || solicitud.email || "esta cuenta"}?`,
      )
    ) {
      return;
    }

    try {
      setEliminandoSolicitudUid(solicitud.uid);
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<{
        ok?: boolean;
        mensaje?: string;
        authUserDeleted?: boolean;
      }>("/api/admin/accesos-atletas", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: solicitud.uid }),
      });

      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(
            response.status,
            data.mensaje,
            "No se pudo eliminar la solicitud y su cuenta pendiente.",
          ),
        );
      }

      void recordAdminAudit(auth, {
        sede,
        action: "eliminar",
        entity: "alumno",
        entityId: solicitud.uid,
        entityName: solicitud.nombre || solicitud.email || "Solicitud de acceso",
        summary: "Se eliminó una solicitud de acceso pendiente que ya no era necesaria.",
        details: { tipo: "solicitud_acceso", uid: solicitud.uid },
      });

      setSolicitudes((actuales) =>
        actuales.filter((item) => item.uid !== solicitud.uid),
      );
      if (solicitudActiva?.uid === solicitud.uid) setSolicitudActiva(null);
      toast({
        title: "Solicitud eliminada",
        description:
          "Se eliminaron la petición, el perfil preliminar y la cuenta sin vincular. El correo puede registrarse de nuevo.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar la solicitud",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setEliminandoSolicitudUid(null);
    }
  };

  const desactivarAcceso = async (alumno: Alumno, acceso: AccesoAtleta) => {
    if (!firestore || !esAdmin || desactivandoId) return;

    if (
      !window.confirm(
        `¿Desactivar el acceso al portal de ${alumno.nombre}?`,
      )
    ) {
      return;
    }

    try {
      setDesactivandoId(alumno.id);
      await updateDoc(doc(firestore, "usuarios", acceso.uid), {
        activo: false,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: auth.currentUser?.uid || "",
      });
      toast({
        title: "Acceso desactivado",
        description: "La cuenta permanece creada, pero ya no puede leer la ficha.",
      });
      await cargarAccesos();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo desactivar",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setDesactivandoId(null);
    }
  };

  const ingresarComoAdministrador = async () => {
    if (
      !firestore ||
      iniciandoAdmin ||
      !adminEmail.trim() ||
      !adminPassword
    ) {
      return;
    }

    try {
      setIniciandoAdmin(true);
      const credencial = await signInWithEmailAndPassword(
        auth,
        adminEmail.trim(),
        adminPassword,
      );
      const perfilSnapshot = await getDoc(
        doc(firestore, "usuarios", credencial.user.uid),
      );
      const perfil = perfilSnapshot.data();

      if (
        !perfilSnapshot.exists() ||
        perfil?.rol !== "admin" ||
        perfil?.activo !== true
      ) {
        await signOut(auth);
        throw new Error("La cuenta ingresada no es un administrador activo.");
      }

      localStorage.setItem("userRole", "admin");
      toast({
        title: "Sesión administrativa iniciada",
        description: "Ya puedes administrar los accesos de los atletas.",
      });
      window.location.reload();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo iniciar como administrador",
        description:
          error instanceof Error
            ? error.message
            : "Comprueba el correo y la contraseña.",
      });
    } finally {
      setIniciandoAdmin(false);
    }
  };

  if (!esAdmin) {
    return (
      <div className="grid min-h-[65vh] place-items-center">
        <Card className="w-full max-w-lg border-amber-500/25 bg-amber-500/5">
          <CardContent className="py-10 text-center">
            <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-500" />
            <h1 className="text-xl font-black uppercase italic">
              Función exclusiva del administrador
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Los profesores pueden consultar su sede, pero no crear ni cambiar
              credenciales de atletas.
            </p>
            <div className="mx-auto mt-6 max-w-sm space-y-4 rounded-2xl border border-amber-500/15 bg-background/55 p-4 text-left">
              <div>
                <Label htmlFor="admin-email">Correo del administrador</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="administrador@correo.com"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="admin-password">
                  Contraseña del administrador
                </Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void ingresarComoAdministrador();
                    }
                  }}
                  className="mt-2"
                />
              </div>
              <Button
                type="button"
                className="w-full font-black uppercase"
                disabled={
                  iniciandoAdmin ||
                  !adminEmail.trim() ||
                  !adminPassword
                }
                onClick={() => void ingresarComoAdministrador()}
              >
                {iniciandoAdmin ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Ingresar como administrador
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Las credenciales se envían directamente a Firebase
                Authentication y no se guardan en la página.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-xl shadow-primary/5 md:p-8">
        <Badge className="mb-3 bg-primary/15 text-primary hover:bg-primary/15">
          SEGURIDAD · {sede?.replace("_", " ")}
        </Badge>
        <h1 className="text-3xl font-black uppercase italic tracking-tight md:text-4xl">
          Accesos de atletas
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Vincula la cuenta creada por el alumno con su ficha administrativa.
          También puedes crearle una cuenta directamente y administrar su foto.
          El UID no es una contraseña y solo identifica su cuenta.
        </p>

        <div className="relative mt-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar alumno por nombre o teléfono..."
            className="h-14 rounded-2xl bg-background/70 pl-12"
          />
        </div>
      </section>

      <Card className="border-primary/15 bg-card/55">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic">
              <Inbox className="h-5 w-5 text-primary" />
              Solicitudes pendientes
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Enviadas directamente por los atletas desde Mi Academia.
            </p>
          </div>
          <Badge variant={solicitudes.length ? "default" : "secondary"}>
            {solicitudes.length}
          </Badge>
        </CardHeader>
        <CardContent>
          {cargandoAccesos ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          ) : solicitudes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary/15 py-8 text-center text-sm text-muted-foreground">
              No hay solicitudes pendientes en esta sede.
            </div>
          ) : (
            <div className="grid gap-2">
              {solicitudes.map((solicitud) => (
                <div
                  key={solicitud.uid}
                  className="flex flex-col gap-3 rounded-xl border border-primary/10 bg-background/40 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black uppercase">
                      {solicitud.nombre}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {solicitud.telefono || "Sin teléfono"} ·{" "}
                      {solicitud.email || "Sin correo"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={eliminandoSolicitudUid !== null}
                      onClick={() => void eliminarSolicitud(solicitud)}
                    >
                      {eliminandoSolicitudUid === solicitud.uid ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Eliminar
                    </Button>
                    <Button
                      type="button"
                      disabled={eliminandoSolicitudUid !== null}
                      onClick={() => atenderSolicitud(solicitud)}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Atender
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {cargandoAlumnos || cargandoAccesos ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3">
          {resultados.map((alumno) => {
            const acceso = accesoPorAlumno.get(alumno.id);
            return (
              <Card
                key={alumno.id}
                className="border-primary/10 bg-card/55 transition-colors hover:border-primary/25"
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-black uppercase">
                        {alumno.nombre}
                      </p>
                      {acceso?.activo ? (
                        <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/10">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Activo
                        </Badge>
                      ) : acceso ? (
                        <Badge variant="secondary">Desactivado</Badge>
                      ) : (
                        <Badge variant="outline">Sin cuenta</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alumno.telefono || "Sin teléfono"}
                      {acceso && ` · UID ${acceso.uid.slice(0, 8)}…`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void abrirExpediente(alumno)}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Expediente
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void abrirFoto(alumno)}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Foto
                    </Button>
                    {!acceso?.activo && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => abrirCrearCuenta(alumno)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Crear cuenta
                      </Button>
                    )}
                    {acceso?.activo && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={desactivandoId !== null}
                        onClick={() => void desactivarAcceso(alumno, acceso)}
                      >
                        {desactivandoId === alumno.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Unlink className="mr-2 h-4 w-4" />
                        )}
                        Desactivar
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => abrirVinculacion(alumno)}
                    >
                      {acceso ? (
                        <KeyRound className="mr-2 h-4 w-4" />
                      ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                      )}
                      {acceso ? "Actualizar" : "Vincular"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={alumnoSeleccionado !== null}
        onOpenChange={(open) => !open && !guardando && setAlumnoSeleccionado(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
              <KeyRound className="h-5 w-5 text-primary" />
              {accesoPorAlumno.has(alumnoSeleccionado?.id || "")
                ? "Actualizar UID"
                : "Vincular cuenta"}
            </DialogTitle>
            <DialogDescription>
              {alumnoSeleccionado?.nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="athlete-uid">UID de Firebase Authentication</Label>
              <Input
                id="athlete-uid"
                value={uid}
                onChange={(event) => setUid(event.target.value)}
                placeholder="Pega aquí el UID que ve el atleta"
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              El alumno encuentra este código al entrar a Mi Academia antes de
              ser vinculado. Si cambias el UID, la cuenta anterior se desactiva
              y deja de estar asociada a esta ficha.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="w-full font-black uppercase"
              disabled={guardando}
              onClick={() => void guardarAcceso()}
            >
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {accesoPorAlumno.has(alumnoSeleccionado?.id || "")
                ? "Guardar UID nuevo"
                : "Activar portal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={expedienteAlumno !== null}
        onOpenChange={(open) => {
          if (!open && !enviandoRestablecimiento) {
            setExpedienteAlumno(null);
            setExpediente(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
              <FolderOpen className="h-5 w-5 text-primary" />
              Expediente central
            </DialogTitle>
            <DialogDescription>
              Identidad, cuenta y actividad de {expedienteAlumno?.nombre} en una sola vista.
            </DialogDescription>
          </DialogHeader>

          {cargandoExpediente ? (
            <div className="grid min-h-64 place-items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : expediente ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black uppercase">{expediente.alumno.nombre}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {expediente.alumno.telefono || "Sin teléfono"} · {expediente.alumno.sede.replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={expediente.alumno.activo ? "default" : "secondary"}>
                      Ficha {expediente.alumno.activo ? "activa" : "inactiva"}
                    </Badge>
                    <Badge variant="outline">
                      {expediente.alumno.estadoPago || "Pago sin estado"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><span className="text-xs text-muted-foreground">Disciplina</span><b className="block">{expediente.alumno.disciplina || "Pendiente"}</b></div>
                  <div><span className="text-xs text-muted-foreground">Grado</span><b className="block">{expediente.alumno.grado || "Pendiente"}</b></div>
                  <div><span className="text-xs text-muted-foreground">Día de pago</span><b className="block">{expediente.alumno.diaPago || "Pendiente"}</b></div>
                  <div><span className="text-xs text-muted-foreground">Objetivo</span><b className="block">{expediente.alumno.objetivo || "Sin definir"}</b></div>
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-primary/10 p-4">
                  <h3 className="flex items-center gap-2 font-black uppercase"><KeyRound className="h-4 w-4 text-primary" /> Cuenta y acceso</h3>
                  {expediente.acceso ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Correo de acceso</span><b className="block break-all">{expediente.acceso.email || "Sin correo recuperable"}</b></div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={expediente.acceso.activo ? "default" : "secondary"}>{expediente.acceso.activo ? "Vinculada" : "Desactivada"}</Badge>
                        <Badge variant={expediente.acceso.emailVerificado ? "default" : "outline"}>Correo {expediente.acceso.emailVerificado ? "verificado" : "sin verificar"}</Badge>
                        {!expediente.acceso.existeEnAuthentication && <Badge variant="destructive">Falta en Authentication</Badge>}
                        {expediente.acceso.bloqueado && <Badge variant="destructive">Bloqueada</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Creada</span><b className="block">{fechaLegible(expediente.acceso.creadoEn)}</b></div>
                        <div><span className="text-muted-foreground">Último ingreso</span><b className="block">{fechaLegible(expediente.acceso.ultimoIngreso)}</b></div>
                      </div>
                      <Button type="button" variant="outline" className="w-full" disabled={!expediente.acceso.email || enviandoRestablecimiento} onClick={() => void enviarRestablecimiento()}>
                        {enviandoRestablecimiento ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Enviar cambio de contraseña
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Esta ficha todavía no tiene una cuenta vinculada.</div>
                  )}
                </section>

                <section className="rounded-2xl border border-primary/10 p-4">
                  <h3 className="flex items-center gap-2 font-black uppercase"><CalendarDays className="h-4 w-4 text-primary" /> Actividad</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Asistencias · 30 días</span><b className="block text-2xl">{expediente.actividad.asistencias30Dias}</b></div>
                    <div className="rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Asistencias totales</span><b className="block text-2xl">{expediente.actividad.asistenciasTotales}</b></div>
                    <div className="col-span-2 rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Última asistencia</span><b className="block">{fechaLegible(expediente.actividad.ultimaAsistencia)}</b></div>
                  </div>
                </section>

                <section className="rounded-2xl border border-primary/10 p-4">
                  <h3 className="flex items-center gap-2 font-black uppercase"><CreditCard className="h-4 w-4 text-primary" /> Pagos</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Registros</span><b className="block text-2xl">{expediente.actividad.pagosTotales}</b></div>
                    <div className="rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Último monto</span><b className="block text-2xl">{expediente.actividad.ultimoPago ? `$${expediente.actividad.ultimoPago.monto.toLocaleString("es-MX")}` : "—"}</b></div>
                    <div className="col-span-2 rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Último pago</span><b className="block">{expediente.actividad.ultimoPago ? `${expediente.actividad.ultimoPago.periodo || "Sin periodo"} · ${fechaLegible(expediente.actividad.ultimoPago.fecha)}` : "Sin pagos registrados"}</b></div>
                  </div>
                </section>

                <section className="rounded-2xl border border-primary/10 p-4">
                  <h3 className="flex items-center gap-2 font-black uppercase"><Activity className="h-4 w-4 text-primary" /> Progreso físico</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Evaluaciones</span><b className="block text-2xl">{expediente.actividad.evaluacionesFisicas}</b></div>
                    <div className="rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Puntaje reciente</span><b className="block text-2xl">{expediente.actividad.ultimaEvaluacion?.puntaje || "—"}</b></div>
                    <div className="col-span-2 rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">Última evaluación</span><b className="block">{expediente.actividad.ultimaEvaluacion ? `${fechaLegible(expediente.actividad.ultimaEvaluacion.fecha)}${expediente.actividad.ultimaEvaluacion.pesoKg ? ` · ${expediente.actividad.ultimaEvaluacion.pesoKg} kg` : ""}` : "Sin evaluaciones registradas"}</b></div>
                  </div>
                </section>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => { const alumno = expedienteAlumno; setExpedienteAlumno(null); if (alumno) void abrirFoto(alumno); }}><Camera className="mr-2 h-4 w-4" /> Administrar foto</Button>
                {!expediente.acceso && expedienteAlumno && (
                  <Button type="button" onClick={() => { const alumno = expedienteAlumno; setExpedienteAlumno(null); abrirCrearCuenta(alumno); }}><UserPlus className="mr-2 h-4 w-4" /> Crear cuenta</Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No fue posible cargar el expediente.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={cuentaAlumno !== null}
        onOpenChange={(open) => {
          if (!open && !creandoCuenta) {
            setCuentaAlumno(null);
            setCuentaEmail("");
            setCuentaPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
              <UserPlus className="h-5 w-5 text-primary" />
              Crear cuenta de atleta
            </DialogTitle>
            <DialogDescription>
              La cuenta quedará vinculada directamente con {cuentaAlumno?.nombre}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-athlete-email">Correo electrónico</Label>
              <Input
                id="new-athlete-email"
                type="email"
                autoComplete="off"
                value={cuentaEmail}
                onChange={(event) => setCuentaEmail(event.target.value)}
                placeholder="atleta@correo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-athlete-password">Contraseña temporal</Label>
              <Input
                id="new-athlete-password"
                type="password"
                autoComplete="new-password"
                value={cuentaPassword}
                onChange={(event) => setCuentaPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              La contraseña se envía directamente a Firebase Authentication; no
              se guarda en Firestore ni en el historial administrativo.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="w-full font-black uppercase"
              disabled={creandoCuenta || !cuentaEmail.trim() || cuentaPassword.length < 8}
              onClick={() => void crearCuenta()}
            >
              {creandoCuenta ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Crear y vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fotoAlumno !== null}
        onOpenChange={(open) => {
          if (!open && !guardandoFoto && !preparandoFoto) setFotoAlumno(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
              <Camera className="h-5 w-5 text-primary" />
              Foto del atleta
            </DialogTitle>
            <DialogDescription>{fotoAlumno?.nombre}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="mx-auto grid h-44 w-44 place-items-center overflow-hidden rounded-3xl border border-primary/20 bg-muted">
              {cargandoFoto || preparandoFoto ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : fotoPreview ? (
                <Image
                  src={fotoPreview}
                  alt={`Fotografía de ${fotoAlumno?.nombre || "atleta"}`}
                  width={176}
                  height={176}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-athlete-photo">Seleccionar fotografía</Label>
              <Input
                id="admin-athlete-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={cargandoFoto || preparandoFoto || guardandoFoto}
                onChange={(event) => void seleccionarFotoAdmin(event)}
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG o WebP. Se recorta y comprime automáticamente al mismo
                formato usado por Mi Academia.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {fotoExistente && (
              <Button
                type="button"
                variant="outline"
                disabled={guardandoFoto || preparandoFoto}
                onClick={() => void eliminarFotoAdmin()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Quitar foto
              </Button>
            )}
            <Button
              type="button"
              disabled={!fotoPreview || cargandoFoto || preparandoFoto || guardandoFoto}
              onClick={() => void guardarFotoAdmin()}
            >
              {guardandoFoto ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Guardar foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={solicitudActiva !== null}
        onOpenChange={(open) => !open && setSolicitudActiva(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
              <Search className="h-5 w-5 text-primary" />
              Seleccionar ficha
            </DialogTitle>
            <DialogDescription>
              Solicitud de {solicitudActiva?.nombre}. Confirma cuidadosamente
              que sea la misma persona.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={busquedaSolicitud}
              onChange={(event) => setBusquedaSolicitud(event.target.value)}
              placeholder="Buscar por nombre o teléfono..."
            />
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
              {(alumnos || [])
                .filter((alumno) => alumno.activo !== false)
                .filter((alumno) => {
                  const termino = normalizarTexto(busquedaSolicitud);
                  return (
                    !termino ||
                    normalizarTexto(alumno.nombre).includes(termino) ||
                    normalizarTexto(alumno.telefono || "").includes(termino)
                  );
                })
                .slice(0, 12)
                .map((alumno) => (
                  <button
                    key={alumno.id}
                    type="button"
                    className="flex items-center justify-between rounded-xl border border-primary/10 p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                    onClick={() => elegirAlumnoParaSolicitud(alumno)}
                  >
                    <span>
                      <span className="block font-bold">{alumno.nombre}</span>
                      <span className="block text-xs text-muted-foreground">
                        {alumno.telefono || "Sin teléfono"}
                      </span>
                    </span>
                    <Link2 className="h-4 w-4 text-primary" />
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
