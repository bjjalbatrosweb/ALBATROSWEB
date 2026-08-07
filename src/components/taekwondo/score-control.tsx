"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Undo2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Athlete = { id: string; nombre: string; fotoUrl?: string };
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
  votosPendientes: { controladorId: string; clave: string; at: number }[];
  ultimoEvento?: { descripcion?: string; puntos?: number };
};
const actions = [
  ["Puño", "puno", 1],
  ["Cuerpo", "cuerpo", 2],
  ["Cabeza", "cabeza", 3],
  ["Giro cuerpo", "giro_cuerpo", 4],
  ["Giro cabeza", "giro_cabeza", 5],
] as const;
const clock = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.ceil(Math.max(0, ms) / 1000) % 60).padStart(2, "0")}`;

export function ScoreControl({
  id,
  controlToken,
  compacto = false,
}: {
  id: string;
  controlToken: string;
  compacto?: boolean;
}) {
  const [fight, setFight] = useState<Fight | null>(null);
  const [online, setOnline] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [shownMs, setShownMs] = useState(0);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/taekwondo/${id}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) {
        setFight(d.combate);
        setShownMs(d.combate.restanteMs);
        setOnline(true);
      } else setOnline(false);
    } catch {
      setOnline(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const timer = setInterval(load, 700);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!fight?.corriendo) return;
    const timer = setInterval(
      () => setShownMs((v) => Math.max(0, v - 100)),
      100,
    );
    return () => clearInterval(timer);
  }, [fight?.corriendo]);
  useEffect(() => {
    const ping = setInterval(
      () =>
        fetch(`/api/taekwondo/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlToken, accion: "heartbeat" }),
        }).catch(() => undefined),
      4000,
    );
    return () => clearInterval(ping);
  }, [controlToken, id]);
  const act = async (accion: string, extra: Record<string, unknown> = {}) => {
    try {
      if (navigator.vibrate) navigator.vibrate(35);
      const r = await fetch(`/api/taekwondo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlToken, accion, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.mensaje);
      setFight(d.combate);
      if (d.pendiente)
        setFeedback(`Voto recibido · ${d.votos}/${d.necesarios}`);
      else if (d.marcado) setFeedback(`¡Puntuación validada! +${d.puntos}`);
      else setFeedback("Actualizado");
      setTimeout(() => setFeedback(""), 1600);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Sin conexión");
    }
  };
  const pending = useMemo(
    () =>
      fight?.votosPendientes?.filter((v) => Date.now() - v.at <= 2000).length ||
      0,
    [fight],
  );
  if (!fight) return <div className="p-8 text-center">Conectando control…</div>;
  const side = (lado: "rojo" | "azul", athlete: Athlete, score: number) => {
    const nombre = String(athlete?.nombre || lado.toUpperCase());
    const fotoUrl = typeof athlete?.fotoUrl === "string" ? athlete.fotoUrl : "";
    return (
      <section
        className={`rounded-3xl border p-3 ${lado === "rojo" ? "border-red-500/50 bg-red-950/25" : "border-blue-500/50 bg-blue-950/25"}`}
      >
        <div className="mb-3 flex items-center gap-3">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 font-black">
              {nombre.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-black uppercase">{nombre}</h2>
            <p className="text-xs opacity-60">{lado.toUpperCase()}</p>
          </div>
          <strong className="text-5xl tabular-nums">{score}</strong>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(([label, tecnica, points]) => (
            <Button
              key={tecnica}
              disabled={!fight.corriendo || fight.fase !== "combate"}
              variant="secondary"
              className="h-14 whitespace-normal px-2 font-black"
              onClick={() => act("puntos", { lado, tecnica })}
            >
              {label}
              <span>+{points}</span>
            </Button>
          ))}
        </div>
        <Button
          disabled={!fight.corriendo || fight.fase !== "combate"}
          variant="outline"
          className="mt-2 w-full"
          onClick={() => act("puntos", { lado, tecnica: "gamjeom" })}
        >
          +1 por Gam-jeom del rival
        </Button>
      </section>
    );
  };
  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-center gap-2 rounded-2xl border bg-background/95 p-3 backdrop-blur">
        <span className={online ? "text-emerald-500" : "text-red-500"}>
          {online ? <Wifi /> : <WifiOff />}
        </span>
        <strong>
          {fight.fase === "descanso"
            ? "DESCANSO"
            : `ROUND ${fight.round}/${fight.rounds}`}
        </strong>
        <span className="font-mono text-3xl font-black tabular-nums">
          {clock(shownMs)}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
          Consenso {fight.umbral}/{fight.controlesActivos}
        </span>
        {pending > 0 && (
          <span className="animate-pulse rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-black">
            {pending} voto(s) pendiente(s)
          </span>
        )}
      </div>
      {feedback && (
        <div className="rounded-xl bg-primary p-3 text-center font-black text-primary-foreground">
          {feedback}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {side("rojo", fight.rojo, fight.puntosRojo)}
        {side("azul", fight.azul, fight.puntosAzul)}
      </div>
      {!compacto && (
        <div className="flex flex-wrap justify-center gap-2 rounded-2xl border p-3">
          <Button onClick={() => act(fight.corriendo ? "pausar" : "iniciar")}>
            {fight.corriendo ? <Pause /> : <Play />}
            {fight.corriendo
              ? "Pausar"
              : fight.fase === "descanso"
                ? "Iniciar descanso"
                : "Iniciar"}
          </Button>
          <Button variant="secondary" onClick={() => act("avanzar")}>
            <SkipForward />
            Avanzar fase
          </Button>
          <Button variant="outline" onClick={() => act("deshacer")}>
            <Undo2 />
            Deshacer último punto
          </Button>
          <Button variant="outline" onClick={() => act("reiniciar")}>
            <RotateCcw />
            Reiniciar
          </Button>
          <Button variant="destructive" onClick={() => act("terminar")}>
            Finalizar combate
          </Button>
        </div>
      )}
    </div>
  );
}
