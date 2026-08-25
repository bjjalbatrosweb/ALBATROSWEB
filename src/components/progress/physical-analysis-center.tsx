"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight, HeartPulse, Medal, Search, ShieldCheck, Sparkles, Target, type LucideIcon } from "lucide-react";
import { buildAthleteAnalytics, type AnalyticsAthlete, type AthleteAnalytics } from "@/lib/physical-analytics";
import { buildFitnessRanking, type FitnessRankingEntry } from "@/lib/fitness-scoring";
import { FitnessRankBadge } from "@/components/progress/fitness-score-overview";

export function PhysicalAnalysisCenter({ athletes, onEvaluate }: { athletes: AnalyticsAthlete[]; onEvaluate: (id: string) => void }) {
  const analytics = useMemo(() => buildAthleteAnalytics(athletes), [athletes]);
  const batteryRanking = useMemo(() => buildFitnessRanking(athletes), [athletes]);
  const [selectedId, setSelectedId] = useState(analytics[0]?.id || "");
  const [search, setSearch] = useState("");
  const selected = analytics.find((item) => item.id === selectedId) || analytics[0];
  const selectedBattery = batteryRanking.find((item) => item.athleteId === selected?.id);
  const visible = analytics.filter((item) => item.nombre.toLowerCase().includes(search.toLowerCase()));
  const average = (key: keyof AthleteAnalytics) => {
    const values = analytics.map((item) => item[key]).filter((value): value is number => typeof value === "number");
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined;
  };

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.17),transparent_38%),linear-gradient(135deg,#101827,#071018)] p-5 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-cyan-300"><Sparkles className="h-4 w-4"/>Centro de análisis</p><h2 className="mt-2 text-3xl font-black">Decisiones basadas en evolución</h2><p className="mt-2 max-w-3xl text-sm text-slate-400">Cribado, rendimiento y cobertura permanecen separados. Los percentiles solo aparecen con cinco atletas comparables y tres capacidades disponibles.</p></div>
        <div className="grid grid-cols-3 gap-2"><Summary label="Cribado" value={average("healthScore")}/><Summary label="Rendimiento" value={average("performanceScore")}/><Summary label="Datos" value={average("dataQuality")}/></div>
      </div>
    </section>
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="h-fit rounded-[2rem] border border-white/10 bg-white/[.035] p-4 xl:sticky xl:top-6">
        <label className="relative block"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta…" className="input pl-10"/></label>
        <div className="mt-3 max-h-[650px] space-y-2 overflow-auto">{visible.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${selected?.id === item.id ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/[.07] bg-black/20"}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[.06] font-black text-cyan-200">{item.nombre.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.nombre}</b><small className="text-slate-500">Datos {item.dataQuality}%</small></span><ChevronRight className="h-4 w-4 text-slate-600"/></button>)}</div>
      </aside>
      {selected ? <AthletePanel athlete={selected} battery={selectedBattery} onEvaluate={() => onEvaluate(selected.id)}/> : <div className="rounded-[2rem] border border-dashed border-white/10 p-12 text-center text-slate-500">No hay evaluaciones disponibles.</div>}
    </div>
    <BatteryRanking athletes={batteryRanking}/>
    <Methodology/>
  </div>;
}

function AthletePanel({ athlete, battery, onEvaluate }: { athlete: AthleteAnalytics; battery?: FitnessRankingEntry; onEvaluate: () => void }) {
  const trend = athlete.trend === "up" ? "Mejorando" : athlete.trend === "down" ? "Revisar" : athlete.trend === "baseline" ? "Línea base" : "Estable";
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[.035] p-5">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Expediente analítico</p><h2 className="text-3xl font-black">{athlete.nombre}</h2><p className="mt-1 text-xs text-slate-400">{athlete.peerSize ? `Grupo comparable: ${athlete.peerLabel} · n=${athlete.peerSize}` : "Muestra insuficiente: se prioriza la evolución personal."}</p></div>
      <div className="flex flex-wrap items-center gap-3">{battery && <FitnessRankBadge rank={battery.rank} score={battery.report.overall}/>}<button onClick={onEvaluate} className="rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Abrir evaluación</button></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      <ScoreCard icon={HeartPulse} label="Cribado" score={athlete.healthScore} note={`${athlete.healthIndicatorCount} indicadores; no diagnóstico`} color="emerald"/>
      <ScoreCard icon={Activity} label="Rendimiento" score={athlete.performanceScore} note={athlete.peerSize ? `${athlete.performanceMetricsCount} capacidades comparables` : "Sin cohorte suficiente"} color="cyan"/>
      <ScoreCard icon={Target} label="Cobertura" score={athlete.balanceScore} note="Perímetros documentados; no estética" color="violet"/>
      <ScoreCard icon={athlete.trend === "down" ? ArrowDownRight : ArrowUpRight} label="Evolución" score={athlete.improvementScore} note={trend} color="amber"/>
    </div>
    <div className="grid gap-4 lg:grid-cols-2"><Insight title="Fortalezas" items={athlete.strengths} good/><Insight title="Prioridades de mejora" items={athlete.priorities}/></div>
    <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-cyan-300">Lectura cuantificada</p><h3 className="text-xl font-black">Perfil actual reconstruido</h3></div><BarChart3 className="text-cyan-300"/></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Lagartijas" value={athlete.latest?.lagartijas}/><Metric label="Sentadillas" value={athlete.latest?.sentadillas}/><Metric label="Abdominales" value={athlete.latest?.abdominales}/><Metric label="Burpees" value={athlete.latest?.burpees}/><Metric label="Navette" value={athlete.latest?.navetteNivel}/><Metric label="VO₂ estimado" value={athlete.latest?.vo2MaxEstimado}/><Metric label="IMC" value={athlete.latest?.imc}/><Metric label="Cintura/altura" value={athlete.latest?.cinturaEstatura}/></div></div>
  </section>;
}

