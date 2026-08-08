"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import {
  BarChart3,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  History,
  Monitor,
  Plus,
  Printer,
  Radio,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Trophy,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/firebase";
import { ScoreControl } from "@/components/taekwondo/score-control";

type Athlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
};
type Fight = {
  id: string;
  rojo: Athlete;
  azul: Athlete;
  puntosRojo: number;
  puntosAzul: number;
  fase: string;
  creadoEn: string | null;
  ganador: string;
  eventos?: number;
  cadencia?: number;
  jueces?: Array<{ id?: string; nombre: string; validaciones?: number }>;
  minutoMasActivo?: { minuto: string; puntos: number } | null;
  rojoStats?: { zonas: Array<{ zona: string; puntos: number }> };
  azulStats?: { zonas: Array<{ zona: string; puntos: number }> };
};
type Control = {
  id: string;
  nombre: string;
  activo: boolean;
  conectado: boolean;
  controlToken?: string;
  qr?: string;
};
type Stats = {
  resumen: {
    combates: number;
    finalizados: number;
    puntos: number;
    acciones: number;
  };
  ranking: {
    id: string;
    nombre: string;
    fotoUrl: string;
    combates: number;
    victorias: number;
    puntos: number;
    recibidos: number;
    porcentajeVictorias: number;
    puntosPorCombate: number;
    tecnicaPrincipal?: string;
    tendencia?: "mejorando" | "estable" | "bajando" | "sin datos";
    tecnicaPuntos?: Record<string, number>;
    mesas?: {
      id: string;
      fecha: string | null;
      rival: string;
      puntos: number;
      recibidos: number;
      resultado: string;
    }[];
  }[];
  combates: Fight[];
};

