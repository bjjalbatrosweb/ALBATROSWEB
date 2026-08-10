"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Award,
  CircleMinus,
  Flag,
  Gavel,
  Hand,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Trophy,
  Undo2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type Athlete = {
  id?: string;
  nombre?: string;
  fotoUrl?: string;
};

type Fight = {
  rojo?: Athlete;
  azul?: Athlete;
  puntosRojo?: number;
  puntosAzul?: number;
  ventajasRojo?: number;
  ventajasAzul?: number;
  penalizacionesRojo?: number;
  penalizacionesAzul?: number;
  fase?: string;
  restanteMs?: number;
  corriendo?: boolean;
  ganador?: string;
  resultadoTipo?: string;
  categoria?: string;
  cinturon?: string;
  modalidad?: string;
  ultimoEvento?: { descripcion?: string } | null;
};

const actions = [
  { key: "derribo", label: "Derribo", points: 2 },
  { key: "barrida", label: "Barrida", points: 2 },
  { key: "rodilla_vientre", label: "Rodilla abdomen", points: 2 },
  { key: "pase_guardia", label: "Pase guardia", points: 3 },
  { key: "montada", label: "Montada", points: 4 },
  { key: "espalda", label: "Espalda", points: 4 },
] as const;

const clock = (ms: number) => {
  const safe = Math.max(0, Number(ms) || 0);
  return `${Math.floor(safe / 60000)}:${String(
    Math.ceil(safe / 1000) % 60,
  ).padStart(2, "0")}`;
};

const resultLabel = (value?: string) =>
  ({
    puntos: "Victoria por puntos",
    sumision: "Victoria por sumisión",
    decision: "Decisión arbitral",
    descalificacion: "Victoria por descalificación",
    abandono: "Victoria por abandono",
  })[String(value || "")] || "Resultado final";

