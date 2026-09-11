"use client";

import { Medal, ShieldCheck, Target, Trophy } from "lucide-react";
import type { FitnessScoreReport } from "@/lib/fitness-scoring";

const tone = (score?: number) => score === undefined
  ? "border-white/10 text-slate-400"
  : score >= 90
    ? "border-fuchsia-300/30 text-fuchsia-200"
    : score >= 75
      ? "border-cyan-300/30 text-cyan-200"
      : score >= 60
        ? "border-emerald-300/30 text-emerald-200"
        : score >= 40
          ? "border-amber-300/30 text-amber-200"
          : "border-rose-300/30 text-rose-200";

const showPoints = (value?: number) => value === undefined ? "—" : Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

export function FitnessScoreOverview({ report, compact = false }: { report: FitnessScoreReport; compact?: boolean }) {
  if (!report.completed) return <section className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-5 text-center text-sm text-slate-500">Registra las cuatro pruebas para calcular el puntaje.</section>;
  const repetitions = report.exercises.map((item) => item.repetitions);
  return <section className={`overflow-hidden rounded-3xl border border-violet-300/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.16),transparent_42%),rgba(2,6,23,.72)] ${compact ? "p-4" : "p-5"}`}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-400/15 text-violet-200"><Trophy className="h-5 w-5"/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">Batería física</p><h3 className="text-lg font-black text-white">Puntaje por repeticiones</h3></div></div>
      <div className="text-right"><b className="text-4xl text-white">{showPoints(report.overall)}<small className="ml-1 text-sm text-slate-500">pts</small></b><span className="ml-3 rounded-full bg-white/[.07] px-3 py-1 text-[10px] font-black uppercase text-slate-300">{report.rankingEligible ? report.overallLabel : "Incompleta"}</span></div>
    </div>
    <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-4"}`}>
      {report.exercises.map((item) => <article key={item.key} className={`rounded-2xl border bg-black/20 p-4 ${tone(item.score)}`}><div className="flex items-start justify-between gap-3"><div><b className="text-sm text-white">{item.label}</b><p className="text-[10px] uppercase text-slate-500">Repeticiones válidas</p></div><b className="text-2xl">{item.repetitions}</b></div><div className="mt-3 rounded-xl bg-white/[.04] p-2 text-xs"><small className="block text-slate-500">Objetivo personal</small><b className="text-white">{item.target} reps</b></div>{item.change !== undefined && <p className={`mt-2 text-[10px] font-bold ${item.change >= 0 ? "text-emerald-300" : "text-amber-200"}`}>{item.change >= 0 ? "+" : ""}{item.change} frente al registro previo</p>}</article>)}
    </div>
    <div className="mt-4 border-t border-white/[.07] pt-4 text-xs">
      {report.rankingEligible ? <p className="flex flex-wrap items-center gap-2 text-slate-300"><Target className="h-4 w-4 text-cyan-300"/>({repetitions.join(" + ")}) ÷ 4 = <b className="text-white">{showPoints(report.baseAverage)}</b>{report.sexBonus > 0 && <> + bono femenino de 3 = <b className="text-violet-200">{showPoints(report.overall)} puntos</b></>}</p> : <p className="flex items-center gap-2 text-slate-400"><ShieldCheck className="h-4 w-4"/>Completa las cuatro pruebas para obtener puntaje oficial y entrar al ranking.</p>}
    </div>
    <p className="mt-3 rounded-xl bg-white/[.035] p-3 text-[10px] leading-4 text-slate-500">Fórmula oficial: se suman lagartijas, sentadillas, abdominales y burpees, y el total se divide entre cuatro. A las mujeres se les añaden 3 puntos al promedio final. Las metas personales sólo orientan el progreso y no cambian este puntaje.</p>
  </section>;
}

export function FitnessRankBadge({ rank, score }: { rank?: number; score?: number }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-200"><Medal className="h-4 w-4"/>{rank ? `#${rank}` : "Sin rango"} · {showPoints(score)} pts</span>;
}
