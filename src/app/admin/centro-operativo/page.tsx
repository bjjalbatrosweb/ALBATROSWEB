"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, doc, limit, onSnapshot, query, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { Activity, AlertTriangle, CheckCircle2, ClipboardCheck, DoorClosed, Gauge, Loader2, RadioTower, RefreshCw, ShieldAlert, Users, Wifi, WifiOff, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser } from "@/firebase";
import { analyzeDevice, deviceConnectionState, occupancyLevel, type DeviceTelemetry, type OperationalSignal } from "@/lib/operational-intelligence";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type DeviceRecord = {
  deviceId?: string; dispositivo?: string; firmware?: string; estadoSistema?: string;
  ultimoContacto?: Timestamp; ultimoContactoMs?: number; rssi?: number | null; heapLibre?: number | null;
  reiniciosBrownout?: number | null; rfidDisponible?: boolean | null; puertaCerrada?: boolean;
  puertaBloqueada?: boolean; alarmaActiva?: boolean; uptimeMs?: number | null; bootId?: string; ip?: string;
};
type Incident = { id: string; titulo: string; detalle: string; prioridad: "baja" | "media" | "alta"; estado: "abierta" | "resuelta"; creadoEn?: Timestamp };

const severityStyle: Record<OperationalSignal["severity"], string> = {
  ok: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  info: "border-sky-400/30 bg-sky-500/10 text-sky-100",
  warning: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  critical: "border-red-400/35 bg-red-500/15 text-red-100",
};

function startOfToday() { const value = new Date(); value.setHours(0, 0, 0, 0); return value; }
function relativeTime(value?: number) {
  if (!value) return "Sin señal";
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  return seconds < 60 ? `hace ${seconds} s` : `hace ${Math.floor(seconds / 60)} min`;
}

