"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import {
  Cpu,
  FileUp,
  Loader2,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type EstadoDispositivo = {
  deviceId?: string;
  firmware?: string;
  otaRemota?: boolean;
  puertaCerrada?: boolean;
  puertaBloqueada?: boolean;
  alarmaActiva?: boolean;
  ultimoContacto?: Timestamp;
  ultimoContactoMs?: number;
};

const SEDES: { value: Sede; label: string }[] = [
  { value: "MMA", label: "MMA" },
  { value: "CAUCEL", label: "Caucel" },
  { value: "JUAN_PABLO", label: "Juan Pablo" },
];

export default function FirmwareAdminPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [sede, setSede] = useState<Sede>("MMA");
  const [estado, setEstado] = useState<EstadoDispositivo | null>(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    const guardada = localStorage.getItem("userSede") as Sede | null;
    if (guardada && SEDES.some((item) => item.value === guardada))
      setSede(guardada);
  }, []);

  useEffect(() => {
    setCargandoEstado(true);
    const unsubscribe = onSnapshot(
      doc(firestore, "DispositivosAcceso", sede),
      (snapshot) => {
        setEstado(
          snapshot.exists() ? (snapshot.data() as EstadoDispositivo) : null,
        );
        setCargandoEstado(false);
        setAhora(Date.now());
      },
      () => {
        setEstado(null);
        setCargandoEstado(false);
      },
    );
    return unsubscribe;
  }, [firestore, sede]);

  useEffect(() => {
    const timer = window.setInterval(() => setAhora(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const ultimoContacto =
    estado?.ultimoContacto?.toMillis?.() ||
    (Number.isFinite(Number(estado?.ultimoContactoMs))
      ? Number(estado?.ultimoContactoMs)
      : 0);
  const retrasado =
    ultimoContacto > 0 &&
    ahora - ultimoContacto > 5 * 60_000 &&
    ahora - ultimoContacto <= 8 * 60_000;
  const conectado = ultimoContacto > 0 && ahora - ultimoContacto <= 8 * 60_000;
  const seguro =
    conectado &&
    estado?.otaRemota === true &&
    estado?.puertaCerrada === true &&
    estado?.puertaBloqueada === true &&
    estado?.alarmaActiva !== true;
  const listo = Boolean(
    user &&
    archivo &&
    version.trim() &&
    estado?.deviceId &&
    seguro &&
    !subiendo,
  );

  const estadoTexto = useMemo(() => {
    if (cargandoEstado) return "Comprobando dispositivo";
    if (!estado?.deviceId) return "Sin ESP32 asociado";
    if (!conectado) return "ESP32 sin conexión";
    if (retrasado) return "ESP32 con señal atrasada";
    if (estado.otaRemota !== true) return "Requiere firmware puente 2.2";
    if (estado.alarmaActiva) return "Alarma activa";
    if (!estado.puertaCerrada) return "Puerta abierta";
    if (!estado.puertaBloqueada) return "Puerta sin bloquear";
    return "Listo para OTA remota";
  }, [cargandoEstado, conectado, estado, retrasado]);

  const enviarFirmware = async () => {
    if (!listo || !user || !archivo || !estado?.deviceId) return;
    setConfirmar(false);
    try {
      setSubiendo(true);
      const token = await user.getIdToken();
      const form = new FormData();
      form.set("sede", sede);
      form.set("deviceId", estado.deviceId);
      form.set("version", version.trim());
      form.set("confirmar", "true");
      form.set("firmware", archivo);

      const response = await fetch("/api/admin/firmware", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok)
        throw new Error(
          result.mensaje || "No se pudo preparar la actualización.",
        );

      toast({
        title: "Actualización preparada",
        description: `Versión ${result.version}. El ESP32 la recibirá en su siguiente heartbeat.`,
      });
      setArchivo(null);
      setVersion("");
      const input = document.getElementById(
        "firmware-bin",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se envió el firmware",
        description:
          error instanceof Error ? error.message : "Inténtelo nuevamente.",
      });
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 lg:px-8">
      <header>
        <Badge
          variant="outline"
          className="mb-3 border-red-500/30 text-red-500"
        >
          CONTROL SEGURO · ESP32
        </Badge>
        <h1 className="text-3xl font-black uppercase italic tracking-tight sm:text-4xl">
          Firmware remoto
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Actualice un controlador Albatros desde Internet. La orden queda
          ligada al identificador físico del ESP32 seleccionado.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RadioTower className="h-5 w-5 text-red-500" />
              Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {SEDES.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={sede === item.value ? "default" : "outline"}
                  className="px-2 text-xs"
                  onClick={() => setSede(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <div className="rounded-2xl border bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase text-muted-foreground">
                  Estado
                </span>
                {conectado ? (
                  <Wifi className={`h-4 w-4 ${retrasado ? "text-amber-400" : "text-emerald-400"}`} />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-400" />
                )}
              </div>
              <p
                className={`mt-2 font-black ${seguro ? "text-emerald-400" : retrasado ? "text-amber-400" : "text-red-400"}`}
              >
                {estadoTexto}
              </p>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <p>
                  ID:{" "}
                  <span className="font-mono text-foreground">
                    {estado?.deviceId || "—"}
                  </span>
                </p>
                <p>
                  Firmware:{" "}
                  <span className="font-mono text-foreground">
                    {estado?.firmware || "—"}
                  </span>
                </p>
                <p>
                  Puerta:{" "}
                  <span className="text-foreground">
                    {estado?.puertaCerrada
                      ? "Cerrada"
                      : "Abierta/no disponible"}
                  </span>
                </p>
                <p>
                  Electroimán:{" "}
                  <span className="text-foreground">
                    {estado?.puertaBloqueada ? "Bloqueado" : "Sin bloquear"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
              <p>
                La web rechaza la orden si el equipo está desconectado, la
                puerta no está segura o el firmware no anuncia soporte OTA
                remoto.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-red-500" />
              Nueva versión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-bold">Versión</span>
              <input
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="Ej. albatros-control-fiable-2.3"
                maxLength={40}
                className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-red-500"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold">
                Firmware compilado (.bin)
              </span>
              <div className="rounded-2xl border border-dashed border-border p-5">
                <input
                  id="firmware-bin"
                  type="file"
                  accept=".bin,application/octet-stream"
                  onChange={(event) =>
                    setArchivo(event.target.files?.[0] || null)
                  }
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:font-bold file:text-white"
                />
                {archivo && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
            </label>

            <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">
              <LockKeyhole className="h-5 w-5 shrink-0 text-amber-400" />
              <p>
                El archivo se guarda en almacenamiento privado. La URL de
                descarga entregada al ESP32 es temporal y solo se genera cuando
                existe una orden válida.
              </p>
            </div>

            <Button
              className="h-12 w-full"
              disabled={!listo}
              onClick={() => setConfirmar(true)}
            >
              {subiendo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              {subiendo
                ? "Preparando firmware..."
                : "Preparar actualización remota"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Actualizar este ESP32?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará {archivo?.name || "el firmware"} a{" "}
              {sede.replace("_", " ")} ({estado?.deviceId || "sin ID"}). El
              equipo volverá a comprobar que la puerta sea segura antes de
              instalarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void enviarFirmware()}>
              Sí, preparar actualización
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
