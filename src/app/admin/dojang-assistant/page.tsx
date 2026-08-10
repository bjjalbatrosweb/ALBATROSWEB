"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudRain,
  Cpu,
  DoorClosed,
  DoorOpen,
  Droplets,
  Fan,
  Home,
  Lightbulb,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  MoonStar,
  Power,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Speaker,
  Sun,
  Thermometer,
  TriangleAlert,
  Tv,
  Volume2,
  Wind,
  X,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";

type Sede = "MMA" | "CAUCEL" | "JUAN_PABLO";
type View = "hub" | "zonas" | "modos";
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
    color: "from-sky-400/10 via-white/[.025] to-white/[.01]",
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
    color: "from-red-400/10 via-white/[.025] to-white/[.01]",
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
    color: "from-amber-400/10 via-white/[.025] to-white/[.01]",
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
    color: "from-emerald-400/10 via-white/[.025] to-white/[.01]",
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
    color: "from-white/[.055] via-white/[.025] to-white/[.01]",
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
  const shellRef = useRef<HTMLElement>(null);
  const [site, setSite] = useState<Sede>("MMA");
  const [view, setView] = useState<View>("hub");
  const [clock, setClock] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [doorUnlocked, setDoorUnlocked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [simulated, setSimulated] = useState<Record<string, boolean>>({});
  const [deviceLevels, setDeviceLevels] = useState<Record<string, number>>({});
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const isFullscreen = nativeFullscreen || fallbackFullscreen;

  useEffect(() => {
    setSite(normalizeSite(localStorage.getItem("userSede")));
    const interval = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateFullscreen = () =>
      setNativeFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    if (!fallbackFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fallbackFullscreen]);

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

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      setFallbackFullscreen(false);
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {
        setNativeFullscreen(false);
      }
      return;
    }

    try {
      if (!shellRef.current?.requestFullscreen)
        throw new Error("Fullscreen API unavailable");
      await shellRef.current.requestFullscreen();
      setNativeFullscreen(true);
    } catch {
      setFallbackFullscreen(true);
    }
  };

  const simulatedOn = Object.values(simulated).filter(Boolean).length;
  const viewMeta = {
    hub: {
      icon: Home,
      label: "Hub",
      title: "Tu Dojang, de un vistazo",
      description: "Estado, clima y controles esenciales en un solo lugar.",
    },
    zonas: {
      icon: MapIcon,
      label: "Zonas",
      title: "Espacios y dispositivos",
      description: "Explora y controla cada equipo según su ubicación.",
    },
    modos: {
      icon: Sparkles,
      label: "Modos",
      title: "Escenas inteligentes",
      description: "Prepara el Dojang para cada momento con una sola acción.",
    },
  }[view];
  const ViewIcon = viewMeta.icon;

  return (
    <main
      ref={shellRef}
      className={`dojang-shell relative min-h-screen overflow-x-hidden bg-[#07080b] text-white ${isFullscreen ? "dojang-fullscreen overflow-y-auto" : "overflow-hidden"} ${fallbackFullscreen ? "fixed inset-0 z-[999]" : ""}`}
    >
      <style jsx global>{`
        @keyframes dojang-enter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.992);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes dojang-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(18px, -14px, 0) scale(1.06);
          }
        }
        @keyframes dojang-breathe {
          0%,
          100% {
            opacity: 0.45;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes dojang-popover-enter {
          from {
            opacity: 0;
            transform: translate(-50%, -47%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        .dojang-view {
          animation: dojang-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .dojang-orb {
          animation: dojang-float 14s ease-in-out infinite;
        }
        .dojang-live-dot {
          animation: dojang-breathe 2.2s ease-in-out infinite;
        }
        .dojang-popover {
          transform: translate(-50%, -50%);
          animation: dojang-popover-enter 280ms cubic-bezier(0.22, 1, 0.36, 1)
            both;
        }
        .dojang-fullscreen .dojang-hub-ambient {
          min-height: min(58vh, 680px);
        }
        .dojang-fullscreen .dojang-hub-clock {
          font-size: clamp(5.5rem, 12vw, 13rem);
        }
        .dojang-fullscreen {
          height: 100dvh;
          min-height: 100dvh;
          overflow-y: auto !important;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
        }
        .dojang-fullscreen .dojang-display-header {
          border-radius: 1.25rem;
          padding: 0.75rem 1rem;
        }
        .dojang-fullscreen .dojang-view-description {
          display: none;
        }
        .dojang-fullscreen .dojang-display-nav {
          margin-top: 0.6rem;
        }
        .dojang-fullscreen .dojang-screen-intro {
          border-radius: 1.25rem;
          padding: 1rem 1.25rem;
        }
        .dojang-fullscreen .dojang-floor-card {
          border-radius: 1.5rem;
          padding: 1rem;
        }
        .dojang-fullscreen .dojang-floor-card-header {
          margin-bottom: 0.75rem;
        }
        .dojang-fullscreen .dojang-floor-map {
          min-height: clamp(360px, 44vh, 480px);
        }
        @media (min-width: 1500px) and (min-height: 760px) {
          .dojang-fullscreen .dojang-modes-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 0.75rem;
          }
          .dojang-fullscreen .dojang-mode-card {
            padding: 1rem;
          }
          .dojang-fullscreen .dojang-mode-card h3 {
            margin-top: 1rem;
          }
          .dojang-fullscreen .dojang-mode-card ul {
            margin-top: 0.75rem;
          }
          .dojang-fullscreen .dojang-mode-card > button {
            margin-top: 1rem;
          }
          .dojang-fullscreen .dojang-device-groups {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.75rem;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .dojang-view,
          .dojang-orb,
          .dojang-live-dot,
          .dojang-popover,
          .dojang-shell .animate-spin {
            animation: none !important;
          }
          .dojang-shell * {
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="dojang-orb absolute -left-32 top-24 h-96 w-96 rounded-full bg-red-600/[.08] blur-[110px]" />
        <div className="dojang-orb absolute -right-28 top-1/3 h-[30rem] w-[30rem] rounded-full bg-indigo-600/[.07] blur-[130px] [animation-delay:-7s]" />
      </div>

      <div
        className={`relative mx-auto grid w-full gap-4 ${isFullscreen ? "max-w-none p-2 sm:p-3" : "max-w-[1680px] p-3 sm:p-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-5 lg:p-6"}`}
      >
        <aside
          className={`sticky top-6 h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[1.75rem] border border-white/[.08] bg-[#111318]/90 p-3 shadow-2xl backdrop-blur-2xl ${isFullscreen ? "hidden" : "hidden lg:flex"}`}
        >
          <div className="flex items-center gap-3 px-2 py-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-950/40">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-white">Dojang Assistant</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.16em] text-white/35">
                Albatros OS
              </p>
            </div>
          </div>

          <div className="mx-2 mt-3 flex items-center gap-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[.05] p-3">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <Radio className="h-4 w-4" />
              <span className="dojang-live-dot absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white/85">
                Sede {site.replace("_", " ")}
              </p>
              <p className="mt-0.5 text-[10px] text-white/35">
                Interfaz disponible
              </p>
            </div>
          </div>

          <nav className="mt-6 grid gap-1.5">
            {(
              [
                ["hub", Home, "Hub", "Resumen general"],
                ["zonas", MapIcon, "Zonas", "Espacios y equipos"],
                ["modos", Sparkles, "Modos", "Escenas rápidas"],
              ] as const
            ).map(([value, Icon, label, description]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={`group flex items-center gap-3 rounded-2xl p-3 text-left transition-all duration-300 ${view === value ? "bg-white/[.09] text-white shadow-lg" : "text-white/45 hover:bg-white/[.045] hover:text-white/80"}`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all duration-300 ${view === value ? "bg-red-500 text-white shadow-lg shadow-red-950/40" : "bg-white/[.04] group-hover:bg-white/[.07]"}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-white/30">
                    {description}
                  </span>
                </span>
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${view === value ? "translate-x-0 text-white/60" : "-translate-x-1 text-white/15 group-hover:translate-x-0"}`}
                />
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/[.07] bg-black/20 p-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/35">
              <span>Equipos</span>
              <span>{ALL_EQUIPMENT.length}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-500"
                style={{
                  width: `${Math.max(4, (simulatedOn / ALL_EQUIPMENT.length) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-white/30">
              {simulatedOn} activos en la simulación · 0 vinculados físicamente
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="dojang-display-header rounded-[1.75rem] border border-white/[.1] bg-white/[.035] p-4 shadow-[0_24px_70px_rgba(0,0,0,.3)] backdrop-blur-3xl sm:p-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div className="flex items-center gap-3">
                <span
                  className={`h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/[.08] bg-white/[.045] text-red-300 ${isFullscreen ? "grid" : "grid lg:hidden"}`}
                >
                  <ViewIcon className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-white/30">
                    <span>Dojang Assistant</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-red-300">{viewMeta.label}</span>
                  </div>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {viewMeta.title}
                  </h1>
                  <p className="dojang-view-description mt-1 text-xs text-white/40 sm:text-sm">
                    {viewMeta.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[.08] bg-black/20 px-3 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  <Activity className="h-3.5 w-3.5 text-emerald-300" />
                  {simulatedOn} activos
                </span>
                <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[.08] bg-black/20 px-3 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  <Cpu className="h-3.5 w-3.5 text-indigo-300" />0 vinculados
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={load}
                  disabled={loading}
                  className="h-10 rounded-xl border-white/10 bg-white/[.04] px-3 text-white/70 transition-all hover:border-white/20 hover:bg-white/[.08] hover:text-white"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Actualizar</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void toggleFullscreen()}
                  className="h-10 rounded-xl border-white/10 bg-white/[.04] px-3 text-white/70 transition-all hover:border-white/20 hover:bg-white/[.08] hover:text-white"
                  title={
                    isFullscreen
                      ? "Salir de pantalla completa"
                      : "Abrir pantalla completa"
                  }
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">
                    {isFullscreen ? "Salir" : "Pantalla completa"}
                  </span>
                </Button>
              </div>
            </div>

            <nav
              className={`dojang-display-nav mt-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-white/[.08] bg-black/20 p-1.5 backdrop-blur-xl ${isFullscreen ? "" : "lg:hidden"}`}
            >
              {(
                [
                  ["hub", Home, "Hub"],
                  ["zonas", MapIcon, "Zonas"],
                  ["modos", Sparkles, "Modos"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-xs font-bold transition-all ${view === value ? "bg-white/[.1] text-white shadow-lg" : "text-white/40 hover:bg-white/[.05] hover:text-white/75"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </header>

          {!isFullscreen && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/10 bg-amber-400/[.045] px-4 py-3 text-xs leading-relaxed text-amber-50/60">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/75" />
              <p>
                <strong className="text-amber-100/85">
                  Modo demostración:
                </strong>{" "}
                luces, ventilación, TV y audio son simulaciones locales hasta
                conectar el hardware. La puerta conserva su módulo seguro.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-950/35 p-4 text-sm text-red-100">
              {error}
            </div>
          )}

          <div key={view} className="dojang-view mt-4">
            {view === "hub" && (
              <HubView
                clock={clock}
                userName={userName}
                site={site}
                weather={weather}
                doorUnlocked={doorUnlocked}
                simulated={simulated}
              />
            )}

            {view === "zonas" && (
              <ZonesView
                simulated={simulated}
                setSimulated={setSimulated}
                doorUnlocked={doorUnlocked}
                deviceLevels={deviceLevels}
                setDeviceLevels={setDeviceLevels}
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
        </div>
      </div>
    </main>
  );
}

function HubView({
  clock,
  userName,
  site,
  weather,
  doorUnlocked,
  simulated,
}: {
  clock: Date;
  userName: string;
  site: Sede;
  weather: Weather | null;
  doorUnlocked: boolean | null;
  simulated: Record<string, boolean>;
}) {
  const WeatherIcon = weather
    ? weatherIcon(weather.codigo, weather.esDia)
    : Cloud;
  const simulatedOn = Object.values(simulated).filter(Boolean).length;
  return (
    <section className="dojang-hub-view grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <article className="dojang-hub-ambient group relative flex min-h-[390px] flex-col justify-between overflow-hidden rounded-[2rem] border border-white/[.12] bg-[radial-gradient(circle_at_18%_100%,rgba(239,68,68,.18),transparent_43%),radial-gradient(circle_at_92%_8%,rgba(99,102,241,.12),transparent_38%)] bg-white/[.035] p-7 shadow-[0_28px_90px_rgba(0,0,0,.32)] backdrop-blur-3xl transition-all duration-500 hover:border-white/[.18] sm:p-10">
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full border border-red-400/10 bg-red-500/[.05] blur-2xl" />
          <div className="relative flex items-start justify-between gap-5">
            <div>
              <p className="text-sm font-medium text-white/45">
                {greeting(clock.getHours())},
              </p>
              <h2 className="mt-1 text-2xl font-black capitalize tracking-tight text-white sm:text-4xl">
                {userName}
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/[.08] bg-black/20 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/35 backdrop-blur-xl">
              <span className="dojang-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Dojang disponible
            </div>
          </div>

          <div className="relative py-8 sm:py-10">
            <p className="dojang-hub-clock text-[clamp(5rem,10vw,10rem)] font-black leading-[.78] tabular-nums tracking-[-.075em] text-white">
              {clock.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-lg font-medium capitalize text-white/75 sm:text-xl">
                {clock.toLocaleDateString("es-MX", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/30">
                Sede {site.replace("_", " ")}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-black/20 px-4 py-3 backdrop-blur-xl">
              <Activity className="h-4 w-4 text-emerald-300" />
              <div>
                <p className="text-xs font-bold text-white/75">
                  {simulatedOn} equipos activos
                </p>
                <p className="mt-0.5 text-[9px] text-white/30">
                  Simulación local
                </p>
              </div>
            </div>
          </div>
        </article>

        <div className="grid gap-4">
          <article className="group relative overflow-hidden rounded-[2rem] border border-sky-300/15 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,.16),transparent_48%)] bg-white/[.035] p-6 shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-3xl transition-all duration-500 hover:border-sky-300/25 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-sky-300">
                  Ahora afuera
                </p>
                <p className="mt-1 text-sm text-white/40">
                  {weather?.ubicacion || "Esperando actualización"}
                </p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-sky-300/10 bg-sky-300/[.07] text-sky-300 transition-transform duration-500 group-hover:-translate-y-1">
                <WeatherIcon className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-7 flex items-end gap-3">
              <p className="text-7xl font-black tabular-nums tracking-[-.06em] text-white">
                {weather ? Math.round(weather.temperatura) : "--"}°
              </p>
              <p className="pb-2 text-sm font-medium text-white/50">
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
          </article>

          <article className="flex items-center gap-4 rounded-[1.75rem] border border-white/[.11] bg-white/[.04] p-5 shadow-[0_18px_50px_rgba(0,0,0,.24)] backdrop-blur-2xl">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${doorUnlocked ? "border-amber-300/15 bg-amber-400/[.08] text-amber-300" : "border-emerald-300/15 bg-emerald-400/[.08] text-emerald-300"}`}
            >
              {doorUnlocked ? (
                <DoorOpen className="h-5 w-5" />
              ) : (
                <DoorClosed className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white/85">
                Puerta principal
              </p>
              <p className="mt-1 text-[10px] text-white/35">
                {doorUnlocked === null
                  ? "Estado no disponible"
                  : doorUnlocked
                    ? "Liberada"
                    : "Bloqueada y segura"}
              </p>
            </div>
            <Link
              href="/admin/puerta"
              className="rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[10px] font-bold text-white/55 transition-colors hover:bg-white/[.08] hover:text-white"
            >
              Ver
            </Link>
          </article>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={Building2} value="4" label="Zonas registradas" />
        <StatusCard
          icon={Zap}
          value={String(ALL_EQUIPMENT.length)}
          label="Equipos planificados"
        />
        <StatusCard
          icon={Activity}
          value={String(simulatedOn)}
          label="Activos ahora"
          accent={simulatedOn > 0 ? "text-emerald-300" : "text-white"}
        />
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
    </section>
  );
}

function ZonesView({
  simulated,
  setSimulated,
  doorUnlocked,
  deviceLevels,
  setDeviceLevels,
}: {
  simulated: Record<string, boolean>;
  setSimulated: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  doorUnlocked: boolean | null;
  deviceLevels: Record<string, number>;
  setDeviceLevels: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  return (
    <section className="dojang-zones-view grid gap-4">
      <FloorPlan
        simulated={simulated}
        setSimulated={setSimulated}
        deviceLevels={deviceLevels}
        setDeviceLevels={setDeviceLevels}
        doorUnlocked={doorUnlocked}
      />
      <div className="dojang-device-groups grid gap-4 lg:grid-cols-2">
        {ZONES.map((zone) => (
          <details
            key={zone.id}
            className="group overflow-hidden rounded-[1.5rem] border border-white/[.1] bg-white/[.035] shadow-[0_18px_50px_rgba(0,0,0,.22)] backdrop-blur-2xl transition-all duration-300 open:border-white/[.16] open:bg-white/[.055] hover:border-white/[.16]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 p-5 transition-colors hover:bg-white/[.025]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-red-300/10 bg-red-500/[.07] text-red-300 transition-transform duration-300 group-open:scale-105">
                <MapIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-white/90">{zone.name}</h2>
                <p className="mt-0.5 text-xs text-white/35">
                  {zone.description}
                </p>
              </div>
              <span className="rounded-full border border-white/[.07] bg-black/20 px-3 py-1 text-xs font-bold text-white/45">
                {zone.equipment.length}
              </span>
              <ChevronRight className="h-4 w-4 text-white/25 transition-transform duration-300 group-open:rotate-90" />
            </summary>
            <div className="grid gap-2 border-t border-white/[.06] p-4">
              {zone.equipment.map((item) => {
                const Icon = equipmentIcon(item.type);
                const isDoor = item.type === "door";
                const isOn = simulated[item.id] === true;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/[.06] bg-black/20 p-3 transition-all duration-300 hover:border-white/[.12] hover:bg-white/[.035]"
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${isDoor ? "border-sky-300/10 bg-sky-500/[.08] text-sky-300" : isOn ? "border-amber-300/15 bg-amber-400/10 text-amber-300" : "border-white/[.06] bg-white/[.035] text-white/35"}`}
                    >
                      {isDoor && doorUnlocked ? (
                        <DoorOpen className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white/85">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-white/30">
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
                        className="rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-[10px] font-bold uppercase text-white/70 transition-colors hover:bg-white/[.08] hover:text-white"
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
                        className={`relative h-8 w-14 rounded-full border p-1 transition-all duration-300 ${isOn ? "border-emerald-300/30 bg-emerald-500/70 shadow-[0_0_18px_rgba(16,185,129,.16)]" : "border-white/10 bg-black/30"}`}
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
    <section className="grid gap-4">
      <div className="dojang-screen-intro flex flex-col justify-between gap-4 rounded-[1.5rem] border border-white/[.1] bg-white/[.035] p-5 shadow-[0_18px_50px_rgba(0,0,0,.22)] backdrop-blur-2xl sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-red-300">
            Escenas del espacio
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
            Una acción, todo listo
          </h2>
          <p className="mt-1 text-sm text-white/40">
            Previsualiza qué equipos cambiaría cada escena antes de conectar
            hardware.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-2 text-xs font-bold text-white/45">
            {simulatedOn} equipos activos
          </span>
          <button
            type="button"
            onClick={onReset}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.025] text-white/45 transition-all hover:rotate-[-25deg] hover:bg-white/[.08] hover:text-white"
            title="Limpiar simulación"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="dojang-modes-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODES.map((mode) => {
          const active = activeMode === mode.id;
          return (
            <article
              key={mode.id}
              className={`dojang-mode-card group relative flex flex-col overflow-hidden rounded-[1.5rem] border bg-gradient-to-br p-5 shadow-[0_20px_60px_rgba(0,0,0,.3)] backdrop-blur-2xl transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_26px_75px_rgba(0,0,0,.4)] ${mode.color} ${active ? "border-emerald-400/35 ring-2 ring-emerald-400/10" : "border-white/[.11] hover:border-white/[.2]"}`}
            >
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-white/[.045] blur-3xl transition-transform duration-700 group-hover:scale-125" />
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-2xl border transition-transform duration-500 group-hover:scale-110 ${active ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-300" : "border-white/[.07] bg-white/[.04] text-white/45"}`}
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
                      : "border-white/10 text-white/40"
                  }
                >
                  {active ? "Simulando" : "Disponible"}
                </Badge>
              </div>
              <h3 className="mt-5 text-xl font-black tracking-tight text-white">
                {mode.name}
              </h3>
              <p className="mt-2 min-h-10 text-sm text-white/45">
                {mode.description}
              </p>
              <ul className="mt-4 grid flex-1 content-start gap-2">
                {mode.actions.map((action) => (
                  <li
                    key={action}
                    className="flex gap-2 text-xs leading-relaxed text-white/55"
                  >
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" />
                    {action}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onSimulate(mode)}
                className={`mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-300 ${active ? "bg-emerald-500 text-black shadow-lg shadow-emerald-950/30 hover:bg-emerald-400" : "bg-white/[.07] text-white/75 hover:bg-white/[.13] hover:text-white"}`}
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

type FloorPlanProps = {
  simulated: Record<string, boolean>;
  setSimulated: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  deviceLevels: Record<string, number>;
  setDeviceLevels: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  doorUnlocked: boolean | null;
};

function FloorPlan({
  simulated,
  setSimulated,
  deviceLevels,
  setDeviceLevels,
  doorUnlocked,
}: FloorPlanProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedEquipment = selectedId
    ? ALL_EQUIPMENT.find((item) => item.id === selectedId) || null
    : null;

  const device = (equipmentId: string, className: string) => (
    <PlanDeviceButton
      key={equipmentId}
      equipmentId={equipmentId}
      className={className}
      selected={selectedId === equipmentId}
      simulated={simulated}
      doorUnlocked={doorUnlocked}
      onSelect={setSelectedId}
    />
  );

  return (
    <article className="dojang-floor-card overflow-hidden rounded-[1.75rem] border border-white/[.1] bg-white/[.035] p-4 shadow-[0_24px_70px_rgba(0,0,0,.3)] backdrop-blur-3xl transition-colors duration-500 hover:border-white/[.16] sm:p-6">
      <div className="dojang-floor-card-header mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-red-300">
            Plano interactivo
          </p>
          <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
            Distribución de zonas
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Toca cualquier equipo para abrir sus controles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-wide text-white/55">
          <PlanLegend icon={Lightbulb} label="Luz" color="text-amber-300" />
          <PlanLegend icon={Fan} label="Ventilación" color="text-cyan-300" />
          <PlanLegend icon={Tv} label="Pantalla" color="text-indigo-300" />
          <PlanLegend icon={Speaker} label="Audio" color="text-fuchsia-300" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-[1.75rem] border border-white/10 bg-[#07080b] p-2">
        <div className="dojang-floor-map relative grid min-h-[440px] min-w-[780px] grid-cols-[38%_62%] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#0d0f14] shadow-[inset_0_0_80px_rgba(0,0,0,.65)]">
          <section className="relative overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_60%_50%,rgba(239,68,68,.1),transparent_45%),linear-gradient(145deg,#17191f,#101116)]">
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,.045) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <div className="absolute left-4 top-4 grid h-[47%] w-[39%] grid-rows-2 overflow-hidden rounded-2xl border border-red-400/25 bg-black/30 shadow-xl backdrop-blur-sm">
              <div className="relative border-b border-white/10">
                <span className="absolute bottom-3 left-3 text-[9px] font-black uppercase tracking-wider text-white/55">
                  Baño H
                </span>
                {device(
                  "bathroom-men-light-1",
                  "left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2",
                )}
              </div>
              <div className="relative">
                <span className="absolute bottom-3 left-3 text-[9px] font-black uppercase tracking-wider text-white/55">
                  Baño M
                </span>
                {device(
                  "bathroom-women-light-1",
                  "left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2",
                )}
              </div>
            </div>

            <div className="absolute inset-x-0 top-[53%] text-center">
              <Home className="mx-auto h-8 w-8 text-red-300" />
              <p className="mt-2 text-xl font-black uppercase text-white">
                Lobby
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">
                Recepción y acceso
              </p>
            </div>
            {device("lobby-fan-1", "right-[12%] top-[10%]")}
            {device("lobby-light-1", "left-[56%] top-1/2 -translate-y-1/2")}
            {device("lobby-door-1", "bottom-[7%] right-[7%]")}

            <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/35">
              Lobby · 3 equipos
            </div>
          </section>

          <section className="relative m-4 overflow-hidden rounded-[1.5rem] border border-indigo-400/35 bg-[radial-gradient(circle_at_center,rgba(99,102,241,.12),transparent_58%),linear-gradient(135deg,#11131c,#090a10)] shadow-[0_0_40px_rgba(79,70,229,.12),inset_0_0_50px_rgba(79,70,229,.06)]">
            <div
              className="pointer-events-none absolute inset-4 rounded-[1.15rem] border border-indigo-300/10 opacity-70"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(129,140,248,.08) 1px, transparent 1px), linear-gradient(90deg,rgba(129,140,248,.08) 1px, transparent 1px)",
                backgroundSize: "42px 42px",
              }}
            />

            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div className="rounded-3xl border border-white/[.06] bg-black/20 px-8 py-5 backdrop-blur-sm">
                <Building2 className="mx-auto h-9 w-9 text-indigo-300" />
                <p className="mt-2 text-2xl font-black uppercase text-white">
                  Tatami
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">
                  Entrenamiento y torneo
                </p>
              </div>
            </div>

            {device("tatami-tv-1", "left-[32%] top-[4%]")}
            {device("tatami-tv-2", "right-[32%] top-[4%]")}
            {device("tatami-speaker-1", "right-[4%] top-[5%]")}

            {device("tatami-fan-1", "left-[7%] top-[24%]")}
            {device("tatami-fan-2", "left-1/2 top-[20%] -translate-x-1/2")}
            {device("tatami-fan-3", "right-[7%] top-[24%]")}
            {device("tatami-fan-4", "bottom-[23%] left-[7%]")}
            {device("tatami-fan-5", "bottom-[19%] left-1/2 -translate-x-1/2")}
            {device("tatami-fan-6", "bottom-[23%] right-[7%]")}

            {device("tatami-light-1", "left-[6%] top-1/2 -translate-y-1/2")}
            {device("tatami-light-2", "left-[22%] top-1/2 -translate-y-1/2")}
            {device("tatami-light-3", "right-[22%] top-1/2 -translate-y-1/2")}
            {device("tatami-light-4", "right-[6%] top-1/2 -translate-y-1/2")}

            <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-indigo-300/10 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-200/45">
              Tatami · 13 equipos
            </div>
          </section>

          {selectedEquipment && (
            <DeviceControlBubble
              equipment={selectedEquipment}
              isOn={
                selectedEquipment.type === "door"
                  ? doorUnlocked === true
                  : simulated[selectedEquipment.id] === true
              }
              level={deviceLevels[selectedEquipment.id] ?? 70}
              doorUnlocked={doorUnlocked}
              onPower={(next) =>
                setSimulated((current) => ({
                  ...current,
                  [selectedEquipment.id]: next,
                }))
              }
              onLevel={(next) =>
                setDeviceLevels((current) => ({
                  ...current,
                  [selectedEquipment.id]: next,
                }))
              }
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </article>
  );
}

function PlanLegend({
  icon: Icon,
  label,
  color,
}: {
  icon: typeof Lightbulb;
  label: string;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1.5">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      {label}
    </span>
  );
}

function PlanDeviceButton({
  equipmentId,
  className,
  selected,
  simulated,
  doorUnlocked,
  onSelect,
}: {
  equipmentId: string;
  className: string;
  selected: boolean;
  simulated: Record<string, boolean>;
  doorUnlocked: boolean | null;
  onSelect: (id: string) => void;
}) {
  const equipment = ALL_EQUIPMENT.find((item) => item.id === equipmentId);
  if (!equipment) return null;

  const Icon = equipmentIcon(equipment.type);
  const isOn =
    equipment.type === "door"
      ? doorUnlocked === true
      : simulated[equipment.id] === true;
  const tone = {
    light: "text-amber-300 shadow-amber-500/20",
    fan: "text-cyan-300 shadow-cyan-500/20",
    tv: "text-indigo-300 shadow-indigo-500/20",
    speaker: "text-fuchsia-300 shadow-fuchsia-500/20",
    door: "text-emerald-300 shadow-emerald-500/20",
  }[equipment.type];

  return (
    <button
      type="button"
      title={equipment.name}
      aria-label={`Abrir controles de ${equipment.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(equipment.id)}
      className={`absolute z-10 grid h-11 w-11 place-items-center rounded-2xl border bg-[#171a20]/95 shadow-lg backdrop-blur-md transition duration-200 hover:scale-110 hover:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${className} ${tone} ${selected ? "scale-110 border-white/50 ring-2 ring-white/20" : "border-white/10"} ${isOn ? "shadow-[0_0_24px_currentColor]" : "opacity-75 hover:opacity-100"}`}
    >
      {equipment.type === "door" && doorUnlocked ? (
        <DoorOpen className="h-5 w-5" />
      ) : (
        <Icon
          className={`h-5 w-5 ${isOn && equipment.type === "fan" ? "animate-spin" : ""}`}
        />
      )}
      <span
        className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${isOn ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-white/20"}`}
      />
    </button>
  );
}

function DeviceControlBubble({
  equipment,
  isOn,
  level,
  doorUnlocked,
  onPower,
  onLevel,
  onClose,
}: {
  equipment: Equipment;
  isOn: boolean;
  level: number;
  doorUnlocked: boolean | null;
  onPower: (next: boolean) => void;
  onLevel: (next: number) => void;
  onClose: () => void;
}) {
  const Icon = equipmentIcon(equipment.type);
  const levelLabel =
    equipment.type === "light"
      ? "Intensidad"
      : equipment.type === "fan"
        ? "Velocidad"
        : "Volumen";
  const supportsLevel = equipment.type !== "door";

  return (
    <div className="dojang-popover absolute left-1/2 top-1/2 z-40 w-[min(92%,360px)] rounded-[1.75rem] border border-white/20 bg-[#151821]/75 p-5 text-left shadow-[0_30px_90px_rgba(0,0,0,.75)] backdrop-blur-3xl">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[.06] text-red-300">
          {equipment.type === "door" && doorUnlocked ? (
            <DoorOpen className="h-6 w-6" />
          ) : (
            <Icon className="h-6 w-6" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/40">
            Control del equipo
          </p>
          <h3 className="mt-1 truncate text-lg font-black text-white">
            {equipment.name}
          </h3>
          <p className="mt-0.5 text-xs text-white/45">
            {equipment.type === "door"
              ? doorUnlocked === null
                ? "Estado no disponible"
                : doorUnlocked
                  ? "Puerta liberada"
                  : "Puerta bloqueada"
              : isOn
                ? "Encendido · simulación local"
                : "Apagado · simulación local"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Cerrar controles"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {equipment.type === "door" ? (
        <div className="mt-5 grid gap-3">
          <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[.06] p-3 text-xs leading-relaxed text-amber-100/75">
            Por seguridad, la puerta se administra únicamente desde su módulo
            dedicado.
          </div>
          <Link
            href="/admin/puerta"
            className="flex h-11 items-center justify-center rounded-xl bg-red-600 text-sm font-black uppercase text-white hover:bg-red-500"
          >
            Abrir control de puerta
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5">
            <button
              type="button"
              onClick={() => onPower(false)}
              className={`h-10 rounded-xl text-xs font-black uppercase transition ${!isOn ? "bg-white text-black" : "text-white/45 hover:bg-white/[.06] hover:text-white"}`}
            >
              Apagar
            </button>
            <button
              type="button"
              onClick={() => onPower(true)}
              className={`h-10 rounded-xl text-xs font-black uppercase transition ${isOn ? "bg-emerald-500 text-black" : "text-white/45 hover:bg-white/[.06] hover:text-white"}`}
            >
              Encender
            </button>
          </div>

          {supportsLevel && (
            <div className={`mt-4 ${isOn ? "opacity-100" : "opacity-40"}`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/60">
                  {equipment.type === "light" ? (
                    <Lightbulb className="h-4 w-4" />
                  ) : equipment.type === "fan" ? (
                    <Fan className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                  {levelLabel}
                </span>
                <span className="text-sm font-black tabular-nums text-white">
                  {level}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={level}
                disabled={!isOn}
                onChange={(event) => onLevel(Number(event.target.value))}
                aria-label={`${levelLabel} de ${equipment.name}`}
                className="h-2 w-full cursor-pointer accent-red-500 disabled:cursor-not-allowed"
              />
            </div>
          )}
        </>
      )}
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
    <div className="rounded-2xl border border-white/[.09] bg-white/[.035] p-3 shadow-inner backdrop-blur-xl transition-colors duration-300 hover:bg-white/[.065]">
      <Icon className="mx-auto h-4 w-4 text-sky-300" />
      <p className="mt-2 font-black text-white/90">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/30">
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
    <article className="group rounded-2xl border border-white/[.11] bg-white/[.04] p-4 shadow-[0_18px_50px_rgba(0,0,0,.22)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[.18] hover:bg-white/[.065]">
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-red-300/10 bg-red-500/[.07] text-red-300 transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-4 w-4" />
      </span>
      <p className={`mt-4 text-2xl font-black tracking-tight ${accent}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/30">
        {label}
      </p>
    </article>
  );
}
