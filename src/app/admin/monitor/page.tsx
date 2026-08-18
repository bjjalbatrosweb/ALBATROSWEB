"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bug,
  CirclePause,
  CirclePlay,
  Copy,
  Eraser,
  Loader2,
  MonitorDot,
  RefreshCw,
  Search,
  ServerCog,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type MonitorLevel = "info" | "warning" | "error" | "recovery";
type MonitorEvent = {
  id: string;
  source: "esp32" | "web";
  level: MonitorLevel;
  code: string;
  message: string;
  path?: string;
  count: number;
  occurredAt: number;
  deviceId?: string;
};
type MonitorResponse = {
  ok: boolean;
  mensaje?: string;
  generatedAt: number;
  cached?: boolean;
  events: MonitorEvent[];
  device: {
    deviceId: string;
    firmware: string;
    estadoSistema: string;
    rfidDisponible: boolean;
    ultimoContactoMs: number;
  } | null;
};

const LEVEL_STYLE: Record<MonitorLevel, string> = {
  error: "text-red-300",
  warning: "text-amber-300",
  recovery: "text-emerald-300",
  info: "text-sky-300",
};
const LEVEL_LABEL: Record<MonitorLevel, string> = {
  error: "ERROR",
  warning: "AVISO",
  recovery: "RECUPERADO",
  info: "INFO",
};

function getSite(): Sede {
  const value = window.localStorage.getItem("userSede") as Sede | null;
  return value && ["MMA", "CAUCEL", "JUAN_PABLO"].includes(value)
    ? value
    : "MMA";
}

