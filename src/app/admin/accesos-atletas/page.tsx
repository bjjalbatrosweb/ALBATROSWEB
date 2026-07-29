"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Inbox,
  KeyRound,
  Link2,
  Loader2,
  Search,
  ShieldAlert,
  Unlink,
  UserRound,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

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
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { recordAdminAudit } from "@/lib/admin-audit";

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

export default function AccesosAtletasPage() {
  const auth = useAuth();
  const firestore = useFirestore();
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
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [iniciandoAdmin, setIniciandoAdmin] = useState(false);

  useEffect(() => {
    setSede(normalizarSede(localStorage.getItem("userSede")));
    setEsAdmin(localStorage.getItem("userRole") === "admin");
  }, []);

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
    () =>
      new Map(
        accesos.map((acceso) => [acceso.alumnoId, acceso] as const),
      ),
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
      const batch = writeBatch(firestore);
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
        title: "Acceso activado",
        description: `${alumnoSeleccionado.nombre} ya puede abrir Mi Academia.`,
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
                  <Button
                    type="button"
                    onClick={() => atenderSolicitud(solicitud)}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Atender
                  </Button>
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
                  <div className="flex gap-2">
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
              Vincular cuenta
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
              ser vinculado.
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
              Activar portal
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
