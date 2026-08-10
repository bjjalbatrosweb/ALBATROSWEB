"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardCheck,
  Copy,
  History,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";

import { useFirestore, useUser } from "@/firebase";
import {
  DISCIPLINE_LABELS,
  createTechnicalEvaluation,
  emptyEvaluationScores,
  evaluationReadiness,
  evaluationRecommendation,
  evaluationRubric,
  normalizeEvaluationDiscipline,
  scoreDelta,
  type EvaluationDiscipline,
  type TechnicalEvaluation,
} from "@/lib/technical-evaluation";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  activo?: boolean;
  evaluacionesTecnicas?: unknown;
};

type Athlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
  evaluaciones: TechnicalEvaluation[];
};

const MAX_EVALUATIONS = 20;
const SCORE_LABELS = ["", "Inicial", "Básico", "Consistente", "Avanzado", "Dominado"];

function isEvaluation(value: unknown): value is TechnicalEvaluation {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.fecha === "string" &&
    typeof record.disciplina === "string" &&
    typeof record.preparacion === "number" &&
    Boolean(record.puntuaciones) &&
    typeof record.puntuaciones === "object"
  );
}

function parseEvaluations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isEvaluation).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function recommendationClasses(value: string) {
  if (value.includes("Listo")) return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
  if (value.includes("Cerca")) return "border-amber-300/30 bg-amber-500/15 text-amber-100";
  return "border-sky-300/30 bg-sky-500/15 text-sky-100";
}

