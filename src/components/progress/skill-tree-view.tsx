"use client";

import type React from "react";
import { Check, LockKeyhole, Sparkles } from "lucide-react";
import { SKILL_TREES, nextSkillStatus, type SkillDiscipline, type SkillProgress } from "@/lib/athlete-progress";
import { cn } from "@/lib/utils";

export function SkillTreeView({ discipline, progress, editable = false, saving = false, onChange }: { discipline: SkillDiscipline; progress: SkillProgress; editable?: boolean; saving?: boolean; onChange?: (next: SkillProgress) => void }) {
  const branches = SKILL_TREES[discipline];
  const allSkills = branches.flatMap(([, skills]) => [...skills]);
  const dominated = allSkills.filter((skill) => progress[skill] === "dominada").length;
  const practicing = allSkills.filter((skill) => progress[skill] === "practicando").length;
  const percent = Math.round((dominated / allSkills.length) * 100);

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,.16),_transparent_55%)] p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.24em] text-cyan-300">Ruta técnica · {discipline}</p><h2 className="mt-1 text-2xl font-black text-white">{percent}% del árbol dominado</h2><p className="mt-1 text-sm text-slate-300">{dominated} logros obtenidos · {practicing} en práctica</p></div><div className="grid h-24 w-24 place-items-center rounded-full bg-[conic-gradient(rgb(34,211,238)_var(--progress),rgba(255,255,255,.08)_0)] p-2" style={{ "--progress": `${percent}%` } as React.CSSProperties}><div className="grid h-full w-full place-items-center rounded-full bg-slate-950 text-xl font-black">{percent}%</div></div></div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold text-slate-300"><Legend className="bg-slate-700" text="Bloqueada"/><Legend className="bg-cyan-400" text="En práctica"/><Legend className="bg-emerald-400" text="Logro dominado"/></div>
    </section>
    <div className="relative grid gap-7 xl:grid-cols-2">{branches.map(([category, skills], branchIndex) => <section key={category} className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-5"><div className="absolute bottom-10 left-9 top-20 w-px bg-gradient-to-b from-cyan-400/70 via-cyan-400/30 to-white/5" aria-hidden="true"/><div className="relative z-10 mb-5 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 font-black text-cyan-200">{branchIndex + 1}</div><div><p className="text-xs uppercase tracking-widest text-slate-400">Rama {branchIndex + 1}</p><h3 className="text-lg font-black text-white">{category}</h3></div></div><div className="relative z-10 space-y-3 pl-2">{skills.map((skill, index) => {
        const status = progress[skill] || "pendiente";
        const prerequisite = index === 0 ? null : skills[index - 1];
        const unlocked = index === 0 || progress[prerequisite!] === "dominada" || status !== "pendiente";
        const canEdit = editable && unlocked && !saving;
        return <div key={skill} className="relative flex items-center gap-3"><div className={cn("h-px w-8", unlocked ? "bg-cyan-400/60" : "bg-white/10")} aria-hidden="true"/><button type="button" disabled={!canEdit} onClick={() => onChange?.({ ...progress, [skill]: nextSkillStatus(status) })} className={cn("group flex min-h-16 flex-1 items-center gap-3 rounded-2xl border p-3 text-left transition", status === "dominada" ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-100" : status === "practicando" ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100" : unlocked ? "border-white/15 bg-white/[.04] text-slate-200" : "cursor-not-allowed border-white/5 bg-black/20 text-slate-600", canEdit && "hover:-translate-y-0.5 hover:border-cyan-300/60")}><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", status === "dominada" ? "bg-emerald-400 text-slate-950" : status === "practicando" ? "bg-cyan-400 text-slate-950" : "bg-white/[.06]")}>{status === "dominada" ? <Check className="h-5 w-5"/> : unlocked ? <Sparkles className="h-4 w-4"/> : <LockKeyhole className="h-4 w-4"/>}</span><span><b className="block">{skill}</b><small className="mt-0.5 block text-[11px] font-medium opacity-75">{status === "dominada" ? "Logro obtenido" : status === "practicando" ? "Entrenando actualmente" : unlocked ? editable ? "Disponible para evaluar" : "Habilidad disponible" : `Domina ${prerequisite} para desbloquear`}</small></span></button></div>;
      })}</div></section>)}</div>
  </div>;
}
function Legend({className,text}:{className:string;text:string}){return <span className="flex items-center gap-2"><i className={cn("h-2.5 w-2.5 rounded-full",className)}/>{text}</span>}