export default function TaekwondoPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<
    "nuevo" | "vivo" | "historial" | "estadisticas"
  >("nuevo");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [fights, setFights] = useState<Fight[]>([]);
  const [query, setQuery] = useState("");
  const [red, setRed] = useState<Athlete | null>(null);
  const [blue, setBlue] = useState<Athlete | null>(null);
  const [guestRed, setGuestRed] = useState("");
  const [guestBlue, setGuestBlue] = useState("");
  const [minutes, setMinutes] = useState(2);
  const [rounds, setRounds] = useState(3);
  const [rest, setRest] = useState(1);
  const [pin, setPin] = useState("");
  const [live, setLive] = useState<{ id: string; token: string } | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlName, setControlName] = useState("Juez 2");
  const [soloReceptor, setSoloReceptor] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const sede =
    typeof window === "undefined"
      ? "MMA"
      : localStorage.getItem("userSede") || "MMA";
  const bearer = useCallback(
    async () => ({
      Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
    }),
    [auth],
  );
  const load = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const r = await fetch(`/api/taekwondo?sede=${encodeURIComponent(sede)}`, {
        headers: await bearer(),
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.mensaje);
      setAthletes(d.alumnos || []);
      setFights(d.combates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    }
  }, [auth.currentUser, bearer, sede]);
  useEffect(() => {
    void load();
  }, [load]);
  const visible = useMemo(
    () =>
      athletes.filter(
        (a) =>
          !query ||
          `${a.nombre} ${a.disciplina} ${a.grado}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [athletes, query],
  );
  const choose = (a: Athlete) => {
    if (!red) {
      setRed(a);
      setGuestRed("");
    } else if (!blue && a.id !== red.id) {
      setBlue(a);
      setGuestBlue("");
    } else if (red.id === a.id) setRed(null);
    else if (blue?.id === a.id) setBlue(null);
  };
  const saveToken = (id: string, token: string) => {
    localStorage.setItem(`tkd-control-${id}`, token);
  };
  const create = async () => {
    if ((!red && !guestRed.trim()) || (!blue && !guestBlue.trim())) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/taekwondo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await bearer()) },
        body: JSON.stringify({
          sede,
          rojoId: red?.id || "",
          azulId: blue?.id || "",
          rojoInvitado: red ? "" : guestRed,
          azulInvitado: blue ? "" : guestBlue,
          minutos: minutes,
          rounds,
          descanso: rest,
          pin,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.mensaje);
      saveToken(d.combateId, d.controlToken);
      setLive({ id: d.combateId, token: d.controlToken });
      setTab("vivo");
      await load();
      await loadControls(d.combateId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  };
  const loadControls = useCallback(async (id?: string) => {
    const targetId = id ?? live?.id;
    if (!targetId || document.hidden) return;
    const r = await fetch(`/api/taekwondo/${targetId}/controles`, {
      headers: await bearer(),
    });
    const d = await r.json();
    if (r.ok)
      setControls((previous) =>
        (d.controles || []).map((control: Control) => {
          const local = previous.find((item) => item.id === control.id);
          return {
            ...control,
            controlToken: local?.controlToken,
            qr: local?.qr,
          };
        }),
      );
  }, [bearer, live?.id]);
  const liveId = live?.id;
  useEffect(() => {
    if (!liveId || tab !== "vivo") return;
    void loadControls(liveId);
    const refresh = () => {
      if (!document.hidden) void loadControls(liveId);
    };
    const timer = window.setInterval(() => void loadControls(liveId), 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [liveId, loadControls, tab]);
  const controlUrl = (control: Control) =>
    control.controlToken && live
      ? `${location.origin}/taekwondo/control/${live.id}?control=${encodeURIComponent(control.controlToken)}`
      : "";
  const copyControl = async (control: Control) => {
    const url = controlUrl(control);
    if (url) await navigator.clipboard.writeText(url);
  };
  const shareControl = async (control: Control) => {
    const url = controlUrl(control);
    if (!url) return;
    if (navigator.share)
      await navigator.share({ title: `Control · ${control.nombre}`, url });
    else await navigator.clipboard.writeText(url);
  };
  const addControl = async () => {
    if (!live) return;
    const r = await fetch(`/api/taekwondo/${live.id}/controles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await bearer()) },
      body: JSON.stringify({ nombre: controlName }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.mensaje);
      return;
    }
    const url = `${location.origin}/taekwondo/control/${live.id}?control=${encodeURIComponent(d.control.controlToken)}`;
    const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    setControls((c) => [
      ...c,
      { ...d.control, activo: true, conectado: false, qr },
    ]);
    setControlName(`Juez ${controls.length + 2}`);
  };
  const revoke = async (controlId: string) => {
    if (!live) return;
    await fetch(`/api/taekwondo/${live.id}/controles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await bearer()) },
      body: JSON.stringify({ accion: "revocar", controlId }),
    });
    await loadControls();
  };
  const resume = async (fight: Fight) => {
    let token = localStorage.getItem(`tkd-control-${fight.id}`);
    if (!token) {
      const response = await fetch(`/api/taekwondo/${fight.id}/controles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await bearer()) },
        body: JSON.stringify({ nombre: "Mesa recuperada" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.mensaje || "No se pudo recuperar la mesa.");
        return;
      }
      token = data.control.controlToken;
      saveToken(fight.id, token!);
    }
    setLive({ id: fight.id, token: token! });
    setTab("vivo");
    await loadControls(fight.id);
  };
  const loadStats = async () => {
    setTab("estadisticas");
    const r = await fetch(
      `/api/taekwondo/estadisticas-seguras?sede=${encodeURIComponent(sede)}`,
      { headers: await bearer() },
    );
    const d = await r.json();
    if (r.ok) setStats(d);
    else setError(d.mensaje);
  };
  const showHistory = async () => {
    const r = await fetch(
      `/api/taekwondo/estadisticas-seguras?sede=${encodeURIComponent(sede)}`,
      { headers: await bearer() },
    );
    const d = await r.json();
    if (r.ok) setStats(d);
    else setError(d.mensaje);
    setLive(null);
    setTab("historial");
    await load();
  };
  const manageTables = async (
    accion: "finalizar" | "eliminar",
    ids: string[],
    todas = false,
  ) => {
    if (!todas && !ids.length) {
      setError("Selecciona al menos una mesa.");
      return;
    }
    if (
      accion === "eliminar" &&
      !window.confirm(
        "Se eliminará la mesa y todos sus eventos. Las estadísticas se recalcularán. ¿Continuar?",
      )
    )
      return;
    const adminPin = window.prompt("Ingresa el PIN administrativo");
    if (adminPin === null) return;
    const response = await fetch("/api/taekwondo/administrar", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await bearer()) },
      body: JSON.stringify({ sede, accion, ids, todas, pin: adminPin }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.mensaje || "No se pudieron administrar las mesas.");
      return;
    }
    setSelectedTables([]);
    await load();
    if (tab === "historial") await showHistory();
  };
  const tabs = [
    { id: "nuevo", label: "Nuevo combate", icon: Plus },
    { id: "vivo", label: "En vivo", icon: Radio },
    { id: "historial", label: "Historial", icon: History },
    { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
  ] as const;
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <header>
        <div className="flex items-center gap-2 text-primary">
          <Sparkles />
          <span className="text-xs font-black uppercase tracking-[.25em]">
            Dojang Live
          </span>
        </div>
        <h1 className="text-3xl font-black uppercase text-white">
          Centro de torneo Taekwondo
        </h1>
        <p className="text-muted-foreground">
          Combates, consenso arbitral, transmisión y análisis técnico.
        </p>
      </header>
      <nav className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant="outline"
            className="h-14 border-white/20 font-black"
            style={{
              backgroundColor: tab === t.id ? "#ffffff" : "#090a0e",
              color: tab === t.id ? "#dc2626" : "#ffffff",
              borderColor: tab === t.id ? "#ffffff" : "rgba(255,255,255,.18)",
            }}
            onClick={() =>
              t.id === "estadisticas"
                ? void loadStats()
                : t.id === "historial"
                  ? void showHistory()
                  : setTab(t.id)
            }
          >
            <t.icon style={{ color: "inherit" }} />
            <span style={{ color: "inherit" }}>{t.label}</span>
          </Button>
        ))}
      </nav>
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-red-200">
          {error}
          <button className="float-right" onClick={() => setError("")}>
            <X />
          </button>
        </div>
      )}
      {tab === "nuevo" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>1. Selecciona rojo y azul</CardTitle>
              <Input
                placeholder="Buscar atleta, disciplina o grado…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </CardHeader>
            <CardContent className="grid max-h-[560px] grid-cols-2 gap-3 overflow-auto md:grid-cols-3">
              {visible.map((a) => {
                const side =
                  red?.id === a.id ? "rojo" : blue?.id === a.id ? "azul" : "";
                return (
                  <button
                    key={a.id}
                    onClick={() => choose(a)}
                    className={`rounded-2xl border p-3 text-left transition ${side === "rojo" ? "border-red-500 bg-red-950/30" : side === "azul" ? "border-blue-500 bg-blue-950/30" : "hover:border-primary"}`}
                  >
                    {a.fotoUrl ? (
                      <Image
                        src={a.fotoUrl}
                        alt=""
                        width={400}
                        height={400}
                        unoptimized
                        className="mb-2 aspect-square w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="mb-2 grid aspect-square place-items-center rounded-xl bg-muted">
                        <UserRound className="h-10 w-10 opacity-30" />
                      </div>
                    )}
                    <strong className="line-clamp-2">{a.nombre}</strong>
                    <p className="text-xs text-muted-foreground">
                      {a.disciplina || "Sin disciplina"} ·{" "}
                      {a.grado || "Sin grado"}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>2. Configura el combate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-red-950/30 p-3">
                  <small>ROJO</small>
                  <strong className="block truncate">
                    {red?.nombre || guestRed || "Selecciona"}
                  </strong>
                </div>
                <div className="rounded-xl bg-blue-950/30 p-3">
                  <small>AZUL</small>
                  <strong className="block truncate">
                    {blue?.nombre || guestBlue || "Selecciona"}
                  </strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-red-400">
                  Invitado rojo
                  <Input
                    value={guestRed}
                    onChange={(e) => {
                      setGuestRed(e.target.value);
                      if (e.target.value) setRed(null);
                    }}
                    placeholder="Nombre"
                    className="mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-blue-400">
                  Invitado azul
                  <Input
                    value={guestBlue}
                    onChange={(e) => {
                      setGuestBlue(e.target.value);
                      if (e.target.value) setBlue(null);
                    }}
                    placeholder="Nombre"
                    className="mt-1"
                  />
                </label>
              </div>
              <label className="block text-sm font-bold">
                Minutos por round
                <Input
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm font-bold">
                Número de rounds
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm font-bold">
                Descanso entre rounds (minutos)
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.5"
                  value={rest}
                  onChange={(e) => setRest(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm font-bold">
                PIN para unirse (opcional)
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="4 a 6 números"
                />
                <small className="font-normal text-muted-foreground">
                  Vacío permite acceso abierto desde la web.
                </small>
              </label>
              <Button
                disabled={
                  (!red && !guestRed.trim()) ||
                  (!blue && !guestBlue.trim()) ||
                  busy
                }
                className="h-14 w-full text-base font-black"
                onClick={create}
              >
                <Trophy />
                {busy ? "Preparando…" : "Iniciar mesa de combate"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {tab === "vivo" &&
        (live ? (
          <div className="space-y-5">
            <Card className="overflow-hidden border-white/10 bg-[#101116] text-white shadow-2xl">
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.22em] text-red-400">
                    Emparejamiento rápido
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    Conecta la TV y los jueces
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    1. Abre la pantalla · 2. Nombra al juez · 3. Comparte el QR.
                    Máximo 4 controles.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    asChild
                    style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
                    className="h-12 bg-red-600 hover:bg-red-500"
                  >
                    <Link
                      target="_blank"
                      href={`/taekwondo/marcador/${live.id}`}
                    >
                      <Monitor /> Abrir pantalla TV <ExternalLink />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
                    className="h-12 border-white/15 bg-white/[0.04]"
                  >
                    <Link target="_blank" href="/taekwondo/unirse">
                      <Users /> Ver mesas para unirse
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    style={{
                      color: soloReceptor ? "#34d399" : "#fff",
                      WebkitTextFillColor: soloReceptor ? "#34d399" : "#fff",
                      backgroundColor: soloReceptor
                        ? "rgba(16,185,129,.12)"
                        : "rgba(255,255,255,.04)",
                    }}
                    className="h-12 border-white/15"
                    onClick={() => setSoloReceptor((value) => !value)}
                  >
                    <Shield />
                    {soloReceptor
                      ? "Mesa solo receptora"
                      : "Mesa también puntúa"}
                  </Button>
                </div>
              </CardContent>
              <CardContent className="grid gap-2 border-t border-white/10 p-4 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/55">
                    Nombre o posición del juez
                  </span>
                  <Input
                    className="h-12 border-white/15 bg-black/40 text-white placeholder:text-white/35"
                    value={controlName}
                    onChange={(e) => setControlName(e.target.value)}
                    placeholder="Ej. Juez esquina 1"
                  />
                </label>
                <Button
                  className="h-12 self-end bg-white font-black text-red-600 hover:bg-white/90 hover:text-red-700"
                  onClick={addControl}
                  disabled={controls.filter((c) => c.activo).length >= 4}
                >
                  <Smartphone /> Generar QR de control
                </Button>
              </CardContent>
            </Card>
            <ScoreControl
              id={live.id}
              controlToken={live.token}
              soloReceptor={soloReceptor}
              onFinalizado={() => void showHistory()}
            />
            <Card className="border-white/10 bg-[#101116] text-white">
              <CardHeader>
                <CardTitle className="text-white">
                  Controles conectados
                </CardTitle>
                <p className="text-sm text-white/55">
                  Solo cuentan para el consenso los dispositivos realmente
                  conectados.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {controls.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-white/10 bg-black/35 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <strong>{c.nombre}</strong>
                      <span
                        className={
                          c.conectado
                            ? "text-emerald-500"
                            : "text-muted-foreground"
                        }
                      >
                        {c.conectado ? "● En línea" : "○ Sin conexión"}
                      </span>
                    </div>
                    {c.qr && (
                      <>
                        <Image
                          src={c.qr}
                          alt="QR control"
                          width={160}
                          height={160}
                          unoptimized
                          className="mx-auto my-2 w-40 rounded bg-white p-2"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            style={{ color: "#111" }}
                            className="bg-white hover:bg-white/90"
                            onClick={() => void copyControl(c)}
                          >
                            <Copy /> Copiar
                          </Button>
                          <Button
                            size="sm"
                            style={{ color: "#fff" }}
                            className="bg-red-600 hover:bg-red-500"
                            onClick={() => void shareControl(c)}
                          >
                            <Share2 /> Compartir
                          </Button>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                        >
                          <a target="_blank" href={controlUrl(c)}>
                            <CheckCircle2 /> Probar control
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 w-full text-destructive"
                      onClick={() => revoke(c.id)}
                    >
                      Revocar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              Crea un combate o ábrelo desde Historial.
            </CardContent>
          </Card>
        ))}
      {tab === "vivo" && (
        <Card className="border-white/10 bg-[#101116] text-white">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-white">Mesas abiertas</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  style={{ color: "#fff" }}
                  className="border-white/15 bg-white/[0.04]"
                  onClick={() => void manageTables("finalizar", selectedTables)}
                >
                  Finalizar seleccionadas
                </Button>
                <Button
                  size="sm"
                  style={{ color: "#fff" }}
                  className="bg-red-600 hover:bg-red-500"
                  onClick={() => void manageTables("finalizar", [], true)}
                >
                  Finalizar todas
                </Button>
              </div>
            </div>
            <p className="text-sm text-white/55">
              Todas las mesas no finalizadas permanecen disponibles para
              recuperarlas o para que los jueces se unan desde la web.
            </p>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {fights
              .filter((fight) => fight.fase !== "finalizado")
              .map((fight) => (
                <div
                  key={fight.id}
                  className={`flex items-center gap-2 rounded-2xl border bg-black/30 p-2 ${
                    selectedTables.includes(fight.id)
                      ? "border-red-500/60"
                      : "border-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.includes(fight.id)}
                    onChange={(event) =>
                      setSelectedTables((current) =>
                        event.target.checked
                          ? [...current, fight.id]
                          : current.filter((id) => id !== fight.id),
                      )
                    }
                    className="h-5 w-5 accent-red-600"
                  />
                  <button
                    type="button"
                    onClick={() => void resume(fight)}
                    style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
                    className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 p-1 text-left"
                  >
                    <span className="truncate font-black text-red-400">
                      {fight.rojo.nombre}
                    </span>
                    <span className="text-xs font-black text-white/45">
                      {fight.puntosRojo}–{fight.puntosAzul}
                    </span>
                    <span className="truncate text-right font-black text-blue-400">
                      {fight.azul.nombre}
                    </span>
                  </button>
                </div>
              ))}
            {!fights.some((fight) => fight.fase !== "finalizado") && (
              <p className="text-sm text-white/45">No hay mesas abiertas.</p>
            )}
          </CardContent>
        </Card>
      )}
      {tab === "historial" && (
        <div className="grid gap-3 md:grid-cols-2">
          {(stats?.combates || fights)
            .filter((f) => f.fase === "finalizado")
            .map((f) => (
              <Card
                id={`mesa-${f.id}`}
                key={f.id}
                className="overflow-hidden border-white/10 bg-white/[0.045] shadow-xl backdrop-blur-xl transition hover:border-white/20"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">
                      {f.fase}
                    </span>
                    <small>
                      {f.creadoEn
                        ? new Date(f.creadoEn).toLocaleString("es-MX")
                        : ""}
                    </small>
                  </div>
                  <div className="my-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    <div>
                      <strong className="block truncate text-red-400">
                        {f.rojo.nombre}
                      </strong>
                      <b className="text-4xl">{f.puntosRojo}</b>
                    </div>
                    <span>VS</span>
                    <div>
                      <strong className="block truncate text-blue-400">
                        {f.azul.nombre}
                      </strong>
                      <b className="text-4xl">{f.puntosAzul}</b>
                    </div>
                  </div>
                  <details className="group rounded-2xl border border-white/10 bg-black/20">
                    <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-xs font-black uppercase tracking-wider">
                      <span>Ver análisis completo</span>
                      <span className="text-muted-foreground transition group-open:rotate-180">
                        ▾
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-white/10 p-3">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-muted p-2">
                          <b className="block">{f.eventos ?? "—"}</b>acciones
                        </div>
                        <div className="rounded-xl bg-muted p-2">
                          <b className="block">{f.cadencia ?? "—"}</b>
                          acciones/min
                        </div>
                        <div className="rounded-xl bg-muted p-2">
                          <b className="block">
                            {f.jueces?.[0]?.nombre || "—"}
                          </b>
                          juez destacado
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Jueces:{" "}
                        {f.jueces?.map((j) => j.nombre).join(", ") ||
                          "Sin datos arbitrales"}
                      </p>
                      <div className="mt-3 rounded-xl border p-3 text-sm">
                        <b>Ganador: </b>
                        {f.ganador === "empate"
                          ? "Empate"
                          : f.ganador === "rojo"
                            ? f.rojo.nombre
                            : f.azul.nombre}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Minuto más activo: {f.minutoMasActivo?.minuto || "—"}{" "}
                          · Zona principal rojo:{" "}
                          {f.rojoStats?.zonas?.sort(
                            (a, b) => b.puntos - a.puntos,
                          )[0]?.zona || "—"}{" "}
                          · azul:{" "}
                          {f.azulStats?.zonas?.sort(
                            (a, b) => b.puntos - a.puntos,
                          )[0]?.zona || "—"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-red-500 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => void manageTables("eliminar", [f.id])}
                      >
                        <Trash2 /> Eliminar combate
                      </Button>
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
      {tab === "estadisticas" && (
        <StatsView
          stats={stats}
          onHistory={(id) => {
            setTab("historial");
            window.setTimeout(
              () =>
                document
                  .getElementById(`mesa-${id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" }),
              50,
            );
          }}
        />
      )}
    </main>
  );
}

function StatsView({
  stats,
  onHistory,
}: {
  stats: Stats | null;
  onHistory: (id: string) => void;
}) {
  if (!stats)
    return <div className="p-8 text-center">Calculando estadísticas…</div>;
  const csv = () => {
    const rows = [
      [
        "Fecha",
        "Rojo",
        "Puntos rojo",
        "Azul",
        "Puntos azul",
        "Ganador",
        "Cadencia",
        "Minuto activo",
      ],
      ...stats.combates.map((c) => [
        c.creadoEn || "",
        c.rojo.nombre,
        c.puntosRojo,
        c.azul.nombre,
        c.puntosAzul,
        c.ganador,
        c.cadencia,
        c.minutoMasActivo?.minuto || "",
      ]),
    ];
    const blob = new Blob(
      [
        rows
          .map((r) =>
            r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
          )
          .join("\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estadisticas-dojang-live.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={csv}>
          <Download />
          Exportar CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer />
          Imprimir / PDF
        </Button>
      </div>
      <Card className="border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Rendimiento de atletas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Toca un atleta para desplegar su evolución, técnicas y mesas.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.ranking.map((a, i) => (
            <details
              key={a.id}
              className="group rounded-2xl border border-white/10 bg-black/20 p-3 transition open:border-primary/30 open:bg-primary/[0.04]"
            >
              <summary className="grid cursor-pointer list-none grid-cols-[32px_1fr_auto] items-center gap-3">
                <b>#{i + 1}</b>
                <div className="flex items-center gap-2">
                  {a.fotoUrl ? (
                    <Image
                      src={a.fotoUrl}
                      className="h-10 w-10 rounded-full object-cover"
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                    />
                  ) : null}
                  <div>
                    <strong>{a.nombre}</strong>
                    <p className="text-xs text-muted-foreground">
                      {a.victorias}/{a.combates} victorias ·{" "}
                      {a.porcentajeVictorias}% · {a.puntosPorCombate}{" "}
                      pts/combate
                    </p>
                    <p className="text-xs font-bold">
                      Tendencia:{" "}
                      <span
                        className={
                          a.tendencia === "mejorando"
                            ? "text-emerald-500"
                            : a.tendencia === "bajando"
                              ? "text-red-500"
                              : "text-amber-500"
                        }
                      >
                        {a.tendencia || "sin datos"}
                      </span>{" "}
                      · Técnica principal: {a.tecnicaPrincipal || "—"}
                    </p>
                  </div>
                </div>
                <b>{a.puntos} pts</b>
              </summary>
              <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">
                    Puntos por técnica
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(a.tecnicaPuntos || {}).map(
                      ([tecnica, puntos]) => (
                        <span
                          key={tecnica}
                          className="rounded-full bg-muted px-2 py-1 text-xs"
                        >
                          {tecnica}: {puntos}
                        </span>
                      ),
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">
                    Mesas disputadas
                  </p>
                  <div className="mt-2 grid gap-1">
                    {a.mesas?.map((mesa) => (
                      <button
                        key={mesa.id}
                        type="button"
                        onClick={() => onHistory(mesa.id)}
                        className="flex items-center justify-between rounded-lg bg-muted px-2 py-1.5 text-left text-xs hover:bg-primary/10"
                      >
                        <span>vs {mesa.rival}</span>
                        <span>
                          {mesa.resultado} · {mesa.puntos}-{mesa.recibidos}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
