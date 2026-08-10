"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheckBig,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";

import { useFirestore, useUser } from "@/firebase";
import {
  CATEGORY_LABELS,
  CHALLENGE_TEMPLATES,
  challengeProgress,
  createWeeklyChallenge,
  currentWeekRange,
  isChallengeOverdue,
  updateChallengeProgress,
  type ChallengeCategory,
  type ChallengeTemplate,
  type WeeklyChallenge,
} from "@/lib/weekly-challenges";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  activo?: boolean;
  retosSemanales?: unknown;
};

type Athlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
  retos: WeeklyChallenge[];
};

type View = "activos" | "historial";
const MAX_CHALLENGES = 30;

function isChallenge(value: unknown): value is WeeklyChallenge {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.titulo === "string" &&
    typeof record.categoria === "string" &&
    typeof record.objetivo === "number" &&
    typeof record.progreso === "number" &&
    typeof record.estado === "string"
  );
}

function parseChallenges(value: unknown) {
  return Array.isArray(value)
    ? value.filter(isChallenge).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    : [];
}

function categoryClasses(category: ChallengeCategory) {
  const styles: Record<ChallengeCategory, string> = {
    tecnica: "border-sky-300/30 bg-sky-500/15 text-sky-100",
    asistencia: "border-emerald-300/30 bg-emerald-500/15 text-emerald-100",
    fisico: "border-orange-300/30 bg-orange-500/15 text-orange-100",
    habito: "border-violet-300/30 bg-violet-500/15 text-violet-100",
    competencia: "border-amber-300/30 bg-amber-500/15 text-amber-100",
  };
  return styles[category];
}

