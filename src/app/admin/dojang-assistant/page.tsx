"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Building2,
  CheckCircle2,
  Cloud,
  CloudRain,
  DoorClosed,
  DoorOpen,
  Droplets,
  Fan,
  Gauge,
  Home,
  Lightbulb,
  Loader2,
  Map as MapIcon,
  Monitor,
  MoonStar,
  Power,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Speaker,
  Sun,
  Thermometer,
  TriangleAlert,
  Tv,
  Wind,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type View = "dashboard" | "zonas" | "modos";
type EquipmentType = "light" | "fan" | "tv" | "speaker" | "door";
type Equipment = {
  id: string;
  name: string;
  type: EquipmentType;
  note?: string;
};
type Zone = {
  id: string;
  name: string;
  description: string;
  equipment: Equipment[];
};
type Weather = {
  temperatura: number;
  sensacion: number | null;
  humedad: number | null;
  viento: number | null;
  codigo: number;
  esDia: boolean;
  observadoEn: string;
  ubicacion: string;
  fuente: string;
};

const ZONES: Zone[] = [
  {
    id: "lobby",
    name: "Lobby",
    description: "Recepción, acceso principal y espera.",
    equipment: [
      { id: "lobby-light-1", name: "Luz principal", type: "light" },
      { id: "lobby-fan-1", name: "Ventilador", type: "fan" },
      {
        id: "lobby-door-1",
        name: "Puerta principal",
        type: "door",
        note: "Estado consultado desde el control de acceso.",
      },
    ],
  },
  {
    id: "bathroom-men",
    name: "Baño hombres",
    description: "Iluminación del baño de hombres.",
    equipment: [{ id: "bathroom-men-light-1", name: "Luz", type: "light" }],
  },
  {
    id: "bathroom-women",
    name: "Baño mujeres",
    description: "Iluminación del baño de mujeres.",
    equipment: [{ id: "bathroom-women-light-1", name: "Luz", type: "light" }],
  },
  {
    id: "tatami",
    name: "Tatami",
    description: "Área principal de entrenamiento, clases y torneos.",
    equipment: [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `tatami-light-${index + 1}`,
        name: `Luz ${index + 1}`,
        type: "light" as const,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `tatami-fan-${index + 1}`,
        name: `Ventilador ${index + 1}`,
        type: "fan" as const,
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        id: `tatami-tv-${index + 1}`,
        name: `TV ${index + 1}`,
        type: "tv" as const,
      })),
      { id: "tatami-speaker-1", name: "Bocina", type: "speaker" },
    ],
  },
];

const ALL_EQUIPMENT = ZONES.flatMap((zone) => zone.equipment);
const LIGHT_IDS = ALL_EQUIPMENT.filter((item) => item.type === "light").map(
  (item) => item.id,
);
const TATAMI_LIGHTS = ALL_EQUIPMENT.filter(
  (item) => item.type === "light" && item.id.startsWith("tatami"),
).map((item) => item.id);
const TATAMI_FANS = ALL_EQUIPMENT.filter(
  (item) => item.type === "fan" && item.id.startsWith("tatami"),
).map((item) => item.id);
const TATAMI_TVS = ALL_EQUIPMENT.filter((item) => item.type === "tv").map(
  (item) => item.id,
);

const MODES = [
  {
    id: "lobby-only",
    name: "Solo lobby",
    description: "Apaga el tatami y mantiene únicamente la luz del lobby.",
    color: "from-sky-500/20 to-blue-950/20",
    enabled: ["lobby-light-1"],
    actions: [
      "Luz del lobby encendida",
      "Luces y ventilación del tatami apagadas",
      "TV y bocina apagadas",
    ],
  },
  {
    id: "class",
    name: "Modo clase",
    description: "Prepara iluminación, ventilación y audio para entrenar.",
    color: "from-red-500/20 to-red-950/20",
    enabled: [
      "lobby-light-1",
      ...TATAMI_LIGHTS,
      ...TATAMI_FANS,
      "tatami-speaker-1",
    ],
    actions: [
      "Lobby y tatami iluminados",
      "Ventiladores del tatami encendidos",
      "Bocina encendida y televisores apagados",
    ],
  },
  {
    id: "tournament",
    name: "Modo torneo",
    description: "Activa el tatami completo, pantallas y sonido.",
    color: "from-amber-500/20 to-orange-950/20",
    enabled: [
      "lobby-light-1",
      ...TATAMI_LIGHTS,
      ...TATAMI_FANS,
      ...TATAMI_TVS,
      "tatami-speaker-1",
    ],
    actions: [
      "Tatami completamente iluminado",
      "Ventilación, televisores y bocina encendidos",
      "Baños sin cambios automáticos",
    ],
  },
  {
    id: "cleaning",
    name: "Modo limpieza",
    description: "Enciende todas las luces y la ventilación principal.",
    color: "from-emerald-500/20 to-green-950/20",
    enabled: [...LIGHT_IDS, "lobby-fan-1", ...TATAMI_FANS],
    actions: [
      "Todas las luces encendidas",
      "Todos los ventiladores encendidos",
      "TV y bocina apagadas",
    ],
  },
  {
    id: "closing",
    name: "Modo cierre",
    description: "Apaga los equipos y deja preparada la revisión de salida.",
    color: "from-zinc-500/20 to-black",
    enabled: [],
    actions: [
      "Luces, ventiladores, TV y bocina apagados",
      "Solicitar verificación de puerta",
      "No modifica físicamente la cerradura en esta versión",
    ],
  },
] as const;

