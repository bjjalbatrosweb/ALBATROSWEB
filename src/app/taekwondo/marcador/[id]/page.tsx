"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
type Athlete = { nombre: string; fotoUrl?: string };
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
  ultimoEvento?: { descripcion?: string; puntos?: number };
};
const clock = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.ceil(Math.max(0, ms) / 1000) % 60).padStart(2, "0")}`;
export default function MarcadorPage() {
  const { id } = useParams<{ id: string }>();
  const [fight, setFight] = useState<Fight | null>(null);
  const [shown, setShown] = useState(0);
  const [online, setOnline] = useState(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/taekwondo/${id}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) {
        setFight(d.combate);
        setShown(d.combate.restanteMs);
        setOnline(true);
      } else setOnline(false);
    } catch {
      setOnline(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const t = setInterval(load, 600);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!fight?.corriendo) return;
    const t = setInterval(() => setShown((v) => Math.max(0, v - 100)), 100);
    return () => clearInterval(t);
  }, [fight?.corriendo]);
  if (!fight)
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        Conectando marcador…
      </main>
    );
  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div>
          <span
            className={`mr-2 ${online ? "text-emerald-400" : "text-red-400"}`}
          >
            ●
          </span>
          <b>{online ? "EN VIVO" : "RECONECTANDO"}</b>
        </div>
        <div className="text-center">
          <p className="font-black uppercase tracking-[.25em]">
            {fight.fase === "descanso"
              ? "Descanso"
              : `Round ${fight.round}/${fight.rounds}`}
          </p>
          <strong
            className={`font-mono text-6xl tabular-nums ${shown <= 10000 ? "text-amber-400" : ""}`}
          >
            {clock(shown)}
          </strong>
        </div>
        <div className="text-right text-xs">
          <b>
            {fight.umbral}/{fight.controlesActivos}
          </b>
          <p>consenso</p>
        </div>
      </header>
      <div className="grid grid-cols-2">
        <Side color="red" athlete={fight.rojo} score={fight.puntosRojo} />
        <Side color="blue" athlete={fight.azul} score={fight.puntosAzul} />
      </div>
      <footer className="flex h-12 items-center justify-center bg-white/5 text-sm font-bold uppercase tracking-widest">
        {fight.terminado
          ? "Combate finalizado"
          : fight.ultimoEvento?.descripcion
            ? `Última acción · ${fight.ultimoEvento.descripcion}`
            : "Dojang Live · Albatros"}
      </footer>
    </main>
  );
}
function Side({
  color,
  athlete,
  score,
}: {
  color: "red" | "blue";
  athlete: Athlete;
  score: number;
}) {
  const nombre = String(athlete?.nombre || color.toUpperCase());
  const fotoUrl = typeof athlete?.fotoUrl === "string" ? athlete.fotoUrl : "";
  return (
    <section
      className={`grid place-items-center p-5 text-center ${color === "red" ? "bg-gradient-to-br from-red-600 to-red-950" : "bg-gradient-to-br from-blue-600 to-blue-950"}`}
    >
      <div>
        {fotoUrl && (
          <img
            src={fotoUrl}
            alt=""
            className="mx-auto mb-2 h-24 w-24 rounded-full border-4 border-white/50 object-cover"
          />
        )}
        <h1 className="max-w-[44vw] truncate text-4xl font-black uppercase md:text-6xl">
          {nombre}
        </h1>
        <div className="text-[25vw] font-black leading-none tabular-nums">
          {score}
        </div>
      </div>
    </section>
  );
}
