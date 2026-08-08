"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Award, Radio, ShieldAlert, Trophy, WifiOff } from "lucide-react";
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

const clock = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)}:${String(
    Math.ceil(Math.max(0, ms) / 1000) % 60,
  ).padStart(2, "0")}`;

export default function MarcadorJiujitsuPage() {
  const { id } = useParams<{ id: string }>();
  const [fight, setFight] = useState<Fight | null>(null);
  const [shown, setShown] = useState(0);
  const [online, setOnline] = useState(true);
  const [pulse, setPulse] = useState<"rojo" | "azul" | null>(null);
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
      fight?.corriendo ? 4000 : 7000,
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

  if (!fight) {
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        <Radio className="animate-pulse text-emerald-400" />
        Conectando marcador…
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

    return (
      <section
        className={`relative grid min-w-0 place-items-center overflow-hidden p-3 text-center ${
          red
            ? "bg-gradient-to-br from-[#2b080b] via-[#120709] to-black"
            : "bg-gradient-to-bl from-[#071633] via-[#080d19] to-black"
        }`}
      >
        <div className="relative z-10 w-full">
          <div
            className={`relative mx-auto mb-2 h-16 w-16 overflow-hidden rounded-2xl border-2 md:h-24 md:w-24 ${
              red
                ? "border-red-400/50 bg-red-500/15"
                : "border-blue-400/50 bg-blue-500/15"
            }`}
          >
            {photo ? (
              <Image
                src={photo}
                alt={name}
                fill
                sizes="(min-width: 768px) 96px, 64px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-xl font-black">
                {name.slice(0, 2)}
              </div>
            )}
          </div>
          <h1 className="mx-auto max-w-[44vw] truncate text-xl font-black uppercase md:text-4xl">
            {name}
          </h1>
          <div
            className={`mt-1 text-[23vw] font-black leading-[.78] tabular-nums md:text-[21vw] ${
              pulse === lado ? "score-pop" : ""
            }`}
          >
            {score}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black uppercase md:text-base">
            <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300">
              <Award className="mx-auto h-4 w-4" />
              Ventajas {advantages}
            </div>
            <div className="rounded-xl bg-amber-400/10 p-2 text-amber-300">
              <ShieldAlert className="mx-auto h-4 w-4" />
              Penal. {penalties}
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
    <main className="grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-black text-white">
      <style jsx global>{`
        @keyframes scorePop {
          0% { transform: scale(0.72); filter: brightness(2); }
          55% { transform: scale(1.16); }
          100% { transform: scale(1); }
        }
        .score-pop { animation: scorePop 0.62s cubic-bezier(0.2, 0.9, 0.2, 1); }
      `}</style>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 bg-black/90 px-3 py-2 md:px-8">
        <div className="flex items-center gap-2 text-xs font-black uppercase">
          {online ? (
            <><Radio className="h-4 w-4 text-emerald-400" /> En vivo</>
          ) : (
            <><WifiOff className="h-4 w-4 text-red-400" /> Reconectando</>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-2 text-center">
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-white/45">
            {fight.fase === "decision" ? "Decisión" : "Tiempo"}
          </p>
          <strong className="font-mono text-4xl font-black tabular-nums md:text-6xl">
            {clock(shown)}
          </strong>
        </div>
        <div className="text-right text-[10px] font-bold uppercase text-white/50 md:text-xs">
          {fight.modalidad} · {fight.cinturon}
          <span className="block">{fight.categoria}</span>
        </div>
      </header>
      <div className="grid grid-cols-2">
        {side("rojo")}
        {side("azul")}
      </div>
      <footer className="flex min-h-14 items-center justify-center border-t border-white/10 bg-black px-4 text-center text-sm font-black uppercase tracking-wider text-white/70">
        {fight.fase === "finalizado" ? (
          <span className="flex items-center gap-2 text-amber-300">
            <Trophy /> {winner} · {fight.resultadoTipo}
          </span>
        ) : fight.fase === "decision" ? (
          "Empate exacto · esperando decisión arbitral"
        ) : fight.ultimoEvento?.descripcion ? (
          `Última acción · ${fight.ultimoEvento.descripcion}`
        ) : (
          "Jiu-Jitsu Live · Reglamento IBJJF"
        )}
      </footer>
    </main>
  );
}
