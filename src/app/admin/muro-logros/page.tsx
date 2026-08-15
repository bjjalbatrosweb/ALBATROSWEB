"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Expand,
  Loader2,
  Medal,
  Minimize2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { useFirestore } from "@/firebase";
import {
  ACHIEVEMENT_KIND_LABELS,
  ACHIEVEMENT_WALL_THEME_LABELS,
  buildAthleteAchievements,
  clampWallInterval,
  createManualAchievement,
  defaultAchievementWallState,
  type Achievement,
  type AchievementAthlete,
  type AchievementKind,
  type AchievementWallState,
  type AchievementWallTheme,
} from "@/lib/achievement-wall";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  activo?: boolean;
  resultadosCompetencias?: Array<{ fecha?: string; evento?: string; resultado?: string }>;
};

const STORAGE_PREFIX = "albatros-achievement-wall-v1";
const MAX_WALL_ITEMS = 16;

const wallThemes: Record<AchievementWallTheme, { backdrop: string; accent: string; badge: string; glow: string }> = {
  dorado: { backdrop: "bg-[radial-gradient(circle_at_top,#4a3210,#08090c_55%)]", accent: "text-amber-300", badge: "bg-amber-400 text-slate-950", glow: "shadow-[0_0_80px_rgba(251,191,36,.22)]" },
  neon: { backdrop: "bg-[radial-gradient(circle_at_top,#241050,#06070b_58%)]", accent: "text-fuchsia-300", badge: "bg-fuchsia-400 text-slate-950", glow: "shadow-[0_0_80px_rgba(232,121,249,.22)]" },
  academia: { backdrop: "bg-[radial-gradient(circle_at_top,#082f49,#06070b_58%)]", accent: "text-sky-300", badge: "bg-sky-400 text-slate-950", glow: "shadow-[0_0_80px_rgba(56,189,248,.22)]" },
};

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWallState(value: unknown): value is AchievementWallState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return typeof state.titulo === "string" && Array.isArray(state.selectedIds) && Array.isArray(state.manualAchievements);
}

