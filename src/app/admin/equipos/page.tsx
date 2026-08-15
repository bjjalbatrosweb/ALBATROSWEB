"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Expand,
  Loader2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Shuffle,
  TimerReset,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { useFirestore } from "@/firebase";
import {
  DEFAULT_STATIONS,
  createTeamBoard,
  formatRoundTime,
  rotateTeamStations,
  teamBalanceSpread,
  teamStrengths,
  type TeamAthlete,
  type TeamBoard,
  type TeamColor,
  type TeamMode,
} from "@/lib/team-balancer";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  pesoActual?: number;
  activo?: boolean;
};

const STORAGE_PREFIX = "albatros-team-board-v1";
const MAX_ATHLETES = 60;

const teamStyles: Record<TeamColor, { border: string; panel: string; badge: string; text: string }> = {
  rojo: { border: "border-red-400/40", panel: "bg-red-500/10", badge: "bg-red-400", text: "text-red-200" },
  azul: { border: "border-sky-400/40", panel: "bg-sky-500/10", badge: "bg-sky-400", text: "text-sky-200" },
  verde: { border: "border-emerald-400/40", panel: "bg-emerald-500/10", badge: "bg-emerald-400", text: "text-emerald-200" },
  amarillo: { border: "border-amber-300/40", panel: "bg-amber-400/10", badge: "bg-amber-300", text: "text-amber-200" },
  violeta: { border: "border-violet-400/40", panel: "bg-violet-500/10", badge: "bg-violet-400", text: "text-violet-200" },
  naranja: { border: "border-orange-400/40", panel: "bg-orange-500/10", badge: "bg-orange-400", text: "text-orange-200" },
};

function isTeamBoard(value: unknown): value is TeamBoard {
  if (!value || typeof value !== "object") return false;
  const board = value as Record<string, unknown>;
  return typeof board.id === "string" && Array.isArray(board.atletas) && Array.isArray(board.equipos) && Array.isArray(board.estaciones);
}