export default function OperationsCenterPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [site, setSite] = useState<Sede>("MMA");
  const [device, setDevice] = useState<DeviceRecord | null>(null);
  const [attendance, setAttendance] = useState(0);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [capacity, setCapacity] = useState(30);
  const [clock, setClock] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState<Incident["prioridad"]>("media");

  useEffect(() => {
    const selected = localStorage.getItem("userSede");
    if (["MMA", "CAUCEL", "JUAN_PABLO"].includes(selected || "")) setSite(selected as Sede);
    const storedCapacity = Number(localStorage.getItem(`albatros-capacity:${selected}`));
    if (storedCapacity > 0) setCapacity(storedCapacity);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLoading(true);
    const stopDevice = onSnapshot(doc(firestore, "DispositivosAcceso", site), (snapshot) => {
      setDevice(snapshot.exists() ? snapshot.data() as DeviceRecord : null); setLoading(false);
    }, () => setLoading(false));
    const attendanceQuery = query(collection(firestore, "Asistencias"), where("sede", "==", site), where("fecha", ">=", Timestamp.fromDate(startOfToday())));
    const stopAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      setAttendance(new Set(snapshot.docs.map((item) => String(item.data().alumnoId || item.id))).size);
    }, () => setAttendance(0));
    const incidentsQuery = query(collection(firestore, "IncidenciasOperativas"), where("sede", "==", site), limit(30));
    const stopIncidents = onSnapshot(incidentsQuery, (snapshot) => setIncidents(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Incident, "id">) })).sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0)).slice(0, 12)), () => setIncidents([]));
    return () => { stopDevice(); stopAttendance(); stopIncidents(); };
  }, [firestore, site]);

  const lastContactMs = device?.ultimoContacto?.toMillis?.() || device?.ultimoContactoMs;
  const telemetry: DeviceTelemetry = useMemo(() => ({
    lastContactMs, rssi: device?.rssi, freeHeap: device?.heapLibre, brownouts: device?.reiniciosBrownout,
    readerAvailable: device?.rfidDisponible, doorClosed: device?.puertaCerrada, alarmActive: device?.alarmaActiva,
    uptimeSeconds: typeof device?.uptimeMs === "number" ? device.uptimeMs / 1000 : null, firmware: device?.firmware, bootId: device?.bootId,
  }), [device, lastContactMs]);
  const signals = useMemo(() => analyzeDevice(telemetry, clock), [clock, telemetry]);
  const connection = deviceConnectionState(lastContactMs, clock);
  const occupancy = occupancyLevel(attendance, capacity);

  async function saveIncident(event: React.FormEvent) {
    event.preventDefault();
    if (!user || title.trim().length < 4 || detail.trim().length < 8 || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(firestore, "IncidenciasOperativas"), { sede: site, titulo: title.trim().slice(0, 100), detalle: detail.trim().slice(0, 600), prioridad: priority, estado: "abierta", actorUid: user.uid, actorEmail: user.email || "", creadoEn: serverTimestamp() });
      setTitle(""); setDetail(""); setPriority("media");
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#08090c] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1c22] via-[#111319] to-[#101820] p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-sky-300"><RadioTower className="h-4 w-4" /> Operación diaria · {site}</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Centro operativo</h1><p className="mt-2 max-w-3xl text-sm text-white/70">Estado del ESP32, alertas explicables, ocupación, contingencia e incidencias en una sola vista. No muestra códigos RFID ni sustituye los controles actuales.</p></div><Button type="button" variant="outline" onClick={() => setClock(Date.now())} className="border-white/20 bg-white/[.06] text-white hover:bg-white/10 hover:text-white"><RefreshCw className="mr-2 h-4 w-4" /> Actualizar diagnóstico</Button></div>
        </header>

        <section aria-label="Resumen operativo" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard icon={connection === "online" ? Wifi : WifiOff} label="ESP32" value={loading ? "Comprobando" : connection === "online" ? "Conectado" : connection === "delayed" ? "Señal atrasada" : connection === "offline" ? "Sin conexión" : "Sin telemetría"} detail={relativeTime(lastContactMs)} tone={connection === "online" ? "emerald" : "red"} />
          <StatusCard icon={Users} label="Asistencia de hoy" value={`${attendance} atleta${attendance === 1 ? "" : "s"}`} detail={`${occupancy.percent}% de capacidad configurada`} tone={occupancy.level === "normal" ? "sky" : "amber"} />
          <StatusCard icon={DoorClosed} label="Acceso" value={device?.alarmaActiva ? "Alarma activa" : device?.puertaCerrada === false ? "Puerta abierta" : "Puerta cerrada"} detail={device?.puertaBloqueada ? "Bloqueo activo" : "Control normal"} tone={device?.alarmaActiva ? "red" : "emerald"} />
          <StatusCard icon={ShieldAlert} label="Incidencias" value={`${incidents.filter((item) => item.estado === "abierta").length} abierta(s)`} detail={incidents.some((item) => item.prioridad === "alta" && item.estado === "abierta") ? "Hay prioridad alta" : "Sin prioridad alta"} tone={incidents.some((item) => item.prioridad === "alta" && item.estado === "abierta") ? "red" : "sky"} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-3xl border border-white/10 bg-[#14161c] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-sky-300">Monitor importante</p><h2 className="mt-1 text-xl font-black">Diagnóstico del controlador</h2></div><Activity className="h-6 w-6 text-sky-300" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{signals.map((signal) => <article key={signal.id} role={signal.severity === "critical" ? "alert" : undefined} className={`rounded-2xl border p-4 ${severityStyle[signal.severity]}`}><div className="flex gap-3">{signal.severity === "ok" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}<div><h3 className="font-black">{signal.title}</h3><p className="mt-1 text-xs leading-relaxed opacity-80">{signal.detail}</p></div></div></article>)}</div><div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">{[["Firmware", device?.firmware || "Sin dato"], ["WiFi", typeof device?.rssi === "number" ? `${device.rssi} dBm` : "Sin dato"], ["Memoria", typeof device?.heapLibre === "number" ? `${Math.round(device.heapLibre / 1024)} KB` : "Sin dato"], ["IP local", device?.ip || "Sin dato"], ["Sistema", device?.estadoSistema || "Sin dato"], ["Reinicios", String(device?.reiniciosBrownout ?? 0)], ["Boot ID", device?.bootId || "Sin dato"], ["Dispositivo", device?.deviceId || "Sin registrar"]].map(([label, value]) => <div key={label} className="min-w-0 bg-[#111319] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/70">{label}</p><p className="mt-1 truncate text-sm font-bold text-white" title={value}>{value}</p></div>)}</div></div>

          <div className="rounded-3xl border border-white/10 bg-[#14161c] p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-amber-300">Aforo y seguridad</p><h2 className="mt-1 text-xl font-black">Ocupación estimada</h2><div className="mt-5 flex items-end justify-between"><strong className="text-5xl font-black">{attendance}</strong><span className="text-sm font-bold text-white/70">de {capacity}</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${occupancy.level === "full" ? "bg-red-400" : occupancy.level === "high" ? "bg-amber-300" : "bg-emerald-400"}`} style={{ width: `${occupancy.percent}%` }} /></div><Label htmlFor="capacity" className="mt-5 block text-white">Capacidad segura configurada</Label><Input id="capacity" type="number" min={1} max={500} value={capacity} onChange={(event) => { const value = Math.max(1, Number(event.target.value) || 1); setCapacity(value); localStorage.setItem(`albatros-capacity:${site}`, String(value)); }} className="mt-2 border-white/15 bg-black/30 text-white" /><p className="mt-3 text-xs leading-relaxed text-white/70">La ocupación usa asistencias únicas del día. Es una ayuda operativa, no un conteo físico de evacuación.</p></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveIncident} className="rounded-3xl border border-white/10 bg-[#14161c] p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-red-300">Bitácora compartida</p><h2 className="mt-1 text-xl font-black">Registrar incidencia</h2><div className="mt-5 grid gap-4"><div><Label htmlFor="incident-title" className="text-white">Título</Label><Input id="incident-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required minLength={4} className="mt-2 border-white/15 bg-black/30 text-white" /></div><div><Label htmlFor="incident-detail" className="text-white">Detalle y acción tomada</Label><Textarea id="incident-detail" value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={600} required minLength={8} className="mt-2 min-h-28 border-white/15 bg-black/30 text-white" /></div><div><Label htmlFor="incident-priority" className="text-white">Prioridad</Label><select id="incident-priority" value={priority} onChange={(event) => setPriority(event.target.value as Incident["prioridad"])} className="mt-2 min-h-11 w-full rounded-md border border-white/15 bg-[#090a0d] px-3 font-bold text-white"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></div><Button type="submit" disabled={saving || !user} className="min-h-11 font-black">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />} Guardar incidencia</Button></div></form>

          <div className="rounded-3xl border border-white/10 bg-[#14161c] p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Continuidad</p><h2 className="mt-1 text-xl font-black">Modo contingencia</h2><p className="mt-2 text-sm text-white/70">Atajos seguros si falla internet, Firebase o el controlador. No ejecutan acciones automáticas.</p><div className="mt-5 grid gap-3">{[["Control manual de clase", "/admin/clase-activa", RadioTower], ["Checklist de apertura y cierre", "/admin/checklist-operativo", ClipboardCheck], ["Mantenimiento preventivo", "/admin/mantenimiento", Wrench], ["Registro desde recepción", "/admin/recepcion", Users]].map(([label, href, Icon]) => { const ItemIcon = Icon as typeof Gauge; return <Link key={String(href)} href={String(href)} className="flex min-h-12 items-center justify-between rounded-xl border border-white/15 bg-white/[.04] px-4 font-bold text-white hover:bg-white/10"><span className="flex items-center gap-3"><ItemIcon className="h-5 w-5 text-emerald-300" />{String(label)}</span><span aria-hidden>→</span></Link>; })}</div></div>
        </section>
      </div>
    </main>
  );
}

function StatusCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: string; detail: string; tone: "emerald" | "sky" | "amber" | "red" }) {
  const colors = { emerald: "text-emerald-300", sky: "text-sky-300", amber: "text-amber-300", red: "text-red-300" };
  return <article className="rounded-2xl border border-white/10 bg-[#15171d] p-4"><Icon className={`h-5 w-5 ${colors[tone]}`} /><p className="mt-3 text-[10px] font-black uppercase tracking-[.16em] text-white/70">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-white/70">{detail}</p></article>;
}