export function JiujitsuScoreControl({
  id,
  controlToken,
  compacto = false,
  onFinalizado,
}: {
  id: string;
  controlToken: string;
  compacto?: boolean;
  onFinalizado?: () => void;
}) {
  const [raw, setRaw] = useState<Fight | null>(null);
  const [online, setOnline] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [shownMs, setShownMs] = useState(0);
  const [finalReportado, setFinalReportado] = useState(false);
  const [busyAction, setBusyAction] = useState("");

  const fight = useMemo(() => {
    if (!raw) return null;
    return {
      ...raw,
      rojo: raw.rojo || { nombre: "ROJO" },
      azul: raw.azul || { nombre: "AZUL" },
      puntosRojo: Number(raw.puntosRojo) || 0,
      puntosAzul: Number(raw.puntosAzul) || 0,
      ventajasRojo: Number(raw.ventajasRojo) || 0,
      ventajasAzul: Number(raw.ventajasAzul) || 0,
      penalizacionesRojo: Number(raw.penalizacionesRojo) || 0,
      penalizacionesAzul: Number(raw.penalizacionesAzul) || 0,
      fase: raw.fase || "preparacion",
      restanteMs: Number(raw.restanteMs) || 0,
    };
  }, [raw]);

  const load = useCallback(async () => {
    if (document.hidden) return;
    try {
      const response = await fetch(`/api/jiujitsu/${id}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.combate) throw new Error();
      setRaw(data.combate);
      setShownMs(Number(data.combate.restanteMs) || 0);
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
      () => setShownMs((value) => Math.max(0, value - 100)),
      100,
    );
    return () => window.clearInterval(timer);
  }, [fight?.corriendo]);

  useEffect(() => {
    const ping = () => {
      if (document.hidden) return;
      void fetch(`/api/jiujitsu/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlToken, accion: "heartbeat" }),
      }).catch(() => undefined);
    };
    void ping();
    const timer = window.setInterval(ping, 30000);
    return () => window.clearInterval(timer);
  }, [controlToken, id]);

  useEffect(() => {
    if (fight?.fase === "finalizado" && !finalReportado) {
      setFinalReportado(true);
      const timer = window.setTimeout(() => onFinalizado?.(), 3500);
      return () => window.clearTimeout(timer);
    }
  }, [fight?.fase, finalReportado, onFinalizado]);

  const act = async (accion: string, extra: Record<string, unknown> = {}) => {
    if (busyAction) return;
    setBusyAction(accion);
    try {
      navigator.vibrate?.(35);
      const response = await fetch(`/api/jiujitsu/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlToken, accion, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.mensaje || "No se pudo actualizar.");
      }
      if (data.combate) {
        setRaw(data.combate);
        setShownMs(Number(data.combate.restanteMs) || 0);
      }
      setOnline(true);
      setFeedback(
        data.deshecho
          ? "Última acción deshecha"
          : data.marcado
            ? "Marcación aplicada"
            : "Acción aplicada",
      );
      window.setTimeout(() => setFeedback(""), 1600);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Sin conexión");
      if (error instanceof TypeError) setOnline(false);
    } finally {
      setBusyAction("");
    }
  };

  if (!fight) {
    return (
      <div className="grid min-h-64 place-items-center rounded-3xl border border-white/10 bg-[#080b0d] p-8 font-black text-white">
        <Wifi className="animate-pulse text-emerald-400" />
        Conectando combate…
      </div>
    );
  }

  const canScore = fight.fase === "combate" && fight.corriendo === true;
  const competitorPanel = (lado: "rojo" | "azul") => {
    const red = lado === "rojo";
    const athlete = red ? fight.rojo : fight.azul;
    const points = red ? fight.puntosRojo : fight.puntosAzul;
    const advantages = red ? fight.ventajasRojo : fight.ventajasAzul;
    const penalties = red
      ? fight.penalizacionesRojo
      : fight.penalizacionesAzul;
    return (
      <section
        className={`rounded-[26px] border p-3 text-white shadow-2xl ${
          red
            ? "border-red-500/40 bg-gradient-to-br from-red-950/90 to-[#08090c]"
            : "border-blue-500/40 bg-gradient-to-br from-blue-950/90 to-[#08090c]"
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div
            className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border ${
              red
                ? "border-red-400/50 bg-red-500/15"
                : "border-blue-400/50 bg-blue-500/15"
            }`}
          >
            {athlete.fotoUrl ? (
              <Image
                src={athlete.fotoUrl}
                alt={`Foto de ${athlete.nombre}`}
                fill
                sizes="48px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm font-black">
                {String(athlete.nombre || lado).slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[9px] font-black uppercase tracking-[.2em] ${
                red ? "text-red-400" : "text-blue-400"
              }`}
            >
              Competidor {lado}
            </p>
            <h3 className="truncate text-lg font-black uppercase">
              {athlete.nombre}
            </h3>
          </div>
          <strong className="text-5xl font-black tabular-nums">{points}</strong>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs font-black uppercase">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2">
            Ventajas <b className="ml-1 text-lg">{advantages}</b>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-2">
            Penal. <b className="ml-1 text-lg">{penalties}</b>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              disabled={!canScore || Boolean(busyAction) || !online}
              onClick={() =>
                void act("puntos", { lado, tecnica: action.key })
              }
              className={`min-h-[68px] rounded-2xl border p-2 text-left transition active:scale-[.97] disabled:opacity-30 ${
                red
                  ? "border-red-400/20 bg-red-500/20"
                  : "border-blue-400/20 bg-blue-500/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <Hand className="h-4 w-4" />
                <b className="text-xl">+{action.points}</b>
              </div>
              <b className="mt-1 block text-xs">{action.label}</b>
            </button>
          ))}
          <button
            disabled={!canScore || Boolean(busyAction) || !online}
            onClick={() => void act("ventaja", { lado })}
            className="min-h-12 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-xs font-black disabled:opacity-30"
          >
            <Award className="mx-auto mb-1 h-4 w-4 text-emerald-400" />
            + Ventaja
          </button>
          <button
            disabled={!canScore || Boolean(busyAction) || !online}
            onClick={() => void act("penalizacion", { lado })}
            className="min-h-12 rounded-2xl border border-amber-400/25 bg-amber-400/10 text-xs font-black disabled:opacity-30"
          >
            <ShieldAlert className="mx-auto mb-1 h-4 w-4 text-amber-400" />
            + Penalización
          </button>
          <button
            disabled={fight.fase === "finalizado" || Boolean(busyAction) || !online}
            onClick={() => {
              if (window.confirm(`¿Victoria por sumisión para ${athlete.nombre}?`)) {
                void act("sumision", { lado });
              }
            }}
            className="min-h-12 rounded-2xl border border-violet-400/25 bg-violet-400/10 text-xs font-black disabled:opacity-30"
          >
            <Flag className="mx-auto mb-1 h-4 w-4 text-violet-400" />
            Sumisión
          </button>
          <button
            disabled={fight.fase === "finalizado" || Boolean(busyAction) || !online}
            onClick={() => {
              if (window.confirm(`¿Descalificar a ${athlete.nombre}?`)) {
                void act("descalificar", { lado });
              }
            }}
            className="min-h-12 rounded-2xl border border-rose-400/25 bg-rose-400/10 text-xs font-black disabled:opacity-30"
          >
            <CircleMinus className="mx-auto mb-1 h-4 w-4 text-rose-400" />
            Descalificar
          </button>
          <button
            disabled={fight.fase === "finalizado" || Boolean(busyAction) || !online}
            onClick={() => {
              if (window.confirm(`¿Confirmar que ${athlete.nombre} abandona el combate?`)) {
                void act("abandono", { lado });
              }
            }}
            className="col-span-2 min-h-12 rounded-2xl border border-orange-400/30 bg-orange-400/10 text-xs font-black text-white disabled:opacity-30"
          >
            <Flag className="mx-auto mb-1 h-4 w-4 text-orange-300" />
            Abandono de este competidor
          </button>
        </div>
      </section>
    );
  };

  const winnerName =
    fight.ganador === "rojo"
      ? fight.rojo.nombre
      : fight.ganador === "azul"
        ? fight.azul.nombre
        : "";

  return (
    <div className="space-y-3 text-white">
      <section className="rounded-[28px] border border-white/10 bg-[#080b0d] p-3 shadow-2xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-black uppercase text-red-300">
              {fight.rojo.nombre}
            </p>
            <p className="text-3xl font-black">{fight.puntosRojo}</p>
          </div>
          <div>
            <span className={online ? "text-emerald-400" : "text-red-400"}>
              {online ? <Wifi className="mx-auto h-4 w-4" /> : <WifiOff className="mx-auto h-4 w-4" />}
            </span>
            <strong className="block font-mono text-4xl font-black tabular-nums">
              {clock(shownMs)}
            </strong>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/45">
              {fight.fase === "decision" ? "Decisión requerida" : fight.fase}
            </span>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-black uppercase text-blue-300">
              {fight.azul.nombre}
            </p>
            <p className="text-3xl font-black">{fight.puntosAzul}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button
            size={compacto ? "sm" : "default"}
            disabled={
              fight.fase === "finalizado" ||
              fight.fase === "decision" ||
              Boolean(busyAction) ||
              !online
            }
            onClick={() => void act(fight.corriendo ? "pausar" : "iniciar")}
          >
            {fight.corriendo ? <Pause /> : <Play />}
            {fight.corriendo ? "Pausar" : "Iniciar"}
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-[#090a0e] text-white hover:bg-white/10 hover:text-white"
            disabled={Boolean(busyAction) || !online}
            onClick={() => void act("deshacer")}
          >
            <Undo2 /> Deshacer
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-[#090a0e] text-white hover:bg-white/10 hover:text-white"
            disabled={Boolean(busyAction) || !online}
            onClick={() => {
              if (window.confirm("¿Reiniciar marcador y cronómetro?")) {
                void act("reiniciar");
              }
            }}
          >
            <RotateCcw /> Reiniciar
          </Button>
          <Button
            variant="destructive"
            disabled={fight.fase === "finalizado" || Boolean(busyAction) || !online}
            onClick={() => {
              if (window.confirm("¿Terminar el combate y declarar el resultado actual?")) {
                void act("terminar");
              }
            }}
          >
            <Gavel /> Terminar
          </Button>
        </div>
      </section>

      {fight.fase === "decision" && (
        <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-center">
          <p className="mb-3 font-black uppercase text-amber-200">
            Empate exacto: selecciona la decisión del árbitro
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={Boolean(busyAction) || !online}
              onClick={() => {
                if (window.confirm(`¿Dar la decisión a ${fight.rojo.nombre}?`)) {
                  void act("decision", { lado: "rojo" });
                }
              }}
            >
              Decisión · {fight.rojo.nombre}
            </Button>
            <Button
              disabled={Boolean(busyAction) || !online}
              onClick={() => {
                if (window.confirm(`¿Dar la decisión a ${fight.azul.nombre}?`)) {
                  void act("decision", { lado: "azul" });
                }
              }}
            >
              Decisión · {fight.azul.nombre}
            </Button>
          </div>
        </section>
      )}

      {fight.fase === "finalizado" ? (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-6 text-center">
          <Trophy className="mx-auto mb-2 text-amber-300" />
          <p className="text-xs font-black uppercase tracking-widest text-amber-200">
            {resultLabel(fight.resultadoTipo)}
          </p>
          <h2 className="text-2xl font-black uppercase">{winnerName}</h2>
        </section>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {competitorPanel("rojo")}
          {competitorPanel("azul")}
        </div>
      )}

      <p
        aria-live="polite"
        className={`min-h-6 text-center text-xs font-bold ${
          online ? "text-emerald-300" : "text-red-300"
        }`}
      >
        {busyAction
          ? "Registrando acción…"
          : feedback ||
            fight.ultimoEvento?.descripcion ||
            (online ? "Control listo · protección contra doble toque activa" : "Sin conexión · puntuación bloqueada")}
      </p>
    </div>
  );
}