export default function TeamBuilderPage() {
  const firestore = useFirestore();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<TeamAthlete[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("Actividad por equipos");
  const [mode, setMode] = useState<TeamMode>("equilibrado");
  const [teamCount, setTeamCount] = useState(3);
  const [roundMinutes, setRoundMinutes] = useState(3);
  const [stationText, setStationText] = useState(DEFAULT_STATIONS.slice(0, 3).join("\n"));
  const [board, setBoard] = useState<TeamBoard | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [presentation, setPresentation] = useState(false);

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    setStorageReady(false);
    const stored = localStorage.getItem(`${STORAGE_PREFIX}:${site}`);
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        setBoard(isTeamBoard(parsed) ? parsed : null);
      } catch {
        setBoard(null);
      }
    } else setBoard(null);
    setStorageReady(true);
  }, [site]);

  useEffect(() => {
    if (!storageReady) return;
    if (board) localStorage.setItem(`${STORAGE_PREFIX}:${site}`, JSON.stringify(board));
    else localStorage.removeItem(`${STORAGE_PREFIX}:${site}`);
  }, [board, site, storageReady]);

  const loadAthletes = useCallback(async () => {
    if (!firestore || !site) return;
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(query(collection(firestore, "Alumnos"), where("sede", "==", site)));
      const loaded = snapshot.docs
        .filter((record) => (record.data() as AthleteDocument).activo !== false)
        .map((record) => {
          const data = record.data() as AthleteDocument;
          return {
            id: record.id,
            nombre: String(data.nombre || "Atleta"),
            fotoUrl: String(data.fotoUrl || data.imagenUrl || ""),
            disciplina: String(data.disciplina || ""),
            grado: String(data.grado || ""),
            peso: Number(data.pesoActual) > 0 ? Number(data.pesoActual) : null,
          } satisfies TeamAthlete;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los atletas.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  const disciplines = useMemo(() => ["Todas", ...new Set(athletes.map((athlete) => athlete.disciplina || "Sin disciplina"))], [athletes]);
  const visibleAthletes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return athletes.filter((athlete) => {
      const matchesDiscipline = discipline === "Todas" || (athlete.disciplina || "Sin disciplina") === discipline;
      return matchesDiscipline && (!term || `${athlete.nombre} ${athlete.disciplina} ${athlete.grado}`.toLocaleLowerCase("es").includes(term));
    });
  }, [athletes, discipline, search]);
  const selectedAthletes = selectedIds.map((id) => athletes.find((athlete) => athlete.id === id)).filter((athlete): athlete is TeamAthlete => Boolean(athlete));

  const toggleAthlete = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= MAX_ATHLETES ? current : [...current, id]);
    setConfirming(false);
  };

  const toggleVisible = () => {
    const ids = visibleAthletes.map((athlete) => athlete.id).slice(0, MAX_ATHLETES);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !ids.includes(id)) : [...new Set([...selectedIds, ...ids])].slice(0, MAX_ATHLETES));
  };

  const generate = () => {
    try {
      const stations = stationText.split("\n");
      setBoard(createTeamBoard({ title, athletes: selectedAthletes, teamCount, mode, stations, roundMinutes }));
      setConfirming(false);
      setError("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudieron crear los equipos.");
      setConfirming(false);
    }
  };

  const reset = () => {
    setBoard(null);
    setSelectedIds([]);
    setPresentation(false);
    setConfirming(false);
  };

  const moveAthlete = (athleteId: string, targetTeamId: string) => {
    setBoard((current) => current ? { ...current, equipos: current.equipos.map((team) => ({ ...team, athleteIds: team.id === targetTeamId ? [...team.athleteIds.filter((id) => id !== athleteId), athleteId] : team.athleteIds.filter((id) => id !== athleteId) })) } : current);
  };

  const renameTeam = (teamId: string, name: string) => setBoard((current) => current ? { ...current, equipos: current.equipos.map((team) => team.id === teamId ? { ...team, nombre: name } : team) } : current);

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-[1600px] space-y-6"><header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,.18),transparent_38%),linear-gradient(135deg,#0a1a14,#090b11)] p-6 shadow-2xl sm:p-8"><div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-emerald-300"><Users className="h-4 w-4" /> Operaciones · {site}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Equipos y estaciones</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">Forma grupos equilibrados o aleatorios, organiza circuitos y muestra cada rotación en una pantalla.</p></div>{board && <div className="flex flex-wrap gap-2"><button onClick={() => setBoard((current) => current ? rotateTeamStations(current, 1) : current)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 font-bold text-white"><RefreshCw className="h-4 w-4" /> Rotar estaciones</button><button onClick={() => setPresentation(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-400 px-5 font-black text-slate-950"><Expand className="h-5 w-5" /> Pantalla TV</button></div>}</div></header>{error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-red-950/50 p-4 text-red-100"><span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> {error}</span><button onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}

      {!board ? <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_430px]"><section className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-sky-300">Paso 1</p><h2 className="mt-1 text-xl font-black text-white">Selecciona participantes</h2><p className="mt-1 text-sm text-slate-400">Puedes incluir hasta {MAX_ATHLETES} atletas.</p></div><div className="flex flex-wrap gap-2"><label className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta..." className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label><select value={discipline} onChange={(event) => setDiscipline(event.target.value)} className="min-h-11 rounded-xl border border-white/15 bg-black/50 px-3 font-bold text-white">{disciplines.map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => void loadAthletes()} className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/[.05]"><RefreshCw className="h-4 w-4" /></button></div></div><button onClick={toggleVisible} className="mt-4 min-h-10 rounded-xl border border-white/15 bg-white/[.04] px-4 text-sm font-bold text-white">Seleccionar / quitar visibles</button><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{loading ? <div className="col-span-full grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-300" /></div> : visibleAthletes.map((athlete) => { const selected = selectedIds.includes(athlete.id); return <button key={athlete.id} onClick={() => toggleAthlete(athlete.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-emerald-300/50 bg-emerald-500/15" : "border-white/10 bg-black/25 hover:bg-white/[.06]"}`}><AthletePhoto athlete={athlete} className="h-14 w-14 rounded-xl" /><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{athlete.nombre}</span><span className="block truncate text-xs text-slate-400">{athlete.grado || athlete.disciplina || "Atleta"}</span>{athlete.peso && <span className="mt-1 block text-xs font-bold text-sky-300">{athlete.peso} kg</span>}</span><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${selected ? "bg-emerald-400 text-slate-950" : "border border-white/15 text-slate-400"}`}>{selected ? <Check className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span></button>; })}</div></section>
        <aside className="space-y-6"><div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Seleccionados</p><h2 className="font-black text-white">Lista de clase</h2></div><span className="rounded-xl bg-emerald-400 px-3 py-2 font-black text-slate-950">{selectedAthletes.length}</span></div><div className="mt-4 max-h-60 space-y-2 overflow-y-auto">{selectedAthletes.length ? selectedAthletes.map((athlete, index) => <div key={athlete.id} className="flex items-center gap-3 rounded-xl bg-black/25 p-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-black">{index + 1}</span><AthletePhoto athlete={athlete} className="h-9 w-9 rounded-lg" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{athlete.nombre}</span><button onClick={() => toggleAthlete(athlete.id)}><X className="h-4 w-4 text-slate-400" /></button></div>) : <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">Aún no seleccionas participantes.</p>}</div></div><div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Paso 2</p><h2 className="mt-1 font-black text-white">Configura la actividad</h2><div className="mt-4 space-y-4"><Field label="Nombre" value={title} onChange={setTitle} placeholder="Circuito técnico" /><SelectField label="Distribución" value={mode} onChange={(value) => setMode(value as TeamMode)} options={{ equilibrado: "Equilibrar experiencia y peso", aleatorio: "Completamente aleatorio" }} /><NumberField label="Cantidad de equipos" value={teamCount} min={2} max={6} onChange={(value) => { setTeamCount(value); setStationText(DEFAULT_STATIONS.slice(0, value).join("\n")); }} /><NumberField label="Minutos por estación" value={roundMinutes} min={1} max={60} onChange={setRoundMinutes} /><TextField label="Estaciones, una por línea" value={stationText} onChange={setStationText} placeholder="Técnica\nSparring\nMovilidad" /></div>{!confirming ? <button onClick={() => setConfirming(true)} disabled={selectedAthletes.length < teamCount} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-slate-950 disabled:opacity-40"><Shuffle className="h-5 w-5" /> Crear equipos</button> : <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4"><p className="font-black text-amber-100">¿Crear {teamCount} equipos con {selectedAthletes.length} atletas?</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-white/15 bg-black/25 font-bold text-white">Cancelar</button><button onClick={generate} className="min-h-11 rounded-xl bg-emerald-400 font-black text-slate-950">Confirmar</button></div></div>}</div></aside></div> : <section className="space-y-6"><div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">{board.mode === "equilibrado" ? "Distribución equilibrada" : "Distribución aleatoria"}</p><h2 className="mt-1 text-2xl font-black text-white">{board.titulo}</h2><p className="mt-1 text-sm text-slate-400">{board.atletas.length} atletas · {board.equipos.length} equipos · diferencia de fuerza estimada {teamBalanceSpread(board)}</p></div><button onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300/20 bg-red-500/10 px-4 font-bold text-red-100"><X className="h-4 w-4" /> Nueva distribución</button></div></div><TeamGrid board={board} editable onMove={moveAthlete} onRename={renameTeam} /><div className="flex flex-wrap justify-center gap-3"><button onClick={() => setBoard((current) => current ? rotateTeamStations(current, -1) : current)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.05] px-4 font-bold text-white"><ChevronLeft className="h-4 w-4" /> Rotación anterior</button><button onClick={() => setBoard((current) => current ? rotateTeamStations(current, 1) : current)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-5 font-black text-slate-950">Siguiente rotación <ChevronRight className="h-4 w-4" /></button></div></section>}
      </div>{presentation && board && <TeamPresentation board={board} onBoard={setBoard} onClose={() => setPresentation(false)} />}</main>
  );
}

function TeamGrid({ board, editable, onMove, onRename }: { board: TeamBoard; editable: boolean; onMove?: (athleteId: string, targetTeamId: string) => void; onRename?: (teamId: string, name: string) => void }) {
  const athleteMap = new Map(board.atletas.map((athlete) => [athlete.id, athlete]));
  const strengths = teamStrengths(board);
  return <div className={`grid gap-4 ${board.equipos.length <= 2 ? "md:grid-cols-2" : board.equipos.length <= 3 ? "lg:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3"}`}>{board.equipos.map((team, teamIndex) => { const style = teamStyles[team.color]; return <article key={team.id} className={`overflow-hidden rounded-[1.75rem] border ${style.border} ${style.panel}`}><header className="border-b border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1">{editable ? <input value={team.nombre} onChange={(event) => onRename?.(team.id, event.target.value)} className="w-full bg-transparent text-xl font-black text-white outline-none" /> : <h3 className="truncate text-xl font-black text-white">{team.nombre}</h3>}<p className={`mt-1 text-sm font-black uppercase tracking-wide ${style.text}`}>{team.estacion}</p></div><span className={`grid h-11 min-w-11 place-items-center rounded-xl px-2 text-lg font-black text-slate-950 ${style.badge}`}>{team.athleteIds.length}</span></div>{editable && <p className="mt-2 text-xs text-white/70">Fuerza estimada: {strengths[teamIndex]}</p>}</header><div className="space-y-2 p-3">{team.athleteIds.map((id) => { const athlete = athleteMap.get(id); if (!athlete) return null; return <div key={id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/25 p-2"><AthletePhoto athlete={athlete} className="h-11 w-11 rounded-xl" /><span className="min-w-0 flex-1"><span className="block truncate font-bold text-white">{athlete.nombre}</span><span className="block truncate text-xs text-white/70">{athlete.grado || athlete.disciplina || "Atleta"}</span></span>{editable && <select value={team.id} onChange={(event) => onMove?.(athlete.id, event.target.value)} aria-label={`Mover a ${athlete.nombre}`} className="h-9 max-w-24 rounded-lg border border-white/10 bg-black/50 px-2 text-xs font-bold text-white">{board.equipos.map((target) => <option key={target.id} value={target.id}>{target.nombre}</option>)}</select>}</div>; })}</div></article>; })}</div>;
}

function TeamPresentation({ board, onBoard, onClose }: { board: TeamBoard; onBoard: (board: TeamBoard) => void; onClose: () => void }) {
  const [remaining, setRemaining] = useState(board.roundSeconds);
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  useEffect(() => { setRemaining(board.roundSeconds); setPlaying(false); }, [board.rotation, board.roundSeconds]);
  useEffect(() => { const update = () => setClock(new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date())); update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!playing || remaining <= 0) return; const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [playing, remaining]);
  useEffect(() => { if (remaining === 0) setPlaying(false); }, [remaining]);
  const rotate = (direction: -1 | 1) => onBoard(rotateTeamStations(board, direction));
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[radial-gradient(circle_at_top,#083344,#050609_55%)] p-4 text-white sm:p-6"><header className="sticky top-0 z-20 mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-[#0b1117]/95 p-4 shadow-2xl backdrop-blur"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">Rotación {board.rotation + 1}</p><h1 className="text-2xl font-black text-white sm:text-4xl">{board.titulo}</h1></div><div className="flex items-center gap-3"><div className="text-right"><p className={`text-4xl font-black tabular-nums sm:text-6xl ${remaining <= 10 ? "text-red-300" : "text-white"}`}>{formatRoundTime(remaining)}</p><p className="flex items-center justify-end gap-2 text-xs text-white/70"><Clock3 className="h-3.5 w-3.5" /> {clock}</p></div><button onClick={onClose} className="grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-white/[.06]"><Minimize2 className="h-5 w-5" /></button></div></header><TeamGrid board={board} editable={false} /><footer className="sticky bottom-0 z-20 mt-5 flex flex-wrap items-center justify-center gap-3 rounded-3xl border border-white/10 bg-[#0b1117]/95 p-4 backdrop-blur"><button onClick={() => rotate(-1)} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[.06]"><ChevronLeft className="h-5 w-5" /></button><button onClick={() => { setRemaining(board.roundSeconds); setPlaying(false); }} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-5 font-bold"><TimerReset className="h-5 w-5" /> Reiniciar</button><button onClick={() => setPlaying((value) => !value)} className="inline-flex min-h-14 items-center gap-2 rounded-full bg-emerald-400 px-7 text-lg font-black text-slate-950">{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}{playing ? "Pausar" : "Iniciar"}</button><button onClick={() => rotate(1)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-sky-400 px-5 font-black text-slate-950">Rotar <ChevronRight className="h-5 w-5" /></button></footer></div>;
}

function AthletePhoto({ athlete, className }: { athlete: TeamAthlete; className: string }) { return <span className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="120px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-slate-400"><UserRound className="h-1/2 w-1/2" /></span>}</span>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" /></label>; }
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={5} className="w-full resize-y rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" /></label>; }
function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-white outline-none focus:border-emerald-400" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><span className="relative block"><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-white/15 bg-black/50 px-3 pr-10 text-sm font-bold text-white outline-none focus:border-emerald-400">{Object.entries(options).map(([option, labelText]) => <option key={option} value={option}>{labelText}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" /></span></label>; }