export default function AchievementWallPage() {
  const firestore = useFirestore();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<AchievementAthlete[]>([]);
  const [wall, setWall] = useState<AchievementWallState>(defaultAchievementWallState);
  const [storageReady, setStorageReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<AchievementKind | "todos">("todos");
  const [presentation, setPresentation] = useState(false);
  const [manualAthleteId, setManualAthleteId] = useState("");
  const [manualDate, setManualDate] = useState(localDate);
  const [manualEvent, setManualEvent] = useState("");
  const [manualResult, setManualResult] = useState("");
  const [manualKind, setManualKind] = useState<AchievementKind>("especial");

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    setStorageReady(false);
    const stored = localStorage.getItem(`${STORAGE_PREFIX}:${site}`);
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        setWall(isWallState(parsed) ? { ...parsed, intervalSeconds: clampWallInterval(parsed.intervalSeconds) } : defaultAchievementWallState());
      } catch {
        setWall(defaultAchievementWallState());
      }
    } else {
      setWall(defaultAchievementWallState());
    }
    setStorageReady(true);
  }, [site]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(`${STORAGE_PREFIX}:${site}`, JSON.stringify(wall));
  }, [site, storageReady, wall]);

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
            resultados: (data.resultadosCompetencias || []).map((result) => ({ fecha: String(result.fecha || ""), evento: String(result.evento || ""), resultado: String(result.resultado || "Reconocimiento") })),
          } satisfies AchievementAthlete;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);
      setManualAthleteId((current) => current && loaded.some((athlete) => athlete.id === current) ? current : loaded[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los logros.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  const automaticAchievements = useMemo(() => buildAthleteAchievements(athletes), [athletes]);
  const achievements = useMemo(() => [...wall.manualAchievements, ...automaticAchievements], [automaticAchievements, wall.manualAchievements]);
  const selectedAchievements = wall.selectedIds.map((id) => achievements.find((achievement) => achievement.id === id)).filter((achievement): achievement is Achievement => Boolean(achievement));
  const visibleAchievements = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return achievements.filter((achievement) => {
      const kindMatches = kindFilter === "todos" || achievement.kind === kindFilter;
      return kindMatches && (!term || `${achievement.nombre} ${achievement.evento} ${achievement.resultado} ${achievement.disciplina}`.toLocaleLowerCase("es").includes(term));
    });
  }, [achievements, kindFilter, search]);

  const toggleAchievement = (id: string) => {
    setWall((current) => ({
      ...current,
      selectedIds: current.selectedIds.includes(id)
        ? current.selectedIds.filter((item) => item !== id)
        : current.selectedIds.length >= MAX_WALL_ITEMS
          ? current.selectedIds
          : [...current.selectedIds, id],
    }));
  };

  const selectRecent = () => {
    setWall((current) => ({ ...current, selectedIds: achievements.slice(0, MAX_WALL_ITEMS).map((achievement) => achievement.id) }));
  };

  const addManual = () => {
    const athlete = athletes.find((item) => item.id === manualAthleteId);
    if (!athlete || !manualResult.trim()) {
      setError("Selecciona un atleta y escribe el reconocimiento.");
      return;
    }
    const achievement = createManualAchievement({ athlete, date: manualDate, event: manualEvent, result: manualResult, kind: manualKind });
    setWall((current) => ({
      ...current,
      manualAchievements: [achievement, ...current.manualAchievements].slice(0, 30),
      selectedIds: current.selectedIds.length < MAX_WALL_ITEMS ? [achievement.id, ...current.selectedIds] : current.selectedIds,
    }));
    setManualEvent("");
    setManualResult("");
    setError("");
  };

  const removeManual = (id: string) => {
    setWall((current) => ({ ...current, manualAchievements: current.manualAchievements.filter((achievement) => achievement.id !== id), selectedIds: current.selectedIds.filter((item) => item !== id) }));
  };

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,.22),transparent_38%),linear-gradient(135deg,#181207,#090b11)] p-6 shadow-2xl sm:p-8"><div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-amber-300"><Crown className="h-4 w-4" /> Comunicación · {site}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Muro de logros</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">Convierte resultados y reconocimientos en una presentación visual para recepción, eventos y pantallas de la academia.</p></div><div className="flex flex-wrap gap-2"><button onClick={selectRecent} disabled={!achievements.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 font-bold text-white disabled:opacity-40"><Sparkles className="h-4 w-4" /> Usar recientes</button><button onClick={() => selectedAchievements.length ? setPresentation(true) : setError("Agrega al menos un logro al muro.")} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-400 px-5 font-black text-slate-950"><Expand className="h-5 w-5" /> Pantalla TV ({selectedAchievements.length})</button></div></div></header>
        {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-red-950/50 p-4 text-red-100"><span>{error}</span><button onClick={() => setError("")} aria-label="Cerrar"><X className="h-4 w-4" /></button></div>}

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-sky-300">Resultados disponibles</p><h2 className="mt-1 text-xl font-black text-white">Selecciona qué mostrar</h2><p className="mt-1 text-sm text-slate-400">Máximo {MAX_WALL_ITEMS} tarjetas en el carrusel.</p></div><div className="flex flex-wrap gap-2"><label className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta o evento..." className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as AchievementKind | "todos")} className="min-h-11 rounded-xl border border-white/15 bg-black/50 px-3 font-bold text-white"><option value="todos">Todos</option>{Object.entries(ACHIEVEMENT_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button onClick={() => void loadAthletes()} aria-label="Actualizar" className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/[.05]"><RefreshCw className="h-4 w-4" /></button></div></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{loading ? <div className="col-span-full grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-amber-300" /></div> : visibleAchievements.length === 0 ? <div className="col-span-full grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/15 text-center"><div><Trophy className="mx-auto h-10 w-10 text-slate-500" /><p className="mt-3 font-bold text-white">No hay resultados disponibles.</p><p className="mt-1 text-sm text-slate-400">Puedes crear un reconocimiento manual.</p></div></div> : visibleAchievements.map((achievement) => <AchievementPicker key={achievement.id} achievement={achievement} selected={wall.selectedIds.includes(achievement.id)} onToggle={() => toggleAchievement(achievement.id)} onRemove={achievement.source === "manual" ? () => removeManual(achievement.id) : undefined} />)}</div>
          </section>

          <aside className="space-y-6"><div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Presentación</p><h2 className="font-black text-white">Configuración del muro</h2></div><span className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-slate-950">{selectedAchievements.length}/{MAX_WALL_ITEMS}</span></div><div className="mt-4 space-y-4"><Field label="Título" value={wall.titulo} onChange={(value) => setWall((current) => ({ ...current, titulo: value }))} placeholder="Muro de campeones" /><Field label="Subtítulo" value={wall.subtitulo} onChange={(value) => setWall((current) => ({ ...current, subtitulo: value }))} placeholder="Disciplina y comunidad" /><SelectField label="Estilo" value={wall.theme} onChange={(value) => setWall((current) => ({ ...current, theme: value as AchievementWallTheme }))} options={ACHIEVEMENT_WALL_THEME_LABELS} /><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">Cambio de tarjeta: {wall.intervalSeconds} segundos</span><input type="range" min={4} max={30} step={1} value={wall.intervalSeconds} onChange={(event) => setWall((current) => ({ ...current, intervalSeconds: clampWallInterval(Number(event.target.value)) }))} className="w-full accent-amber-400" /></label></div><div className="mt-5 max-h-60 space-y-2 overflow-y-auto">{selectedAchievements.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-400">El muro está vacío.</p> : selectedAchievements.map((achievement, index) => <div key={achievement.id} className="flex items-center gap-3 rounded-xl bg-black/25 p-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-black text-white">{index + 1}</span><AthletePhoto achievement={achievement} className="h-9 w-9 rounded-lg" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{achievement.nombre} · {achievement.resultado}</span><button onClick={() => toggleAchievement(achievement.id)} aria-label="Quitar del muro" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-500/15 hover:text-red-200"><X className="h-4 w-4" /></button></div>)}</div></div>

            <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Award className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Tarjeta manual</p><h2 className="font-black text-white">Agregar reconocimiento</h2></div></div><div className="mt-4 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">Atleta</span><span className="relative block"><select value={manualAthleteId} onChange={(event) => setManualAthleteId(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-white/15 bg-black/50 px-3 pr-10 font-bold text-white"><option value="">Seleccionar</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.nombre}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" /></span></label><SelectField label="Tipo" value={manualKind} onChange={(value) => setManualKind(value as AchievementKind)} options={ACHIEVEMENT_KIND_LABELS} /><Field label="Reconocimiento" value={manualResult} onChange={setManualResult} placeholder="Ej. Promoción a cinturón azul" /><Field label="Evento / motivo" value={manualEvent} onChange={setManualEvent} placeholder="Ceremonia de grados" /><DateField label="Fecha" value={manualDate} onChange={setManualDate} /></div><button onClick={addManual} disabled={!manualAthleteId || !manualResult.trim()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-400 font-black text-slate-950 disabled:opacity-40"><Plus className="h-5 w-5" /> Agregar al muro</button></div>
          </aside>
        </div>
      </div>
      {presentation && <WallPresentation wall={wall} achievements={selectedAchievements} site={site} onClose={() => setPresentation(false)} />}
    </main>
  );
}

function AchievementPicker({ achievement, selected, onToggle, onRemove }: { achievement: Achievement; selected: boolean; onToggle: () => void; onRemove?: () => void }) {
  return <article className={`relative overflow-hidden rounded-2xl border transition ${selected ? "border-amber-300/55 bg-amber-500/15" : "border-white/10 bg-black/25"}`}><button onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left"><AthletePhoto achievement={achievement} className="h-16 w-16 rounded-2xl" /><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{achievement.nombre}</span><span className="mt-1 block truncate text-sm font-bold text-amber-200">{achievement.resultado}</span><span className="mt-1 block truncate text-xs text-slate-400">{achievement.evento || achievement.disciplina || "Academia Albatros"}</span></span><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${selected ? "bg-amber-400 text-slate-950" : "border border-white/15 text-slate-400"}`}>{selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span></button>{onRemove && <button onClick={onRemove} aria-label="Eliminar reconocimiento manual" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-red-950/80 text-red-200"><Trash2 className="h-3.5 w-3.5" /></button>}</article>;
}

function WallPresentation({ wall, achievements, site, onClose }: { wall: AchievementWallState; achievements: Achievement[]; site: string; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [clock, setClock] = useState("--:--:--");
  const theme = wallThemes[wall.theme];
  const current = achievements[index % Math.max(1, achievements.length)] || null;
  useEffect(() => { setIndex((value) => Math.min(value, Math.max(0, achievements.length - 1))); }, [achievements.length]);
  useEffect(() => { const update = () => setClock(new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date())); update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!playing || achievements.length < 2) return; const timer = window.setInterval(() => setIndex((value) => (value + 1) % achievements.length), wall.intervalSeconds * 1000); return () => window.clearInterval(timer); }, [achievements.length, playing, wall.intervalSeconds]);
  const move = (direction: -1 | 1) => setIndex((value) => (value + direction + achievements.length) % achievements.length);
  return <div className={`fixed inset-0 z-[100] overflow-hidden text-white ${theme.backdrop}`}><header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 p-5 sm:p-8"><div><p className={`text-xs font-black uppercase tracking-[.3em] ${theme.accent}`}>Sede {site}</p><h1 className="text-2xl font-black text-white sm:text-4xl">{wall.titulo}</h1><p className="mt-1 text-sm text-white/70">{wall.subtitulo}</p></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="flex items-center gap-2 text-2xl font-black tabular-nums"><Clock3 className={`h-5 w-5 ${theme.accent}`} /> {clock}</p><p className="text-xs text-white/70">{index + 1} de {achievements.length}</p></div><button onClick={onClose} aria-label="Cerrar pantalla TV" className="grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-white/[.07]"><Minimize2 className="h-5 w-5" /></button></div></header>{current ? <div className="grid h-full place-items-center px-6 pb-28 pt-32"><div className={`grid w-full max-w-6xl items-center gap-8 rounded-[3rem] border border-white/10 bg-black/35 p-6 backdrop-blur md:grid-cols-[.9fr_1.1fr] md:p-10 ${theme.glow}`}><div className="relative mx-auto aspect-square w-full max-w-[480px] overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/[.06]">{current.fotoUrl ? <Image src={current.fotoUrl} alt={`Foto de ${current.nombre}`} fill sizes="480px" unoptimized priority className="object-cover" /> : <div className="grid h-full place-items-center text-white/70"><UserRound className="h-32 w-32" /></div>}<div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" /></div><div className="text-center md:text-left"><div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black uppercase tracking-wider ${theme.badge}`}>{kindIcon(current.kind)} {ACHIEVEMENT_KIND_LABELS[current.kind]}</div><h2 className="mt-6 text-4xl font-black leading-none text-white sm:text-6xl lg:text-7xl">{current.nombre}</h2><p className={`mt-5 text-2xl font-black sm:text-4xl ${theme.accent}`}>{current.resultado}</p><p className="mt-4 text-lg text-white/65 sm:text-2xl">{current.evento || current.disciplina || "Academia Albatros"}</p>{current.fecha && <p className="mt-3 text-sm font-bold uppercase tracking-[.2em] text-white/70">{formatDate(current.fecha)}</p>}</div></div></div> : <div className="grid h-full place-items-center"><p className="text-xl font-bold">No hay logros seleccionados.</p></div>}<footer className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 p-5 sm:p-8"><button onClick={() => move(-1)} disabled={achievements.length < 2} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[.07] disabled:opacity-30"><ChevronLeft className="h-6 w-6" /></button><div className="flex items-center gap-2"><button onClick={() => setPlaying((value) => !value)} className={`inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-black ${theme.badge}`}>{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}{playing ? "Pausar" : "Continuar"}</button></div><button onClick={() => move(1)} disabled={achievements.length < 2} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[.07] disabled:opacity-30"><ChevronRight className="h-6 w-6" /></button></footer></div>;
}

function kindIcon(kind: AchievementKind) { if (kind === "oro" || kind === "victoria") return <Crown className="h-5 w-5" />; if (kind === "plata" || kind === "bronce") return <Medal className="h-5 w-5" />; return <Award className="h-5 w-5" />; }
function AthletePhoto({ achievement, className }: { achievement: Achievement; className: string }) { return <span className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{achievement.fotoUrl ? <Image src={achievement.fotoUrl} alt={`Foto de ${achievement.nombre}`} fill sizes="120px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-slate-400"><UserRound className="h-1/2 w-1/2" /></span>}</span>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-amber-400" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><span className="relative block"><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-white/15 bg-black/50 px-3 pr-10 text-sm font-bold text-white outline-none focus:border-amber-400">{Object.entries(options).map(([option, labelText]) => <option key={option} value={option}>{labelText}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" /></span></label>; }
function formatDate(value: string) { if (!value) return ""; const date = new Date(`${value.slice(0, 10)}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(date); }