export default function TechnicalEvaluationsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [discipline, setDiscipline] = useState<EvaluationDiscipline>("general");
  const [scores, setScores] = useState<Record<string, number>>(emptyEvaluationScores("general"));
  const [targetGrade, setTargetGrade] = useState("");
  const [coach, setCoach] = useState("");
  const [notes, setNotes] = useState("");
  const [nextGoal, setNextGoal] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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
            evaluaciones: parseEvaluations(data.evaluacionesTecnicas),
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
  const rubric = useMemo(() => evaluationRubric(discipline), [discipline]);
  const previous = useMemo(
    () => selected?.evaluaciones.find((evaluation) => evaluation.disciplina === discipline) || null,
    [discipline, selected],
  );

  useEffect(() => {
    if (!selected) return;
    const nextDiscipline = normalizeEvaluationDiscipline(selected.disciplina);
    setDiscipline(nextDiscipline);
    setScores(emptyEvaluationScores(nextDiscipline));
    setTargetGrade("");
    setNotes("");
    setNextGoal("");
    setConfirming(false);
    setSuccess("");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const readiness = evaluationReadiness(discipline, scores);
  const recommendation = evaluationRecommendation(readiness);
  const visibleAthletes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return athletes.filter((athlete) =>
      !term || `${athlete.nombre} ${athlete.disciplina} ${athlete.grado}`.toLocaleLowerCase("es").includes(term),
    );
  }, [athletes, search]);

  const changeDiscipline = (value: EvaluationDiscipline) => {
    setDiscipline(value);
    setScores(emptyEvaluationScores(value));
    setConfirming(false);
  };

  const saveEvaluation = async () => {
    if (!firestore || !selected || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const evaluation = createTechnicalEvaluation({
        discipline,
        currentGrade: selected.grado,
        targetGrade,
        coach,
        notes,
        nextGoal,
        scores,
      });
      const history = [...selected.evaluaciones, evaluation]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .slice(-MAX_EVALUATIONS);
      await updateDoc(doc(firestore, "Alumnos", selected.id), {
        evaluacionesTecnicas: history,
      });
      setAthletes((current) =>
        current.map((athlete) =>
          athlete.id === selected.id
            ? { ...athlete, evaluaciones: [...history].reverse() }
            : athlete,
        ),
      );
      setConfirming(false);
      setSuccess("Evaluación guardada. El resultado es una guía para revisión del coach.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la evaluación.");
    } finally {
      setSaving(false);
    }
  };

  const copySummary = async () => {
    if (!selected) return;
    const detail = rubric
      .map((criterion) => `• ${criterion.label}: ${scores[criterion.id]}/5`)
      .join("\n");
    const summary = [
      `Evaluación técnica · ${selected.nombre}`,
      `${DISCIPLINE_LABELS[discipline]} · ${readiness}% · ${recommendation}`,
      selected.grado ? `Grado actual: ${selected.grado}` : "",
      targetGrade ? `Objetivo: ${targetGrade}` : "",
      detail,
      nextGoal ? `Próximo objetivo: ${nextGoal}` : "",
      "Resultado orientativo: la promoción requiere revisión del coach.",
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,.18),transparent_34%),linear-gradient(135deg,#111827,#090b11)] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-emerald-300">
                <ClipboardCheck className="h-4 w-4" /> Atletas · {site}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Evaluación técnica</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Evalúa habilidades por disciplina, compara avances y prepara la siguiente revisión de grado sin promociones automáticas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={copySummary} disabled={!selected} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 font-bold text-white hover:bg-white/10 disabled:opacity-40">
                {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar resumen"}
              </button>
              <button onClick={() => void loadAthletes()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 font-bold text-white hover:bg-white/10">
                <RefreshCw className="h-4 w-4" /> Actualizar
              </button>
            </div>
          </div>
        </header>

        {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-950/50 p-4 text-red-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><span>{error}</span></div>}
        {success && <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/50 p-4 text-emerald-100"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><span>{success}</span></div>}

        <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11141b]">
            <div className="border-b border-white/10 p-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta..." className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" />
              </label>
            </div>
            <div className="max-h-[760px] space-y-1 overflow-y-auto p-2">
              {loading ? <div className="grid min-h-56 place-items-center text-slate-300"><Loader2 className="h-7 w-7 animate-spin text-emerald-300" /></div> : visibleAthletes.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">No hay atletas activos para esta sede.</p> : visibleAthletes.map((athlete) => {
                const last = athlete.evaluaciones[0];
                const active = selected?.id === athlete.id;
                return <button key={athlete.id} onClick={() => setSelectedId(athlete.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-emerald-300/50 bg-emerald-500/15" : "border-transparent bg-white/[.02] hover:border-white/10 hover:bg-white/[.05]"}`}>
                  <AthletePhoto athlete={athlete} className="h-12 w-12 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-white">{athlete.nombre}</span>
                    <span className="block truncate text-xs text-slate-400">{athlete.disciplina || "Sin disciplina"}{athlete.grado ? ` · ${athlete.grado}` : ""}</span>
                  </span>
                  {last && <span className="rounded-lg bg-black/35 px-2 py-1 text-xs font-black text-emerald-200">{last.preparacion}%</span>}
                </button>;
              })}
            </div>
          </aside>

          {!selected ? <section className="grid min-h-[500px] place-items-center rounded-[1.75rem] border border-dashed border-white/15 bg-white/[.025] p-8 text-center text-slate-400"><div><UserRound className="mx-auto mb-3 h-10 w-10" /><p className="font-bold text-white">Selecciona un atleta</p><p className="mt-1 text-sm">Su evaluación aparecerá aquí.</p></div></section> : <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <AthletePhoto athlete={selected} className="h-24 w-24 rounded-3xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Ficha de evaluación</p>
                  <h2 className="mt-1 truncate text-2xl font-black text-white sm:text-3xl">{selected.nombre}</h2>
                  <p className="mt-1 text-sm text-slate-300">{selected.disciplina || "Sin disciplina"}{selected.grado ? ` · ${selected.grado}` : " · Sin grado registrado"}</p>
                </div>
                <div className={`rounded-2xl border px-5 py-4 text-center ${recommendationClasses(recommendation)}`}>
                  <span className="block text-3xl font-black">{readiness}%</span>
                  <span className="mt-1 block max-w-44 text-xs font-bold uppercase tracking-wide">{recommendation}</span>
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-emerald-400 transition-all" style={{ width: `${readiness}%` }} /></div>
              <p className="mt-2 text-xs text-slate-400">Indicador orientativo. El coach decide cuándo revisar o promover al atleta.</p>
            </div>

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div><p className="text-xs font-black uppercase tracking-[.2em] text-sky-300">Rúbrica</p><h3 className="mt-1 text-xl font-black text-white">Habilidades de la disciplina</h3></div>
                  <label className="relative">
                    <span className="mb-1 block text-xs font-bold text-slate-300">Disciplina evaluada</span>
                    <select value={discipline} onChange={(event) => changeDiscipline(event.target.value as EvaluationDiscipline)} className="min-h-11 appearance-none rounded-xl border border-white/15 bg-black/50 py-2 pl-3 pr-10 font-bold text-white outline-none focus:border-sky-400">
                      {Object.entries(DISCIPLINE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3 h-4 w-4 text-slate-400" />
                  </label>
                </div>
                <div className="space-y-4">
                  {rubric.map((criterion) => {
                    const value = scores[criterion.id] || 1;
                    const delta = scoreDelta(value, previous?.puntuaciones[criterion.id]);
                    return <div key={criterion.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><h4 className="font-black text-white">{criterion.label}</h4><p className="mt-1 text-xs leading-relaxed text-slate-400">{criterion.description}</p></div>
                        <div className="flex items-center gap-2"><span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-black text-white">{value}/5 · {SCORE_LABELS[value]}</span>{delta !== null && delta !== 0 && <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black ${delta > 0 ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>{delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{delta > 0 ? `+${delta}` : delta}</span>}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-2">{[1,2,3,4,5].map((score) => <button key={score} onClick={() => setScores((current) => ({ ...current, [criterion.id]: score }))} aria-label={`${criterion.label}: ${score} de 5`} className={`min-h-11 rounded-xl border font-black transition ${value === score ? "border-sky-300 bg-sky-400 text-slate-950" : "border-white/15 bg-white/[.04] text-white hover:bg-white/10"}`}>{score}</button>)}</div>
                    </div>;
                  })}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Mapa de habilidades</p><h3 className="mt-1 font-black text-white">Perfil actual</h3></div><BarChart3 className="h-6 w-6 text-violet-300" /></div>
                  <RadarChart scores={scores} discipline={discipline} previous={previous?.puntuaciones} />
                  {previous ? <p className="text-center text-xs text-slate-400">Línea tenue: evaluación del {formatDate(previous.fecha)}</p> : <p className="text-center text-xs text-slate-400">La comparación aparecerá tras guardar una evaluación.</p>}
                </div>
                <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Cierre de evaluación</p>
                  <div className="mt-4 space-y-4">
                    <Field label="Grado / nivel objetivo" value={targetGrade} onChange={setTargetGrade} placeholder="Ej. Cinturón azul" />
                    <Field label="Coach evaluador" value={coach} onChange={setCoach} placeholder="Nombre o correo" />
                    <TextField label="Próximo objetivo" value={nextGoal} onChange={setNextGoal} placeholder="Una meta concreta para el siguiente ciclo" />
                    <TextField label="Notas privadas del coach" value={notes} onChange={setNotes} placeholder="Fortalezas, ajustes y contexto" />
                  </div>
                  {!confirming ? <button onClick={() => setConfirming(true)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-black text-slate-950 hover:bg-emerald-300"><Save className="h-5 w-5" /> Revisar y guardar</button> : <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
                    <p className="font-black text-amber-100">¿Confirmas esta evaluación?</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-50/70">Se agregará al historial de {selected.nombre}. No cambia su grado automáticamente.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setConfirming(false)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/25 font-bold text-white"><X className="h-4 w-4" /> Cancelar</button><button onClick={() => void saveEvaluation()} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-slate-950 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar</button></div>
                  </div>}
                </div>
              </div>
            </div>

            <EvaluationHistory evaluations={selected.evaluaciones} />
          </section>}
        </div>
      </div>
    </main>
  );
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

function RadarChart({ scores, discipline, previous }: { scores: Record<string, number>; discipline: EvaluationDiscipline; previous?: Record<string, number> }) {
  const criteria = evaluationRubric(discipline);
  const center = 120;
  const radius = 82;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / criteria.length;
    const distance = radius * (Math.max(0, Math.min(5, value)) / 5);
    return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
  };
  const polygon = (values: Record<string, number>) => criteria.map((criterion, index) => point(index, Number(values[criterion.id]) || 0)).join(" ");
  return <svg viewBox="0 0 240 240" role="img" aria-label="Gráfica de habilidades" className="mx-auto my-3 h-auto w-full max-w-[280px]">
    {[1,2,3,4,5].map((level) => <polygon key={level} points={criteria.map((_, index) => point(index, level)).join(" ")} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1" />)}
    {criteria.map((criterion, index) => { const edge = point(index, 5).split(","); return <line key={criterion.id} x1={center} y1={center} x2={edge[0]} y2={edge[1]} stroke="rgba(255,255,255,.1)" />; })}
    {previous && <polygon points={polygon(previous)} fill="rgba(167,139,250,.08)" stroke="rgba(196,181,253,.65)" strokeWidth="2" strokeDasharray="4 4" />}
    <polygon points={polygon(scores)} fill="rgba(56,189,248,.22)" stroke="#7dd3fc" strokeWidth="3" />
    {criteria.map((criterion, index) => { const [x,y] = point(index, 5).split(",").map(Number); const labelX = center + (x-center)*1.19; const labelY = center + (y-center)*1.19; return <text key={criterion.id} x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fill="#e2e8f0" fontSize="8" fontWeight="700">{criterion.shortLabel.slice(0,10)}</text>; })}
  </svg>;
}

function EvaluationHistory({ evaluations }: { evaluations: TechnicalEvaluation[] }) {
  return <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6">
    <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[.06] text-slate-200"><History className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-slate-400">Seguimiento</p><h3 className="font-black text-white">Historial de evaluaciones</h3></div></div>
    {evaluations.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-3 font-bold text-white">Todavía no hay evaluaciones guardadas.</p><p className="mt-1 text-sm text-slate-400">La primera establecerá la línea base del atleta.</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{evaluations.map((evaluation) => <article key={evaluation.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-sky-300">{evaluation.disciplinaLabel || DISCIPLINE_LABELS[evaluation.disciplina]}</p><p className="mt-1 text-sm font-bold text-white">{formatDate(evaluation.fecha)}</p></div><span className="rounded-xl bg-white/10 px-3 py-2 text-lg font-black text-white">{evaluation.preparacion}%</span></div>
      <p className={`mt-3 inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${recommendationClasses(evaluation.recomendacion)}`}>{evaluation.recomendacion}</p>
      {evaluation.gradoObjetivo && <p className="mt-3 flex items-start gap-2 text-sm text-slate-300"><Target className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> {evaluation.gradoObjetivo}</p>}
      {evaluation.proximoObjetivo && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{evaluation.proximoObjetivo}</p>}
      {evaluation.coach && <p className="mt-3 truncate border-t border-white/10 pt-3 text-xs text-slate-500">Coach: {evaluation.coach}</p>}
    </article>)}</div>}
  </div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha sin registrar";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

