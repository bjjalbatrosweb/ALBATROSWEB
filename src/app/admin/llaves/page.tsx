"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleCheckBig,
  Clock3,
  Copy,
  Crown,
  Expand,
  Loader2,
  Medal,
  Minimize2,
  Network,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  UserRound,
  X,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { useFirestore } from "@/firebase";
import {
  bracketPodium,
  bracketProgress,
  createTournamentBracket,
  selectBracketWinner,
  shuffleAthletes,
  type BracketAthlete,
  type BracketMatch,
  type TournamentBracket,
} from "@/lib/tournament-bracket";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  activo?: boolean;
};

const STORAGE_PREFIX = "albatros-tournament-bracket-v1";

function isTournamentBracket(value: unknown): value is TournamentBracket {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && Array.isArray(record.competidores) && Array.isArray(record.rounds);
}

export default function TournamentBracketsPage() {
  const firestore = useFirestore();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<BracketAthlete[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventName, setEventName] = useState("Torneo interno");
  const [category, setCategory] = useState("");
  const [mat, setMat] = useState("Tatami 1");
  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wallClock, setWallClock] = useState("--:--:--");

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}:${site}`);
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (isTournamentBracket(parsed)) setBracket(parsed);
      } catch {
        localStorage.removeItem(`${STORAGE_PREFIX}:${site}`);
      }
    }
    setStorageReady(true);
  }, [site]);

  useEffect(() => {
    if (!storageReady) return;
    if (bracket) localStorage.setItem(`${STORAGE_PREFIX}:${site}`, JSON.stringify(bracket));
    else localStorage.removeItem(`${STORAGE_PREFIX}:${site}`);
  }, [bracket, site, storageReady]);

  useEffect(() => {
    const update = () => setWallClock(new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

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
          } satisfies BracketAthlete;
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
      const disciplineMatches = discipline === "Todas" || (athlete.disciplina || "Sin disciplina") === discipline;
      return disciplineMatches && (!term || `${athlete.nombre} ${athlete.disciplina} ${athlete.grado}`.toLocaleLowerCase("es").includes(term));
    });
  }, [athletes, discipline, search]);
  const selectedAthletes = selectedIds.map((id) => athletes.find((athlete) => athlete.id === id)).filter((athlete): athlete is BracketAthlete => Boolean(athlete));
  const progress = bracket ? bracketProgress(bracket) : 0;

  const toggleAthlete = (athleteId: string) => {
    setSelectedIds((current) => {
      if (current.includes(athleteId)) return current.filter((id) => id !== athleteId);
      if (current.length >= 16) return current;
      return [...current, athleteId];
    });
    setConfirmingCreate(false);
  };

  const shuffleSelected = () => {
    setSelectedIds(shuffleAthletes(selectedAthletes).map((athlete) => athlete.id));
    setConfirmingCreate(false);
  };

  const generateBracket = () => {
    try {
      setBracket(createTournamentBracket({ name: eventName, category, mat, athletes: selectedAthletes }));
      setConfirmingCreate(false);
      setError("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear la llave.");
    }
  };

  const chooseWinner = (roundIndex: number, matchIndex: number, athleteId: string) => {
    setBracket((current) => current ? selectBracketWinner(current, roundIndex, matchIndex, athleteId) : current);
  };

  const resetTournament = () => {
    setBracket(null);
    setSelectedIds([]);
    setConfirmingCreate(false);
    setPresentation(false);
  };

  const copyResults = async () => {
    if (!bracket) return;
    const podium = bracketPodium(bracket);
    const athleteName = (id: string | null) => bracket.competidores.find((athlete) => athlete.id === id)?.nombre || "Pendiente";
    const text = [
      `${bracket.nombre}${bracket.categoria ? ` · ${bracket.categoria}` : ""}`,
      `Oro: ${athleteName(podium.championId)}`,
      `Plata: ${athleteName(podium.runnerUpId)}`,
      ...podium.bronzeIds.map((id) => `Bronce: ${athleteName(id)}`),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (presentation && bracket) {
    return <BracketPresentation bracket={bracket} wallClock={wallClock} onClose={() => setPresentation(false)} />;
  }

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.2),transparent_36%),linear-gradient(135deg,#15101f,#090b11)] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div><p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-violet-300"><Network className="h-4 w-4" /> Torneos · {site}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Llaves y podio</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">Crea cruces de eliminación con fotos, avanza ganadores y proyecta el torneo en una pantalla.</p></div>
            <div className="flex flex-wrap gap-2">{bracket && <><button onClick={copyResults} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 font-bold text-white hover:bg-white/10">{copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar podio"}</button><button onClick={() => setPresentation(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-400 px-4 font-black text-slate-950 hover:bg-violet-300"><Expand className="h-4 w-4" /> Pantalla TV</button></>}</div>
          </div>
        </header>

        {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-950/50 p-4 text-red-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><span>{error}</span></div>}

        {!bracket ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-sky-300">Paso 1</p><h2 className="mt-1 text-2xl font-black text-white">Selecciona competidores</h2><p className="mt-1 text-sm text-slate-400">Entre 2 y 16 atletas. El orden define la siembra inicial.</p></div><div className="flex flex-wrap gap-2"><label className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta..." className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label><select value={discipline} onChange={(event) => setDiscipline(event.target.value)} className="min-h-11 rounded-xl border border-white/15 bg-black/60 px-3 font-bold text-white outline-none focus:border-sky-400">{disciplines.map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => void loadAthletes()} aria-label="Actualizar atletas" className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/[.05] text-white"><RefreshCw className="h-4 w-4" /></button></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{loading ? <div className="col-span-full grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-violet-300" /></div> : visibleAthletes.map((athlete) => { const chosen = selectedIds.includes(athlete.id); return <button key={athlete.id} onClick={() => toggleAthlete(athlete.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${chosen ? "border-violet-300/60 bg-violet-500/20" : "border-white/10 bg-black/25 hover:bg-white/[.06]"}`}><AthletePhoto athlete={athlete} className="h-14 w-14 rounded-xl" /><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{athlete.nombre}</span><span className="block truncate text-xs text-slate-400">{athlete.disciplina || "Sin disciplina"}{athlete.grado ? ` · ${athlete.grado}` : ""}</span></span><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${chosen ? "bg-violet-300 text-slate-950" : "border border-white/15 text-slate-400"}`}>{chosen ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span></button>; })}</div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Siembra</p><h3 className="mt-1 font-black text-white">Orden de competidores</h3></div><span className="rounded-xl bg-white/10 px-3 py-2 font-black text-white">{selectedAthletes.length}/16</span></div><div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{selectedAthletes.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">Selecciona atletas para formar la llave.</p> : selectedAthletes.map((athlete, index) => <div key={athlete.id} className="flex items-center gap-3 rounded-xl bg-black/25 p-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-black text-white">{index + 1}</span><AthletePhoto athlete={athlete} className="h-9 w-9 rounded-lg" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{athlete.nombre}</span><button onClick={() => toggleAthlete(athlete.id)} aria-label={`Quitar a ${athlete.nombre}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-500/15 hover:text-red-200"><X className="h-4 w-4" /></button></div>)}</div><button onClick={shuffleSelected} disabled={selectedAthletes.length < 2} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.05] font-bold text-white disabled:opacity-40"><Shuffle className="h-4 w-4" /> Mezclar cruces</button></div>
            <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Paso 2</p><h3 className="mt-1 font-black text-white">Datos del torneo</h3><div className="mt-4 space-y-4"><Field label="Nombre" value={eventName} onChange={setEventName} placeholder="Torneo interno" /><Field label="Categoría" value={category} onChange={setCategory} placeholder="Adultos · -76 kg" /><Field label="Área" value={mat} onChange={setMat} placeholder="Tatami 1" /></div>{!confirmingCreate ? <button onClick={() => setConfirmingCreate(true)} disabled={selectedAthletes.length < 2} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-400 font-black text-slate-950 hover:bg-violet-300 disabled:opacity-40"><Network className="h-5 w-5" /> Crear llave</button> : <div className="mt-5 rounded-2xl border border-violet-300/30 bg-violet-500/10 p-4"><p className="font-black text-violet-100">¿Crear la llave con {selectedAthletes.length} competidores?</p><p className="mt-1 text-xs text-violet-100/70">Los espacios libres avanzarán automáticamente.</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setConfirmingCreate(false)} className="min-h-11 rounded-xl border border-white/15 bg-black/25 font-bold text-white">Cancelar</button><button onClick={generateBracket} className="min-h-11 rounded-xl bg-violet-400 font-black text-slate-950">Confirmar</button></div></div>}</div>
          </aside>
        </div> : <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">{bracket.tatami || "Área sin asignar"}</p><h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">{bracket.nombre}</h2><p className="mt-1 text-sm text-slate-400">{bracket.categoria || "Categoría abierta"} · {bracket.competidores.length} competidores</p></div><div className="flex flex-wrap items-center gap-3"><div className="min-w-48"><div className="mb-1 flex justify-between text-xs font-bold text-slate-400"><span>Progreso</span><span>{progress}%</span></div><div className="h-3 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-400" style={{ width: `${progress}%` }} /></div></div><button onClick={resetTournament} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300/20 bg-red-500/10 px-4 font-bold text-red-100"><X className="h-4 w-4" /> Nueva llave</button></div></div></div>
          <BracketBoard bracket={bracket} interactive onWinner={chooseWinner} />
          <Podium bracket={bracket} />
        </section>}
      </div>
    </main>
  );
}

