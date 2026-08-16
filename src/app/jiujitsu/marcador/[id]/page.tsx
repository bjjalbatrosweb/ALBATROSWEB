"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Award,
  Clock3,
  Expand,
  Minimize2,
  Radio,
  ShieldAlert,
  Trophy,
  WifiOff,
} from "lucide-react";
import { useParams } from "next/navigation";

type Athlete = { nombre?: string; fotoUrl?: string };
type Fight = {
  rojo: Athlete;
  azul: Athlete;
  puntosRojo: number;
  puntosAzul: number;
  ventajasRojo: number;
  ventajasAzul: number;
  penalizacionesRojo: number;
  penalizacionesAzul: number;
  fase: string;
  restanteMs: number;
  corriendo: boolean;
  ganador?: string;
  resultadoTipo?: string;
  categoria?: string;
  cinturon?: string;
  modalidad?: string;
  ultimoEvento?: { descripcion?: string } | null;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
  };
};

const clock = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)}:${String(
    Math.ceil(Math.max(0, ms) / 1000) % 60,
  ).padStart(2, "0")}`;

const resultLabel = (value?: string) =>
  ({
    puntos: "Victoria por puntos",
    sumision: "Victoria por sumisión",
    decision: "Decisión arbitral",
    descalificacion: "Victoria por descalificación",
    abandono: "Victoria por abandono",
  })[String(value || "")] || "Resultado final";

export default function MarcadorJiujitsuPage() {
  const { id } = useParams<{ id: string }>();
  const [fight, setFight] = useState<Fight | null>(null);
  const [shown, setShown] = useState(0);
  const [online, setOnline] = useState(true);
  const [pulse, setPulse] = useState<"rojo" | "azul" | null>(null);
  const [wallClock, setWallClock] = useState("--:--:--");
  const [fullscreen, setFullscreen] = useState(false);
  const previous = useRef({ rojo: 0, azul: 0 });

  const load = useCallback(async () => {
    if (document.hidden) return;
    try {
      const response = await fetch(`/api/jiujitsu/${id}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.combate) throw new Error();
      const next = data.combate as Fight;
      if (next.puntosRojo !== previous.current.rojo) {
        setPulse("rojo");
        window.setTimeout(() => setPulse(null), 650);
      } else if (next.puntosAzul !== previous.current.azul) {
        setPulse("azul");
        window.setTimeout(() => setPulse(null), 650);
      }
      previous.current = { rojo: next.puntosRojo, azul: next.puntosAzul };
      setFight(next);
      setShown(next.restanteMs);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(
      () => void load(),
      fight?.corriendo ? 1500 : 4000,
    );
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fight?.corriendo, load]);

  useEffect(() => {
    if (!fight?.corriendo) return;
    const timer = window.setInterval(
      () => setShown((value) => Math.max(0, value - 100)),
      100,
    );
    return () => window.clearInterval(timer);
  }, [fight?.corriendo]);

  useEffect(() => {
    const updateClock = () =>
      setWallClock(
        new Intl.DateTimeFormat("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const requestLock = async () => {
      try {
        lock = await (navigator as WakeLockNavigator).wakeLock?.request("screen") || null;
      } catch {
        lock = null;
      }
    };
    void requestLock();
    const reacquire = () => {
      if (document.visibilityState === "visible" && !lock) void requestLock();
    };
    document.addEventListener("visibilitychange", reacquire);
    return () => {
      document.removeEventListener("visibilitychange", reacquire);
      void lock?.release();
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Algunos navegadores de Smart TV no exponen la API de pantalla completa.
    }
  };

  if (!fight) {
    return (
      <main className="grid min-h-dvh place-items-center bg-black text-white">
        <div className="text-center font-black">
          <Radio className="mx-auto mb-3 animate-pulse text-emerald-400" />
          Conectando marcador…
        </div>
      </main>
    );
  }

  const side = (lado: "rojo" | "azul") => {
    const red = lado === "rojo";
    const athlete = red ? fight.rojo : fight.azul;
    const score = red ? fight.puntosRojo : fight.puntosAzul;
    const advantages = red ? fight.ventajasRojo : fight.ventajasAzul;
    const penalties = red
      ? fight.penalizacionesRojo
      : fight.penalizacionesAzul;
    const name = String(athlete.nombre || lado).toUpperCase();
    const photo = String(athlete.fotoUrl || "");
    const winner = fight.ganador === lado;

    return (
      <section
        className={`relative grid min-w-0 place-items-center overflow-hidden border-white/10 p-[clamp(.5rem,1.4vw,1.5rem)] text-center ${
          red
            ? "border-r bg-gradient-to-br from-[#38070d] via-[#16070a] to-black"
            : "bg-gradient-to-bl from-[#06245c] via-[#071326] to-black"
        } ${winner ? "winner-side" : ""}`}
      >
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center">
          <div
            className={`relative mb-[clamp(.25rem,1vh,.75rem)] h-[clamp(4.25rem,13vh,9rem)] w-[clamp(4.25rem,13vh,9rem)] overflow-hidden rounded-[clamp(.8rem,2vw,1.75rem)] border-[3px] ${
              red
                ? "border-red-300/70 bg-red-500/20"
                : "border-blue-300/70 bg-blue-500/20"
            }`}
          >
            {photo ? (
              <Image
                src={photo}
                alt={name}
                fill
                sizes="144px"
                unoptimized
                priority
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-[clamp(1.5rem,4vw,3.5rem)] font-black text-white">
                {name.slice(0, 2)}
              </div>
            )}
          </div>
          <h1 className="mx-auto max-w-[45vw] truncate text-[clamp(1.1rem,3vw,3.4rem)] font-black uppercase leading-none text-white">
            {name}
          </h1>
          <div
            className={`my-[clamp(.15rem,.8vh,.65rem)] text-[clamp(7rem,25vw,23rem)] font-black leading-[.75] tabular-nums text-white drop-shadow-2xl ${
              pulse === lado ? "score-pop" : ""
            }`}
          >
            {score}
          </div>
          <div className="grid w-full max-w-xl grid-cols-2 gap-[clamp(.35rem,1vw,.8rem)] text-[clamp(.65rem,1.35vw,1.25rem)] font-black uppercase">
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/15 p-[clamp(.4rem,1vw,.8rem)] text-emerald-200">
              <Award className="mx-auto mb-1 h-[1.1em] w-[1.1em]" />
              Ventajas <span className="ml-1 text-[1.35em] text-white">{advantages}</span>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-400/15 p-[clamp(.4rem,1vw,.8rem)] text-amber-200">
              <ShieldAlert className="mx-auto mb-1 h-[1.1em] w-[1.1em]" />
              Penal. <span className="ml-1 text-[1.35em] text-white">{penalties}</span>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const winner =
    fight.ganador === "rojo"
      ? fight.rojo.nombre
      : fight.ganador === "azul"
        ? fight.azul.nombre
        : "Decisión pendiente";

  return (
    <main className="grid h-dvh min-h-[420px] grid-rows-[auto_1fr_auto] overflow-hidden bg-black text-white">
      <style jsx global>{`
        @keyframes scorePop {
          0% { transform: scale(0.72); filter: brightness(2.4); }
          55% { transform: scale(1.14); }
          100% { transform: scale(1); }
        }
        @keyframes winnerGlow {
          0%, 100% { box-shadow: inset 0 0 0 rgba(251, 191, 36, 0); }
          50% { box-shadow: inset 0 0 8rem rgba(251, 191, 36, .18); }
        }
        .score-pop { animation: scorePop .62s cubic-bezier(.2, .9, .2, 1); }
        .winner-side { animation: winnerGlow 1.8s ease-in-out infinite; }
      `}</style>

      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/15 bg-[#030405] px-[clamp(.6rem,2vw,2rem)] py-[clamp(.4rem,1vh,.75rem)]">
        <div className="flex min-w-0 items-center gap-2 text-[clamp(.6rem,1.1vw,.9rem)] font-black uppercase text-white">
          {online ? (
            <>
              <Radio className="h-[1.2em] w-[1.2em] shrink-0 text-emerald-400" />
              <span className="hidden sm:inline">En vivo</span>
            </>
          ) : (
            <>
              <WifiOff className="h-[1.2em] w-[1.2em] shrink-0 text-red-400" />
              <span className="text-red-200">Reconectando</span>
            </>
          )}
          <span className="hidden truncate text-white/70 lg:inline">
            {fight.modalidad} · {fight.cinturon} · {fight.categoria}
          </span>
        </div>

        <div className="rounded-[clamp(.75rem,1.5vw,1.25rem)] border border-white/15 bg-white/[0.06] px-[clamp(1rem,3vw,3.5rem)] py-1 text-center shadow-2xl">
          <p className="text-[clamp(.45rem,.75vw,.65rem)] font-black uppercase tracking-[.22em] text-white/60">
            {fight.fase === "decision" ? "Decisión" : fight.corriendo ? "Tiempo oficial" : "Tiempo detenido"}
          </p>
          <strong className="font-mono text-[clamp(2.2rem,6vw,5.5rem)] font-black leading-none tabular-nums text-white">
            {clock(shown)}
          </strong>
        </div>

        <div className="flex items-center justify-end gap-3">
          <div className="hidden text-right md:block">
            <p className="text-[.55rem] font-black uppercase tracking-[.18em] text-white/70">Hora local</p>
            <p className="flex items-center gap-1 font-mono text-[clamp(.8rem,1.5vw,1.2rem)] font-black tabular-nums text-white">
              <Clock3 className="h-4 w-4 text-emerald-300" /> {wallClock}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            aria-label={fullscreen ? "Salir de pantalla completa" : "Usar pantalla completa"}
            title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {fullscreen ? <Minimize2 /> : <Expand />}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-2">
        {side("rojo")}
        {side("azul")}
      </div>

      <footer className="flex min-h-[clamp(2.75rem,7vh,5rem)] items-center justify-center border-t border-white/15 bg-[#030405] px-4 text-center text-[clamp(.7rem,1.6vw,1.35rem)] font-black uppercase tracking-wider text-white">
        {fight.fase === "finalizado" ? (
          <span className="flex items-center gap-2 text-amber-200">
            <Trophy className="h-[1.35em] w-[1.35em] text-amber-300" />
            {winner} · {resultLabel(fight.resultadoTipo)}
          </span>
        ) : fight.fase === "decision" ? (
          <span className="text-amber-200">Empate exacto · esperando decisión arbitral</span>
        ) : fight.ultimoEvento?.descripcion ? (
          <span className="text-white/85">Última acción · {fight.ultimoEvento.descripcion}</span>
        ) : (
          <span className="text-white/65">Jiu-Jitsu Live · Reglamento IBJJF</span>
        )}
      </footer>
    </main>
  );
}
