"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { SKILL_TREES, nextSkillStatus, type SkillDiscipline, type SkillProgress } from "@/lib/athlete-progress";
import { cn } from "@/lib/utils";

export function SkillTreeView({ discipline, progress, editable = false, saving = false, onChange }: { discipline: SkillDiscipline; progress: SkillProgress; editable?: boolean; saving?: boolean; onChange?: (next: SkillProgress) => void }) {
  const nodes = SKILL_TREES[discipline];
  const total = nodes.reduce((sum, [, skills]) => sum + skills.length, 0);
  const dominated = Object.values(progress).filter((value) => value === "dominada").length;
  return <div className="space-y-5">
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-slate-100"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-cyan-200">Progreso dominado</p><p className="text-2xl font-black">{dominated} de {total}</p></div>{saving && <Loader2 className="animate-spin" />}</div><div className="mt-3 h-2 overflow-hidden rounded bg-black/30"><div className="h-full bg-cyan-400" style={{ width: `${total ? dominated / total * 100 : 0}%` }} /></div></div>
    <div className="grid gap-4 lg:grid-cols-2">{nodes.map(([category, skills]) => <section key={category} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><h3 className="mb-3 font-black text-white">{category}</h3><div className="grid gap-2">{skills.map((skill) => { const status = progress[skill] || "pendiente"; return <button type="button" disabled={!editable || saving} key={skill} onClick={() => onChange?.({ ...progress, [skill]: nextSkillStatus(status) })} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-bold transition", status === "dominada" ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100" : status === "practicando" ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-black/20 text-slate-300", editable && "hover:border-cyan-300/60")}>{status === "dominada" ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}<span>{skill}</span><span className="ml-auto text-[10px] uppercase">{status}</span></button>})}</div></section>)}</div>
  </div>;
}