function BracketBoard({ bracket, interactive, onWinner }: { bracket: TournamentBracket; interactive: boolean; onWinner?: (roundIndex: number, matchIndex: number, athleteId: string) => void }) {
  const athlete = (id: string | null) => bracket.competidores.find((item) => item.id === id) || null;
  return <div className="overflow-x-auto rounded-[1.75rem] border border-white/10 bg-[#0d1016] p-4 sm:p-6"><div className="grid min-w-max auto-cols-[290px] grid-flow-col gap-6">{bracket.rounds.map((round, roundIndex) => <div key={round.id} className="flex min-h-[520px] flex-col"><div className="mb-4 text-center"><span className="rounded-xl border border-white/10 bg-white/[.05] px-4 py-2 text-sm font-black uppercase tracking-wide text-white">{round.label}</span></div><div className="flex flex-1 flex-col justify-around gap-5">{round.matches.map((match, matchIndex) => <MatchCard key={match.id} match={match} red={athlete(match.redId)} blue={athlete(match.blueId)} interactive={interactive} onWinner={(athleteId) => onWinner?.(roundIndex, matchIndex, athleteId)} />)}</div></div>)}</div></div>;
}

function MatchCard({ match, red, blue, interactive, onWinner }: { match: BracketMatch; red: BracketAthlete | null; blue: BracketAthlete | null; interactive: boolean; onWinner: (athleteId: string) => void }) {
  return <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#171a22] shadow-xl"><CompetitorRow athlete={red} color="red" winner={Boolean(red && match.winnerId === red.id)} interactive={interactive && Boolean(red && blue)} onClick={() => red && onWinner(red.id)} /><div className="h-px bg-white/10" /><CompetitorRow athlete={blue} color="blue" winner={Boolean(blue && match.winnerId === blue.id)} interactive={interactive && Boolean(red && blue)} onClick={() => blue && onWinner(blue.id)} /></div>;
}