export default function WeeklyChallengesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const week = useMemo(() => currentWeekRange(), []);
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("activos");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ChallengeCategory>("tecnica");
  const [target, setTarget] = useState(3);
  const [unit, setUnit] = useState("sesiones");
  const [startDate, setStartDate] = useState(week.start);
  const [endDate, setEndDate] = useState(week.end);
  const [coach, setCoach] = useState("");

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    if (!coach && user?.email) setCoach(user.email);
  }, [coach, user?.email]);

  const loadAthletes = useCallback(async () => {
    if (!firestore || !site) return;
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(
        query(collection(firestore, "Alumnos"), where("sede", "==", site)),
      );
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
            retos: parseChallenges(data.retosSemanales),
          } satisfies Athlete;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);
      setSelectedId((current) =>
        current && loaded.some((athlete) => athlete.id === current)
          ? current
          : loaded[0]?.id || "",
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los atletas.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  const selected = athletes.find((athlete) => athlete.id === selectedId) || null;
  const visibleAthletes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return athletes.filter((athlete) =>
      !term || `${athlete.nombre} ${athlete.disciplina} ${athlete.grado}`.toLocaleLowerCase("es").includes(term),
    );
  }, [athletes, search]);
  const activeChallenges = selected?.retos.filter((challenge) => challenge.estado === "activo") || [];
  const historyChallenges = selected?.retos.filter((challenge) => challenge.estado !== "activo") || [];
  const displayedChallenges = view === "activos" ? activeChallenges : historyChallenges;
  const summary = useMemo(() => {
    const all = athletes.flatMap((athlete) => athlete.retos);
    return {
      active: all.filter((challenge) => challenge.estado === "activo").length,
      completed: all.filter((challenge) => challenge.estado === "completado").length,
      athletesWithGoals: athletes.filter((athlete) => athlete.retos.some((challenge) => challenge.estado === "activo")).length,
    };
  }, [athletes]);

  const persistChallenges = async (athlete: Athlete, challenges: WeeklyChallenge[], message: string) => {
    if (!firestore) return;
    setSavingId(athlete.id);
    setError("");
    setSuccess("");
    try {
      const limited = [...challenges]
        .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
        .slice(-MAX_CHALLENGES);
      await updateDoc(doc(firestore, "Alumnos", athlete.id), { retosSemanales: limited });
      setAthletes((current) => current.map((item) => item.id === athlete.id ? { ...item, retos: [...limited].reverse() } : item));
      setSuccess(message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el cambio.");
    } finally {
      setSavingId("");
    }
  };

  const chooseTemplate = (template: ChallengeTemplate) => {
    setTitle(template.titulo);
    setDescription(template.descripcion);
    setCategory(template.categoria);
    setTarget(template.objetivo);
    setUnit(template.unidad);
    setConfirmingCreate(false);
  };

  const createChallenge = async () => {
    if (!selected || !title.trim() || savingId) return;
    const challenge = createWeeklyChallenge({
      title,
      description,
      category,
      target,
      unit,
      startDate,
      endDate,
      coach,
    });
    await persistChallenges(selected, [...selected.retos, challenge], `Reto asignado a ${selected.nombre}.`);
    setTitle("");
    setDescription("");
    setTarget(3);
    setUnit("sesiones");
    setConfirmingCreate(false);
    setView("activos");
  };

  const setProgress = async (challenge: WeeklyChallenge, progress: number) => {
    if (!selected || savingId) return;
    const updated = updateChallengeProgress(challenge, progress);
    const next = selected.retos.map((item) => item.id === challenge.id ? updated : item);
    await persistChallenges(
      selected,
      next,
      updated.estado === "completado" ? `¡Reto completado por ${selected.nombre}!` : "Progreso actualizado.",
    );
  };

  const changeStatus = async (challenge: WeeklyChallenge, status: "activo" | "cancelado") => {
    if (!selected || savingId) return;
    const next = selected.retos.map((item) => item.id === challenge.id ? { ...item, estado: status, completadoEn: undefined } : item);
    await persistChallenges(selected, next, status === "activo" ? "Reto reactivado." : "Reto cancelado y enviado al historial.");
  };

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,.2),transparent_36%),linear-gradient(135deg,#17120b,#090b11)] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-amber-300"><Target className="h-4 w-4" /> Atletas · {site}</p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Retos semanales</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">Convierte los objetivos del coach en metas claras, medibles y fáciles de seguir durante la semana.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[430px]">
              <Metric value={summary.active} label="Activos" color="text-amber-200" />
              <Metric value={summary.completed} label="Completados" color="text-emerald-200" />
              <Metric value={summary.athletesWithGoals} label="Con meta" color="text-sky-200" />
            </div>
          </div>
        </header>

        {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-950/50 p-4 text-red-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><span>{error}</span></div>}
        {success && <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/50 p-4 text-emerald-100"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><span>{success}</span></div>}

        <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11141b]">
            <div className="flex gap-2 border-b border-white/10 p-4">
              <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta..." className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" /></label>
              <button onClick={() => void loadAthletes()} aria-label="Actualizar atletas" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[.05] text-white hover:bg-white/10"><RefreshCw className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[850px] space-y-1 overflow-y-auto p-2">
              {loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-amber-300" /></div> : visibleAthletes.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">No hay atletas activos en esta sede.</p> : visibleAthletes.map((athlete) => {
                const active = athlete.retos.filter((challenge) => challenge.estado === "activo").length;
                const selectedAthlete = athlete.id === selected?.id;
                return <button key={athlete.id} onClick={() => { setSelectedId(athlete.id); setSuccess(""); }} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selectedAthlete ? "border-amber-300/50 bg-amber-500/15" : "border-transparent bg-white/[.02] hover:border-white/10 hover:bg-white/[.05]"}`}>
                  <AthletePhoto athlete={athlete} className="h-12 w-12 rounded-xl" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{athlete.nombre}</span><span className="block truncate text-xs text-slate-400">{athlete.disciplina || "Sin disciplina"}{athlete.grado ? ` · ${athlete.grado}` : ""}</span></span>
                  <span className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-black ${active ? "bg-amber-400 text-slate-950" : "bg-white/10 text-slate-300"}`}>{active}</span>
                </button>;
              })}
            </div>
          </aside>

          {!selected ? <section className="grid min-h-[520px] place-items-center rounded-[1.75rem] border border-dashed border-white/15 bg-white/[.025] p-8 text-center"><div><UserRound className="mx-auto h-10 w-10 text-slate-500" /><p className="mt-3 font-black text-white">Selecciona un atleta</p><p className="mt-1 text-sm text-slate-400">Podrás asignarle y seguir sus objetivos.</p></div></section> : <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <AthletePhoto athlete={selected} className="h-24 w-24 rounded-3xl" />
                <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Semana {formatShortDate(week.start)} – {formatShortDate(week.end)}</p><h2 className="mt-1 truncate text-2xl font-black text-white sm:text-3xl">{selected.nombre}</h2><p className="mt-1 text-sm text-slate-300">{selected.disciplina || "Sin disciplina"}{selected.grado ? ` · ${selected.grado}` : ""}</p></div>
                <div className="grid grid-cols-2 gap-2"><Metric value={activeChallenges.length} label="En curso" color="text-amber-200" /><Metric value={historyChallenges.filter((challenge) => challenge.estado === "completado").length} label="Logrados" color="text-emerald-200" /></div>
              </div>
            </div>

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div><p className="text-xs font-black uppercase tracking-[.2em] text-sky-300">Seguimiento</p><h3 className="mt-1 text-xl font-black text-white">Objetivos del atleta</h3></div>
                    <div className="flex rounded-xl border border-white/10 bg-black/30 p-1"><button onClick={() => setView("activos")} className={`min-h-10 rounded-lg px-4 text-sm font-bold ${view === "activos" ? "bg-white text-slate-950" : "text-slate-300"}`}>Activos ({activeChallenges.length})</button><button onClick={() => setView("historial")} className={`min-h-10 rounded-lg px-4 text-sm font-bold ${view === "historial" ? "bg-white text-slate-950" : "text-slate-300"}`}>Historial ({historyChallenges.length})</button></div>
                  </div>
                  {displayedChallenges.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-10 text-center"><Target className="mx-auto h-9 w-9 text-slate-500" /><p className="mt-3 font-bold text-white">{view === "activos" ? "No tiene retos activos." : "Todavía no hay historial."}</p><p className="mt-1 text-sm text-slate-400">{view === "activos" ? "Usa una plantilla o crea un objetivo personalizado." : "Aquí aparecerán los retos completados o cancelados."}</p></div> : <div className="mt-5 space-y-4">{displayedChallenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} saving={savingId === selected.id} onProgress={(progress) => void setProgress(challenge, progress)} onCancel={() => void changeStatus(challenge, "cancelado")} onReactivate={() => void changeStatus(challenge, "activo")} />)}</div>}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5">
                  <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-200"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Inicio rápido</p><h3 className="font-black text-white">Plantillas de reto</h3></div></div>
                  <div className="mt-4 grid gap-2">{CHALLENGE_TEMPLATES.map((template) => <button key={template.id} onClick={() => chooseTemplate(template)} className="rounded-xl border border-white/10 bg-white/[.035] p-3 text-left hover:border-amber-300/30 hover:bg-amber-500/10"><span className="block font-bold text-white">{template.titulo}</span><span className="mt-1 block text-xs text-slate-400">{template.objetivo} {template.unidad} · {CATEGORY_LABELS[template.categoria]}</span></button>)}</div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Asignar objetivo</p>
                  <div className="mt-4 space-y-4">
                    <Field label="Título" value={title} onChange={setTitle} placeholder="Ej. Mejorar escapes de montada" />
                    <TextField label="Indicaciones" value={description} onChange={setDescription} placeholder="Qué debe realizar y cómo se comprobará" />
                    <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">Categoría</span><span className="relative block"><select value={category} onChange={(event) => setCategory(event.target.value as ChallengeCategory)} className="min-h-11 w-full appearance-none rounded-xl border border-white/15 bg-black/40 px-3 pr-10 text-sm font-bold text-white outline-none focus:border-emerald-400">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" /></span></label>
                    <div className="grid grid-cols-2 gap-3"><NumberField label="Meta" value={target} onChange={setTarget} /><Field label="Unidad" value={unit} onChange={setUnit} placeholder="repeticiones" /></div>
                    <div className="grid grid-cols-2 gap-3"><DateField label="Inicio" value={startDate} onChange={setStartDate} /><DateField label="Fin" value={endDate} onChange={setEndDate} /></div>
                    <Field label="Coach" value={coach} onChange={setCoach} placeholder="Nombre o correo" />
                  </div>
                  {!confirmingCreate ? <button onClick={() => setConfirmingCreate(true)} disabled={!title.trim()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-black text-slate-950 hover:bg-emerald-300 disabled:opacity-40"><Target className="h-5 w-5" /> Revisar asignación</button> : <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4"><p className="font-black text-amber-100">¿Asignar “{title}”?</p><p className="mt-1 text-xs text-amber-50/70">El objetivo se guardará en la ficha de {selected.nombre}.</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setConfirmingCreate(false)} disabled={Boolean(savingId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/25 font-bold text-white"><X className="h-4 w-4" /> Cancelar</button><button onClick={() => void createChallenge()} disabled={Boolean(savingId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-slate-950 disabled:opacity-50">{savingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar</button></div></div>}
                </div>
              </div>
            </div>
          </section>}
        </div>
      </div>
    </main>
  );
}

function ChallengeCard({ challenge, saving, onProgress, onCancel, onReactivate }: { challenge: WeeklyChallenge; saving: boolean; onProgress: (progress: number) => void; onCancel: () => void; onReactivate: () => void }) {
  const progress = challengeProgress(challenge);
  const overdue = isChallengeOverdue(challenge);
  const completed = challenge.estado === "completado";
  return <article className={`rounded-2xl border p-4 sm:p-5 ${completed ? "border-emerald-300/25 bg-emerald-500/[.07]" : overdue ? "border-red-300/25 bg-red-500/[.06]" : "border-white/10 bg-black/25"}`}>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg border px-2 py-1 text-xs font-black ${categoryClasses(challenge.categoria)}`}>{CATEGORY_LABELS[challenge.categoria]}</span>{overdue && <span className="rounded-lg border border-red-300/25 bg-red-500/15 px-2 py-1 text-xs font-black text-red-100">Vencido</span>}{completed && <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2 py-1 text-xs font-black text-slate-950"><CircleCheckBig className="h-3 w-3" /> Logrado</span>}</div><h4 className="mt-3 text-lg font-black text-white">{challenge.titulo}</h4>{challenge.descripcion && <p className="mt-1 text-sm leading-relaxed text-slate-400">{challenge.descripcion}</p>}</div><span className="shrink-0 text-2xl font-black text-white">{progress}%</span></div>
    <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/60"><div className={`h-full rounded-full transition-all ${completed ? "bg-emerald-400" : "bg-gradient-to-r from-sky-400 to-amber-300"}`} style={{ width: `${progress}%` }} /></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3 text-xs text-slate-400"><span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> {challenge.progreso} / {challenge.objetivo} {challenge.unidad}</span><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatShortDate(challenge.fechaInicio)} – {formatShortDate(challenge.fechaFin)}</span></div>
      {challenge.estado === "activo" ? <div className="flex gap-2"><button onClick={() => onProgress(challenge.progreso - 1)} disabled={saving || challenge.progreso <= 0} aria-label="Restar progreso" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[.05] text-white disabled:opacity-30"><Minus className="h-4 w-4" /></button><button onClick={() => onProgress(challenge.progreso + 1)} disabled={saving || challenge.progreso >= challenge.objetivo} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 font-black text-slate-950 disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Sumar</button><button onClick={onCancel} disabled={saving} aria-label="Cancelar reto" className="grid h-10 w-10 place-items-center rounded-xl border border-red-300/20 bg-red-500/10 text-red-200"><Trash2 className="h-4 w-4" /></button></div> : <button onClick={onReactivate} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[.05] px-4 text-sm font-bold text-white"><RotateCcw className="h-4 w-4" /> Reactivar</button>}
    </div>
    {challenge.coach && <p className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-500">Asignado por {challenge.coach}</p>}
  </article>;
}

function Metric({ value, label, color }: { value: number; label: string; color: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-center"><span className={`block text-2xl font-black ${color}`}>{value}</span><span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</span></div>;
}

function AthletePhoto({ athlete, className }: { athlete: Athlete; className: string }) {
  return <span className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="120px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-slate-400"><UserRound className="h-1/2 w-1/2" /></span>}</span>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" /></label>;
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="w-full resize-y rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input type="number" min={1} max={999} value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none focus:border-emerald-400" /></label>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-emerald-400" /></label>;
}

function formatShortDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(date);
}
