"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Shield, Trophy, WifiOff } from "lucide-react";
import { useParams } from "next/navigation";

type Athlete = { nombre?: string; fotoUrl?: string };
type Fight = {
  rojo: Athlete;
  azul: Athlete;
  puntosRojo: number;
  puntosAzul: number;
  round: number;
  rounds: number;
  fase: string;
  restanteMs: number;
  corriendo: boolean;
  terminado: boolean;
  controlesActivos: number;
  umbral: number;
  ganador?: string;
  ultimoEvento?: { descripcion?: string };
};
const clock = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.ceil(Math.max(0, ms) / 1000) % 60).padStart(2, "0")}`;

export default function MarcadorPage() {
  const { id } = useParams<{ id: string }>();
  const [fight, setFight] = useState<Fight | null>(null),
    [shown, setShown] = useState(0),
    [online, setOnline] = useState(true),
    [pulse, setPulse] = useState<"rojo" | "azul" | null>(null);
  const previous = useRef({ rojo: 0, azul: 0 });
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/taekwondo/${id}`, {
          cache: "no-store",
        }),
        data = await response.json();
      if (!response.ok || !data.combate) throw Error();
      const next = data.combate as Fight;
      if (next.puntosRojo !== previous.current.rojo) {
        setPulse("rojo");
        setTimeout(() => setPulse(null), 650);
      } else if (next.puntosAzul !== previous.current.azul) {
        setPulse("azul");
        setTimeout(() => setPulse(null), 650);
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
    const timer = setInterval(() => void load(), 700);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!fight?.corriendo) return;
    const timer = setInterval(
      () => setShown((value) => Math.max(0, value - 100)),
      100,
    );
    return () => clearInterval(timer);
  }, [fight?.corriendo]);
  if (!fight)
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        <Radio className="animate-pulse text-red-500" />
        Conectando marcador…
      </main>
    );
  const side = (color: "rojo" | "azul", athlete: Athlete, score: number) => {
    const red = color === "rojo",
      name = String(athlete.nombre || color).toUpperCase(),
      photo = String(athlete.fotoUrl || "");
    return (
      <section
        className={`relative grid min-w-0 place-items-center overflow-hidden p-4 text-center ${red ? "bg-gradient-to-br from-[#2b080b] via-[#120709] to-black" : "bg-gradient-to-bl from-[#071633] via-[#080d19] to-black"}`}
      >
        <div
          className={`absolute inset-0 opacity-20 ${red ? "bg-[radial-gradient(circle_at_20%_40%,#ef4444,transparent_45%)]" : "bg-[radial-gradient(circle_at_80%_40%,#3b82f6,transparent_45%)]"}`}
        />
        <div className="relative z-10">
          <div
            className={`mx-auto mb-3 h-20 w-20 overflow-hidden rounded-3xl border-2 shadow-2xl md:h-28 md:w-28 ${red ? "border-red-400/50 bg-red-500/15" : "border-blue-400/50 bg-blue-500/15"}`}
          >
            {photo ? (
              <img
                src={photo}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-2xl font-black text-white">
                {name.slice(0, 2)}
              </div>
            )}
          </div>
          <p
            className={`text-xs font-black uppercase tracking-[.3em] ${red ? "text-red-400" : "text-blue-400"}`}
          >
            {color}
          </p>
          <h1 className="mx-auto max-w-[42vw] truncate text-2xl font-black uppercase text-white md:text-5xl">
            {name}
          </h1>
          <div
            className={`score-number mt-2 text-[24vw] font-black leading-[.82] tabular-nums text-white ${pulse === color ? "score-pop" : ""}`}
          >
            {score}
          </div>
        </div>
      </section>
    );
  };
  const winner =
    fight.ganador === "empate"
      ? "Empate"
      : fight.ganador === "rojo"
        ? fight.rojo.nombre
        : fight.azul.nombre;
  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-black text-white">
      <style jsx global>{`
        @keyframes scorePop {
          0% {
            transform: scale(0.72);
            filter: brightness(2);
          }
          55% {
            transform: scale(1.16);
            text-shadow: 0 0 55px currentColor;
          }
          100% {
            transform: scale(1);
          }
        }
        .score-pop {
          animation: scorePop 0.62s cubic-bezier(0.2, 0.9, 0.2, 1);
        }
      `}</style>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 bg-black/80 px-3 py-2 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
          {online ? (
            <>
              <Radio className="h-4 w-4 text-emerald-400" />
              En vivo
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-400" />
              Reconectando
            </>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-2 text-center shadow-2xl">
          <p className="text-[9px] font-black uppercase tracking-[.25em] text-white/45">
            {fight.fase === "descanso"
              ? "Descanso"
              : `Round ${fight.round} de ${fight.rounds}`}
          </p>
          <strong
            className={`font-mono text-4xl font-black tabular-nums md:text-6xl ${shown <= 10000 ? "text-amber-400" : "text-white"}`}
          >
            {clock(shown)}
          </strong>
        </div>
        <div className="flex items-center justify-end gap-2 text-right text-xs">
          <Shield className="h-4 w-4 text-white/40" />
          <span>
            <b>
              {fight.umbral}/{fight.controlesActivos}
            </b>
            <small className="block text-white/40">consenso</small>
          </span>
        </div>
      </header>
      <div className="grid grid-cols-2">
        {side("rojo", fight.rojo, fight.puntosRojo)}
        {side("azul", fight.azul, fight.puntosAzul)}
      </div>
      <footer className="flex min-h-14 items-center justify-center border-t border-white/10 bg-black px-4 text-center text-sm font-black uppercase tracking-widest text-white/70">
        {fight.fase === "finalizado" ? (
          <span className="flex items-center gap-2 text-amber-300">
            <Trophy />
            Resultado final · {winner} · {fight.puntosRojo}-{fight.puntosAzul}
          </span>
        ) : fight.ultimoEvento?.descripcion ? (
          `Última acción · ${fight.ultimoEvento.descripcion}`
        ) : (
          "Dojang Live · Albatros"
        )}
      </footer>
    </main>
  );
}