function CompetitorRow({ athlete, color, winner, interactive, onClick }: { athlete: BracketAthlete | null; color: "red" | "blue"; winner: boolean; interactive: boolean; onClick: () => void }) {
  return <button disabled={!interactive} onClick={onClick} className={`flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition ${winner ? "bg-emerald-500/20" : interactive ? "hover:bg-white/[.06]" : ""}`}><span className={`h-9 w-1 rounded-full ${color === "red" ? "bg-red-400" : "bg-sky-400"}`} />{athlete ? <><AthletePhoto athlete={athlete} className="h-11 w-11 rounded-xl" /><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{athlete.nombre}</span><span className="block truncate text-xs text-slate-400">{athlete.grado || athlete.disciplina || "Competidor"}</span></span>{winner && <CircleCheckBig className="h-5 w-5 shrink-0 text-emerald-300" />}</> : <span className="flex-1 text-sm font-bold text-slate-600">Esperando ganador</span>}</button>;
}

function Podium({ bracket }: { bracket: TournamentBracket }) {
  const podium = bracketPodium(bracket);
  const athlete = (id: string | null) => bracket.competidores.find((item) => item.id === id) || null;
  const champion = athlete(podium.championId);
  const runnerUp = athlete(podium.runnerUpId);
  const bronze = podium.bronzeIds.map(athlete).filter((item): item is BracketAthlete => Boolean(item));
  return <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,#17130b,#11141b)] p-5 sm:p-8"><div className="mb-6 text-center"><p className="text-xs font-black uppercase tracking-[.24em] text-amber-300">Resultados</p><h3 className="mt-1 text-2xl font-black text-white">Podio</h3></div><div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3"><PodiumPlace athlete={runnerUp} place="2" label="Plata" color="border-slate-300/30 bg-slate-300/10 text-slate-200" icon={<Medal className="h-7 w-7" />} /><PodiumPlace athlete={champion} place="1" label="Oro" color="border-amber-300/40 bg-amber-400/15 text-amber-200" icon={<Crown className="h-8 w-8" />} featured /><PodiumPlace athlete={bronze[0] || null} secondary={bronze[1] || null} place="3" label="Bronce" color="border-orange-300/30 bg-orange-500/10 text-orange-200" icon={<Medal className="h-7 w-7" />} /></div></div>;
}