function normalizeSite(value: string | null): Sede {
  const site = String(value || "MMA")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return ["MMA", "CAUCEL", "JUAN_PABLO"].includes(site)
    ? (site as Sede)
    : "MMA";
}

function equipmentIcon(type: EquipmentType) {
  if (type === "light") return Lightbulb;
  if (type === "fan") return Fan;
  if (type === "tv") return Tv;
  if (type === "speaker") return Speaker;
  return DoorClosed;
}

function weatherDescription(code: number) {
  if (code === 0) return "Despejado";
  if (code <= 3) return "Parcialmente nublado";
  if (code === 45 || code === 48) return "Niebla";
  if (code >= 51 && code <= 82) return "Lluvia";
  if (code >= 95) return "Tormenta";
  return "Condición variable";
}

function weatherIcon(code: number, isDay: boolean) {
  if (code === 0) return isDay ? Sun : MoonStar;
  if ((code >= 51 && code <= 82) || code >= 95) return CloudRain;
  return Cloud;
}

function greeting(hour: number) {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function DojangAssistantPage() {
  const auth = useAuth();
  const [site, setSite] = useState<Sede>("MMA");
  const [view, setView] = useState<View>("dashboard");
  const [clock, setClock] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [doorUnlocked, setDoorUnlocked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [simulated, setSimulated] = useState<Record<string, boolean>>({});
  const [activeMode, setActiveMode] = useState<string | null>(null);

  useEffect(() => {
    setSite(normalizeSite(localStorage.getItem("userSede")));
    const interval = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token)
        throw new Error("La sesión expiró. Inicie sesión nuevamente.");
      const headers = { Authorization: `Bearer ${token}` };
      const [weatherResult, doorResult] = await Promise.allSettled([
        apiRequest<{ ok?: boolean; mensaje?: string } & Weather>(
          `/api/admin/dojang-assistant/clima?sede=${encodeURIComponent(site)}`,
          { headers },
        ),
        apiRequest<{
          ok?: boolean;
          mensaje?: string;
          puertaLiberada?: boolean;
        }>(`/api/control-puerta?sede=${encodeURIComponent(site)}`, { headers }),
      ]);

      if (
        weatherResult.status === "fulfilled" &&
        weatherResult.value.response.ok &&
        weatherResult.value.data.ok
      ) {
        setWeather(weatherResult.value.data);
      } else {
        setWeather(null);
      }
      if (
        doorResult.status === "fulfilled" &&
        doorResult.value.response.ok &&
        doorResult.value.data.ok
      ) {
        setDoorUnlocked(doorResult.value.data.puertaLiberada === true);
      } else {
        setDoorUnlocked(null);
      }

      if (
        weatherResult.status === "rejected" &&
        doorResult.status === "rejected"
      ) {
        throw new Error("No se pudo actualizar el estado del Dojang.");
      }
      if (
        weatherResult.status === "fulfilled" &&
        !weatherResult.value.response.ok
      ) {
        setError(
          apiErrorMessage(
            weatherResult.value.response.status,
            weatherResult.value.data.mensaje,
            "El clima no está disponible; los demás datos siguen visibles.",
          ),
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el Dojang.",
      );
    } finally {
      setLoading(false);
    }
  }, [auth, site]);

  useEffect(() => {
    if (!auth.currentUser) return;
    void load();
  }, [auth.currentUser, load]);

  const userName = useMemo(() => {
    const user = auth.currentUser;
    return (
      user?.displayName?.trim() || user?.email?.split("@")[0] || "Administrador"
    );
  }, [auth.currentUser]);

  const simulateMode = (mode: (typeof MODES)[number]) => {
    const next = Object.fromEntries(
      ALL_EQUIPMENT.filter((item) => item.type !== "door").map((item) => [
        item.id,
        mode.enabled.includes(item.id as never),
      ]),
    );
    setSimulated(next);
    setActiveMode(mode.id);
  };

  const simulatedOn = Object.values(simulated).filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[#07080b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1500px] gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-red-500/20 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.2),transparent_38%),linear-gradient(135deg,#17181d,#0b0c10)] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <Badge className="mb-3 border border-red-400/25 bg-red-500/10 text-red-300">
                <Bot className="mr-1 h-3.5 w-3.5" /> DOJANG ASSISTANT ·{" "}
                {site.replace("_", " ")}
              </Badge>
              <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">
                Centro del Dojang
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65 sm:text-base">
                Estado general, distribución de equipos y preparación de futuras
                automatizaciones por zona.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={load}
              disabled={loading}
              className="border-white/15 bg-black/25 text-white hover:bg-white/10 hover:text-white"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Actualizar estado
            </Button>
          </div>
        </header>

        <nav className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#15161b] p-1.5">
          {(
            [
              ["dashboard", Home, "Dashboard"],
              ["zonas", MapIcon, "Zonas"],
              ["modos", Sparkles, "Modos"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black uppercase tracking-wide transition-colors sm:text-sm ${view === value ? "bg-red-600 text-white shadow-lg shadow-red-950/30" : "text-white/60 hover:bg-white/[.06] hover:text-white"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[.07] p-4 text-sm text-amber-100">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p>
            <strong>Etapa de planeación:</strong> los controles de luces,
            ventiladores, TV y bocina son simulaciones locales. No envían
            órdenes a dispositivos físicos. La puerta solamente se consulta y se
            controla desde su módulo dedicado.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-400/25 bg-red-950/40 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        {view === "dashboard" && (
          <DashboardView
            clock={clock}
            userName={userName}
            site={site}
            weather={weather}
            doorUnlocked={doorUnlocked}
          />
        )}

        {view === "zonas" && (
          <ZonesView
            simulated={simulated}
            setSimulated={setSimulated}
            doorUnlocked={doorUnlocked}
          />
        )}

        {view === "modos" && (
          <ModesView
            activeMode={activeMode}
            simulatedOn={simulatedOn}
            onSimulate={simulateMode}
            onReset={() => {
              setSimulated({});
              setActiveMode(null);
            }}
          />
        )}
      </div>
    </main>
  );
}

function DashboardView({
  clock,
  userName,
  site,
  weather,
  doorUnlocked,
}: {
  clock: Date;
  userName: string;
  site: Sede;
  weather: Weather | null;
  doorUnlocked: boolean | null;
}) {
  const WeatherIcon = weather
    ? weatherIcon(weather.codigo, weather.esDia)
    : Cloud;
  return (
    <section className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <article className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_bottom_left,rgba(239,68,68,.16),transparent_40%),#15161b] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.2em] text-red-300">
            {greeting(clock.getHours())}
          </p>
          <h2 className="mt-2 text-3xl font-black capitalize text-white sm:text-5xl">
            {userName}
          </h2>
          <div className="mt-8 flex flex-wrap items-end gap-x-7 gap-y-3">
            <p className="text-5xl font-black tabular-nums text-white sm:text-7xl">
              {clock.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <div className="pb-1">
              <p className="font-bold capitalize text-white/75">
                {clock.toLocaleDateString("es-MX", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-wider text-white/40">
                Sede {site.replace("_", " ")}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] border border-sky-400/15 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,.18),transparent_45%),#13171d] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-sky-300">
                Clima exterior real
              </p>
              <p className="mt-1 text-sm text-white/50">
                {weather?.ubicacion || "Esperando actualización"}
              </p>
            </div>
            <WeatherIcon className="h-10 w-10 text-sky-300" />
          </div>
          <div className="mt-6 flex items-end gap-3">
            <p className="text-6xl font-black tabular-nums text-white">
              {weather ? Math.round(weather.temperatura) : "--"}°
            </p>
            <p className="pb-2 font-bold text-white/65">
              {weather ? weatherDescription(weather.codigo) : "Sin datos"}
            </p>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <WeatherMetric
              icon={Thermometer}
              label="Sensación"
              value={
                weather?.sensacion != null
                  ? `${Math.round(weather.sensacion)}°`
                  : "--"
              }
            />
            <WeatherMetric
              icon={Droplets}
              label="Humedad"
              value={
                weather?.humedad != null
                  ? `${Math.round(weather.humedad)}%`
                  : "--"
              }
            />
            <WeatherMetric
              icon={Wind}
              label="Viento"
              value={
                weather?.viento != null
                  ? `${Math.round(weather.viento)} km/h`
                  : "--"
              }
            />
          </div>
          <p className="mt-4 text-[10px] text-white/35">
            Temperatura interior: sin sensor vinculado
            {weather ? ` · Fuente ${weather.fuente}` : ""}
          </p>
        </article>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={Building2} value="4" label="Zonas registradas" />
        <StatusCard
          icon={Zap}
          value={String(ALL_EQUIPMENT.length)}
          label="Equipos planificados"
        />
        <StatusCard icon={Gauge} value="0" label="Equipos vinculados" />
        <StatusCard
          icon={doorUnlocked ? DoorOpen : DoorClosed}
          value={
            doorUnlocked === null
              ? "Sin dato"
              : doorUnlocked
                ? "Liberada"
                : "Bloqueada"
          }
          label="Puerta principal"
          accent={doorUnlocked ? "text-amber-300" : "text-emerald-300"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <FloorPlan />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {ZONES.map((zone) => (
            <article
              key={zone.id}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#17181d] p-4"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-300">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-black uppercase text-white">{zone.name}</h3>
                <p className="text-xs text-white/45">
                  {zone.equipment.length} equipos · 0 vinculados
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase text-white/45">
                Planeado
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ZonesView({
  simulated,
  setSimulated,
  doorUnlocked,
}: {
  simulated: Record<string, boolean>;
  setSimulated: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  doorUnlocked: boolean | null;
}) {
  return (
    <section className="grid gap-5">
      <FloorPlan />
      <div className="grid gap-4 lg:grid-cols-2">
        {ZONES.map((zone, zoneIndex) => (
          <details
            key={zone.id}
            open={zoneIndex === 0 || zone.id === "tatami"}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-[#17181d]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-300">
                <MapIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-black uppercase text-white">{zone.name}</h2>
                <p className="mt-0.5 text-xs text-white/45">
                  {zone.description}
                </p>
              </div>
              <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-black text-white/55">
                {zone.equipment.length}
              </span>
            </summary>
            <div className="grid gap-2 border-t border-white/10 p-4">
              {zone.equipment.map((item) => {
                const Icon = equipmentIcon(item.type);
                const isDoor = item.type === "door";
                const isOn = simulated[item.id] === true;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-black/20 p-3"
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isDoor ? "bg-sky-500/10 text-sky-300" : isOn ? "bg-amber-400/15 text-amber-300" : "bg-white/[.05] text-white/40"}`}
                    >
                      {isDoor && doorUnlocked ? (
                        <DoorOpen className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white">{item.name}</p>
                      <p className="text-[11px] text-white/40">
                        {isDoor
                          ? doorUnlocked === null
                            ? "Estado no disponible"
                            : doorUnlocked
                              ? "Liberada · consulta real"
                              : "Bloqueada · consulta real"
                          : isOn
                            ? "Encendido · simulación"
                            : "Sin vincular · simulación apagada"}
                      </p>
                    </div>
                    {isDoor ? (
                      <Link
                        href="/admin/puerta"
                        className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-white/10"
                      >
                        Ver puerta
                      </Link>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Simular ${isOn ? "apagado" : "encendido"} de ${item.name}`}
                        onClick={() =>
                          setSimulated((current) => ({
                            ...current,
                            [item.id]: !isOn,
                          }))
                        }
                        className={`relative h-8 w-14 rounded-full border p-1 transition-colors ${isOn ? "border-amber-300/40 bg-amber-500/70" : "border-white/15 bg-black/30"}`}
                      >
                        <span
                          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-6" : "translate-x-0"}`}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ModesView({
  activeMode,
  simulatedOn,
  onSimulate,
  onReset,
}: {
  activeMode: string | null;
  simulatedOn: number;
  onSimulate: (mode: (typeof MODES)[number]) => void;
  onReset: () => void;
}) {
  return (
    <section className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[#17181d] p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-red-300">
            Automatizaciones futuras
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Modos del Dojang
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Previsualiza qué equipos cambiaría cada escena antes de conectar
            hardware.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-xs font-black text-white/60">
            {simulatedOn} equipos simulados encendidos
          </span>
          <button
            type="button"
            onClick={onReset}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/60 hover:bg-white/10 hover:text-white"
            title="Limpiar simulación"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODES.map((mode) => {
          const active = activeMode === mode.id;
          return (
            <article
              key={mode.id}
              className={`overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${mode.color} ${active ? "border-emerald-400/40 ring-2 ring-emerald-400/10" : "border-white/10"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-xl ${active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[.06] text-white/55"}`}
                >
                  {active ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Power className="h-5 w-5" />
                  )}
                </span>
                <Badge
                  variant="outline"
                  className={
                    active
                      ? "border-emerald-400/25 text-emerald-300"
                      : "border-white/15 text-white/50"
                  }
                >
                  {active ? "Simulando" : "Disponible"}
                </Badge>
              </div>
              <h3 className="mt-5 text-xl font-black uppercase text-white">
                {mode.name}
              </h3>
              <p className="mt-2 min-h-10 text-sm text-white/55">
                {mode.description}
              </p>
              <ul className="mt-4 grid gap-2">
                {mode.actions.map((action) => (
                  <li
                    key={action}
                    className="flex gap-2 text-xs leading-relaxed text-white/65"
                  >
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" />
                    {action}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onSimulate(mode)}
                className={`mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-black uppercase transition-colors ${active ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-white/[.08] text-white hover:bg-white/[.14]"}`}
              >
                <Sparkles className="h-4 w-4" />
                {active ? "Simulación activa" : "Simular modo"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FloorPlan() {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#111216] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-red-300">
            Plano base
          </p>
          <h2 className="mt-1 text-xl font-black text-white">
            Distribución de zonas
          </h2>
        </div>
        <Badge variant="outline" className="border-white/15 text-white/50">
          4 áreas
        </Badge>
      </div>
      <div className="grid min-h-[310px] grid-cols-[.38fr_.62fr] overflow-hidden rounded-2xl border-4 border-red-600/70 bg-[#090a0d]">
        <div className="relative border-r-4 border-red-600/70 p-3">
          <div className="absolute left-3 top-3 grid w-[36%] grid-rows-2 overflow-hidden rounded-lg border-2 border-red-500/60">
            <PlanArea label="Baño H" icon={Lightbulb} />
            <PlanArea label="Baño M" icon={Lightbulb} border />
          </div>
          <div className="grid h-full place-items-center pt-20 text-center">
            <div>
              <Home className="mx-auto h-8 w-8 text-red-300" />
              <p className="mt-2 font-black uppercase text-white">Lobby</p>
              <p className="mt-1 text-[10px] text-white/40">
                Luz · ventilador · puerta
              </p>
            </div>
          </div>
          <DoorClosed className="absolute bottom-4 right-3 h-5 w-5 text-red-300" />
        </div>
        <div className="relative m-5 grid place-items-center rounded-xl border-4 border-indigo-500/70 bg-indigo-500/[.04] text-center">
          <div>
            <Building2 className="mx-auto h-10 w-10 text-indigo-300" />
            <p className="mt-2 text-xl font-black uppercase text-white">
              Tatami
            </p>
            <p className="mt-1 text-[10px] text-white/40">
              4 luces · 6 ventiladores · 2 TV · bocina
            </p>
          </div>
          <div className="absolute inset-x-5 bottom-5 flex justify-between text-indigo-200/60">
            {Array.from({ length: 4 }, (_, index) => (
              <Lightbulb key={index} className="h-5 w-5" />
            ))}
          </div>
          <Monitor className="absolute left-1/3 top-3 h-4 w-4 text-white/40" />
          <Monitor className="absolute right-1/3 top-3 h-4 w-4 text-white/40" />
          <Speaker className="absolute right-3 top-3 h-4 w-4 text-white/40" />
        </div>
      </div>
    </article>
  );
}

function PlanArea({
  label,
  icon: Icon,
  border = false,
}: {
  label: string;
  icon: typeof Lightbulb;
  border?: boolean;
}) {
  return (
    <div
      className={`grid min-h-20 place-items-center bg-red-500/[.04] p-2 text-center ${border ? "border-t-2 border-red-500/60" : ""}`}
    >
      <div>
        <Icon className="mx-auto h-4 w-4 text-red-300" />
        <p className="mt-1 text-[9px] font-black uppercase text-white/65">
          {label}
        </p>
      </div>
    </div>
  );
}

function WeatherMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[.08] bg-black/20 p-3">
      <Icon className="mx-auto h-4 w-4 text-sky-300" />
      <p className="mt-2 font-black text-white">{value}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase text-white/35">
        {label}
      </p>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  value,
  label,
  accent = "text-white",
}: {
  icon: typeof Building2;
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#17181d] p-4">
      <Icon className="h-5 w-5 text-red-300" />
      <p className={`mt-4 text-2xl font-black ${accent}`}>{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-white/40">
        {label}
      </p>
    </article>
  );
}