function clock(value: number) {
  if (!value) return "--:--:--";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function relative(value: number) {
  if (!value) return "sin señal";
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  return `hace ${Math.floor(seconds / 3600)} h`;
}

export default function MonitorPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const terminalRef = useRef<HTMLDivElement>(null);
  const [site, setSite] = useState<Sede>("MMA");
  const [minutes, setMinutes] = useState<5 | 10>(10);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"all" | MonitorLevel>("all");
  const [hiddenBefore, setHiddenBefore] = useState(0);
  const [data, setData] = useState<MonitorResponse | null>(null);

  useEffect(() => {
    setSite(getSite());
    const saved = Number(localStorage.getItem("albatros-monitor-minutes"));
    if (saved === 5 || saved === 10) setMinutes(saved);
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (!user) return;
      if (force) setRefreshing(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/admin/monitor?sede=${site}${force ? "&force=1" : ""}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as MonitorResponse;
        if (!response.ok || !payload.ok)
          throw new Error(payload.mensaje || "No se pudo leer el monitor");
        setData(payload);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Monitor no disponible",
          description:
            error instanceof Error ? error.message : "Intenta nuevamente.",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [site, toast, user],
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void load();
  }, [load, user]);

  useEffect(() => {
    if (!user || paused) return;
    const timer = window.setInterval(() => void load(), minutes * 60_000);
    return () => window.clearInterval(timer);
  }, [load, minutes, paused, user]);

  const events = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (data?.events || []).filter(
      (event) =>
        event.occurredAt >= hiddenBefore &&
        (level === "all" || event.level === level) &&
        (!search ||
          `${event.code} ${event.message} ${event.path || ""} ${event.deviceId || ""}`
            .toLowerCase()
            .includes(search)),
    );
  }, [data?.events, hiddenBefore, level, query]);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [events.length]);

  const counts = useMemo(
    () => ({
      errors: events.filter((event) => event.level === "error").length,
      warnings: events.filter((event) => event.level === "warning").length,
      recoveries: events.filter((event) => event.level === "recovery").length,
    }),
    [events],
  );
  const online = Boolean(
    data?.device?.ultimoContactoMs &&
      Date.now() - data.device.ultimoContactoMs < 8 * 60_000,
  );

  function changeMinutes(value: 5 | 10) {
    setMinutes(value);
    localStorage.setItem("albatros-monitor-minutes", String(value));
  }

  async function copyVisible() {
    const text = events
      .map(
        (event) =>
          `[${clock(event.occurredAt)}] [${LEVEL_LABEL[event.level]}] [${event.source.toUpperCase()}] ${event.code}: ${event.message}${event.count > 1 ? ` (x${event.count})` : ""}`,
      )
      .join("\n");
    await navigator.clipboard.writeText(text);
    toast({ title: "Registros visibles copiados" });
  }

  return (
    <main className="min-h-screen bg-[#07090b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1500px] gap-5">
        <header className="overflow-hidden rounded-3xl border border-emerald-400/15 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.13),transparent_34%),linear-gradient(135deg,#171b20,#0d1014)] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.22em] text-emerald-300">
                <MonitorDot className="h-4 w-4" /> Sistema · Monitor
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Consola de diagnóstico
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">
                Eventos agrupados del ESP32 y errores de la interfaz. La vista
                consulta por intervalos; no mantiene una escucha permanente de Firebase.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-white/70">
                Lectura automática
              </span>
              {([5, 10] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeMinutes(value)}
                  className={`min-h-9 rounded-full px-4 text-xs font-black transition ${minutes === value ? "bg-emerald-400 text-black" : "border border-white/15 bg-white/[.04] text-white/70 hover:bg-white/10"}`}
                >
                  {value} min
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Status
            icon={online ? Wifi : WifiOff}
            label="ESP32"
            value={online ? "En línea" : "Sin señal"}
            detail={relative(data?.device?.ultimoContactoMs || 0)}
            tone={online ? "emerald" : "red"}
          />
          <Status icon={Bug} label="Errores" value={String(counts.errors)} detail="en la vista actual" tone="red" />
          <Status icon={AlertTriangle} label="Avisos" value={String(counts.warnings)} detail="requieren revisión" tone="amber" />
          <Status icon={ServerCog} label="Última lectura" value={data?.generatedAt ? clock(data.generatedAt) : "Pendiente"} detail={data?.cached ? "respuesta protegida por caché" : `cada ${minutes} minutos`} tone="sky" />
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e11] shadow-2xl shadow-black/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#15191e] px-4 py-3">
            <div className="flex items-center gap-2" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-2 font-mono text-xs text-white/50">albatros-monitor · {site.toLowerCase()}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPaused((value) => !value)} className="border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white">
                {paused ? <CirclePlay className="mr-2 h-4 w-4" /> : <CirclePause className="mr-2 h-4 w-4" />}
                {paused ? "Reanudar" : "Pausar"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void load(true)} disabled={refreshing} className="border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white">
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Actualizar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyVisible()} disabled={!events.length} className="border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white">
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setHiddenBefore(Date.now())} className="border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white">
                <Eraser className="mr-2 h-4 w-4" /> Limpiar vista
              </Button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código, mensaje, ruta o dispositivo…" className="border-white/10 bg-black/30 pl-10 font-mono text-white" />
            </label>
            <div className="flex flex-wrap gap-2">
              {(["all", "error", "warning", "recovery", "info"] as const).map((value) => (
                <button key={value} type="button" onClick={() => setLevel(value)} className={`min-h-10 rounded-xl px-3 text-[11px] font-black uppercase tracking-wider transition ${level === value ? "bg-white text-black" : "border border-white/10 bg-white/[.03] text-white/60 hover:bg-white/10"}`}>
                  {value === "all" ? "Todos" : LEVEL_LABEL[value]}
                </button>
              ))}
            </div>
          </div>

          <div ref={terminalRef} className="h-[56vh] min-h-[430px] overflow-auto scroll-smooth bg-[#050708] p-4 font-mono text-xs leading-6 sm:p-5 sm:text-sm">
            {loading ? (
              <p className="flex items-center gap-2 text-emerald-300"><Loader2 className="h-4 w-4 animate-spin" /> conectando con el registro agrupado…</p>
            ) : events.length ? (
              events.map((event) => (
                <div key={event.id} className="grid border-b border-white/[.045] py-1.5 lg:grid-cols-[145px_92px_75px_1fr] lg:gap-3">
                  <span className="text-white/35">{clock(event.occurredAt)}</span>
                  <span className={LEVEL_STYLE[event.level]}>[{LEVEL_LABEL[event.level]}]</span>
                  <span className="text-violet-300">[{event.source === "esp32" ? "ESP32" : "WEB"}]</span>
                  <span className="min-w-0 text-white/75"><strong className="text-white">{event.code}</strong> · {event.message}{event.path ? <em className="ml-2 not-italic text-sky-300">{event.path}</em> : null}{event.count > 1 ? <b className="ml-2 text-amber-300">×{event.count}</b> : null}</span>
                </div>
              ))
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div><p className="text-2xl text-emerald-300">✓</p><p className="mt-2 font-bold text-white/70">No hay eventos con estos filtros</p><p className="mt-1 text-white/35">Los nuevos diagnósticos aparecerán en el siguiente bloque de lectura.</p></div>
              </div>
            )}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#11151a] px-4 py-3 text-[11px] font-bold text-white/45">
            <span>{events.length} eventos visibles · {counts.recoveries} recuperaciones</span>
            <span>“Limpiar vista” no borra Firebase · caducidad objetivo: 14 días</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

function Status({ icon: Icon, label, value, detail, tone }: { icon: typeof Wifi; label: string; value: string; detail: string; tone: "emerald" | "red" | "amber" | "sky" }) {
  const color = { emerald: "text-emerald-300", red: "text-red-300", amber: "text-amber-300", sky: "text-sky-300" }[tone];
  return <article className="rounded-2xl border border-white/10 bg-[#14181d] p-4"><Icon className={`h-5 w-5 ${color}`} /><p className="mt-3 text-[10px] font-black uppercase tracking-[.18em] text-white/40">{label}</p><p className="mt-1 text-xl font-black">{value}</p><p className="mt-1 text-xs text-white/45">{detail}</p></article>;
}
