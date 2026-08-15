"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Copy,
  ExternalLink,
  History,
  Loader2,
  Plus,
  QrCode,
  Radio,
  ShieldCheck,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { JiujitsuScoreControl } from "@/components/jiujitsu/score-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/firebase";

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
  ventajasRojo: number;
  ventajasAzul: number;
  penalizacionesRojo: number;
  penalizacionesAzul: number;
  fase: string;
  ganador: string;
  resultadoTipo: string;
  categoria: string;
  cinturon: string;
  modalidad: string;
  creadoEn: string | null;
};

type Control = {
  id: string;
  nombre: string;
  activo: boolean;
  conectado: boolean;
  esMesa?: boolean;
  pendiente?: boolean;
  pairingToken?: string;
  qr?: string;
};
type GeneralPairing = { id: string; maxClaims: number; pairingToken: string; qr: string; url: string };

export default function JiujitsuAdminPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<"nuevo" | "vivo" | "historial">("nuevo");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [fights, setFights] = useState<Fight[]>([]);
  const [query, setQuery] = useState("");
  const [red, setRed] = useState<Athlete | null>(null);
  const [blue, setBlue] = useState<Athlete | null>(null);
  const [guestRed, setGuestRed] = useState("");
  const [guestBlue, setGuestBlue] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [category, setCategory] = useState("Adulto");
  const [belt, setBelt] = useState("Libre");
  const [modality, setModality] = useState<"gi" | "nogi">("gi");
  const [pin, setPin] = useState("");
  const [live, setLive] = useState<{ id: string; token: string } | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlName, setControlName] = useState("Árbitro 2");
  const [generalPairing, setGeneralPairing] = useState<GeneralPairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      const response = await fetch(
        `/api/jiujitsu?sede=${encodeURIComponent(sede)}`,
        { headers: await bearer(), cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje);
      setAthletes(data.alumnos || []);
      setFights(data.combates || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "No se pudo cargar.",
      );
    }
  }, [auth.currentUser, bearer, sede]);

  useEffect(() => {
    void load();
  }, [load]);

  const jiujitsuAthletes = useMemo(() => {
    const filtered = athletes.filter((athlete) =>
      /jiu|bjj|grappling/i.test(athlete.disciplina),
    );
    return filtered.length ? filtered : athletes;
  }, [athletes]);

  const visibleAthletes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    if (!normalizedQuery) return jiujitsuAthletes;

    return jiujitsuAthletes.filter((athlete) =>
      [athlete.nombre, athlete.disciplina, athlete.grado]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(normalizedQuery),
    );
  }, [jiujitsuAthletes, query]);

  const chooseAthlete = (athlete: Athlete) => {
    if (red?.id === athlete.id) {
      setRed(null);
      return;
    }
    if (blue?.id === athlete.id) {
      setBlue(null);
      return;
    }
    if (!red) {
      setRed(athlete);
      setGuestRed("");
      return;
    }
    if (!blue) {
      setBlue(athlete);
      setGuestBlue("");
    }
  };

  const saveToken = (id: string, token: string) => {
    localStorage.setItem(`bjj-control-${id}`, token);
  };

  const loadControls = useCallback(
    async (id?: string) => {
      const targetId = id || live?.id;
      if (!targetId || !auth.currentUser) return;
      const response = await fetch(`/api/jiujitsu/${targetId}/controles`, {
        headers: await bearer(),
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setControls((previous) =>
          (data.controles || []).map((control: Control) => ({
            ...control,
            pairingToken: control.activo ? undefined : previous.find((item) => item.id === control.id)?.pairingToken,
            qr: control.activo ? undefined : previous.find((item) => item.id === control.id)?.qr,
          })),
        );
      }
    },
    [auth.currentUser, bearer, live?.id],
  );

  const create = async () => {
    if ((!red && !guestRed.trim()) || (!blue && !guestBlue.trim())) {
      setError("Selecciona o escribe dos competidores.");
      return;
    }
    if (red && blue && red.id === blue.id) {
      setError("Selecciona dos competidores distintos.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/jiujitsu", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await bearer()) },
        body: JSON.stringify({
          sede,
          rojoId: red?.id || "",
          azulId: blue?.id || "",
          rojoInvitado: red ? "" : guestRed,
          azulInvitado: blue ? "" : guestBlue,
          minutos: minutes,
          categoria: category,
          cinturon: belt,
          modalidad: modality,
          pin,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje);
      saveToken(data.combateId, data.controlToken);
      setLive({ id: data.combateId, token: data.controlToken });
      setTab("vivo");
      await load();
      await loadControls(data.combateId);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resume = async (fight: Fight) => {
    let token = localStorage.getItem(`bjj-control-${fight.id}`);
    if (!token) {
      const response = await fetch(`/api/jiujitsu/${fight.id}/controles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await bearer()) },
        body: JSON.stringify({ accion: "recuperar_mesa" }),
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

  const addControl = async () => {
    if (!live) return;
    const response = await fetch(`/api/jiujitsu/${live.id}/controles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await bearer()) },
      body: JSON.stringify({ nombre: controlName }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.mensaje || "No se pudo crear el control.");
      return;
    }
    const url = `${location.origin}/jiujitsu/control/${live.id}?pair=${encodeURIComponent(data.control.pairingToken)}`;
    const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    setControls((current) => [
      ...current,
      { ...data.control, activo: false, pendiente: true, conectado: false, qr },
    ]);
    setControlName(`Árbitro ${controls.length + 2}`);
  };

  const controlUrl = (control: Control) =>
    control.pairingToken && live
      ? `${location.origin}/jiujitsu/control/${live.id}?pair=${encodeURIComponent(
          control.pairingToken,
        )}`
      : "";

  const createGeneralPairing = async () => {
    if (!live) return;
    const response = await fetch(`/api/jiujitsu/${live.id}/controles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await bearer()) },
      body: JSON.stringify({ accion: "vinculacion_general" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.mensaje || "No se pudo crear el QR general.");
      return;
    }
    const url = `${location.origin}/jiujitsu/control/${live.id}?pair=${encodeURIComponent(data.vinculacion.pairingToken)}`;
    const qr = await QRCode.toDataURL(url, { width: 420, margin: 1 });
    setGeneralPairing({ ...data.vinculacion, qr, url });
  };

  const manage = async (fight: Fight, action: "finalizar" | "eliminar") => {
    if (
      action === "eliminar" &&
      !window.confirm("Se eliminará el combate y todos sus eventos. ¿Continuar?")
    ) {
      return;
    }
    const adminPin = window.prompt("Ingresa el PIN administrativo");
    if (adminPin === null) return;
    const response = await fetch("/api/jiujitsu/administrar", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await bearer()) },
      body: JSON.stringify({ sede, accion: action, ids: [fight.id], pin: adminPin }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.mensaje || "No se pudo administrar el combate.");
      return;
    }
    await load();
  };

  const openFights = fights.filter((fight) => fight.fase !== "finalizado");
  const history = fights.filter((fight) => fight.fase === "finalizado");

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <header>
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck />
          <span className="text-xs font-black uppercase tracking-[.25em]">
            Jiu-Jitsu Live · IBJJF
          </span>
        </div>
        <h1 className="text-3xl font-black uppercase text-white">
          Centro de torneo Jiu-Jitsu
        </h1>
        <p className="text-muted-foreground">
          Puntos, ventajas, penalizaciones, sumisiones y decisión arbitral.
        </p>
      </header>

      <nav className="grid grid-cols-3 gap-2">
        {([
          ["nuevo", "Nuevo combate", Plus],
          ["vivo", "En vivo", Radio],
          ["historial", "Historial", History],
        ] as const).map(([id, label, Icon]) => (
          <Button
            key={id}
            variant="outline"
            className={`h-14 border font-black ${
              tab === id
                ? "border-red-500 bg-red-600 text-white hover:bg-red-500 hover:text-white"
                : "border-white/20 bg-[#090a0e] text-white hover:border-white/35 hover:bg-white/10 hover:text-white"
            }`}
            onClick={() => setTab(id)}
          >
            <Icon /> {label}
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
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle>1. Selecciona rojo y azul</CardTitle>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar atleta, disciplina o grado…"
                aria-label="Buscar atleta"
              />
            </CardHeader>
            <CardContent className="grid max-h-[560px] grid-cols-2 gap-3 overflow-auto md:grid-cols-3">
              {visibleAthletes.map((athlete) => {
                const side =
                  red?.id === athlete.id
                    ? "rojo"
                    : blue?.id === athlete.id
                      ? "azul"
                      : "";

                return (
                  <button
                    key={athlete.id}
                    type="button"
                    aria-pressed={Boolean(side)}
                    onClick={() => chooseAthlete(athlete)}
                    className={`rounded-2xl border p-2 text-left text-white transition hover:-translate-y-0.5 hover:border-white/40 ${
                      side === "rojo"
                        ? "border-red-500 bg-red-950/45 ring-2 ring-red-500"
                        : side === "azul"
                          ? "border-blue-500 bg-blue-950/45 ring-2 ring-blue-500"
                          : "border-white/15 bg-[#090a0e]"
                    }`}
                  >
                    {athlete.fotoUrl ? (
                      <Image
                        src={athlete.fotoUrl}
                        alt={`Foto de ${athlete.nombre}`}
                        width={400}
                        height={400}
                        unoptimized
                        className="mb-2 aspect-square w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-white/10 text-white/60">
                        <UserRound className="h-12 w-12" />
                      </div>
                    )}
                    <strong className="block truncate">{athlete.nombre}</strong>
                    <p className="truncate text-xs text-white/65">
                      {athlete.disciplina || "Jiu-Jitsu"} · {athlete.grado || "Sin grado"}
                    </p>
                    {side && (
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white ${
                          side === "rojo" ? "bg-red-600" : "bg-blue-600"
                        }`}
                      >
                        Competidor {side}
                      </span>
                    )}
                  </button>
                );
              })}
              {visibleAthletes.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                  No se encontraron atletas con esa búsqueda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Configuración IBJJF</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-red-500/30 bg-red-950/35 p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-300">
                    Rojo
                  </span>
                  <strong className="block truncate text-sm text-white">
                    {red?.nombre || guestRed || "Selecciona"}
                  </strong>
                </div>
                <div className="rounded-xl border border-blue-500/30 bg-blue-950/35 p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                    Azul
                  </span>
                  <strong className="block truncate text-sm text-white">
                    {blue?.nombre || guestBlue || "Selecciona"}
                  </strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="guest-red">Invitado rojo</Label>
                  <Input
                    id="guest-red"
                    value={guestRed}
                    onChange={(event) => {
                      setGuestRed(event.target.value);
                      if (event.target.value) setRed(null);
                    }}
                    placeholder="Nombre manual"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="guest-blue">Invitado azul</Label>
                  <Input
                    id="guest-blue"
                    value={guestBlue}
                    onChange={(event) => {
                      setGuestBlue(event.target.value);
                      if (event.target.value) setBlue(null);
                    }}
                    placeholder="Nombre manual"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="minutes">Minutos</Label>
                  <Input
                    id="minutes"
                    type="number"
                    min="1"
                    max="10"
                    value={minutes}
                    onChange={(event) => setMinutes(Number(event.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="modality">Modalidad</Label>
                  <select
                    id="modality"
                    value={modality}
                    onChange={(event) =>
                      setModality(event.target.value === "nogi" ? "nogi" : "gi")
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="gi">Gi</option>
                    <option value="nogi">No-Gi</option>
                  </select>
                </div>
              </div>
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Categoría"
              />
              <Input
                value={belt}
                onChange={(event) => setBelt(event.target.value)}
                placeholder="Cinturón"
              />
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="PIN opcional para controles"
              />
              <Button className="w-full" disabled={busy} onClick={() => void create()}>
                {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                Crear combate
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "vivo" && (
        live ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Button
                  asChild
                  variant="outline"
                  className="border-white/20 bg-[#090a0e] text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href={`/jiujitsu/marcador/${live.id}`} target="_blank">
                    <ExternalLink /> Abrir marcador público
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 bg-[#090a0e] text-white hover:bg-white/10 hover:text-white"
                  onClick={() => void createGeneralPairing()}
                >
                  <QrCode /> QR general para 4
                </Button>
              </div>
              <JiujitsuScoreControl
                id={live.id}
                controlToken={live.token}
                onFinalizado={() => void load()}
              />
            </div>
            <Card className="border-white/10 bg-[#111318] text-white">
              <CardHeader>
                <CardTitle>Controles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {generalPairing && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-center">
                    <Image src={generalPairing.qr} alt="QR general de controles" width={260} height={260} unoptimized className="mx-auto rounded-xl bg-white p-2" />
                    <p className="mt-2 font-black text-white">Un QR · hasta {generalPairing.maxClaims} controles</p>
                    <p className="text-xs text-white/60">Un uso por teléfono · vence en 10 minutos</p>
                    <Button size="sm" className="mt-2 bg-emerald-400 text-[#06110c] hover:bg-emerald-300" onClick={() => void navigator.clipboard.writeText(generalPairing.url)}><Copy /> Copiar enlace</Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={controlName}
                    onChange={(event) => setControlName(event.target.value)}
                  />
                  <Button size="icon" onClick={() => void addControl()}>
                    <Plus />
                  </Button>
                </div>
                {controls.map((control) => (
                  <div key={control.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold">{control.nombre}</p>
                        <p className="text-xs text-white/70">
                          {control.conectado ? "Conectado" : control.pendiente ? "Esperando primer escaneo" : "Sin conexión reciente"}
                        </p>
                      </div>
                      {control.pairingToken && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="border-white/20 bg-[#090a0e] text-white hover:bg-white/10 hover:text-white"
                          onClick={() =>
                            void navigator.clipboard.writeText(controlUrl(control))
                          }
                        >
                          <Copy />
                        </Button>
                      )}
                    </div>
                    {control.qr && (
                      <Image src={control.qr} alt={`QR de ${control.nombre}`} width={220} height={220} unoptimized className="mx-auto mt-3 rounded-xl bg-white p-2" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <FightList
            fights={openFights}
            empty="No hay combates abiertos."
            onOpen={(fight) => void resume(fight)}
            onDelete={(fight) => void manage(fight, "eliminar")}
          />
        )
      )}

      {tab === "historial" && (
        <FightList
          fights={history}
          empty="Todavía no hay combates finalizados."
          onDelete={(fight) => void manage(fight, "eliminar")}
        />
      )}
    </main>
  );
}

function FightList({
  fights,
  empty,
  onOpen,
  onDelete,
}: {
  fights: Fight[];
  empty: string;
  onOpen?: (fight: Fight) => void;
  onDelete: (fight: Fight) => void;
}) {
  if (!fights.length) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          <Users className="mx-auto mb-3" />
          {empty}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fights.map((fight) => {
        const winner =
          fight.ganador === "rojo"
            ? fight.rojo.nombre
            : fight.ganador === "azul"
              ? fight.azul.nombre
              : "Decisión pendiente";
        return (
          <Card key={fight.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black uppercase">
                    {fight.rojo.nombre} vs. {fight.azul.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fight.modalidad} · {fight.cinturon} · {fight.categoria}
                  </p>
                </div>
                <strong className="text-xl">
                  {fight.puntosRojo}-{fight.puntosAzul}
                </strong>
              </div>
              {fight.fase === "finalizado" && (
                <p className="flex items-center gap-2 text-sm font-bold text-amber-400">
                  <Trophy className="h-4 w-4" /> {winner} · {fight.resultadoTipo}
                </p>
              )}
              <div className="flex gap-2">
                {onOpen && (
                  <Button className="flex-1" onClick={() => onOpen(fight)}>
                    <Radio /> Abrir mesa
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="border-white/20 bg-[#090a0e] text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => onDelete(fight)}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
