"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Hand,
  Pause,
  Play,
  RotateCcw,
  ScanFace,
  Shield,
  SkipForward,
  Target,
  TriangleAlert,
  Undo2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
type Athlete = {
  id?: string;
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
};
type Fight = {
  rojo?: Athlete;
  azul?: Athlete;
  puntosRojo?: number;
  puntosAzul?: number;
  round?: number;
  rounds?: number;
  fase?: string;
  restanteMs?: number;
  corriendo?: boolean;
  controlesActivos?: number;
  umbral?: number;
  votosPendientes?: { at?: number }[];
};
const techniques = [
  { label: "Puño", key: "puno", points: 1, icon: Hand, hint: "Peto" },
  { label: "Patada", key: "cuerpo", points: 2, icon: Shield, hint: "Peto" },
  { label: "Cabeza", key: "cabeza", points: 3, icon: ScanFace, hint: "Careta" },
  {
    label: "Giro cuerpo",
    key: "giro_cuerpo",
    points: 4,
    icon: RotateCcw,
    hint: "Peto",
  },
  {
    label: "Giro cabeza",
    key: "giro_cabeza",
    points: 5,
    icon: Target,
    hint: "Careta",
  },
] as const;
const clock = (ms: number) => {
  const n = Math.max(0, Number(ms) || 0);
  return `${Math.floor(n / 60000)}:${String(Math.ceil(n / 1000) % 60).padStart(2, "0")}`;
};
export function ScoreControl({
  id,
  controlToken,
  compacto = false,
  soloReceptor = false,
}: {
  id: string;
  controlToken: string;
  compacto?: boolean;
  soloReceptor?: boolean;
}) {
  const [raw, setRaw] = useState<Fight | null>(null),
    [online, setOnline] = useState(true),
    [feedback, setFeedback] = useState(""),
    [shownMs, setShownMs] = useState(0);
  const fight = useMemo(
    () =>
      raw
        ? {
            ...raw,
            rojo: raw.rojo || { nombre: "ROJO" },
            azul: raw.azul || { nombre: "AZUL" },
            puntosRojo: Number(raw.puntosRojo) || 0,
            puntosAzul: Number(raw.puntosAzul) || 0,
            round: Number(raw.round) || 1,
            rounds: Number(raw.rounds) || 3,
            fase: raw.fase || "preparacion",
            restanteMs: Number(raw.restanteMs) || 0,
            controlesActivos: Math.max(1, Number(raw.controlesActivos) || 1),
            umbral: Math.max(1, Number(raw.umbral) || 1),
            votosPendientes: Array.isArray(raw.votosPendientes)
              ? raw.votosPendientes
              : [],
          }
        : null,
    [raw],
  );
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/taekwondo/${id}`, { cache: "no-store" }),
        d = await r.json();
      if (!r.ok || !d.combate) throw Error();
      setRaw(d.combate);
      setShownMs(Number(d.combate.restanteMs) || 0);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 1000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!fight?.corriendo) return;
    const t = window.setInterval(
      () => setShownMs((v) => Math.max(0, v - 100)),
      100,
    );
    return () => clearInterval(t);
  }, [fight?.corriendo]);
  useEffect(() => {
    const ping = () =>
      fetch(`/api/taekwondo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlToken, accion: "heartbeat" }),
      }).catch(() => undefined);
    void ping();
    const t = window.setInterval(ping, 4000);
    return () => clearInterval(t);
  }, [controlToken, id]);
  const act = async (accion: string, extra: Record<string, unknown> = {}) => {
    try {
      navigator.vibrate?.(35);
      const r = await fetch(`/api/taekwondo/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlToken, accion, ...extra }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.mensaje || "No se pudo actualizar.");
      if (d.combate) setRaw(d.combate);
      setFeedback(
        d.pendiente
          ? `Voto registrado · ${d.votos}/${d.necesarios}`
          : d.marcado
            ? `Punto validado · +${d.puntos}`
            : "Acción aplicada",
      );
      setTimeout(() => setFeedback(""), 1700);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Sin conexión");
    }
  };
  if (!fight)
    return (
      <div
        style={{ color: "#fff", background: "#0b0d12" }}
        className="grid min-h-64 place-items-center rounded-3xl border border-white/10 p-8 font-black"
      >
        <Wifi className="animate-pulse text-red-500" />
        Conectando…
      </div>
    );
  const photo = (a: Athlete, red: boolean) => {
    const name = String(a.nombre || (red ? "ROJO" : "AZUL")),
      url = String(a.fotoUrl || a.imagenUrl || "");
    return (
      <div
        className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl border sm:h-16 sm:w-16 ${red ? "border-red-400/40 bg-red-500/20" : "border-blue-400/40 bg-blue-500/20"}`}
      >
        {url ? (
          <img src={url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div
            style={{ color: "#fff" }}
            className="grid h-full w-full place-items-center text-lg font-black"
          >
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    );
  };
  const pad = (side: "rojo" | "azul", a: Athlete) => {
    const red = side === "rojo",
      name = String(a.nombre || side).toUpperCase();
    return (
      <section
        style={{ color: "#fff" }}
        className={`rounded-[26px] border p-3 shadow-2xl ${red ? "border-red-500/40 bg-gradient-to-br from-red-950/90 to-[#090a0e]" : "border-blue-500/40 bg-gradient-to-br from-blue-950/90 to-[#090a0e]"}`}
      >
        <div className="mb-3 flex items-center gap-3">
          {photo(a, red)}
          <div className="min-w-0">
            <p
              className={`text-[9px] font-black uppercase tracking-[.2em] ${red ? "text-red-400" : "text-blue-400"}`}
            >
              Puntuar a {side}
            </p>
            <h3
              style={{ color: "#fff" }}
              className="truncate text-base font-black"
            >
              {name}
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {techniques.map(({ label, key, points, icon: Icon, hint }) => (
            <button
              key={key}
              disabled={!fight.corriendo || fight.fase !== "combate"}
              onClick={() => void act("puntos", { lado: side, tecnica: key })}
              style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
              className={`min-h-[76px] rounded-2xl border p-2 text-left transition active:scale-[.97] disabled:opacity-30 ${red ? "border-red-400/20 bg-red-500/20" : "border-blue-400/20 bg-blue-500/20"}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5" />
                <b className="text-xl">+{points}</b>
              </div>
              <b className="mt-1 block text-xs">{label}</b>
              <span className="text-[9px] text-white/55">{hint}</span>
            </button>
          ))}
          <button
            disabled={!fight.corriendo || fight.fase !== "combate"}
            onClick={() =>
              void act("puntos", { lado: side, tecnica: "gamjeom" })
            }
            style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
            className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 text-xs font-black disabled:opacity-30"
          >
            <TriangleAlert className="h-4 w-4 text-amber-400" />
            +1 por Gam-jeom del rival
          </button>
        </div>
      </section>
    );
  };
  const pending = fight.votosPendientes.filter(
    (v) => Date.now() - Number(v.at || 0) <= 2000,
  ).length;
  return (
    <div
      style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
      className="space-y-3"
    >
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#090b10] shadow-2xl">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center gap-2 bg-gradient-to-r from-red-950/90 to-red-950/20 p-2 sm:p-4">
            {photo(fight.rojo, true)}
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-widest text-red-400">
                Rojo
              </p>
              <h2
                style={{ color: "#fff" }}
                className="truncate text-xs font-black uppercase sm:text-lg"
              >
                {fight.rojo.nombre}
              </h2>
              <strong
                style={{ color: "#fff" }}
                className="text-4xl font-black sm:text-6xl"
              >
                {fight.puntosRojo}
              </strong>
            </div>
          </div>
          <div className="grid min-w-[104px] place-items-center border-x border-white/10 bg-black px-2 py-3 text-center sm:min-w-[180px]">
            <div>
              <span className={online ? "text-emerald-400" : "text-red-400"}>
                {online ? (
                  <Wifi className="mx-auto h-4 w-4" />
                ) : (
                  <WifiOff className="mx-auto h-4 w-4" />
                )}
              </span>
              <p
                style={{ color: "#fff" }}
                className="mt-1 text-[8px] font-black uppercase"
              >
                {fight.fase === "descanso"
                  ? "Descanso"
                  : `R ${fight.round}/${fight.rounds}`}
              </p>
              <strong
                style={{ color: "#fff" }}
                className="block font-mono text-2xl font-black sm:text-4xl"
              >
                {clock(shownMs)}
              </strong>
              <span style={{ color: "#fff" }} className="text-[8px] font-bold">
                {fight.controlesActivos === 1
                  ? "Directo"
                  : `${fight.umbral}/${fight.controlesActivos} jueces`}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-row-reverse items-center gap-2 bg-gradient-to-l from-blue-950/90 to-blue-950/20 p-2 text-right sm:p-4">
            {photo(fight.azul, false)}
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-widest text-blue-400">
                Azul
              </p>
              <h2
                style={{ color: "#fff" }}
                className="truncate text-xs font-black uppercase sm:text-lg"
              >
                {fight.azul.nombre}
              </h2>
              <strong
                style={{ color: "#fff" }}
                className="text-4xl font-black sm:text-6xl"
              >
                {fight.puntosAzul}
              </strong>
            </div>
          </div>
        </div>
      </section>
      {pending > 0 && (
        <div
          style={{ color: "#111", WebkitTextFillColor: "#111" }}
          className="animate-pulse rounded-2xl bg-amber-400 p-3 text-center text-sm font-black"
        >
          {pending} voto pendiente
        </div>
      )}
      {!fight.corriendo && fight.fase !== "finalizado" && (
        <div
          style={{ color: "#fff" }}
          className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-center text-sm font-bold"
        >
          Mesa pausada · inicia el tiempo para puntuar.
        </div>
      )}
      {soloReceptor && (
        <div
          style={{ color: "#fff" }}
          className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-center text-sm font-black"
        >
          <Shield className="mr-2 inline h-4 w-4" />
          Modo receptor · los puntos llegan desde los controles.
        </div>
      )}
      {feedback && (
        <div
          style={{
            color: "#dc2626",
            WebkitTextFillColor: "#dc2626",
            background: "#fff",
          }}
          className="rounded-2xl p-3 text-center font-black"
        >
          <CheckCircle2 className="mr-2 inline h-5 w-5" />
          {feedback}
        </div>
      )}
      {!soloReceptor && (
        <div className="grid gap-3 md:grid-cols-2">
          {pad("rojo", fight.rojo)}
          {pad("azul", fight.azul)}
        </div>
      )}
      {!compacto && (
        <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-[#0d0f14] p-3 sm:flex sm:flex-wrap sm:justify-center">
          <Button
            style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
            className="bg-red-600 hover:bg-red-500"
            onClick={() => void act(fight.corriendo ? "pausar" : "iniciar")}
          >
            {fight.corriendo ? <Pause /> : <Play />}
            {fight.corriendo ? "Pausar" : "Iniciar"}
          </Button>
          <Button
            style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
            variant="secondary"
            onClick={() => void act("avanzar")}
          >
            <SkipForward />
            Siguiente fase
          </Button>
          <Button
            style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
            variant="outline"
            className="border-white/20 bg-transparent"
            onClick={() => void act("deshacer")}
          >
            <Undo2 />
            Deshacer
          </Button>
          <Button
            style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
            variant="outline"
            className="border-white/20 bg-transparent"
            onClick={() => void act("reiniciar")}
          >
            <RotateCcw />
            Reiniciar
          </Button>
          <Button
            style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
            variant="destructive"
            className="col-span-2"
            onClick={() => void act("terminar")}
          >
            Finalizar
          </Button>
        </div>
      )}
    </div>
  );
}