function ScoreCard({ icon: Icon, label, score, note, color }: { icon: LucideIcon; label: string; score?: number; note: string; color: "emerald" | "cyan" | "violet" | "amber" }) {
  const colors = { emerald: "text-emerald-300 from-emerald-400", cyan: "text-cyan-300 from-cyan-400", violet: "text-violet-300 from-violet-400", amber: "text-amber-300 from-amber-400" }[color];
  return <article className="rounded-[1.6rem] border border-white/10 bg-white/[.04] p-4"><div className={`flex items-center gap-2 ${colors.split(" ")[0]}`}><Icon className="h-4 w-4"/><span className="text-xs font-black uppercase">{label}</span></div><b className="mt-3 block text-4xl">{score ?? "—"}<small className="text-sm text-slate-500">/100</small></b><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.06]"><i className={`block h-full bg-gradient-to-r ${colors.split(" ")[1]} to-white`} style={{ width: `${score || 0}%` }}/></div><p className="mt-2 text-xs text-slate-500">{note}</p></article>;
}

function Insight({ title, items, good = false }: { title: string; items: string[]; good?: boolean }) {
  return <div className={`rounded-[1.6rem] border p-5 ${good ? "border-emerald-300/15 bg-emerald-400/[.05]" : "border-amber-300/15 bg-amber-400/[.05]"}`}><h3 className="font-black">{good ? title : "Plan de mejora automático"}</h3><ul className="mt-3 space-y-2 text-sm text-slate-300">{items.length ? items.map((item) => <li key={item}>• {item}</li>) : <li className="text-slate-500">Faltan evaluaciones comparables.</li>}</ul>{!good && items.length > 0 && <div className="mt-4 rounded-xl border border-white/[.07] bg-black/20 p-3 text-xs leading-relaxed text-slate-400"><b className="text-amber-200">Ciclo sugerido de cuatro semanas:</b> trabaja dos prioridades, registra esfuerzo y recuperación, progresa solo si se mantiene la técnica y repite el mismo protocolo al finalizar.</div>}</div>;
}

function BatteryRanking({ athletes }: { athletes: FitnessRankingEntry[] }) {
  return <section className="rounded-[2rem] border border-violet-300/15 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.12),transparent_35%),rgba(255,255,255,.035)] p-5 md:p-6"><div className="flex items-center gap-3"><Medal className="text-violet-300"/><div><h3 className="text-xl font-black">Ranking · batería completa de 60 segundos</h3><p className="text-xs text-slate-500">Solo entran atletas con las cuatro pruebas. Las pruebas parciales permanecen visibles como progreso personal.</p></div></div>{athletes.length ? <div className="mt-5 grid gap-2">{athletes.slice(0, 20).map((item) => <div key={item.athleteId} className="grid gap-3 rounded-2xl border border-white/[.07] bg-black/20 p-3 sm:grid-cols-[44px_minmax(150px,1fr)_repeat(5,minmax(58px,auto))] sm:items-center"><b className="text-center text-xl text-violet-200">#{item.rank}</b><span><b className="block">{item.name}</b><small className="text-slate-500">4/4 · protocolo completo</small></span>{(["lagartijas", "sentadillas", "abdominales", "burpees"] as const).map((key) => { const score = item.report.exercises.find((exercise) => exercise.key === key); return <span key={key} className="text-center"><b className="block text-sm text-slate-200">{score?.score ?? "—"}</b><small className="text-[8px] uppercase text-slate-600">{key.slice(0, 4)}</small></span>; })}<span className="rounded-xl bg-violet-400/10 p-2 text-center"><b className="block text-violet-200">{item.report.overall}</b><small className="text-[8px] uppercase text-slate-500">general</small></span></div>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Aún no hay atletas con la batería completa.</p>}</section>;
}

function Methodology() {
  return <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-cyan-300"/><div><h3 className="font-black">Cómo interpretar las puntuaciones</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">Cribado combina únicamente indicadores fisiológicos disponibles; la calidad se muestra aparte. Rendimiento exige una cohorte mínima comparable. Cobertura indica cuántos perímetros fueron registrados y no califica salud, belleza ni proporciones.</p><p className="mt-2 text-xs text-slate-600">Los resultados orientan seguimiento deportivo y no sustituyen diagnóstico, valoración médica ni evaluación nutricional.</p></div></div></section>;
}

function Summary({ label, value }: { label: string; value?: number }) { return <div className="min-w-20 rounded-2xl border border-white/10 bg-black/20 p-3 text-center"><b className="block text-2xl">{value ?? "—"}</b><small className="text-[9px] font-black uppercase text-slate-500">{label}</small></div>; }
function Metric({ label, value, suffix = "" }: { label: string; value?: number; suffix?: string }) { const shown = value === undefined ? "—" : `${Number.isInteger(value) ? value : Math.round(value * 100) / 100}${suffix}`; return <div className="rounded-2xl border border-white/[.07] bg-white/[.035] p-3"><span className="text-[10px] font-black uppercase text-slate-500">{label}</span><b className="mt-1 block text-xl">{shown}</b></div>; }