function PodiumPlace({ athlete, secondary, place, label, color, icon, featured = false }: { athlete: BracketAthlete | null; secondary?: BracketAthlete | null; place: string; label: string; color: string; icon: React.ReactNode; featured?: boolean }) {
  return <div className={`rounded-3xl border p-5 text-center ${color} ${featured ? "md:-translate-y-3" : ""}`}><div className="mx-auto flex h-10 items-center justify-center">{icon}</div>{athlete ? <><AthletePhoto athlete={athlete} className="mx-auto mt-3 h-20 w-20 rounded-full" /><p className="mt-3 font-black text-white">{athlete.nombre}</p>{secondary && <p className="mt-1 text-xs font-bold text-white/70">y {secondary.nombre}</p>}</> : <div className="mx-auto mt-3 grid h-20 w-20 place-items-center rounded-full border border-dashed border-white/20 text-white/30"><UserRound className="h-8 w-8" /></div>}<p className="mt-3 text-xs font-black uppercase tracking-[.2em]">{place}º · {label}</p></div>;
}

function BracketPresentation({ bracket, wallClock, onClose }: { bracket: TournamentBracket; wallClock: string; onClose: () => void }) {
  const progress = bracketProgress(bracket);
  return <main className="fixed inset-0 z-[100] overflow-y-auto bg-[#050609] p-4 text-white sm:p-6"><header className="sticky top-0 z-10 mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-[#0d1016]/95 p-4 shadow-2xl backdrop-blur"><div><p className="text-xs font-black uppercase tracking-[.22em] text-violet-300">{bracket.tatami || "Torneo"}</p><h1 className="text-2xl font-black text-white sm:text-4xl">{bracket.nombre}</h1><p className="text-sm text-slate-400">{bracket.categoria || "Categoría abierta"}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="flex items-center gap-2 text-2xl font-black tabular-nums text-white"><Clock3 className="h-5 w-5 text-violet-300" /> {wallClock}</p><p className="text-xs font-bold text-slate-400">Llave {progress}% completada</p></div><button onClick={onClose} aria-label="Cerrar pantalla TV" className="grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-white/[.06] text-white"><Minimize2 className="h-5 w-5" /></button></div></header><BracketBoard bracket={bracket} interactive={false} /><div className="mt-5"><Podium bracket={bracket} /></div></main>;
}

function AthletePhoto({ athlete, className }: { athlete: BracketAthlete; className: string }) {
  return <span className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="120px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-slate-400"><UserRound className="h-1/2 w-1/2" /></span>}</span>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400" /></label>;
}
