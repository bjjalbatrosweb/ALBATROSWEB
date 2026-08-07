"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  BarChart3,
  Download,
  ExternalLink,
  History,
  Monitor,
  Plus,
  Printer,
  Radio,
  Smartphone,
  Sparkles,
  Trophy,
  UserRound,
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
  }[];
  combates: any[];
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
  const [minutes, setMinutes] = useState(2);
  const [rounds, setRounds] = useState(3);
  const [rest, setRest] = useState(1);
  const [live, setLive] = useState<{ id: string; token: string } | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlName, setControlName] = useState("Juez 2");
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sede =
    typeof window === "undefined"
      ? "MMA"
      : localStorage.getItem("userSede") || "MMA";
  const bearer = useCallback(
    async () => ({
      Authorization: `Bearer ${await auth.currentUser?.getIdToken(true)}`,
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
    if (!red) setRed(a);
    else if (!blue && a.id !== red.id) setBlue(a);
    else if (red.id === a.id) setRed(null);
    else if (blue?.id === a.id) setBlue(null);
  };
  const saveToken = (id: string, token: string) => {
    localStorage.setItem(`tkd-control-${id}`, token);
  };
  const create = async () => {
    if (!red || !blue) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/taekwondo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await bearer()) },
        body: JSON.stringify({
          sede,
          rojoId: red.id,
          azulId: blue.id,
          minutos: minutes,
          rounds,
          descanso: rest,
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
  const loadControls = async (id = live?.id) => {
    if (!id) return;
    const r = await fetch(`/api/taekwondo/${id}/controles`, {
      headers: await bearer(),
    });
    const d = await r.json();
    if (r.ok) setControls(d.controles || []);
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
      `/api/taekwondo/estadisticas?sede=${encodeURIComponent(sede)}`,
      { headers: await bearer() },
    );
    const d = await r.json();
    if (r.ok) setStats(d);
    else setError(d.mensaje);
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
              t.id === "estadisticas" ? void loadStats() : setTab(t.id)
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
                      <img
                        src={a.fotoUrl}
                        alt=""
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
                    {red?.nombre || "Selecciona"}
                  </strong>
                </div>
                <div className="rounded-xl bg-blue-950/30 p-3">
                  <small>AZUL</small>
                  <strong className="block truncate">
                    {blue?.nombre || "Selecciona"}
                  </strong>
                </div>
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
              <Button
                disabled={!red || !blue || busy}
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
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link target="_blank" href={`/taekwondo/marcador/${live.id}`}>
                  <Monitor />
                  Pantalla TV
                  <ExternalLink />
                </Link>
              </Button>
              <Button
                variant="secondary"
                onClick={addControl}
                disabled={controls.filter((c) => c.activo).length >= 4}
              >
                <Smartphone />
                Añadir control
              </Button>
              <Input
                className="max-w-44"
                value={controlName}
                onChange={(e) => setControlName(e.target.value)}
                placeholder="Nombre del juez"
              />
            </div>
            <ScoreControl id={live.id} controlToken={live.token} />
            <Card>
              <CardHeader>
                <CardTitle>Controles y consenso · máximo 4</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {controls.map((c) => (
                  <div key={c.id} className="rounded-2xl border p-3">
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
                        <img
                          src={c.qr}
                          alt="QR control"
                          className="mx-auto my-2 w-40 rounded bg-white p-2"
                        />
                        <Button asChild size="sm" className="w-full">
                          <a
                            target="_blank"
                            href={`/taekwondo/control/${live.id}?control=${encodeURIComponent(c.controlToken || "")}`}
                          >
                            Abrir control
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
      {tab === "historial" && (
        <div className="grid gap-3 md:grid-cols-2">
          {fights.map((f) => (
            <Card key={f.id}>
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => resume(f)}
                >
                  Abrir mesa
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {tab === "estadisticas" && <StatsView stats={stats} />}
    </main>
  );
}

function StatsView({ stats }: { stats: Stats | null }) {
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(stats.resumen).map(([k, v]) => (
          <Card key={k}>
            <CardContent className="p-4">
              <small className="uppercase text-muted-foreground">{k}</small>
              <div className="text-4xl font-black">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ranking de atletas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.ranking.map((a, i) => (
            <div
              key={a.id}
              className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-xl border p-3"
            >
              <b>#{i + 1}</b>
              <div className="flex items-center gap-2">
                {a.fotoUrl ? (
                  <img
                    src={a.fotoUrl}
                    className="h-10 w-10 rounded-full object-cover"
                    alt=""
                  />
                ) : null}
                <div>
                  <strong>{a.nombre}</strong>
                  <p className="text-xs text-muted-foreground">
                    {a.victorias}/{a.combates} victorias ·{" "}
                    {a.porcentajeVictorias}% · {a.puntosPorCombate} pts/combate
                  </p>
                </div>
              </div>
              <b>{a.puntos} pts</b>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {stats.combates.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {c.rojo.nombre} {c.puntosRojo} — {c.puntosAzul} {c.azul.nombre}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-center md:grid-cols-4">
                <div className="rounded bg-muted p-2">
                  <b>{c.cadencia}</b>
                  <small className="block">acciones/min</small>
                </div>
                <div className="rounded bg-muted p-2">
                  <b>{c.minutoMasActivo?.minuto || "—"}</b>
                  <small className="block">más activo</small>
                </div>
                <div className="rounded bg-muted p-2">
                  <b>{c.minutoMasFlojo?.minuto || "—"}</b>
                  <small className="block">más flojo</small>
                </div>
                <div className="rounded bg-muted p-2">
                  <b>{c.jueces?.[0]?.nombre || "—"}</b>
                  <small className="block">más validaciones</small>
                </div>
              </div>
              {(["rojoStats", "azulStats"] as const).map((key) => (
                <div key={key}>
                  <strong
                    className={
                      key === "rojoStats" ? "text-red-400" : "text-blue-400"
                    }
                  >
                    {key === "rojoStats" ? c.rojo.nombre : c.azul.nombre}
                  </strong>
                  <div className="mt-1 flex gap-1">
                    {c[key].zonas.map((z: any) => (
                      <div
                        key={z.zona}
                        className="flex-1 rounded bg-muted p-2 text-center"
                      >
                        <b>{z.puntos}</b>
                        <small className="block">
                          {z.zona} · {z.porcentaje}%
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
